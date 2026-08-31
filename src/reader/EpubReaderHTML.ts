import { ReadingSettings } from '../types/book';

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
  settings: ReadingSettings
): string {
  const colors = getThemeColors(settings.themeMode);
  const rawData = JSON.stringify(fileUriOrBase64);
  const initialLoc = JSON.stringify(initialCfi || '1');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>EPUB Reader - HD Page Flip</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"></script>
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
      user-select: none;
      -webkit-user-select: none;
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

  <script>
    (function() {
      var book = null;
      var rendition = null;
      var fileData = ${rawData};
      var isB64 = ${isBase64 ? 'true' : 'false'};
      var savedLocation = ${initialLoc};

      function sendToRN(type, payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
        }
      }

      function base64ToArrayBuffer(base64) {
        var binaryString = window.atob(base64);
        var len = binaryString.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
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
          }
        } catch(e) {
          console.warn("Error generando portada EPUB:", e);
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

          // Hook iframe contents to register swipe gestures & single-tap fullscreen toggle inside EPUB pages
          rendition.hooks.content.register(function(contents) {
            var doc = contents.document;
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
          document.getElementById('loading').style.display = 'none';
          var errBox = document.getElementById('error-box');
          errBox.style.display = 'block';
          errBox.innerText = "Error cargando EPUB: " + err.message;
        }
      }

      function nextPage() {
        if (rendition) rendition.next();
      }

      function prevPage() {
        if (rendition) rendition.prev();
      }

      // React Native WebView message handler
      window.addEventListener('message', function(event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === 'NEXT_PAGE') {
            nextPage();
          } else if (data.type === 'PREV_PAGE') {
            prevPage();
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
      });

      document.addEventListener('DOMContentLoaded', initEpub);
    })();
  </script>
</body>
</html>
  `;
}
