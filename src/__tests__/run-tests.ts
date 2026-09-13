import { getPdfReaderHTML } from '../reader/PdfReaderHTML';
import { getEpubReaderHTML } from '../reader/EpubReaderHTML';
import { getTxtReaderHTML } from '../reader/TxtReaderHTML';
import { runBookFilesTests } from './test-book-files';

export function testableNormalizePath(path: string): string {
  if (!path) return '';
  let result = path.trim();
  if (
    !result.startsWith('file://') &&
    !result.startsWith('content://') &&
    !result.startsWith('http://') &&
    !result.startsWith('https://')
  ) {
    result = `file://${result}`;
  }
  return result;
}

const DEFAULT_SETTINGS: any = {
  fontSize: 18,
  fontFamily: 'Serif',
  lineHeight: 1.6,
  marginSize: 20,
  themeMode: 'sepia',
  textAlignment: 'left',
  isContinuousScroll: false,
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('\n🧪 ====================================================');
  console.log('🧪 AUTOMATED TEST SUITE FOR LIBREFREE READER APP');
  console.log('🧪 ====================================================\n');

  // TEST SUITE 1: PATH NORMALIZATION & EXPO SANDBOX SAFETY
  console.log('📁 [SUITE 1] File Scanner & Path Normalization Tests');
  
  const fileUri = testableNormalizePath('file:///data/user/0/host.exp.exponent/files/ExperienceData/%40francisco_a%2FLibrefree-React/books/123.pdf');
  assert(
    fileUri === 'file:///data/user/0/host.exp.exponent/files/ExperienceData/%40francisco_a%2FLibrefree-React/books/123.pdf',
    'normalizePath preserves literal %40 and %2F in Expo Go sandbox directory paths'
  );

  const contentUri = testableNormalizePath('content://com.android.providers.downloads/document/12');
  assert(contentUri === 'content://com.android.providers.downloads/document/12', 'normalizePath preserves content:// URIs');

  const relativePath = testableNormalizePath('/storage/emulated/0/Download/libro.pdf');
  assert(relativePath === 'file:///storage/emulated/0/Download/libro.pdf', 'normalizePath prepends file:// to raw Android paths');

  // TEST SUITE 2: PDF READER HTML GENERATOR
  console.log('\n📄 [SUITE 2] PDF Reader Engine Verification');
  
  const pdfHtml = getPdfReaderHTML('dummy_base64_data', '1', DEFAULT_SETTINGS);
  
  assert(
    pdfHtml.includes("document.addEventListener('message'"),
    'PdfReaderHTML includes document.addEventListener("message") for Android WebView compatibility'
  );
  assert(
    pdfHtml.includes("window.addEventListener('message'"),
    'PdfReaderHTML includes window.addEventListener("message") for iOS compatibility'
  );
  assert(
    pdfHtml.includes('pendingPageToRender'),
    'PdfReaderHTML includes pendingPageToRender queue to prevent dropped pages during rapid scrubber drag'
  );
  assert(
    pdfHtml.includes('id="error-box"'),
    'PdfReaderHTML includes error-box container for displaying friendly unreadable file warnings'
  );
  assert(
    pdfHtml.includes('START_BOOK_STREAM') && pdfHtml.includes('BOOK_CHUNK') && pdfHtml.includes('END_BOOK_STREAM'),
    'PdfReaderHTML supports chunked Base64 streaming for large PDF files (>2MB)'
  );

  const pdfScriptRegex = /<script>([\s\S]*?)<\/script>/gi;
  let pdfScriptMatch;
  let pdfScriptsValid = true;
  while ((pdfScriptMatch = pdfScriptRegex.exec(pdfHtml)) !== null) {
    try {
      new Function(pdfScriptMatch[1]);
    } catch (e) {
      pdfScriptsValid = false;
      console.error('PDF script syntax error in test:', e);
    }
  }
  assert(pdfScriptsValid, 'PdfReaderHTML embedded scripts are 100% syntactically valid JavaScript');

  // TEST SUITE 3: EPUB READER HTML GENERATOR
  console.log('\n📘 [SUITE 3] EPUB Reader Engine Verification');

  const epubHtml = getEpubReaderHTML('dummy_epub_content', true, 'epubcfi(/6/2)', DEFAULT_SETTINGS, 50);

  assert(
    epubHtml.includes("document.addEventListener('message'"),
    'EpubReaderHTML includes document.addEventListener("message") for Android WebView compatibility'
  );
  assert(
    epubHtml.includes("window.addEventListener('message'"),
    'EpubReaderHTML includes window.addEventListener("message") for iOS compatibility'
  );
  assert(
    epubHtml.includes('START_BOOK_STREAM') && epubHtml.includes('BOOK_CHUNK') && epubHtml.includes('END_BOOK_STREAM'),
    'EpubReaderHTML supports chunked Base64 streaming for large EPUB files (>2MB)'
  );
  assert(
    !epubHtml.includes('rendition.display(0);') && !epubHtml.includes('rendition.display(idx);'),
    'EpubReaderHTML DOES NOT pass raw integer numbers to rendition.display (which causes TypeError in epub.js)'
  );
  assert(
    epubHtml.includes('rendition.display(book.spine.items[idx].href)'),
    'EpubReaderHTML passes valid string href parameters to rendition.display'
  );

  const epubScriptRegex = /<script>([\s\S]*?)<\/script>/gi;
  let epubScriptMatch;
  let epubScriptsValid = true;
  while ((epubScriptMatch = epubScriptRegex.exec(epubHtml)) !== null) {
    try {
      new Function(epubScriptMatch[1]);
    } catch (e) {
      epubScriptsValid = false;
      console.error('EPUB script syntax error in test:', e);
    }
  }
  assert(epubScriptsValid, 'EpubReaderHTML embedded scripts are 100% syntactically valid JavaScript');

  // TEST SUITE 4: TXT READER HTML GENERATOR
  console.log('\n📝 [SUITE 4] TXT Reader Engine Verification');

  const txtHtml = getTxtReaderHTML('Este es un texto de prueba', 'Libro de Prueba', DEFAULT_SETTINGS);

  assert(
    txtHtml.includes("document.addEventListener('message'"),
    'TxtReaderHTML includes document.addEventListener("message") for Android WebView compatibility'
  );
  assert(
    txtHtml.includes("window.addEventListener('message'"),
    'TxtReaderHTML includes window.addEventListener("message") for iOS compatibility'
  );

  const txtScriptRegex = /<script>([\s\S]*?)<\/script>/gi;
  let txtScriptMatch;
  let txtScriptsValid = true;
  while ((txtScriptMatch = txtScriptRegex.exec(txtHtml)) !== null) {
    try {
      new Function(txtScriptMatch[1]);
    } catch (e) {
      txtScriptsValid = false;
      console.error('TXT script syntax error in test:', e);
    }
  }
  assert(txtScriptsValid, 'TxtReaderHTML embedded scripts are 100% syntactically valid JavaScript');

  // TEST SUITE 5: TOP PROGRESS SCRUBBER MATH
  console.log('\n🎛️ [SUITE 5] Top Scrubber Progress Math Verification');

  const calcPage = (pct: number, total: number) => {
    return pct <= 0 ? 1 : (pct >= 100 ? total : Math.max(1, Math.min(total, Math.round((pct / 100) * total))));
  };

  assert(calcPage(0, 200) === 1, 'Scrubber 0% maps to Page 1');
  assert(calcPage(100, 200) === 200, 'Scrubber 100% maps to Last Page (200)');
  assert(calcPage(50, 200) === 100, 'Scrubber 50% maps to Page 100');
  assert(calcPage(25, 100) === 25, 'Scrubber 25% maps to Page 25');

  // TEST SUITE 6: REAL TEST BOOKS VERIFICATION
  const bookFilesRes = await runBookFilesTests();
  passed += bookFilesRes.passed;
  failed += bookFilesRes.failed;

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
