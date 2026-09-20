import { ReadingSettings } from '../types/book';
import { JSZIP_CODE } from './libs/jszipBundled';
import { EPUB_JS_CODE } from './libs/epubjsBundled';
import { HTML2CANVAS_CODE } from './libs/html2canvasBundled';

export function getThemeColors(themeMode: string) {
  switch (themeMode) {
    case 'sepia':
      return { bg: '#F8F1E3', text: '#433422', link: '#8B4513' };
    case 'dark':
      return { bg: '#1E1E2E', text: '#CDD6F4', link: '#89B4FA' };
    case 'oled':
      return { bg: '#000000', text: '#E0E0E0', link: '#89B4FA' };
    default:
      return { bg: '#FFFFFF', text: '#111111', link: '#3182CE' };
  }
}

export function getEpubReaderHTML(
  fileUriOrBase64: string,
  isBase64: boolean,
  initialCfi: string | undefined,
  settings: ReadingSettings,
  progressPercentage: number = 0
): string {
  const colors = getThemeColors(settings.themeMode);
  const rawData = JSON.stringify(fileUriOrBase64);
  const initialLoc = JSON.stringify(initialCfi || '1');
  const savedProgressPct = progressPercentage || 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>EPUB Reader - HD Page Flip</title>
  <script>${JSZIP_CODE}</script>
  <script>${EPUB_JS_CODE}</script>
  <script>${HTML2CANVAS_CODE}</script>
  <script>
    if (typeof JSZip === 'undefined') {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"><\\/script>');
    }
    if (typeof ePub === 'undefined') {
      document.write('<script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"><\\/script>');
    }
    if (typeof html2canvas === 'undefined') {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\\/script>');
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
      font-family: ${settings.fontFamily || 'Serif'}, Georgia, serif;
    }
    #reader-viewport {
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    #epub-viewer {
      width: 98vw;
      height: 92vh;
      transform-origin: center center;
      will-change: transform;
      background-color: ${colors.bg};
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
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 15px;
      font-weight: 600;
      color: ${colors.text};
      opacity: 0.8;
      text-align: center;
      background-color: ${colors.bg}E6;
      padding: 12px 20px;
      border-radius: 20px;
      z-index: 10;
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
    }
  </style>
</head>
<body>
  <div id="loading">Cargando e-Book EPUB...</div>
  <div id="error-box"></div>

  <div id="reader-viewport">
    <div id="epub-viewer"></div>
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
      var book = null;
      var rendition = null;
      var fileData = ${rawData};
      var isB64 = ${isBase64 ? 'true' : 'false'};
      var savedLocation = ${initialLoc};
      var savedProgressPct = ${savedProgressPct};

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

      function base64ToArrayBuffer(base64) {
        if (!base64) return new ArrayBuffer(0);
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
          return bytes.buffer;
        } catch (e) {
          try {
            var clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
            var binaryString = window.atob(clean);
            var len = binaryString.length;
            var bytes = new Uint8Array(len);
            for (var k = 0; k < len; k++) {
              bytes[k] = binaryString.charCodeAt(k);
            }
            return bytes.buffer;
          } catch (e2) {
            console.error("Error decodificando Base64 EPUB:", e2);
            return new ArrayBuffer(0);
          }
        }
      }

      var currentPageNum = 1;
      var totalPagesCount = 100;
      var currentCfiRange = null;
      var currentSelectedText = '';
      var epubHighlightsCache = [];

      function hideSelectionToolbar() {
        var tb = document.getElementById('highlight-toolbar');
        if (tb) tb.style.display = 'none';
      }

      function updateEpubSelectionToolbar(sel, doc) {
        var txt = sel ? sel.toString().trim() : '';
        var tb = document.getElementById('highlight-toolbar');
        if (!tb) return;
        if (txt && txt.length > 0 && sel.rangeCount > 0) {
          try {
            currentSelectedText = txt;
            var range = sel.getRangeAt(0);
            var rect = range.getBoundingClientRect();
            var iframe = document.querySelector('iframe');
            var ifRect = iframe ? iframe.getBoundingClientRect() : { top: 0, left: 0 };

            var top = ifRect.top + rect.top - 46;
            if (top < 50) {
              top = ifRect.top + rect.bottom + 14;
            }
            var left = ifRect.left + rect.left + (rect.width / 2);
            left = Math.max(80, Math.min(window.innerWidth - 80, left));

            tb.style.top = top + 'px';
            tb.style.left = left + 'px';
            tb.style.display = 'flex';
            return;
          } catch(e) {}
        }
        hideSelectionToolbar();
      }

      function applyStyles() {
        if (!rendition) return;
        rendition.themes.default({
          'body': {
            'background-color': '${colors.bg} !important',
            'color': '${colors.text} !important',
            'font-family': '${settings.fontFamily || 'Serif'}, Georgia, serif !important',
            'font-size': '${settings.fontSize || 18}px !important',
            'line-height': '${settings.lineHeight || 1.6} !important',
            'padding': '10px ${settings.marginSize || 16}px !important'
          },
          'p': {
            'color': '${colors.text} !important',
            'font-size': '${settings.fontSize || 18}px !important',
            'line-height': '${settings.lineHeight || 1.6} !important'
          },
          'h1, h2, h3, h4, h5, h6': {
            'color': '${colors.text} !important'
          }
        });
      }

      async function generateEpubCover() {
        if (!book) return;
        try {
          var coverUrl = await book.coverUrl();
          if (coverUrl) {
            var img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = function() {
              var canvas = document.createElement("canvas");
              canvas.width = img.width || 300;
              canvas.height = img.height || 420;
              var ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              var dataUrl = canvas.toDataURL("image/jpeg", 0.8);
              sendToRN("COVER_GENERATED", { coverPath: dataUrl });
            };
            img.src = coverUrl;
          } else {
            sendToRN("NO_COVER_AVAILABLE", {});
          }
        } catch(e) {
          console.warn("Error generando portada EPUB:", e);
          sendToRN("NO_COVER_AVAILABLE", {});
        }
      }

      async function extractAllEpubText() {
        if (!book) return;
        try {
          await book.ready;
          var fullText = "";
          var spineItems = book.spine ? book.spine.items : [];

          for (var i = 0; i < spineItems.length; i++) {
            var item = spineItems[i];
            if (item && item.load) {
              try {
                var doc = await item.load(book.load.bind(book));
                if (doc && doc.body) {
                  var rawText = doc.body.innerText || doc.body.textContent || "";
                  var cleanText = rawText.replace(/\s+/g, ' ').trim();
                  if (cleanText.length > 10) {
                    fullText += cleanText + "\\n\\n";
                  }
                }
              } catch(e) {}
            }
          }

          if (fullText.trim().length > 30) {
            sendToRN("FULL_EPUB_TEXT", { text: fullText });
          }
        } catch(err) {
          console.warn("Error extrayendo texto EPUB:", err);
        }
      }

      async function initEpub() {
        try {
          if (!fileData || fileData === '""' || fileData.trim().length === 0) {
            var loadEl = document.getElementById('loading');
            if (loadEl) loadEl.style.display = 'none';
            var errBox = document.getElementById('error-box');
            if (errBox) {
              errBox.style.display = 'block';
              errBox.innerHTML = "<div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #EF4444;'>⚠️ Archivo no disponible</div><div style='font-size: 14px; opacity: 0.85; line-height: 1.5; color: inherit;'>El archivo de este libro no se encuentra o está incompleto en el dispositivo.<br><br>Pulsa el botón para buscarlo y vincularlo de nuevo.</div><button id='repick-btn' onclick='window.repickFile()' style='margin-top: 18px; padding: 12px 22px; background: #6366F1; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.4);'>Re-seleccionar archivo</button>";
            }
            return;
          }

          var inputSource = fileData;
          if (fileData && (isB64 || fileData.length > 200)) {
            try {
              inputSource = base64ToArrayBuffer(fileData);
            } catch(bErr) {
              inputSource = fileData;
            }
          }

          book = ePub(inputSource);
          
          rendition = book.renderTo("epub-viewer", {
            width: "100%",
            height: "100%",
            spread: "none",
            flow: "paginated"
          });

          applyStyles();

          // Hook iframe contents to register selection and swipe gestures inside EPUB pages
          rendition.hooks.content.register(function(contents) {
            var doc = contents.document;
            if (doc && doc.head && !doc.getElementById('epub-user-highlight-style')) {
              var style = doc.createElement('style');
              style.id = 'epub-user-highlight-style';
              style.innerHTML = '::selection { background: rgba(250, 204, 21, 0.45) !important; color: inherit !important; } .user-highlight { background-color: rgba(250, 204, 21, 0.45) !important; border-radius: 2px !important; box-shadow: 0 0 2px rgba(234, 179, 8, 0.6) !important; color: inherit !important; }';
              doc.head.appendChild(style);
            }

            if (doc && doc.body) {
              doc.body.style.userSelect = 'text';
              doc.body.style.webkitUserSelect = 'text';
            }

            doc.addEventListener('selectionchange', function() {
              var sel = doc.getSelection();
              updateEpubSelectionToolbar(sel, doc);
            });

            var touchStartX = 0;
            var touchStartY = 0;
            var touchStartTime = 0;

            doc.addEventListener('touchstart', function(e) {
              if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
              }
            }, false);

            doc.addEventListener('touchend', function(e) {
              if (e.changedTouches.length === 1) {
                var sel = doc.getSelection();
                var selectedStr = sel ? sel.toString().trim() : '';
                if (selectedStr.length > 0) {
                  updateEpubSelectionToolbar(sel, doc);
                  return;
                } else {
                  hideSelectionToolbar();
                }

                var touchEndX = e.changedTouches[0].clientX;
                var touchEndY = e.changedTouches[0].clientY;
                var diffX = touchEndX - touchStartX;
                var diffY = touchEndY - touchStartY;
                var duration = Date.now() - touchStartTime;

                if (Math.abs(diffX) < 12 && Math.abs(diffY) < 12 && duration < 320) {
                  // Single tap -> Toggle Bars / Fullscreen mode
                  sendToRN("TOGGLE_BARS", {});
                } else if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
                  if (diffX < 0) {
                    rendition.next();
                  } else {
                    rendition.prev();
                  }
                }
              }
            }, false);
          });

          // rendition selection listener
          rendition.on('selected', function(cfiRange, contents) {
            currentCfiRange = cfiRange;
            try {
              var range = rendition.getRange(cfiRange);
              if (range) {
                currentSelectedText = range.toString().trim();
                var rect = range.getBoundingClientRect();
                var iframe = document.querySelector('iframe');
                var ifRect = iframe ? iframe.getBoundingClientRect() : { top: 0, left: 0 };
                var top = ifRect.top + rect.top - 46;
                if (top < 50) {
                  top = ifRect.top + rect.bottom + 14;
                }
                var left = ifRect.left + rect.left + (rect.width / 2);
                left = Math.max(80, Math.min(window.innerWidth - 80, left));

                var tb = document.getElementById('highlight-toolbar');
                if (tb) {
                  tb.style.top = top + 'px';
                  tb.style.left = left + 'px';
                  tb.style.display = 'flex';
                }
              }
            } catch(e) {}
          });

          var displayPromise;
          var isValidCfi = savedLocation && typeof savedLocation === 'string' && (savedLocation.indexOf('epubcfi') >= 0 || savedLocation.indexOf('/') >= 0 || savedLocation.indexOf('.htm') >= 0);
          if (isValidCfi) {
            displayPromise = rendition.display(savedLocation).catch(function(e) {
              console.warn("CFI guardado no válido, abriendo desde el inicio:", e);
              return rendition.display();
            });
          } else {
            displayPromise = rendition.display();
          }

          await displayPromise;
          await book.ready;

          document.getElementById('loading').style.display = 'none';

          // Generate Cover and Extract Text in background
          generateEpubCover();
          extractAllEpubText();

          // Generate locations in background so page numbers and percentages work accurately
          book.ready.then(function() {
            return book.locations.generate(1024);
          }).then(function() {
            if (!isValidCfi && savedProgressPct > 0 && rendition) {
              var targetCfi = book.locations.cfiFromPercentage(savedProgressPct / 100);
              if (targetCfi) {
                rendition.display(targetCfi);
              }
            }

            if (rendition && rendition.currentLocation()) {
              var loc = rendition.currentLocation();
              if (loc && loc.start) {
                var percent = Math.round((book.locations.percentageFromCfi(loc.start.cfi) || 0) * 100);
                var page = book.locations.locationFromCfi(loc.start.cfi) || 1;
                var total = book.locations.total || 100;
                var chStr = "Página " + page + " de " + total;
                sendToRN("LOCATION_CHANGED", { cfi: loc.start.cfi, percent: percent, page: page, totalPages: total, chapter: chStr });
              }
            }
          }).catch(function(e) {
            console.warn("Error generando ubicaciones EPUB:", e);
          });

          // Location Change Handler
          rendition.on("relocated", function(location) {
            if (location && location.start) {
              var cfi = location.start.cfi;
              var percent = 0;
              var page = 1;
              var total = 100;

              if (book && book.locations && book.locations.total > 0) {
                percent = Math.round((book.locations.percentageFromCfi(cfi) || 0) * 100);
                page = book.locations.locationFromCfi(cfi) || 1;
                total = book.locations.total || 100;
              } else if (location.start.displayed && location.start.displayed.page) {
                page = location.start.displayed.page;
                total = location.start.displayed.total || 100;
                percent = Math.round((page / total) * 100);
              } else if (location.start.index !== undefined && book.spine && book.spine.items) {
                var spineTotal = book.spine.items.length || 1;
                page = location.start.index + 1;
                total = spineTotal;
                percent = Math.round((page / spineTotal) * 100);
              }

              var chapterStr = "Página " + page + (total > 1 ? (" de " + total) : "");
              sendToRN("LOCATION_CHANGED", { cfi: cfi, percent: percent, page: page, totalPages: total, chapter: chapterStr });

              try {
                var iframe = document.querySelector('iframe');
                if (iframe && iframe.contentDocument) {
                  var text = iframe.contentDocument.body.innerText || iframe.contentDocument.body.textContent || "";
                  sendToRN("PAGE_TEXT_EXTRACTED", { text: text.trim().substring(0, 5000) });
                }
              } catch(e) {}
            }
          });

        } catch (err) {
          var loadEl = document.getElementById('loading');
          if (loadEl) loadEl.style.display = 'none';
          var errBox = document.getElementById('error-box');
          if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = "<div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #EF4444;'>⚠️ Error cargando e-Book</div><div style='font-size: 14px; opacity: 0.85; line-height: 1.5; color: inherit;'>El archivo de este libro parece estar incompleto o dañado.<br><br>Puedes volver a seleccionarlo desde tus descargas o archivos.</div><button id='repick-btn' onclick='window.repickFile()' style='margin-top: 18px; padding: 12px 22px; background: #6366F1; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.4);'>Re-seleccionar archivo</button>";
          }
        }
      }

      function nextPage() {
        if (rendition) rendition.next();
      }

      function prevPage() {
        if (rendition) rendition.prev();
      }

      function highlightEpubText(snippet) {
        try {
          var iframes = document.querySelectorAll('iframe');
          if (!iframes || iframes.length === 0) return;

          iframes.forEach(function(iframe) {
            try {
              if (!iframe.contentDocument) return;
              var doc = iframe.contentDocument;

              if (!doc.getElementById('tts-style')) {
                var st = doc.createElement('style');
                st.id = 'tts-style';
                st.innerHTML = '.tts-highlight { background: linear-gradient(135deg, #FFE082, #FFCA28) !important; color: #000000 !important; font-weight: 700 !important; border-radius: 6px !important; padding: 2px 6px !important; box-shadow: 0 0 16px rgba(255, 193, 7, 0.9), 0 0 6px rgba(255, 235, 59, 0.8) !important; border: 1px solid #FFD54F !important; transition: all 0.25s ease !important; display: inline-block !important; }';
                if (doc.head) doc.head.appendChild(st);
              }

              var old = doc.querySelectorAll('.tts-highlight');
              old.forEach(function(el) {
                var parent = el.parentNode;
                if (parent) {
                  parent.replaceChild(doc.createTextNode(el.innerText || el.textContent), el);
                  parent.normalize();
                }
              });

              if (!snippet || !snippet.trim()) return;
              var clean = snippet.trim();
              var body = doc.body;
              if (!body) return;

              var searchTargets = [
                clean,
                clean.length > 30 ? clean.substring(0, 30) : null,
                clean.length > 20 ? clean.substring(0, 20) : null,
                clean.length > 12 ? clean.substring(0, 12) : null,
              ].filter(Boolean);

              var walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
              var node;
              while ((node = walker.nextNode())) {
                var val = node.nodeValue;
                if (!val || !val.trim()) continue;

                for (var i = 0; i < searchTargets.length; i++) {
                  var target = searchTargets[i];
                  var matchIndex = val.toLowerCase().indexOf(target.toLowerCase());
                  if (matchIndex !== -1) {
                    var span = doc.createElement('mark');
                    span.className = 'tts-highlight';

                    var afterNode = node.splitText(matchIndex);
                    afterNode.nodeValue = afterNode.nodeValue.substring(target.length);

                    span.appendChild(doc.createTextNode(val.substring(matchIndex, matchIndex + target.length)));
                    node.parentNode.insertBefore(span, afterNode);

                    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                  }
                }
              }
            } catch (errFrame) {}
          });
        } catch(e) {}
      }

      function highlightEpubTextSnippet(snippet, color) {
        try {
          var iframe = document.querySelector('iframe');
          if (!iframe || !iframe.contentDocument) return;
          var doc = iframe.contentDocument;
          var body = doc.body;
          if (!body || !snippet || !snippet.trim()) return;

          var clean = snippet.trim();
          var searchTargets = [
            clean,
            clean.length > 30 ? clean.substring(0, 30) : null,
            clean.length > 20 ? clean.substring(0, 20) : null,
            clean.length > 12 ? clean.substring(0, 12) : null,
          ].filter(Boolean);

          var walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
          var node;
          while ((node = walker.nextNode())) {
            var val = node.nodeValue;
            if (!val || !val.trim()) continue;

            for (var i = 0; i < searchTargets.length; i++) {
              var target = searchTargets[i];
              var matchIndex = val.toLowerCase().indexOf(target.toLowerCase());
              if (matchIndex !== -1) {
                var span = doc.createElement('mark');
                span.className = 'user-highlight';
                span.setAttribute('data-highlighted', 'true');
                span.style.backgroundColor = 'rgba(250, 204, 21, 0.45)';
                span.style.borderRadius = '2px';
                span.style.boxShadow = '0 0 2px rgba(234, 179, 8, 0.6)';

                var afterNode = node.splitText(matchIndex);
                afterNode.nodeValue = afterNode.nodeValue.substring(target.length);

                span.appendChild(doc.createTextNode(val.substring(matchIndex, matchIndex + target.length)));
                node.parentNode.insertBefore(span, afterNode);
                return;
              }
            }
          }
        } catch(e) {}
      }

      function applySavedEpubHighlights(highlights) {
        if (!highlights || !highlights.length) return;
        highlights.forEach(function(h) {
          if (h && (h.text || h.snippet)) {
            highlightEpubTextSnippet(h.text || h.snippet, h.color || '#FACC15');
          }
        });
      }

      function applyEpubHighlight() {
        if (!currentSelectedText) return;
        var txt = currentSelectedText;
        var cfi = currentCfiRange || '';

        highlightEpubTextSnippet(txt, '#FACC15');
        epubHighlightsCache.push({ text: txt, color: '#FACC15' });

        sendToRN('HIGHLIGHT_CREATED', {
          text: txt,
          cfi: cfi,
          page: currentPageNum || 1,
          color: '#FACC15'
        });

        hideSelectionToolbar();
      }

      function copyEpubSelection() {
        if (currentSelectedText) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(currentSelectedText);
            }
          } catch(e) {}
          sendToRN('COPY_TO_CLIPBOARD', { text: currentSelectedText });
          hideSelectionToolbar();
        }
      }

      function shareEpubSelection() {
        if (currentSelectedText) {
          applyEpubHighlight();
          sendToRN('SHARE_SELECTION', { text: currentSelectedText, page: currentPageNum || 1 });
          hideSelectionToolbar();
          setTimeout(function() {
            captureEpubPage();
          }, 120);
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
        var onEpubHl = function(e) { e.preventDefault(); e.stopPropagation(); applyEpubHighlight(); };
        btnHl.addEventListener('touchend', onEpubHl);
        btnHl.addEventListener('pointerdown', onEpubHl);
        btnHl.addEventListener('click', onEpubHl);
      }

      var btnCp = document.getElementById('btn-copy');
      if (btnCp) {
        var onEpubCp = function(e) { e.preventDefault(); e.stopPropagation(); copyEpubSelection(); };
        btnCp.addEventListener('touchend', onEpubCp);
        btnCp.addEventListener('pointerdown', onEpubCp);
        btnCp.addEventListener('click', onEpubCp);
      }

      var btnSh = document.getElementById('btn-share');
      if (btnSh) {
        var onEpubSh = function(e) { e.preventDefault(); e.stopPropagation(); shareEpubSelection(); };
        btnSh.addEventListener('touchend', onEpubSh);
        btnSh.addEventListener('pointerdown', onEpubSh);
        btnSh.addEventListener('click', onEpubSh);
      }

      async function captureEpubPage() {
        try {
          var iframe = document.querySelector('iframe');
          if (!iframe || !iframe.contentDocument) {
            sendToRN('PAGE_IMAGE_ERROR', { error: 'Lector EPUB no listo' });
            return;
          }
          var targetEl = iframe.contentDocument.body || iframe.contentDocument.documentElement;
          if (typeof html2canvas !== 'undefined') {
            var canvas = await html2canvas(targetEl, {
              backgroundColor: document.body.style.backgroundColor || '#FFFFFF',
              scale: 2.0,
              useCORS: true,
              logging: false
            });
            var dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            sendToRN('PAGE_IMAGE_CAPTURED', {
              dataUrl: dataUrl,
              page: currentPageNum || 1,
              totalPages: totalPagesCount || 100
            });
          } else {
            sendToRN('PAGE_IMAGE_ERROR', { error: 'html2canvas no disponible' });
          }
        } catch(err) {
          console.error('Error al capturar imagen de página EPUB:', err);
          sendToRN('PAGE_IMAGE_ERROR', { error: err.message || 'Error capturando EPUB' });
        }
      }

      // React Native WebView message handler
      var streamedEpubChunks = [];
      function handleMessage(event) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data) return;
          if (data.type === 'START_BOOK_STREAM') {
            streamedEpubChunks = [];
          } else if (data.type === 'BOOK_CHUNK') {
            if (data.payload && data.payload.chunk) {
              streamedEpubChunks.push(data.payload.chunk);
            }
          } else if (data.type === 'END_BOOK_STREAM') {
            fileData = streamedEpubChunks.join('');
            streamedEpubChunks = [];
            isB64 = true;
            initEpub();
          } else if (data.type === 'HIGHLIGHT_SPEECH_TEXT') {
            highlightEpubText(data.snippet);
          } else if (data.type === 'LOAD_BOOK_DATA') {
            if (data.payload && data.payload.base64) {
              fileData = data.payload.base64;
              isB64 = true;
              initEpub();
            }
          } else if (data.type === 'CAPTURE_PAGE_IMAGE') {
            captureEpubPage();
          } else if (data.type === 'LOAD_PAGE_HIGHLIGHTS') {
            if (data.payload && data.payload.highlights) {
              epubHighlightsCache = data.payload.highlights;
              applySavedEpubHighlights(data.payload.highlights);
            }
          } else if (data.type === 'NEXT_PAGE') {
            nextPage();
          } else if (data.type === 'PREV_PAGE') {
            prevPage();
          } else if (data.type === 'SEEK_PERCENT') {
            if (rendition && book) {
              var pct = data.payload.percent;
              if (pct <= 0) {
                if (book.spine && book.spine.items && book.spine.items.length > 0) {
                  rendition.display(book.spine.items[0].href);
                } else {
                  rendition.display();
                }
              } else if (pct >= 100) {
                if (book.spine && book.spine.items && book.spine.items.length > 0) {
                  rendition.display(book.spine.items[book.spine.items.length - 1].href);
                } else {
                  rendition.display();
                }
              } else if (book.locations && book.locations.total > 0) {
                var p = pct / 100;
                var cfi = book.locations.cfiFromPercentage(p);
                if (cfi) {
                  rendition.display(cfi);
                } else if (book.spine && book.spine.items && book.spine.items.length > 0) {
                  var idx = Math.floor(p * book.spine.items.length);
                  idx = Math.max(0, Math.min(book.spine.items.length - 1, idx));
                  rendition.display(book.spine.items[idx].href);
                }
              } else if (book.spine && book.spine.items && book.spine.items.length > 0) {
                var p = pct / 100;
                var idx = Math.floor(p * book.spine.items.length);
                idx = Math.max(0, Math.min(book.spine.items.length - 1, idx));
                rendition.display(book.spine.items[idx].href);
              }
            }
          } else if (data.type === 'UPDATE_SETTINGS') {
            var s = data.payload;
            if (s.themeMode && rendition) {
              var bg = '#FFFFFF', txt = '#111111';
              if (s.themeMode === 'sepia') { bg = '#F8F1E3'; txt = '#433422'; }
              else if (s.themeMode === 'dark') { bg = '#1E1E2E'; txt = '#CDD6F4'; }
              else if (s.themeMode === 'oled') { bg = '#000000'; txt = '#E0E0E0'; }
              document.body.style.backgroundColor = bg;
              document.body.style.color = txt;
              applyStyles();
            }
          }
        } catch(e) {}
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);

      sendToRN('INIT_READY', { format: 'EPUB' });

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEpub);
      } else {
        initEpub();
      }
    })();
  </script>
</body>
</html>
  `;
}
