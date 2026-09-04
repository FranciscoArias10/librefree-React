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
    .tts-highlight {
      background: linear-gradient(135deg, #FFE082, #FFCA28) !important;
      color: #000000 !important;
      font-weight: 700 !important;
      border-radius: 6px !important;
      padding: 2px 6px !important;
      box-shadow: 0 0 16px rgba(255, 193, 7, 0.9), 0 0 6px rgba(255, 235, 59, 0.8) !important;
      border: 1px solid #FFD54F !important;
      transition: all 0.25s ease-in-out !important;
      display: inline-block !important;
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

      function highlightText(snippet) {
        var old = document.querySelectorAll('.tts-highlight');
        old.forEach(function(el) {
          var parent = el.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(el.innerText || el.textContent), el);
            parent.normalize();
          }
        });

        if (!snippet || !snippet.trim()) return;
        var clean = snippet.trim();
        var contentDiv = document.getElementById('content');
        if (!contentDiv) return;

        var searchTargets = [
          clean,
          clean.length > 30 ? clean.substring(0, 30) : null,
          clean.length > 20 ? clean.substring(0, 20) : null,
          clean.length > 12 ? clean.substring(0, 12) : null,
        ].filter(Boolean);

        var walker = document.createTreeWalker(contentDiv, NodeFilter.SHOW_TEXT, null, false);
        var node;

        while ((node = walker.nextNode())) {
          var val = node.nodeValue;
          if (!val || !val.trim()) continue;

          for (var i = 0; i < searchTargets.length; i++) {
            var target = searchTargets[i];
            var matchIdx = val.toLowerCase().indexOf(target.toLowerCase());
            if (matchIdx !== -1) {
              var mark = document.createElement('mark');
              mark.className = 'tts-highlight';

              var after = node.splitText(matchIdx);
              after.nodeValue = after.nodeValue.substring(target.length);

              mark.appendChild(document.createTextNode(val.substring(matchIdx, matchIdx + target.length)));
              node.parentNode.insertBefore(mark, after);

              mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return;
            }
          }
        }
      }

      function sendToRN(type, payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
        }
      }

      sendToRN('PAGE_TEXT_EXTRACTED', { text: fullText.substring(0, 10000) });

      window.addEventListener('scroll', function() {
        var totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
          var progress = Math.min(100, Math.max(0, Math.round((window.scrollY / totalHeight) * 100)));
          sendToRN('PROGRESS_UPDATE', { progress: progress, scrollY: window.scrollY });
        }
      });

      document.addEventListener('click', function() {
        sendToRN('TOGGLE_BARS', {});
      });

      document.addEventListener('selectionchange', function() {
        var selection = window.getSelection().toString().trim();
        if (selection.length > 0) {
          sendToRN('TEXT_SELECTED', { text: selection });
        }
      });

      function handleMessage(event: any) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data) return;
          if (data.type === 'HIGHLIGHT_SPEECH_TEXT') {
            highlightText(data.snippet);
          } else if (data.type === 'SEEK_PERCENT') {
            var pct = data.payload.percent;
            if (pct <= 0) {
              window.scrollTo({ top: 0, behavior: 'auto' });
            } else if (pct >= 100) {
              window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
            } else {
              var p = pct / 100;
              var totalHeight = document.documentElement.scrollHeight - window.innerHeight;
              if (totalHeight > 0) {
                window.scrollTo({ top: p * totalHeight, behavior: 'auto' });
              }
            }
          } else if (data.type === 'UPDATE_SETTINGS') {
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
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);
    })();
  </script>
</body>
</html>
  `;
}
