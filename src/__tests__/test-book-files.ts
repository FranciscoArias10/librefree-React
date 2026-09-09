import fs from 'fs';
import path from 'path';
import { getPdfReaderHTML } from '../reader/PdfReaderHTML';
import { getEpubReaderHTML } from '../reader/EpubReaderHTML';
import { getTxtReaderHTML } from '../reader/TxtReaderHTML';
import { ReadingSettings } from '../types/book';

const defaultSettings: ReadingSettings = {
  fontSize: 18,
  fontFamily: 'Serif',
  lineHeight: 1.6,
  marginSize: 20,
  themeMode: 'sepia',
  textAlignment: 'left',
  isContinuousScroll: false,
};

export async function runBookFilesTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ PASSED: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${description}`);
      failed++;
    }
  }

  console.log('\n📚 [SUITE 6] Real Book Files & Offline Reader Verification (test_books/)');

  const testDir = path.join(process.cwd(), 'test_books');
  assert(fs.existsSync(testDir), 'test_books folder exists in workspace root');

  const pdfPath = path.join(testDir, 'test_doc.pdf');
  const epubPath = path.join(testDir, 'test_book.epub');
  const txtPath = path.join(testDir, 'test_story.txt');

  assert(fs.existsSync(pdfPath), 'test_books/test_doc.pdf exists');
  assert(fs.existsSync(epubPath), 'test_books/test_book.epub exists');
  assert(fs.existsSync(txtPath), 'test_books/test_story.txt exists');

  // Test PDF Base64 & HTML Generation
  try {
    const pdfBuf = fs.readFileSync(pdfPath);
    const pdfB64 = pdfBuf.toString('base64');
    assert(pdfB64.length > 50, 'PDF file converted to valid Base64 string (>50 chars)');

    const pdfHtml = getPdfReaderHTML(pdfB64, '1', defaultSettings);
    assert(pdfHtml.includes('pdfjsLib'), 'getPdfReaderHTML embeds offline pdf.js library');
    assert(pdfHtml.includes('visibility: hidden'), 'getPdfReaderHTML hides canvas-card initially to prevent white rectangle glitch');
    assert(pdfHtml.includes('document.readyState'), 'getPdfReaderHTML includes readyState check to prevent DOMContentLoaded race condition');
  } catch (e: any) {
    assert(false, `PDF test failed: ${e.message}`);
  }

  // Test EPUB Base64 & HTML Generation
  try {
    const epubBuf = fs.readFileSync(epubPath);
    const epubB64 = epubBuf.toString('base64');
    assert(epubB64.length > 50, 'EPUB file converted to valid Base64 string (>50 chars)');

    const epubHtml = getEpubReaderHTML(epubB64, true, undefined, defaultSettings);
    assert(epubHtml.length > 100000, 'getEpubReaderHTML embeds offline JSZip & EpubJS libraries (>100KB HTML payload)');
    assert(epubHtml.includes('document.readyState'), 'getEpubReaderHTML includes readyState check to prevent DOMContentLoaded race condition');
  } catch (e: any) {
    assert(false, `EPUB test failed: ${e.message}`);
  }

  // Test TXT Reading & HTML Generation
  try {
    const txtContent = fs.readFileSync(txtPath, 'utf-8');
    assert(txtContent.includes('LibreFree'), 'TXT file read successfully');

    const txtHtml = getTxtReaderHTML(txtContent, 'test_story.txt', defaultSettings);
    assert(txtHtml.includes('LibreFree'), 'getTxtReaderHTML embeds TXT content correctly');
  } catch (e: any) {
    assert(false, `TXT test failed: ${e.message}`);
  }

  return { passed, failed };
}
