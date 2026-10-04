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
      touch-action: pan-x pan-y pinch-zoom;
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
      touch-action: pan-x pan-y pinch-zoom;
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
    .canvas-wrapper {
      position: relative;
      display: inline-block;
      user-select: text !important;
      -webkit-user-select: text !important;
    }
    .textLayer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      opacity: 1;
      line-height: 1.0;
      text-size-adjust: none;
      forced-color-adjust: none;
      transform-origin: 0 0;
      z-index: 5;
      user-select: text !important;
      -webkit-user-select: text !important;
      touch-action: auto !important;
      pointer-events: auto;
    }
    .textLayer span,
    .textLayer br {
      color: transparent;
      position: absolute;
      white-space: pre;
      cursor: text;
      transform-origin: 0% 0%;
      user-select: text !important;
      -webkit-user-select: text !important;
      touch-action: auto !important;
      pointer-events: auto;
    }
    .textLayer ::selection {
      background: rgba(250, 204, 21, 0.45);
      color: transparent;
    }
    .textLayer span[data-highlighted="true"] {
      background-color: rgba(250, 204, 21, 0.45) !important;
      border-radius: 2px !important;
      box-shadow: 0 0 2px rgba(234, 179, 8, 0.6) !important;
    }
    #highlight-toolbar {
      display: none;
      position: fixed;
      z-index: 9999;
      background: #0F172A;
      color: #FFFFFF;
      border-radius: 26px;
      padding: 5px 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.25);
      align-items: center;
      gap: 4px;
      border: 1px solid rgba(255,255,255,0.18);
      transform: translate(-50%, -100%);
      transition: opacity 0.15s ease;
      user-select: none;
      -webkit-user-select: none;
    }
    .hl-btn {
      background: transparent;
      border: none;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 16px;
      cursor: pointer;
      outline: none;
      font-family: inherit;
    }
    .hl-btn:active {
      background: rgba(255,255,255,0.18);
      transform: scale(0.96);
    }
    .hl-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FACC15;
      display: inline-block;
      box-shadow: 0 0 8px #FACC15;
    }
    .hl-divider {
      width: 1px;
      height: 16px;
      background: rgba(255,255,255,0.2);
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
      <div class="canvas-wrapper" id="canvas-wrapper">
        <canvas id="pdf-canvas"></canvas>
        <div id="text-layer" class="textLayer"></div>
      </div>
    </div>
  </div>

  <div id="highlight-toolbar">
    <button id="btn-highlight" class="hl-btn" title="Resaltar">
      <span class="hl-dot"></span>
      <span>Resaltar</span>
    </button>
    <div class="hl-divider"></div>
    <button id="btn-copy" class="hl-btn" title="Copiar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      <span>Copiar</span>
    </button>
    <div class="hl-divider"></div>
    <button id="btn-share" class="hl-btn" title="Compartir">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
      <span>Compartir</span>
    </button>
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
      var pageHighlightsCache = {};

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

          // Extract readable text of current page for TTS and render textLayer
          var currPageObj = null;
          var textContent = null;
          try {
            currPageObj = await pdfDoc.getPage(pageNum);
            textContent = await currPageObj.getTextContent();
            var pageText = textContent.items.map(function(item) { return item.str; }).join(' ');
            sendToRN("PAGE_TEXT_EXTRACTED", { page: pageNum, text: pageText });
          } catch(e) {}

          // Render interactive textLayer for text selection & fluorescent highlighting
          try {
            var textLayer = document.getElementById('text-layer');
            if (textLayer && currPageObj && textContent) {
              textLayer.innerHTML = '';
              if (mainCanvas) {
                textLayer.style.width = mainCanvas.style.width;
                textLayer.style.height = mainCanvas.style.height;
              }

              var containerWidth = window.innerWidth * 0.98;
              var containerHeight = window.innerHeight * 0.86;
              var unscaledViewport = currPageObj.getViewport({ scale: 1.0 });
              var scaleX = containerWidth / unscaledViewport.width;
              var scaleY = containerHeight / unscaledViewport.height;
              var baseScale = Math.min(scaleX, scaleY);
              var textViewport = currPageObj.getViewport({ scale: baseScale });

              textLayer.style.setProperty('--scale-factor', textViewport.scale);

              var textLayerTask = pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayer,
                viewport: textViewport,
                textDivs: []
              });
              await textLayerTask.promise;

              if (pageHighlightsCache[pageNum]) {
                applySavedHighlights(pageHighlightsCache[pageNum]);
              }
            }
          } catch(eText) {
            console.warn("Error rendering textLayer:", eText);
          }

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
          var maxP = Math.min(totalPages, 300);
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
      var touchStartTime = 0;

      document.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
          isPinching = true;
          initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
          initialScale = currentScale;
        } else if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();
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
          // If the touch was inside the toolbar or near it, do not toggle bars or dismiss toolbar
          var tbCheck = document.getElementById('highlight-toolbar');
          if (tbCheck && tbCheck.style.display !== 'none' && e.changedTouches[0]) {
            var tx = e.changedTouches[0].clientX;
            var ty = e.changedTouches[0].clientY;
            var tbRect = tbCheck.getBoundingClientRect();
            if (tx >= tbRect.left - 15 && tx <= tbRect.right + 15 && ty >= tbRect.top - 15 && ty <= tbRect.bottom + 15) {
              return;
            }
          }

          var activeSel = window.getSelection();
          var selectedStr = activeSel ? activeSel.toString().trim() : '';
          if (selectedStr.length > 0) {
            updateSelectionToolbar();
            return;
          } else if (activeSelectedText) {
            // Keep toolbar visible if active selection was captured
            return;
          } else {
            hideSelectionToolbar();
          }

          var now = Date.now();
          var touchDuration = now - touchStartTime;
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
            if (Math.abs(diffX) < 12 && Math.abs(diffY) < 12 && touchDuration < 300) {
              singleTapTimeout = setTimeout(function() {
                sendToRN("TOGGLE_BARS", {});
              }, 220);
            } else if (touchDuration < 400 && currentScale <= 1.05 && Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
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

      var activeSelectedText = '';
      var activeSelectedRange = null;

      function updateSelectionToolbar() {
        var sel = window.getSelection();
        var txt = sel ? sel.toString().trim() : '';
        var toolbar = document.getElementById('highlight-toolbar');
        if (!toolbar) return;

        if (txt && txt.length > 0 && sel.rangeCount > 0) {
          try {
            activeSelectedText = txt;
            activeSelectedRange = sel.getRangeAt(0).cloneRange();
            var rect = activeSelectedRange.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
              var topPos = rect.top - 46;
              if (topPos < 50) {
                topPos = rect.bottom + 14;
              }
              var leftPos = rect.left + (rect.width / 2);
              leftPos = Math.max(75, Math.min(window.innerWidth - 75, leftPos));
              toolbar.style.top = topPos + 'px';
              toolbar.style.left = leftPos + 'px';
              toolbar.style.display = 'flex';
              return;
            }
          } catch(e) {}
        }
      }

      function hideSelectionToolbar() {
        activeSelectedText = '';
        activeSelectedRange = null;
        var toolbar = document.getElementById('highlight-toolbar');
        if (toolbar) toolbar.style.display = 'none';
      }

      document.addEventListener('selectionchange', function() {
        updateSelectionToolbar();
      });

      function highlightSelectionInTextLayer(color) {
        try {
          var sel = window.getSelection();
          var range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : activeSelectedRange;
          var textLayer = document.getElementById('text-layer');
          if (!textLayer) return;

          var spans = textLayer.querySelectorAll('span');
          spans.forEach(function(span) {
            var matched = false;
            try {
              if (sel && sel.containsNode && sel.containsNode(span, true)) {
                matched = true;
              }
            } catch(e1) {}
            if (!matched && range) {
              try {
                if (range.intersectsNode && range.intersectsNode(span)) {
                  matched = true;
                }
              } catch(e2) {}
            }
            if (matched) {
              span.style.backgroundColor = 'rgba(250, 204, 21, 0.45)';
              span.style.borderRadius = '2px';
              span.setAttribute('data-highlighted', 'true');
            }
          });
        } catch(e) {
          console.warn('Error highlighting selection:', e);
        }
      }

      function applySavedHighlights(highlights) {
        if (!highlights || !highlights.length) return;
        var textLayer = document.getElementById('text-layer');
        if (!textLayer) return;

        var spans = textLayer.querySelectorAll('span');
        if (!spans.length) return;

        highlights.forEach(function(h) {
          if (!h.text || h.text.trim().length < 2) return;
          var target = h.text.trim().toLowerCase();
          var color = h.color || '#FACC15';
          var bg = color === '#FACC15' ? 'rgba(250, 204, 21, 0.45)' : (color + '66');

          spans.forEach(function(span) {
            var spanTxt = (span.textContent || '').trim().toLowerCase();
            if (spanTxt.length > 2 && (target.indexOf(spanTxt) !== -1 || spanTxt.indexOf(target) !== -1)) {
              span.style.backgroundColor = bg;
              span.style.borderRadius = '2px';
              span.setAttribute('data-highlighted', 'true');
            }
          });
        });
      }

      function applyHighlight() {
        var sel = window.getSelection();
        var txt = (sel ? sel.toString().trim() : '') || activeSelectedText;
        if (txt && txt.length > 0) {
          highlightSelectionInTextLayer('#FACC15');
          pageHighlightsCache[currentPage] = pageHighlightsCache[currentPage] || [];
          pageHighlightsCache[currentPage].push({ text: txt, color: '#FACC15' });

          sendToRN('HIGHLIGHT_CREATED', {
            text: txt,
            page: currentPage,
            color: '#FACC15'
          });
          if (sel && sel.removeAllRanges) sel.removeAllRanges();
          hideSelectionToolbar();
        }
      }

      function copySelection() {
        var sel = window.getSelection();
        var txt = (sel ? sel.toString().trim() : '') || activeSelectedText;
        if (txt && txt.length > 0) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(txt);
            }
          } catch(e) {}
          sendToRN('COPY_TO_CLIPBOARD', { text: txt });
          if (sel && sel.removeAllRanges) sel.removeAllRanges();
          hideSelectionToolbar();
        }
      }

      function shareSelection() {
        var sel = window.getSelection();
        var txt = (sel ? sel.toString().trim() : '') || activeSelectedText;
        if (txt && txt.length > 0) {
          // Highlight it first so it appears shaded in the page capture!
          highlightSelectionInTextLayer('#FACC15');
          pageHighlightsCache[currentPage] = pageHighlightsCache[currentPage] || [];
          pageHighlightsCache[currentPage].push({ text: txt, color: '#FACC15' });
          sendToRN('HIGHLIGHT_CREATED', {
            text: txt,
            page: currentPage,
            color: '#FACC15'
          });

          sendToRN('SHARE_SELECTION', { text: txt, page: currentPage });
          if (sel && sel.removeAllRanges) sel.removeAllRanges();
          hideSelectionToolbar();

          // Also trigger page capture so the user can share the full page image with the quote
          setTimeout(function() {
            capturePdfPage();
          }, 150);
        }
      }

      function capturePdfPage() {
        var canvas = document.getElementById('pdf-canvas');
        if (!canvas) {
          sendToRN('PAGE_IMAGE_ERROR', { error: 'Lienzo no encontrado' });
          return;
        }
        try {
          var exportCanvas = document.createElement('canvas');
          exportCanvas.width = canvas.width;
          exportCanvas.height = canvas.height;
          var ctx = exportCanvas.getContext('2d');

          // 1. Draw page paper background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

          // 2. Draw high resolution rendered PDF page
          ctx.drawImage(canvas, 0, 0);

          // 3. Draw highlighted text overlays directly onto the exported image
          var textLayer = document.getElementById('text-layer');
          if (textLayer) {
            var wrapper = document.getElementById('canvas-wrapper');
            var wrapRect = wrapper ? wrapper.getBoundingClientRect() : null;
            if (wrapRect && wrapRect.width > 0 && wrapRect.height > 0) {
              var scaleX = canvas.width / wrapRect.width;
              var scaleY = canvas.height / wrapRect.height;

              var highlightedSpans = textLayer.querySelectorAll('span[data-highlighted="true"]');
              ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
              highlightedSpans.forEach(function(sp) {
                var r = sp.getBoundingClientRect();
                var x = (r.left - wrapRect.left) * scaleX;
                var y = (r.top - wrapRect.top) * scaleY;
                var w = r.width * scaleX;
                var h = r.height * scaleY;
                ctx.fillRect(x, y, w, h);
              });
            }
          }

          var dataUrl = exportCanvas.toDataURL('image/jpeg', 0.95);
          sendToRN('PAGE_IMAGE_CAPTURED', {
            dataUrl: dataUrl,
            page: currentPage,
            totalPages: totalPages
          });
        } catch(err) {
          console.error('Error al capturar imagen de página PDF:', err);
          sendToRN('PAGE_IMAGE_ERROR', { error: err.message || 'Error al procesar imagen' });
        }
      }

      var tbToolbar = document.getElementById('highlight-toolbar');
      if (tbToolbar) {
        tbToolbar.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: false });
        tbToolbar.addEventListener('touchend', function(e) { e.stopPropagation(); }, { passive: false });
        tbToolbar.addEventListener('pointerdown', function(e) { e.stopPropagation(); });
        tbToolbar.addEventListener('mousedown', function(e) { e.stopPropagation(); });
      }

      var btnHl = document.getElementById('btn-highlight');
      if (btnHl) {
        var onHl = function(e) {
          e.preventDefault();
          e.stopPropagation();
          applyHighlight();
        };
        btnHl.addEventListener('touchend', onHl);
        btnHl.addEventListener('click', onHl);
        btnHl.addEventListener('pointerdown', onHl);
      }

      var btnCp = document.getElementById('btn-copy');
      if (btnCp) {
        var onCp = function(e) {
          e.preventDefault();
          e.stopPropagation();
          copySelection();
        };
        btnCp.addEventListener('touchend', onCp);
        btnCp.addEventListener('click', onCp);
        btnCp.addEventListener('pointerdown', onCp);
      }

      var btnSh = document.getElementById('btn-share');
      if (btnSh) {
        var onSh = function(e) {
          e.preventDefault();
          e.stopPropagation();
          shareSelection();
        };
        btnSh.addEventListener('touchend', onSh);
        btnSh.addEventListener('click', onSh);
        btnSh.addEventListener('pointerdown', onSh);
      }

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
          } else if (data.type === 'LOAD_PAGE_HIGHLIGHTS') {
            if (data.payload && data.payload.page !== undefined) {
              pageHighlightsCache[data.payload.page] = data.payload.highlights || [];
              if (currentPage === data.payload.page) {
                applySavedHighlights(data.payload.highlights);
              }
            }
          } else if (data.type === 'CAPTURE_PAGE_IMAGE') {
            capturePdfPage();
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
