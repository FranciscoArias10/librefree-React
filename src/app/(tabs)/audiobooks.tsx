import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  StatusBar,
  Platform,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getAllBooks, getBookById, updateBookProgress } from '../../services/database';
import { extractTextFromBook } from '../../services/fileScanner';
import { Book } from '../../types/book';
import {
  startTTSBook,
  pauseTTS,
  resumeTTS,
  stopTTS,
  setTTSSpeed,
  jumpToTTSChunk,
} from '../../services/ttsService';
import {
  loadAudiobookTrack,
  playAudio,
  pauseAudio,
  seekAudio,
  setPlaybackRate,
  PlaybackStatus,
} from '../../services/audioService';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

export default function AudiobooksScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const miniPlayerBottom = Math.max(insets.bottom + 8, 16) + 68;

  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [isFullPlayerVisible, setIsFullPlayerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTextSnippet, setCurrentTextSnippet] = useState('');
  
  // Progress tracking
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(1);
  const [speed, setSpeed] = useState(1.0);

  // Audio file mode states
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Layout width for timeline dragging
  const [barWidth, setBarWidth] = useState(0);
  const lastSavedPosRef = useRef<number>(0);

  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  const fetchLibrary = async () => {
    const all = await getAllBooks();
    setLibraryBooks(all);
  };

  useFocusEffect(
    useCallback(() => {
      fetchLibrary();
    }, [])
  );

  const handleSelectBook = async (book: Book) => {
    // 1. Save progress of currently active book before switching to a new one
    if (activeBook && activeBook.id !== book.id) {
      if (activeBook.format === 'AUDIOBOOK') {
        if (audioDuration > 0 && audioPosition > 0) {
          const pct = Math.min(100, Math.round((audioPosition / audioDuration) * 100));
          await updateBookProgress(
            activeBook.id,
            pct,
            String(Math.round(audioPosition)),
            `Minuto ${formatTime(audioPosition / 1000)}`
          );
        }
      } else {
        if (totalChunks > 0 && currentChunkIndex > 0) {
          const pct = Math.min(100, Math.round(((currentChunkIndex + 1) / totalChunks) * 100));
          await updateBookProgress(
            activeBook.id,
            pct,
            String(currentChunkIndex),
            `Fragmento ${currentChunkIndex + 1} de ${totalChunks}`
          );
        }
      }
    }

    stopTTS();

    // 2. Fetch fresh record from DB so we get the latest saved location
    const freshBook = (await getBookById(book.id)) || book;
    setActiveBook(freshBook);
    setIsFullPlayerVisible(true);
    setIsPlaying(false);

    let savedPos = 0;
    if (freshBook.currentLocation) {
      const parsed = parseInt(freshBook.currentLocation, 10);
      if (!isNaN(parsed) && parsed > 0) savedPos = parsed;
    }

    lastSavedPosRef.current = savedPos;

    if (freshBook.format === 'AUDIOBOOK') {
      setAudioPosition(savedPos);
      setAudioDuration(freshBook.totalPagesOrDuration || 0);

      loadAudiobookTrack(
        freshBook.filePath,
        (status: PlaybackStatus) => {
          setIsPlaying(status.isPlaying);
          if (status.positionMillis !== undefined) {
            setAudioPosition(status.positionMillis);
          }
          if (status.durationMillis) {
            setAudioDuration(status.durationMillis);
          }

          // Throttle periodic progress saving to DB every 2.5s while playing
          if (status.isPlaying && status.positionMillis && status.durationMillis) {
            if (Math.abs(status.positionMillis - lastSavedPosRef.current) > 2500) {
              lastSavedPosRef.current = status.positionMillis;
              const pct = Math.min(100, Math.round((status.positionMillis / status.durationMillis) * 100));
              updateBookProgress(
                freshBook.id,
                pct,
                String(Math.round(status.positionMillis)),
                `Minuto ${formatTime(status.positionMillis / 1000)}`
              );
            }
          }
        },
        savedPos
      );
    } else {
      // PDF, EPUB, TXT -> Full TTS Generation
      try {
        setIsGenerating(true);
        const textToRead = await extractTextFromBook(freshBook);

        setCurrentChunkIndex(savedPos);

        startTTSBook(
          textToRead,
          speed,
          (index, total, snippet) => {
            setCurrentChunkIndex(index);
            setTotalChunks(total);
            setCurrentTextSnippet(snippet);
            setIsPlaying(true);

            // Save TTS progress continuously to SQLite without overwriting EPUB CFI
            const progressPct = Math.min(100, Math.round(((index + 1) / total) * 100));
            const locToSave = (freshBook.format === 'EPUB' && freshBook.currentLocation?.includes('epubcfi'))
              ? freshBook.currentLocation
              : String(index);
            updateBookProgress(freshBook.id, progressPct, locToSave, `Fragmento ${index + 1} de ${total}`);
          },
          () => {
            setIsPlaying(false);
            setCurrentTextSnippet('Lectura finalizada.');
          },
          savedPos
        );
      } catch (err) {
        console.error('Error generando audiolibro:', err);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleTogglePlay = async () => {
    if (!activeBook) return;

    if (activeBook.format === 'AUDIOBOOK') {
      if (isPlaying) {
        await pauseAudio();
        setIsPlaying(false);
        if (audioDuration > 0) {
          const pct = Math.min(100, Math.round((audioPosition / audioDuration) * 100));
          await updateBookProgress(
            activeBook.id,
            pct,
            String(Math.round(audioPosition)),
            `Minuto ${formatTime(audioPosition / 1000)}`
          );
        }
      } else {
        await playAudio();
        setIsPlaying(true);
      }
    } else {
      if (isPlaying) {
        pauseTTS();
        setIsPlaying(false);
        if (totalChunks > 0) {
          const pct = Math.min(100, Math.round(((currentChunkIndex + 1) / totalChunks) * 100));
          await updateBookProgress(
            activeBook.id,
            pct,
            String(currentChunkIndex),
            `Fragmento ${currentChunkIndex + 1} de ${totalChunks}`
          );
        }
      } else {
        resumeTTS();
        setIsPlaying(true);
      }
    }
  };

  const handleNextFragment = () => {
    if (activeBook?.format === 'AUDIOBOOK') {
      const newPos = Math.min(audioDuration, audioPosition + 15000);
      seekAudio(newPos);
    } else {
      if (currentChunkIndex < totalChunks - 1) {
        jumpToTTSChunk(currentChunkIndex + 1);
      }
    }
  };

  const handlePrevFragment = () => {
    if (activeBook?.format === 'AUDIOBOOK') {
      const newPos = Math.max(0, audioPosition - 15000);
      seekAudio(newPos);
    } else {
      if (currentChunkIndex > 0) {
        jumpToTTSChunk(currentChunkIndex - 1);
      }
    }
  };

  const handleSeekTouch = (locationX: number) => {
    if (barWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));

    if (activeBook?.format === 'AUDIOBOOK') {
      const targetMs = ratio * audioDuration;
      setAudioPosition(targetMs);
      seekAudio(targetMs);
      if (activeBook && audioDuration > 0) {
        const pct = Math.min(100, Math.round((targetMs / audioDuration) * 100));
        updateBookProgress(
          activeBook.id,
          pct,
          String(Math.round(targetMs)),
          `Minuto ${formatTime(targetMs / 1000)}`
        );
      }
    } else {
      if (totalChunks > 0 && activeBook) {
        const targetChunk = Math.min(totalChunks - 1, Math.floor(ratio * totalChunks));
        setCurrentChunkIndex(targetChunk);
        jumpToTTSChunk(targetChunk);
        const pct = Math.min(100, Math.round(((targetChunk + 1) / totalChunks) * 100));
        updateBookProgress(
          activeBook.id,
          pct,
          String(targetChunk),
          `Fragmento ${targetChunk + 1} de ${totalChunks}`
        );
      }
    }
  };

  const handleCycleSpeed = async () => {
    const idx = speeds.indexOf(speed);
    const nextSpeed = speeds[(idx + 1) % speeds.length];
    setSpeed(nextSpeed);

    if (activeBook?.format === 'AUDIOBOOK') {
      await setPlaybackRate(nextSpeed);
    } else {
      setTTSSpeed(nextSpeed, currentChunkIndex);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isAudioFile = activeBook?.format === 'AUDIOBOOK';
  const progressPercent = isAudioFile
    ? audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0
    : totalChunks > 0 ? ((currentChunkIndex + 1) / totalChunks) * 100 : 0;

  // Swipe Down Gesture to minimize full player
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 15,
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 60) {
        setIsFullPlayerVisible(false);
      }
    },
  });

  const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg, paddingTop: androidStatusBarPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Sección de Audiolibros</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Selecciona cualquier libro para escucharlo con el reproductor de música
        </Text>
      </View>

      {/* Main Books Grid / List */}
      {libraryBooks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="headphones" size={56} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.textCard }]}>No hay libros disponibles</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Importa libros desde la estantería para escucharlos aquí.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.listContainer, { paddingBottom: activeBook ? miniPlayerBottom + 80 : 120 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Selecciona un Libro para Reproducir ({libraryBooks.length})
          </Text>
          {libraryBooks.map((b) => {
            const isActive = activeBook?.id === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.bookCardItem,
                  { backgroundColor: theme.bgCard, borderColor: theme.border },
                  isActive && { borderColor: '#8E44AD', borderWidth: 2 },
                ]}
                activeOpacity={0.8}
                onPress={() => handleSelectBook(b)}
              >
                <View style={[styles.cardCoverThumb, { backgroundColor: theme.bg }]}>
                  {b.coverPath && b.coverPath.length > 50 ? (
                    <Image source={{ uri: b.coverPath }} style={styles.thumbImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbPlaceholder, { backgroundColor: theme.mode === 'dark' ? '#2C1A38' : '#F3E5F5' }]}>
                      <Feather name="headphones" size={20} color="#8E44AD" />
                    </View>
                  )}
                </View>

                <View style={styles.cardDetails}>
                  <Text style={[styles.cardTitle, { color: theme.textCard }]} numberOfLines={1}>
                    {b.title}
                  </Text>
                  <Text style={[styles.cardAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                    {b.author} • {b.format}
                  </Text>
                </View>

                <TouchableOpacity style={styles.cardPlayBtn} onPress={() => handleSelectBook(b)}>
                  <FontAwesome
                    name={isActive && isPlaying ? 'pause' : 'play'}
                    size={16}
                    color="#FFFFFF"
                    style={{ marginLeft: isActive && isPlaying ? 0 : 2 }}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Floating Mini Player Bar */}
      {activeBook && !isFullPlayerVisible && (
        <TouchableOpacity
          style={[
            styles.miniPlayerBar,
            {
              bottom: miniPlayerBottom,
              backgroundColor: theme.bgCard,
              borderColor: theme.border,
            },
          ]}
          activeOpacity={0.9}
          onPress={() => setIsFullPlayerVisible(true)}
        >
          <View style={styles.miniCover}>
            {activeBook.coverPath && activeBook.coverPath.length > 50 ? (
              <Image source={{ uri: activeBook.coverPath }} style={styles.miniThumbImage} />
            ) : (
              <View style={[styles.miniThumbPlaceholder, { backgroundColor: theme.mode === 'dark' ? '#2C1A38' : '#F3E5F5' }]}>
                <Feather name="headphones" size={16} color="#8E44AD" />
              </View>
            )}
          </View>

          <View style={styles.miniDetails}>
            <Text style={[styles.miniTitle, { color: theme.textCard }]} numberOfLines={1}>
              {activeBook.title}
            </Text>
            <Text style={[styles.miniSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {isGenerating ? 'Generando voz...' : currentTextSnippet || activeBook.author}
            </Text>
          </View>

          <TouchableOpacity style={styles.miniPlayBtn} onPress={handleTogglePlay}>
            <FontAwesome name={isPlaying ? 'pause' : 'play'} size={14} color="#FFFFFF" style={{ marginLeft: isPlaying ? 0 : 2 }} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.miniExpandBtn} onPress={() => setIsFullPlayerVisible(true)}>
            <Feather name="chevron-up" size={22} color={theme.iconDefault} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Full-Screen Music Player Modal */}
      <Modal
        visible={isFullPlayerVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullPlayerVisible(false)}
      >
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]} {...panResponder.panHandlers}>
          {/* Top Minimize Handle */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.minimizeBtn} onPress={() => setIsFullPlayerVisible(false)}>
              <Feather name="chevron-down" size={28} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={[styles.dragBarHint, { backgroundColor: theme.border }]} />

            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.fullPlayerContent}>
            {/* Cover Artwork */}
            <View style={styles.coverWrapper}>
              {activeBook?.coverPath && activeBook.coverPath.length > 50 ? (
                <Image source={{ uri: activeBook.coverPath }} style={styles.coverArt} resizeMode="cover" />
              ) : (
                <View style={[styles.placeholderArt, { backgroundColor: theme.mode === 'dark' ? '#2C1A38' : '#F3E5F5' }]}>
                  <Feather name="headphones" size={60} color="#8E44AD" />
                </View>
              )}
              <View style={styles.badgeTag}>
                <Feather name="mic" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.badgeText}>{isAudioFile ? 'MP3' : 'Generado por Voz (TTS)'}</Text>
              </View>
            </View>

            {/* Song Title & Author */}
            <Text style={[styles.songTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {activeBook?.title}
            </Text>
            <Text style={[styles.songAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
              {activeBook?.author}
            </Text>

            {/* Live Text Snippet Box */}
            <View style={[styles.snippetBox, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Text style={[styles.snippetText, { color: theme.textSecondary }]} numberOfLines={3}>
                {isGenerating ? 'Generando audiolibro en voz alta...' : currentTextSnippet || `Página / Fragmento ${currentChunkIndex + 1} de ${totalChunks}`}
              </Text>
            </View>

            {/* Interactive Drag & Seek Progress Timeline Slider */}
            <View style={styles.progressSection}>
              <View
                style={styles.progressTouchZone}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => handleSeekTouch(e.nativeEvent.locationX)}
                onResponderMove={(e) => handleSeekTouch(e.nativeEvent.locationX)}
              >
                <View style={[styles.progressBarBg, { backgroundColor: theme.bgChip }]}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                  <View style={[styles.progressKnob, { left: `${progressPercent}%` }]} />
                </View>
              </View>

              <View style={styles.timeRow}>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  {isAudioFile ? formatTime(audioPosition / 1000) : `Pág ${currentChunkIndex + 1}`}
                </Text>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  {isAudioFile ? formatTime(audioDuration / 1000) : `${totalChunks} Páginas`}
                </Text>
              </View>
            </View>

            {/* Main Player Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity style={[styles.secondaryControl, { backgroundColor: theme.bgChip }]} onPress={handlePrevFragment}>
                <Feather name="rotate-ccw" size={22} color={theme.iconDefault} />
                <Text style={[styles.seekLabel, { color: theme.textSecondary }]}>15s</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.playButton} onPress={handleTogglePlay}>
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome name={isPlaying ? 'pause' : 'play'} size={28} color="#FFFFFF" style={{ marginLeft: isPlaying ? 0 : 4 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.secondaryControl, { backgroundColor: theme.bgChip }]} onPress={handleNextFragment}>
                <Feather name="rotate-cw" size={22} color={theme.iconDefault} />
                <Text style={[styles.seekLabel, { color: theme.textSecondary }]}>15s</Text>
              </TouchableOpacity>
            </View>

            {/* Speed Control Button */}
            <View style={styles.extraControlsRow}>
              <TouchableOpacity style={[styles.chipButton, { backgroundColor: theme.bgCard, borderColor: theme.border }]} onPress={handleCycleSpeed}>
                <Feather name="zap" size={16} color="#8E44AD" style={{ marginRight: 6 }} />
                <Text style={[styles.chipButtonText, { color: theme.textCard }]}>Velocidad: {speed}x</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  bookCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardCoverThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardAuthor: {
    fontSize: 12,
    marginTop: 2,
  },
  cardPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8E44AD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 60,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    elevation: 10,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
  },
  miniCover: {
    width: 42,
    height: 42,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 10,
  },
  miniThumbImage: {
    width: '100%',
    height: '100%',
  },
  miniThumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniDetails: {
    flex: 1,
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  miniSub: {
    fontSize: 11,
    marginTop: 1,
  },
  miniPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#8E44AD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  miniExpandBtn: {
    padding: 4,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  minimizeBtn: {
    padding: 4,
  },
  dragBarHint: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  fullPlayerContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  coverWrapper: {
    width: 240,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 20,
    elevation: 8,
    shadowColor: '#8E44AD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  coverArt: {
    width: '100%',
    height: '100%',
  },
  placeholderArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(142, 68, 173, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  songTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  songAuthor: {
    fontSize: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  snippetBox: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    marginVertical: 16,
    borderWidth: 1,
  },
  snippetText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  progressSection: {
    width: '100%',
    marginBottom: 20,
  },
  progressTouchZone: {
    width: '100%',
    paddingVertical: 10,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8E44AD',
    borderRadius: 4,
  },
  progressKnob: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8E44AD',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: -9,
    top: -5,
    elevation: 4,
    shadowColor: '#8E44AD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 20,
  },
  secondaryControl: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  seekLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#8E44AD',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#8E44AD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  extraControlsRow: {
    flexDirection: 'row',
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
