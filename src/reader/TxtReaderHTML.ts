import { ReadingSettings } from '../types/book';
import { getThemeColors } from './EpubReaderHTML';

export function getTxtReaderHTML(
  textContent: string,
  bookTitle: string,
  settings: ReadingSettings
): string {
  const colors = getThemeColors(settings.themeMode);
  const escapedText = JSON.stringify(textContent);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${bookTitle}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: ${colors.bg};
      color: ${colors.text};
      font-family: ${settings.fontFamily === 'Serif' ? 'Georgia, serif' : 'system-ui, sans-serif'};
      font-size: ${settings.fontSize}px;
      line-height: ${settings.lineHeight};
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    #container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px ${settings.marginSize}px 80px ${settings.marginSize}px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    h1.book-header {
      font-size: 1.5em;
      text-align: center;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(128,128,128,0.2);
      padding-bottom: 12px;
    }
  </style>
</head>
<body>
  <div id="container">
    <h1 class="book-header">${bookTitle}</h1>
    <div id="content"></div>
  </div>

  <script>
    (function() {
      var fullText = ${escapedText};
      document.getElementById('content').innerText = fullText;

      function sendToRN(type, payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
        }
      }

      window.addEventListener('scroll', function() {
        var totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
          var progress = Math.min(100, Math.max(0, Math.round((window.scrollY / totalHeight) * 100)));
          sendToRN('PROGRESS_UPDATE', { progress: progress, scrollY: window.scrollY });
        }
      });

      document.addEventListener('selectionchange', function() {
        var selection = window.getSelection().toString().trim();
        if (selection.length > 0) {
          sendToRN('TEXT_SELECTED', { text: selection });
        }
      });

      window.addEventListener('message', function(event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === 'UPDATE_SETTINGS') {
            var s = data.payload;
            if (s.fontSize) document.body.style.fontSize = s.fontSize + 'px';
            if (s.lineHeight) document.body.style.lineHeight = s.lineHeight;
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
      });
    })();
  </script>
</body>
</html>
  `;
}
