import { ReadingSettings } from '../types/book';
import { getThemeColors } from './EpubReaderHTML';
import { PDF_JS_CODE } from './libs/pdfjsBundled';
import { PDF_WORKER_JS_CODE } from './libs/pdfjsWorkerBundled';

export function getPdfReaderHTML(
  pdfUriOrBase64: string,
  initialPageStr: string | undefined,
  settings: ReadingSettings,
  onlyFirstPageMode: boolean = false,
  isBase64Explicit?: boolean
): string {
  const colors = getThemeColors(settings.themeMode);
  const rawData = JSON.stringify(pdfUriOrBase64);
  const initialPage = parseInt(initialPageStr || '1', 10) || 1;
  const isBase64 = isBase64Explicit !== undefined
    ? isBase64Explicit
    : (
        pdfUriOrBase64.startsWith('data:') ||
        pdfUriOrBase64.startsWith('JVBERi') ||
        (!pdfUriOrBase64.startsWith('file://') &&
         !pdfUriOrBase64.startsWith('content://') &&
         !pdfUriOrBase64.startsWith('http://') &&
         !pdfUriOrBase64.startsWith('https://') &&
         !pdfUriOrBase64.startsWith('/'))
      );

  const getCanvasFilter = () => {
    if (settings.themeMode === 'dark' || settings.themeMode === 'oled') {
      return 'invert(0.92) hue-rotate(180deg) contrast(1.2) brightness(0.95)';
    }
    if (settings.themeMode === 'sepia') {
      return 'sepia(0.35) contrast(1.08) brightness(0.96)';
    }
    return 'contrast(1.05) brightness(0.98)';
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>PDF Reader - Ultra HD Retina</title>
  <script>${PDF_JS_CODE}</script>
  <script>${PDF_WORKER_JS_CODE}</script>
  <script>
    if (typeof pdfjsLib === 'undefined' && typeof window.pdfjsLib === 'undefined') {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\\/script>');
    }
  </script>
  <style>
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: ${colors.bg};
      color: ${colors.text};
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    #reader-viewport {
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
      padding-bottom: 20px;
    }
    .canvas-card {
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      border-radius: 6px;
      overflow: hidden;
      background-color: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      transform-origin: center center;
      will-change: transform;
      visibility: hidden;
    }
    canvas {
      display: block;
      max-width: 98vw;
      max-height: 88vh;
      object-fit: contain;
      filter: ${getCanvasFilter()};
      -webkit-filter: ${getCanvasFilter()};
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 14px;
      font-weight: 600;
      color: ${colors.text};
      opacity: 0.9;
      text-align: center;
      background-color: ${colors.bg}E6;
      padding: 12px 22px;
      border-radius: 20px;
      pointer-events: none;
      z-index: 10;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }
    #error-box {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 20px;
      text-align: center;
      color: #E53E3E;
      font-weight: 700;
      background-color: ${colors.bg};
      border-radius: 12px;
      z-index: 15;
    }
  </style>
</head>
<body>
  <div id="loading">Cargando PDF...</div>
  <div id="error-box"></div>

  <div id="reader-viewport">
    <div class="canvas-card" id="card-container">
      <canvas id="pdf-canvas"></canvas>
    </div>
  </div>

  <script>
    (function() {
      if (window.pdfjsLib && typeof window.pdfjsWorker === 'undefined') {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      var pdfDoc = null;
      var totalPages = 0;
      var currentPage = ${initialPage};
      var pdfSource = ${rawData};
      var isBase64 = ${isBase64 ? 'true' : 'false'};
      var onlyFirstPage = ${onlyFirstPageMode ? 'true' : 'false'};
      var isRendering = false;

      var pageCanvasCache = {};

      // Persistent Zoom & Pan State
      var currentScale = 1.0;
      var initialScale = 1.0;
      var initialPinchDistance = 0;
      var panX = 0;
      var panY = 0;
      var startPanX = 0;
      var startPanY = 0;
      var isPinching = false;
      var lastTapTime = 0;

      function sendToRN(type, payload) {
        var msg = JSON.stringify({ type: type, payload: payload });
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        } else {
          var retries = 0;
          var t = setInterval(function() {
            retries++;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              clearInterval(t);
              window.ReactNativeWebView.postMessage(msg);
            } else if (retries > 40) {
              clearInterval(t);
            }
          }, 50);
        }
      }

      window.repickFile = function() {
        sendToRN('REPICK_FILE', {});
      };

      function base64ToUint8Array(base64) {
        if (!base64) return new Uint8Array(0);
        try {
          var str = base64.replace(/^data:[^;]+;base64,/, '').replace(/[^A-Za-z0-9+/=_-]/g, '');
          str = str.replace(/-/g, '+').replace(/_/g, '/');
          while (str.length % 4 !== 0) {
            str += '=';
          }

          var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          var lookup = new Uint8Array(256);
          for (var i = 0; i < chars.length; i++) {
            lookup[chars.charCodeAt(i)] = i;
          }

          var len = str.length;
          var placeHolders = str.charAt(len - 1) === '=' ? (str.charAt(len - 2) === '=' ? 2 : 1) : 0;
          var bytes = new Uint8Array(Math.max(0, (len * 3 / 4) - placeHolders));

          var j = 0;
          for (var i = 0; i < len; i += 4) {
            var a = lookup[str.charCodeAt(i)];
            var b = lookup[str.charCodeAt(i + 1)];
            var c = lookup[str.charCodeAt(i + 2)];
            var d = lookup[str.charCodeAt(i + 3)];

            bytes[j++] = (a << 2) | (b >> 4);
            if (str.charAt(i + 2) !== '=') {
              bytes[j++] = ((b & 15) << 4) | (c >> 2);
            }
            if (str.charAt(i + 3) !== '=') {
              bytes[j++] = ((c & 3) << 6) | (d & 63);
            }
          }
          return bytes;
        } catch (e) {
          try {
            var clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
            var raw = window.atob(clean);
            var rawLength = raw.length;
            var array = new Uint8Array(new ArrayBuffer(rawLength));
            for (var k = 0; k < rawLength; k++) {
              array[k] = raw.charCodeAt(k);
            }
            return array;
          } catch (e2) {
            console.error("Error decodificando Base64 PDF:", e2);
            return new Uint8Array(0);
          }
        }
      }

      function updateTransform() {
        var card = document.getElementById('card-container');
        if (card) {
          card.style.transform = 'scale(' + currentScale + ') translate(' + panX + 'px, ' + panY + 'px)';
        }
      }

      function resetZoom() {
        currentScale = 1.0;
        initialScale = 1.0;
        panX = 0;
        panY = 0;
        updateTransform();
      }

      async function renderPageToCanvas(pageNum) {
        if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return null;
        
        if (pageCanvasCache[pageNum]) {
          return pageCanvasCache[pageNum];
        }

        var page = await pdfDoc.getPage(pageNum);
        var offCanvas = document.createElement('canvas');
        var context = offCanvas.getContext('2d');

        var dpr = Math.max(window.devicePixelRatio || 2.0, 2.5);

        var containerWidth = window.innerWidth * 0.98;
        var containerHeight = window.innerHeight * 0.86;

        var unscaledViewport = page.getViewport({ scale: 1.0 });
        var scaleX = containerWidth / unscaledViewport.width;
        var scaleY = containerHeight / unscaledViewport.height;
        var baseScale = Math.min(scaleX, scaleY);

        var viewport = page.getViewport({ scale: baseScale * dpr });

        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        offCanvas.style.width = Math.floor(viewport.width / dpr) + 'px';
        offCanvas.style.height = Math.floor(viewport.height / dpr) + 'px';

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        pageCanvasCache[pageNum] = offCanvas;
        return offCanvas;
      }

      // CORRECCIÓN DE ERRORES:
      // Cola de páginas pendientes de renderizado (pendingPageToRender).
      // Al arrastrar rápido el marcador en PDF, si una página estaba renderizándose (isRendering = true),
      // los nuevos saltos se descartaban. Con esta cola, al terminar el renderizado actual se dibuja
      // automáticamente la última página solicitada por el usuario.
      var pendingPageToRender = null;

      async function renderPage(pageNum) {
        if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;
        if (isRendering) {
          pendingPageToRender = pageNum;
          return;
        }
        isRendering = true;
        currentPage = pageNum;
        resetZoom();

        try {
          var mainCanvas = document.getElementById('pdf-canvas');
          var mainContext = mainCanvas ? mainCanvas.getContext('2d') : null;

          if (pageCanvasCache[pageNum]) {
            var cached = pageCanvasCache[pageNum];
            if (mainCanvas && mainContext) {
              mainCanvas.width = cached.width;
              mainCanvas.height = cached.height;
              mainCanvas.style.width = cached.style.width;
              mainCanvas.style.height = cached.style.height;

              mainContext.imageSmoothingEnabled = true;
              mainContext.imageSmoothingQuality = 'high';
              mainContext.drawImage(cached, 0, 0);
            }
            var card = document.getElementById('card-container');
            if (card) {
              card.style.backgroundColor = '#FFFFFF';
              card.style.visibility = 'visible';
            }
            var loadEl = document.getElementById('loading');
            if (loadEl) loadEl.style.display = 'none';
          } else {
            var loadEl = document.getElementById('loading');
            if (loadEl) loadEl.style.display = 'block';
            var rendered = await renderPageToCanvas(pageNum);
            if (rendered && mainCanvas && mainContext) {
              mainCanvas.width = rendered.width;
              mainCanvas.height = rendered.height;
              mainCanvas.style.width = rendered.style.width;
              mainCanvas.style.height = rendered.style.height;

              mainContext.imageSmoothingEnabled = true;
              mainContext.imageSmoothingQuality = 'high';
              mainContext.drawImage(rendered, 0, 0);
              var card = document.getElementById('card-container');
              if (card) {
                card.style.backgroundColor = '#FFFFFF';
                card.style.visibility = 'visible';
              }
            }
            var loadEl = document.getElementById('loading');
            if (loadEl) loadEl.style.display = 'none';
          }

          // Extract readable text of current page for TTS
          try {
            var currPageObj = await pdfDoc.getPage(pageNum);
            var textContent = await currPageObj.getTextContent();
            var pageText = textContent.items.map(function(item) { return item.str; }).join(' ');
            sendToRN("PAGE_TEXT_EXTRACTED", { page: pageNum, text: pageText });
          } catch(e) {}

          var progress = Math.min(100, Math.max(0, Math.round((pageNum / totalPages) * 100)));
          sendToRN("PROGRESS_UPDATE", {
            progress: progress,
            page: pageNum,
            totalPages: totalPages,
            chapter: "Página " + pageNum + " de " + totalPages
          });

          if (pageNum === 1 && mainCanvas) {
            try {
              var coverDataUrl = mainCanvas.toDataURL('image/jpeg', 0.75);
              sendToRN("COVER_GENERATED", { coverPath: coverDataUrl });
            } catch(e) {}
          }

          // Pre-render next page in background
          if (pageNum < totalPages && !pageCanvasCache[pageNum + 1]) {
            setTimeout(function() {
              renderPageToCanvas(pageNum + 1);
            }, 50);
          }
        } catch(err) {
        } finally {
          isRendering = false;
          if (pendingPageToRender !== null && pendingPageToRender !== pageNum) {
            var nextP = pendingPageToRender;
            pendingPageToRender = null;
            renderPage(nextP);
          }
        }
      }

      function nextPage() {
        if (currentPage < totalPages && !isRendering) {
          renderPage(currentPage + 1);
        }
      }

      function prevPage() {
        if (currentPage > 1 && !isRendering) {
          renderPage(currentPage - 1);
        }
      }

      async function extractAllText() {
        if (!pdfDoc) return;
        try {
          var fullText = "";
          var maxP = Math.min(totalPages, 40);
          for (var i = 1; i <= maxP; i++) {
            var pObj = await pdfDoc.getPage(i);
            var tObj = await pObj.getTextContent();
            var tStr = tObj.items.map(function(item) { return item.str; }).join(' ');
            if (tStr.trim().length > 0) {
              fullText += "Página " + i + ". " + tStr + "\\n\\n";
            }
          }
          sendToRN("FULL_PDF_TEXT", { text: fullText });
        } catch(e) {}
      }

      async function loadPDF() {
        try {
          if (!pdfSource || pdfSource === '""' || pdfSource.trim().length === 0) {
            var loadEl = document.getElementById('loading');
            if (loadEl) loadEl.style.display = 'none';
            var errBox = document.getElementById('error-box');
            if (errBox) {
              errBox.style.display = 'block';
              errBox.innerHTML = "<div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #EF4444;'>⚠️ Archivo no disponible</div><div style='font-size: 14px; opacity: 0.85; line-height: 1.5; color: inherit;'>El archivo de este libro no se encuentra o está incompleto en el dispositivo.<br><br>Pulsa el botón para buscarlo y vincularlo de nuevo.</div><button id='repick-btn' onclick='window.repickFile()' style='margin-top: 18px; padding: 12px 22px; background: #6366F1; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.4);'>Re-seleccionar archivo</button>";
            }
            return;
          }

          var loadEl = document.getElementById('loading');
          if (loadEl) {
            loadEl.innerText = "Procesando PDF...";
            loadEl.style.display = 'block';
          }

          var actualIsBase64 = isBase64 ||
            pdfSource.indexOf('data:') === 0 ||
            pdfSource.indexOf('JVBERi') === 0 ||
            (!pdfSource.startsWith('file://') &&
             !pdfSource.startsWith('content://') &&
             !pdfSource.startsWith('http://') &&
             !pdfSource.startsWith('https://') &&
             !pdfSource.startsWith('/'));

          var loadingTask;
          if (actualIsBase64) {
            var pdfData = base64ToUint8Array(pdfSource);
            loadingTask = pdfjsLib.getDocument({
              data: pdfData,
              cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
              cMapPacked: true,
              disableWorker: true
            });
          } else {
            loadingTask = pdfjsLib.getDocument({
              url: pdfSource,
              cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
              cMapPacked: true,
              disableWorker: true
            });
          }
          
          pdfDoc = await loadingTask.promise;
          totalPages = pdfDoc.numPages;

          if (onlyFirstPage) {
            renderPage(1);
            return;
          }

          var startP = Math.min(totalPages, Math.max(1, currentPage));
          renderPage(startP);

          if (!onlyFirstPage) {
            setTimeout(function() {
              extractAllText();
            }, 1200);
          }

        } catch (err) {
          var loadEl = document.getElementById('loading');
          if (loadEl) loadEl.style.display = 'none';
          var errBox = document.getElementById('error-box');
          if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = "<div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #EF4444;'>⚠️ Error cargando documento</div><div style='font-size: 14px; opacity: 0.85; line-height: 1.5; color: inherit;'>No se pudo procesar el archivo PDF.<br><br>Pulsa el botón para re-vincularlo.</div><button id='repick-btn' onclick='window.repickFile()' style='margin-top: 18px; padding: 12px 22px; background: #6366F1; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.4);'>Re-seleccionar archivo</button>";
          }
        }
      }

      function getDistance(t1, t2) {
        var dx = t1.clientX - t2.clientX;
        var dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      var touchStartX = 0;
      var touchStartY = 0;

      document.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
          isPinching = true;
          initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
          initialScale = currentScale;
        } else if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          startPanX = panX;
          startPanY = panY;
        }
      }, false);

      document.addEventListener('touchmove', function(e) {
        if (e.touches.length === 2 && initialPinchDistance > 0) {
          var newDist = getDistance(e.touches[0], e.touches[1]);
          var factor = newDist / initialPinchDistance;
          currentScale = Math.min(5.0, Math.max(1.0, initialScale * factor));
          updateTransform();
        } else if (e.touches.length === 1 && currentScale > 1.05 && !isPinching) {
          var deltaX = e.touches[0].clientX - touchStartX;
          var deltaY = e.touches[0].clientY - touchStartY;
          panX = startPanX + (deltaX / currentScale);
          panY = startPanY + (deltaY / currentScale);
          updateTransform();
        }
      }, false);

      var singleTapTimeout = null;

      document.addEventListener('touchend', function(e) {
        if (e.touches.length === 0) {
          isPinching = false;
          initialPinchDistance = 0;
          initialScale = currentScale;
        }

        // Tap & Swipe handler
        if (e.changedTouches.length === 1 && !isPinching) {
          var now = Date.now();
          var touchEndX = e.changedTouches[0].clientX;
          var touchEndY = e.changedTouches[0].clientY;
          var diffX = touchEndX - touchStartX;
          var diffY = touchEndY - touchStartY;

          if (now - lastTapTime < 280) {
            // Double tap -> Zoom toggle
            if (singleTapTimeout) clearTimeout(singleTapTimeout);
            if (currentScale > 1.1) {
              resetZoom();
            } else {
              currentScale = 2.0;
              updateTransform();
            }
          } else {
            // Single tap check vs Swipe check
            if (Math.abs(diffX) < 12 && Math.abs(diffY) < 12) {
              singleTapTimeout = setTimeout(function() {
                sendToRN("TOGGLE_BARS", {});
              }, 220);
            } else if (currentScale <= 1.05 && Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
              if (diffX < 0) {
                nextPage();
              } else {
                prevPage();
              }
            }
          }
          lastTapTime = now;
        }
      }, false);

      var streamedPdfChunks = [];
      function handleMessage(event) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data) return;
          if (data.type === 'START_BOOK_STREAM') {
            streamedPdfChunks = [];
          } else if (data.type === 'BOOK_CHUNK') {
            if (data.payload && data.payload.chunk) {
              streamedPdfChunks.push(data.payload.chunk);
            }
          } else if (data.type === 'END_BOOK_STREAM') {
            pdfSource = streamedPdfChunks.join('');
            streamedPdfChunks = [];
            isBase64 = true;
            loadPDF();
          } else if (data.type === 'LOAD_BOOK_DATA') {
            if (data.payload && data.payload.base64) {
              pdfSource = data.payload.base64;
              isBase64 = true;
              loadPDF();
            }
          } else if (data.type === 'NEXT_PAGE') {
            nextPage();
          } else if (data.type === 'PREV_PAGE') {
            prevPage();
          } else if (data.type === 'SEEK_PERCENT') {
            if (pdfDoc && pdfDoc.numPages > 0) {
              var targetPage = Math.max(1, Math.min(pdfDoc.numPages, Math.round((data.payload.percent / 100) * pdfDoc.numPages)));
              renderPage(targetPage);
            }
          } else if (data.type === 'UPDATE_SETTINGS') {
            var s = data.payload;
            if (s.themeMode) {
              var bg = '#FFFFFF', txt = '#111111';
              if (s.themeMode === 'sepia') { bg = '#F8F1E3'; txt = '#433422'; }
              else if (s.themeMode === 'dark') { bg = '#1E1E2E'; txt = '#CDD6F4'; }
              else if (s.themeMode === 'oled') { bg = '#000000'; txt = '#E0E0E0'; }
              document.body.style.backgroundColor = bg;
              document.body.style.color = txt;
            }
          }
        } catch(e) {}
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);

      sendToRN('INIT_READY', { format: 'PDF' });

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadPDF);
      } else {
        loadPDF();
      }
    })();
  </script>
</body>
</html>
  `;
}
