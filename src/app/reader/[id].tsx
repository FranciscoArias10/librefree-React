import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  PanResponder,
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
import { AudioPlayerModal } from '../../components/AudioPlayerModal';
import { speakText, stopSpeech } from '../../services/ttsService';
import { Book, ReadingSettings } from '../../types/book';
import { Toast } from '../../components/Toast';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface TopProgressScrubberProps {
  progress: number;
  totalPages?: number;
  textColor: string;
  themeMode: string;
  onSeek: (percent: number) => void;
}

const TopProgressScrubber: React.FC<TopProgressScrubberProps> = ({
  progress,
  totalPages = 350,
  textColor,
  themeMode,
  onSeek,
}) => {
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackPageX, setTrackPageX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(progress);
  const initialPctRef = useRef(progress);
  const lastSeekTimeRef = useRef(0);

  useEffect(() => {
    if (!isDragging) {
      setDragPercent(progress);
    }
  }, [progress, isDragging]);

  const emitThrottledSeek = (pct: number, force: boolean = false) => {
    const now = Date.now();
    if (force || now - lastSeekTimeRef.current > 60) {
      lastSeekTimeRef.current = now;
      onSeek(pct);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        setIsDragging(true);
        initialPctRef.current = dragPercent;

        const touchX = evt.nativeEvent.pageX;
        if (trackWidth > 0 && trackPageX > 0) {
          const relX = Math.max(0, Math.min(trackWidth, touchX - trackPageX));
          const tapPct = Math.max(0, Math.min(100, Math.round((relX / trackWidth) * 100)));
          initialPctRef.current = tapPct;
          setDragPercent(tapPct);
          emitThrottledSeek(tapPct, true);
        } else {
          emitThrottledSeek(dragPercent, true);
        }

        if (trackRef.current) {
          trackRef.current.measureInWindow((x, y, w) => {
            if (x > 0) setTrackPageX(x);
            if (w > 0) setTrackWidth(w);
          });
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touchX = evt.nativeEvent.pageX;
        let pct = dragPercent;

        if (trackWidth > 0 && trackPageX > 0) {
          const relX = Math.max(0, Math.min(trackWidth, touchX - trackPageX));
          pct = Math.max(0, Math.min(100, Math.round((relX / trackWidth) * 100)));
        } else if (trackWidth > 0) {
          const deltaPct = (gestureState.dx / trackWidth) * 100;
          pct = Math.max(0, Math.min(100, Math.round(initialPctRef.current + deltaPct)));
        }

        setDragPercent(pct);
        emitThrottledSeek(pct, false);
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);
        const touchX = evt.nativeEvent.pageX;
        let pct = dragPercent;

        if (trackWidth > 0 && trackPageX > 0) {
          const relX = Math.max(0, Math.min(trackWidth, touchX - trackPageX));
          pct = Math.max(0, Math.min(100, Math.round((relX / trackWidth) * 100)));
        } else if (trackWidth > 0) {
          const deltaPct = (gestureState.dx / trackWidth) * 100;
          pct = Math.max(0, Math.min(100, Math.round(initialPctRef.current + deltaPct)));
        }

        setDragPercent(pct);
        emitThrottledSeek(pct, true);
      },
    })
  ).current;

  const currentPercent = isDragging ? dragPercent : progress;
  const total = totalPages && totalPages > 0 ? totalPages : 350;
  const estimatedPage =
    currentPercent <= 0
      ? 1
      : currentPercent >= 100
      ? total
      : Math.max(1, Math.min(total, Math.round((currentPercent / 100) * total)));

  const isDark = themeMode === 'dark' || themeMode === 'oled';

  return (
    <View
      ref={trackRef}
      style={styles.scrubberWrapper}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setTrackWidth(w);
        trackRef.current?.measureInWindow((x, y, width) => {
          if (x > 0) setTrackPageX(x);
          if (width > 0) setTrackWidth(width);
        });
      }}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.scrubberTrack,
          { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)' },
        ]}
      >
        <View
          style={[
            styles.scrubberFill,
            {
              width: `${currentPercent}%`,
              backgroundColor: isDark ? '#60A5FA' : '#2563EB',
            },
          ]}
        />
      </View>

      <View style={[styles.scrubberThumb, { left: `${currentPercent}%` }]}>
        <View style={[styles.scrubberThumbInner, { backgroundColor: isDark ? '#60A5FA' : '#2563EB' }]} />
      </View>

      {isDragging && (
        <View style={[styles.tooltipBadge, { left: `${Math.max(16, Math.min(84, currentPercent))}%` }]}>
          <Text style={styles.tooltipText}>Pág. {estimatedPage} de {total} ({currentPercent}%)</Text>
        </View>
      )}
    </View>
  );
};

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
  const [ttsActive, setTtsActive] = useState(false);
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [ttsIsPlaying, setTtsIsPlaying] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [currentPageText, setCurrentPageText] = useState<string>('');
  const [pageLabel, setPageLabel] = useState<string>('Página 1');
  const [totalPages, setTotalPages] = useState<number>(350);
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

          const data = await readBookContent(b.filePath, b.format, b.id);
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
        const { cfi, page, percent, totalPages: payloadTotalPages, chapter, progress: payloadProgress } = data.payload;
        const actualPercent = percent !== undefined ? percent : payloadProgress;
        
        if (actualPercent !== undefined) setProgress(actualPercent);
        if (cfi) setCurrentCfi(String(cfi));
        if (chapter) setCurrentChapter(chapter);
        if (payloadTotalPages && payloadTotalPages > 0) setTotalPages(payloadTotalPages);

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
              paddingTop: androidStatusBarHeight + 4,
              backgroundColor: settings.themeMode === 'dark' || settings.themeMode === 'oled' ? 'rgba(30, 30, 46, 0.96)' : 'rgba(255, 255, 255, 0.96)',
              borderBottomColor: getTextColor() + '20',
            },
          ]}
        >
          <View style={styles.topBarRow}>
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
              {/* TTS / Audio Button */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  if (ttsActive) {
                    setTtsActive(false);
                    setTtsIsPlaying(false);
                    stopSpeech();
                    webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet: '' }));
                  } else {
                    setTtsActive(true);
                    setTtsIsPlaying(true);
                    const textToRead = currentPageText || `Comenzando lectura de ${pageLabel}`;
                    speakText(textToRead, {
                      onProgress: (idx, tot, snippet) => {
                        webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet }));
                      },
                      onDone: () => {
                        setTtsIsPlaying(false);
                        webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet: '' }));
                      },
                      onError: () => {
                        setTtsIsPlaying(false);
                        webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet: '' }));
                      },
                    });
                  }
                }}
              >
                <Feather name="volume-2" size={20} color={ttsActive ? '#3182CE' : getTextColor()} />
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

          {/* Quick Progress Scrubber (El punto desplazable superior) */}
          <TopProgressScrubber
            progress={progress}
            totalPages={totalPages}
            textColor={getTextColor()}
            themeMode={settings.themeMode}
            onSeek={(pct) => {
              setProgress(pct);
              webViewRef.current?.postMessage(JSON.stringify({ type: 'SEEK_PERCENT', payload: { percent: pct } }));
            }}
          />
        </View>
      )}

      {/* Floating Bottom Bar: Mini Audio Player Bar or Page Navigation Bar */}
      {barsVisible && (
        ttsActive ? (
          <View
            style={[
              styles.bottomBar,
              {
                bottom: dynamicReaderBottom,
                backgroundColor: settings.themeMode === 'dark' || settings.themeMode === 'oled' ? 'rgba(30, 30, 46, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                borderColor: '#8E44AD44',
                paddingHorizontal: 14,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.miniPlayBtnCircle, { backgroundColor: '#8E44AD' }]}
              onPress={() => {
                if (ttsIsPlaying) {
                  stopSpeech();
                  setTtsIsPlaying(false);
                } else {
                  setTtsIsPlaying(true);
                  const textToRead = currentPageText || `Leyendo ${pageLabel}`;
                  speakText(textToRead, {
                    onProgress: (idx, tot, snippet) => {
                      webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet }));
                    },
                    onDone: () => {
                      setTtsIsPlaying(false);
                      webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet: '' }));
                    },
                    onError: () => {
                      setTtsIsPlaying(false);
                      webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet: '' }));
                    },
                  });
                }
              }}
            >
              <FontAwesome name={ttsIsPlaying ? 'pause' : 'play'} size={14} color="#FFFFFF" style={{ marginLeft: ttsIsPlaying ? 0 : 2 }} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.miniTextFlex} onPress={() => setFullPlayerVisible(true)} activeOpacity={0.8}>
              <Text style={[styles.miniTextTitle, { color: getTextColor() }]} numberOfLines={1}>
                {pageLabel} • Lectura en vivo
              </Text>
              <Text style={[styles.miniTextSub, { color: getTextColor(), opacity: 0.7 }]} numberOfLines={1}>
                {currentPageText ? currentPageText.substring(0, 40) + '...' : (currentChapter || `Página actual`)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => setFullPlayerVisible(true)}>
              <Feather name="chevron-up" size={22} color={getTextColor()} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setTtsActive(false);
                setTtsIsPlaying(false);
                stopSpeech();
              }}
            >
              <Feather name="x" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
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
        )
      )}

      {/* Standalone Full Audio Player Modal */}
      <AudioPlayerModal
        visible={fullPlayerVisible}
        book={book}
        initialProgressPercentage={progress}
        onClose={() => setFullPlayerVisible(false)}
        onSnippetChange={(snippet) => {
          webViewRef.current?.postMessage(JSON.stringify({ type: 'HIGHLIGHT_SPEECH_TEXT', snippet }));
        }}
      />

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
    flexDirection: 'column',
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
  },
  scrubberWrapper: {
    height: 24,
    marginHorizontal: 20,
    marginBottom: 6,
    justifyContent: 'center',
    position: 'relative',
  },
  scrubberTrack: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    marginLeft: -9,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  scrubberThumbInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tooltipBadge: {
    position: 'absolute',
    bottom: 26,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: -16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
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
  miniPlayBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miniTextFlex: {
    flex: 1,
    justifyContent: 'center',
  },
  miniTextTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  miniTextSub: {
    fontSize: 10,
    marginTop: 1,
  },
});
