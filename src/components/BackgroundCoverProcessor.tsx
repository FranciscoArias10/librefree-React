import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { getDB, saveBookCover, saveExtractedBookText } from '../services/database';
import { readBookContent } from '../services/fileScanner';
import { getPdfReaderHTML } from '../reader/PdfReaderHTML';
import { getEpubReaderHTML } from '../reader/EpubReaderHTML';
import { ReadingSettings } from '../types/book';

interface ProcessingBook {
  id: string;
  filePath: string;
  format: 'EPUB' | 'PDF' | 'TXT';
}

const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: 18,
  fontFamily: 'Serif',
  lineHeight: 1.6,
  marginSize: 20,
  themeMode: 'light',
  textAlignment: 'left',
  isContinuousScroll: false,
};

export const BackgroundCoverProcessor: React.FC<{ onCoverGenerated?: () => void }> = ({ onCoverGenerated }) => {
  const [currentBook, setCurrentBook] = useState<ProcessingBook | null>(null);
  const [htmlSource, setHtmlSource] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  const checkPendingBooks = async () => {
    try {
      const db = await getDB();
      const row = await db.getFirstAsync<any>(
        `SELECT b.id, b.filePath, b.format 
         FROM books b 
         LEFT JOIN book_texts bt ON b.id = bt.bookId 
         WHERE (b.coverPath IS NULL OR b.coverPath = '' OR length(b.coverPath) < 50 OR bt.extractedText IS NULL) 
         AND (b.format = 'PDF' OR b.format = 'EPUB') 
         LIMIT 1;`
      );

      if (row) {
        const data = await readBookContent(row.filePath, row.format);
        if (data.content && data.content.length > 5) {
          setCurrentBook({ id: row.id, filePath: row.filePath, format: row.format });
          if (row.format === 'PDF') {
            setHtmlSource(getPdfReaderHTML(data.content, '1', DEFAULT_SETTINGS, true));
          } else if (row.format === 'EPUB') {
            setHtmlSource(getEpubReaderHTML(data.content, data.isBase64, undefined, DEFAULT_SETTINGS));
          }
        }
      } else {
        setCurrentBook(null);
        setHtmlSource(null);
      }
    } catch (err) {
      console.error('Error en procesador de portadas y texto en segundo plano:', err);
    }
  };

  useEffect(() => {
    checkPendingBooks();
    const interval = setInterval(checkPendingBooks, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'COVER_GENERATED' && currentBook && data.payload?.coverPath) {
        const coverPath = data.payload.coverPath;
        if (coverPath.length > 50) {
          await saveBookCover(currentBook.id, coverPath);
          if (onCoverGenerated) onCoverGenerated();
          setCurrentBook(null);
          setHtmlSource(null);
          setTimeout(checkPendingBooks, 100);
        }
      } else if ((data.type === 'FULL_PDF_TEXT' || data.type === 'FULL_EPUB_TEXT') && currentBook && data.payload?.text) {
        const text = data.payload.text;
        if (text.length > 20) {
          await saveExtractedBookText(currentBook.id, text);
          setCurrentBook(null);
          setHtmlSource(null);
          setTimeout(checkPendingBooks, 100);
        }
      }
    } catch (e) {}
  };

  if (!htmlSource) return null;

  const baseUrl = FileSystem.documentDirectory || 'file:///';

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlSource, baseUrl: baseUrl }}
        onMessage={handleMessage}
        style={{ width: 300, height: 400, opacity: 0 }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});
