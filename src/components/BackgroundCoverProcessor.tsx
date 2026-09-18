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

export const BackgroundCoverProcessor: React.FC<{ onCoverGenerated?: () => void; triggerKey?: number }> = ({ onCoverGenerated, triggerKey }) => {
  const [currentBook, setCurrentBook] = useState<ProcessingBook | null>(null);
  const [htmlSource, setHtmlSource] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const failedBookIdsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef<boolean>(false);
  const timeoutRef = useRef<any>(null);

  const clearCurrentJob = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isProcessingRef.current = false;
    setCurrentBook(null);
    setHtmlSource(null);
  };

  const checkPendingBooks = async () => {
    if (isProcessingRef.current) {
      return;
    }

    try {
      const db = await getDB();
      const row = await db.getFirstAsync<any>(
        `SELECT b.id, b.filePath, b.format 
         FROM books b 
         WHERE (b.coverPath IS NULL OR b.coverPath = '' OR length(b.coverPath) < 50) 
         AND (b.format = 'PDF' OR b.format = 'EPUB') 
         ORDER BY b.id DESC 
         LIMIT 1;`
      );

      if (row) {
        if (failedBookIdsRef.current.has(row.id)) {
          return;
        }

        isProcessingRef.current = true;

        // Set timeout to prevent getting stuck indefinitely on a problematic book
        timeoutRef.current = setTimeout(() => {
          console.log(`[BackgroundCoverProcessor] Timeout procesando portada para libro ${row.id}`);
          failedBookIdsRef.current.add(row.id);
          clearCurrentJob();
        }, 12000);

        const data = await readBookContent(row.filePath, row.format, row.id);

        if (data.content && data.content.length > 20) {
          setCurrentBook({ id: row.id, filePath: row.filePath, format: row.format });
          if (row.format === 'PDF') {
            setHtmlSource(getPdfReaderHTML(data.content, '1', DEFAULT_SETTINGS, true));
          } else if (row.format === 'EPUB') {
            setHtmlSource(getEpubReaderHTML(data.content, data.isBase64, undefined, DEFAULT_SETTINGS));
          }
        } else {
          failedBookIdsRef.current.add(row.id);
          clearCurrentJob();
        }
      } else {
        clearCurrentJob();
      }
    } catch (err) {
      console.error('Error en procesador de portadas en segundo plano:', err);
      clearCurrentJob();
    }
  };

  useEffect(() => {
    checkPendingBooks();
  }, [triggerKey]);

  useEffect(() => {
    checkPendingBooks();
    const interval = setInterval(checkPendingBooks, 2000);
    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'COVER_GENERATED' && currentBook && data.payload?.coverPath) {
        const coverPath = data.payload.coverPath;
        if (coverPath.length > 50) {
          await saveBookCover(currentBook.id, coverPath);
          if (onCoverGenerated) onCoverGenerated();
          clearCurrentJob();
          setTimeout(checkPendingBooks, 100);
        }
      } else if ((data.type === 'FULL_PDF_TEXT' || data.type === 'FULL_EPUB_TEXT') && currentBook && data.payload?.text) {
        const text = data.payload.text;
        if (text.length > 20) {
          await saveExtractedBookText(currentBook.id, text);
        }
      }
    } catch (e) {
      clearCurrentJob();
    }
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
