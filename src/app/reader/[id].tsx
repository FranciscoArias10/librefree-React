import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { getBookById, updateBookProgress, saveBookCover, saveExtractedBookText, getReadingSettings, saveReadingSettings, addBookmark } from '../../services/database';
import { readBookContent } from '../../services/fileScanner';
import { getEpubReaderHTML } from '../../reader/EpubReaderHTML';
import { getTxtReaderHTML } from '../../reader/TxtReaderHTML';
import { getPdfReaderHTML } from '../../reader/PdfReaderHTML';
import { ReaderControlsModal } from '../../components/ReaderControlsModal';
import { TTSControlBar } from '../../components/TTSControlBar';
import { stopSpeech } from '../../services/ttsService';
import { Book, ReadingSettings } from '../../types/book';
import { Toast } from '../../components/Toast';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

export default function ReaderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dynamicReaderBottom = Math.max(insets.bottom + 8, 16);

  const webViewRef = useRef<WebView>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [bookData, setBookData] = useState<{ content: string; isBase64: boolean }>({ content: '', isBase64: false });
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 18,
    fontFamily: 'Serif',
    lineHeight: 1.6,
    marginSize: 20,
    themeMode: 'sepia',
    textAlignment: 'left',
    isContinuousScroll: false,
  });
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number>(0);
  const [currentCfi, setCurrentCfi] = useState<string>('');
  const [currentChapter, setCurrentChapter] = useState<string>('');
  const [controlsVisible, setControlsVisible] = useState(false);
  const [ttsVisible, setTtsVisible] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [currentPageText, setCurrentPageText] = useState<string>('');
  const [pageLabel, setPageLabel] = useState<string>('Página 1');
  const [barsVisible, setBarsVisible] = useState(true);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const b = await getBookById(id);
        const s = await getReadingSettings();
        setSettings(s);

        if (b) {
          setBook(b);
          setProgress(b.progressPercentage || 0);
          if (b.currentLocation) setCurrentCfi(b.currentLocation);
          if (b.currentChapter) setCurrentChapter(b.currentChapter);

          if (b.currentChapter && b.currentChapter.toLowerCase().includes('página')) {
            setPageLabel(b.currentChapter);
          } else {
            const fakePage = Math.max(1, Math.round(((b.progressPercentage || 0) / 100) * 350));
            setPageLabel(`Página ${fakePage}`);
          }

          const data = await readBookContent(b.filePath, b.format);
          setBookData(data);
        }
      } catch (err) {
        console.error('Error al cargar libro para lectura:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Cleanup function to stop speech when exiting the reader
    return () => {
      stopSpeech();
    };
  }, [id]);

  const handleUpdateSettings = async (newSettings: Partial<ReadingSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveReadingSettings(updated);

    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({ type: 'UPDATE_SETTINGS', payload: updated })
      );
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOCATION_CHANGED' || data.type === 'PROGRESS_UPDATE') {
        const { cfi, page, percent, chapter, progress: payloadProgress } = data.payload;
        const actualPercent = percent !== undefined ? percent : payloadProgress;
        
        if (actualPercent !== undefined) setProgress(actualPercent);
        if (cfi) setCurrentCfi(String(cfi));
        if (chapter) setCurrentChapter(chapter);

        if (chapter && chapter.toLowerCase().includes('página')) {
          setPageLabel(chapter);
        } else if (page) {
          setPageLabel(`Página ${page}`);
        } else if (actualPercent !== undefined) {
          const fakePage = Math.max(1, Math.round((actualPercent / 100) * 350));
          setPageLabel(`Página ${fakePage}`);
        }

        if (book) {
          const newProgress = actualPercent !== undefined ? actualPercent : progress;
          const newCfi = cfi ? String(cfi) : String(page || progress);
          const newChapter = chapter || (page ? `Página ${page}` : undefined);
          updateBookProgress(book.id, newProgress, newCfi, newChapter);
        }
      } else if (data.type === 'COVER_GENERATED') {
        const { coverPath } = data.payload;
        if (book && coverPath && coverPath.length > 50) {
          saveBookCover(book.id, coverPath);
        }
      } else if (data.type === 'FULL_PDF_TEXT' || data.type === 'FULL_EPUB_TEXT') {
        const { text } = data.payload;
        if (book && text && text.length > 20) {
          saveExtractedBookText(book.id, text);
        }
      } else if (data.type === 'TEXT_SELECTED') {
        setSelectedText(data.payload.text || '');
      } else if (data.type === 'PAGE_TEXT_EXTRACTED') {
        setCurrentPageText(data.payload.text || '');
      } else if (data.type === 'TOGGLE_BARS') {
        setBarsVisible((prev) => !prev);
      }
    } catch (e) {}
  };

  const handleAddBookmark = async () => {
    if (!book) return;
    await addBookmark({
      bookId: book.id,
      cfiOrPage: currentCfi || `${progress}%`,
      chapterTitle: currentChapter || 'Marcador de lectura',
      snippet: selectedText || `Progreso ${progress}%`,
    });
    setToast({ visible: true, message: '✓ Posición guardada en tus marcadores.', type: 'success' });
  };

  const handleNextPage = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'NEXT_PAGE' }));
    }
  };

  const handlePrevPage = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'PREV_PAGE' }));
    }
  };

  const htmlSource = useMemo(() => {
    if (!book) return '';
    if (book.format === 'EPUB') {
      return getEpubReaderHTML(bookData.content || book.filePath, bookData.isBase64, book.currentLocation, settings, book.progressPercentage);
    }
    if (book.format === 'PDF') {
      return getPdfReaderHTML(bookData.content, book.currentLocation || '1', settings);
    }
    return getTxtReaderHTML(bookData.content, book.title, settings);
  }, [book?.id, bookData.content, book?.progressPercentage]);

  if (loading || !book) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Abriendo documento...</Text>
      </View>
    );
  }

  const getBackgroundColor = () => {
    if (settings.themeMode === 'sepia') return '#F8F1E3';
    if (settings.themeMode === 'dark') return '#1E1E2E';
    if (settings.themeMode === 'oled') return '#000000';
    return theme.bg;
  };

  const getTextColor = () => {
    if (settings.themeMode === 'dark' || settings.themeMode === 'oled') return '#CDD6F4';
    if (settings.themeMode === 'sepia') return '#433422';
    return '#111111';
  };

  const androidStatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;
  const baseUrl = FileSystem.documentDirectory || 'file:///';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: getBackgroundColor() }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      {/* Main Reader Canvas WebView (Fixed Full Screen Height) */}
      <View style={styles.readerCanvas}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlSource, baseUrl: baseUrl }}
          onMessage={handleWebViewMessage}
          style={{ backgroundColor: 'transparent' }}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          allowingReadAccessToURL="*"
        />
      </View>

      {/* Reader Floating Top Bar Overlay */}
      {barsVisible && (
        <View
          style={[
            styles.topBar,
            {
              paddingTop: androidStatusBarHeight + 6,
              height: 58 + androidStatusBarHeight,
              backgroundColor: settings.themeMode === 'dark' || settings.themeMode === 'oled' ? 'rgba(30, 30, 46, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderBottomColor: getTextColor() + '20',
            },
          ]}
        >
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={getTextColor()} />
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={[styles.headerTitle, { color: getTextColor() }]} numberOfLines={1}>
              {book.title}
            </Text>
            <Text style={[styles.headerChapter, { color: getTextColor(), opacity: 0.7 }]} numberOfLines={1}>
              {currentChapter || book.author}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            {/* TTS Button */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setTtsVisible(!ttsVisible)}>
              <Feather name="volume-2" size={20} color={ttsVisible ? '#3182CE' : getTextColor()} />
            </TouchableOpacity>

            {/* Bookmark Button */}
            <TouchableOpacity style={styles.iconBtn} onPress={handleAddBookmark}>
              <Feather name="bookmark" size={20} color={getTextColor()} />
            </TouchableOpacity>

            {/* Settings Modal Button */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setControlsVisible(true)}>
              <Feather name="sliders" size={20} color={getTextColor()} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reader Floating Bottom Navigation Bar Overlay */}
      {barsVisible && (
        <View
          style={[
            styles.bottomBar,
            {
              bottom: dynamicReaderBottom,
              backgroundColor: settings.themeMode === 'dark' || settings.themeMode === 'oled' ? 'rgba(30, 30, 46, 0.94)' : 'rgba(255, 255, 255, 0.94)',
              borderColor: getTextColor() + '22',
            },
          ]}
        >
          <TouchableOpacity style={styles.pageBtn} onPress={handlePrevPage}>
            <Feather name="chevron-left" size={22} color={getTextColor()} />
          </TouchableOpacity>

          <View style={styles.progressWrapper}>
            <View style={[styles.progressTrack, { backgroundColor: getTextColor() + '20' }]}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressLabel, { color: getTextColor() }]}>{pageLabel}</Text>
          </View>

          <TouchableOpacity style={styles.pageBtn} onPress={handleNextPage}>
            <Feather name="chevron-right" size={22} color={getTextColor()} />
          </TouchableOpacity>
        </View>
      )}

      {/* Floating TTS Control Bar */}
      {ttsVisible && (
        <TTSControlBar
          currentText={selectedText || currentPageText || `Leyendo libro ${book.title}`}
          onClose={() => setTtsVisible(false)}
        />
      )}

      {/* Reader Customization Drawer Modal */}
      <ReaderControlsModal
        visible={controlsVisible}
        onClose={() => setControlsVisible(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        format={book.format}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  titleWrapper: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerChapter: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },
  readerCanvas: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  pageBtn: {
    padding: 8,
  },
  progressWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3182CE',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
