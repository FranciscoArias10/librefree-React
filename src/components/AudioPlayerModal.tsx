import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Book } from '../types/book';
import { useTheme } from '../context/ThemeContext';
import { extractTextFromBook } from '../services/fileScanner';
import { updateBookProgress } from '../services/database';
import {
  startTTSBook,
  pauseTTS,
  resumeTTS,
  stopTTS,
  setTTSSpeed,
  jumpToTTSChunk,
  splitTextIntoChunks,
  isTTSSpeakingForBook,
} from '../services/ttsService';
import {
  loadAudiobookTrack,
  playAudio,
  pauseAudio,
  seekAudio,
  setPlaybackRate,
  PlaybackStatus,
} from '../services/audioService';

interface AudioPlayerModalProps {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  initialProgressPercentage?: number;
  onSnippetChange?: (snippet: string) => void;
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  visible,
  book,
  onClose,
  initialProgressPercentage = 0,
  onSnippetChange,
}) => {
  const { theme } = useTheme();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTextSnippet, setCurrentTextSnippet] = useState('');
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

  useEffect(() => {
    if (!visible || !book) return;

    let isMounted = true;

    async function initPlayer() {
      if (book?.format !== 'AUDIOBOOK' && isTTSSpeakingForBook(book.id)) {
        setIsPlaying(true);
        return;
      }

      stopTTS();
      setIsPlaying(false);

      if (book?.format === 'AUDIOBOOK') {
        let startPos = 0;
        if (book.currentLocation) {
          const parsed = parseInt(book.currentLocation, 10);
          if (!isNaN(parsed) && parsed > 0) startPos = parsed;
        }

        setAudioPosition(startPos);
        setAudioDuration(book.totalPagesOrDuration || 0);

        await loadAudiobookTrack(
          book.filePath,
          (status: PlaybackStatus) => {
            if (!isMounted) return;
            setIsPlaying(status.isPlaying);
            if (status.positionMillis !== undefined) {
              setAudioPosition(status.positionMillis);
            }
            if (status.durationMillis) {
              setAudioDuration(status.durationMillis);
            }

            // Periodic auto-save every 3s
            if (status.isPlaying && status.positionMillis && status.durationMillis) {
              if (Math.abs(status.positionMillis - lastSavedPosRef.current) > 3000) {
                lastSavedPosRef.current = status.positionMillis;
                const pct = Math.min(100, Math.round((status.positionMillis / status.durationMillis) * 100));
                updateBookProgress(
                  book.id,
                  pct,
                  String(Math.round(status.positionMillis)),
                  `Minuto ${formatTime(status.positionMillis / 1000)}`
                );
              }
            }
          },
          startPos
        );
        await playAudio();
        if (isMounted) setIsPlaying(true);
      } else {
        // PDF, EPUB, TXT -> TTS Generation starting from exact progress percentage!
        try {
          setIsGenerating(true);
          const textToRead = await extractTextFromBook(book!);
          if (!isMounted) return;

          let pctToUse = initialProgressPercentage > 0
            ? initialProgressPercentage
            : (book!.progressPercentage || 0);

          if (pctToUse > 0 && pctToUse <= 1.0) {
            pctToUse = pctToUse * 100;
          }

          let startChunk = 0;
          if (pctToUse > 0 && textToRead) {
            const tempChunks = splitTextIntoChunks(textToRead);
            if (tempChunks.length > 0) {
              const rawIndex = Math.floor((pctToUse / 100) * tempChunks.length);
              startChunk = Math.min(tempChunks.length - 1, Math.max(0, rawIndex));
            }
          }

          setCurrentChunkIndex(startChunk);

          startTTSBook(
            textToRead,
            speed,
            (index, total, snippet) => {
              if (!isMounted) return;
              setCurrentChunkIndex(index);
              setTotalChunks(total);
              setCurrentTextSnippet(snippet);
              if (onSnippetChange) onSnippetChange(snippet);
              setIsPlaying(true);

              const progressPct = Math.min(100, Math.round(((index + 1) / total) * 100));
              const locToSave = (book!.format === 'EPUB' && book!.currentLocation?.includes('epubcfi'))
                ? book!.currentLocation
                : String(index);
              updateBookProgress(book!.id, progressPct, locToSave, `Fragmento ${index + 1} de ${total}`);
            },
            () => {
              if (!isMounted) return;
              setIsPlaying(false);
              setCurrentTextSnippet('Lectura finalizada.');
              if (onSnippetChange) onSnippetChange('');
            },
            startChunk,
            book!.id
          );
        } catch (err) {
          console.error('Error generando voz TTS:', err);
        } finally {
          if (isMounted) setIsGenerating(false);
        }
      }
    }

    initPlayer();

    return () => {
      isMounted = false;
    };
  }, [visible, book?.id]);

  const handleTogglePlay = async () => {
    if (!book) return;

    if (book.format === 'AUDIOBOOK') {
      if (isPlaying) {
        await pauseAudio();
        setIsPlaying(false);
        if (audioDuration > 0) {
          const pct = Math.min(100, Math.round((audioPosition / audioDuration) * 100));
          await updateBookProgress(
            book.id,
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
          const locToSave = (book.format === 'EPUB' && book.currentLocation?.includes('epubcfi'))
            ? book.currentLocation
            : String(currentChunkIndex);
          await updateBookProgress(
            book.id,
            pct,
            locToSave,
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
    if (book?.format === 'AUDIOBOOK') {
      const newPos = Math.min(audioDuration, audioPosition + 15000);
      seekAudio(newPos);
    } else {
      if (currentChunkIndex < totalChunks - 1) {
        jumpToTTSChunk(currentChunkIndex + 1);
      }
    }
  };

  const handlePrevFragment = () => {
    if (book?.format === 'AUDIOBOOK') {
      const newPos = Math.max(0, audioPosition - 15000);
      seekAudio(newPos);
    } else {
      if (currentChunkIndex > 0) {
        jumpToTTSChunk(currentChunkIndex - 1);
      }
    }
  };

  const handleSeekTouch = (locationX: number) => {
    if (barWidth <= 0 || !book) return;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));

    if (book.format === 'AUDIOBOOK') {
      const targetMs = ratio * audioDuration;
      setAudioPosition(targetMs);
      seekAudio(targetMs);
      if (audioDuration > 0) {
        const pct = Math.min(100, Math.round((targetMs / audioDuration) * 100));
        updateBookProgress(
          book.id,
          pct,
          String(Math.round(targetMs)),
          `Minuto ${formatTime(targetMs / 1000)}`
        );
      }
    } else {
      if (totalChunks > 0) {
        const targetChunk = Math.min(totalChunks - 1, Math.floor(ratio * totalChunks));
        setCurrentChunkIndex(targetChunk);
        jumpToTTSChunk(targetChunk);
        const pct = Math.min(100, Math.round(((targetChunk + 1) / totalChunks) * 100));
        const locToSave = (book.format === 'EPUB' && book.currentLocation?.includes('epubcfi'))
          ? book.currentLocation
          : String(targetChunk);
        updateBookProgress(
          book.id,
          pct,
          locToSave,
          `Fragmento ${targetChunk + 1} de ${totalChunks}`
        );
      }
    }
  };

  const handleCycleSpeed = async () => {
    const idx = speeds.indexOf(speed);
    const nextSpeed = speeds[(idx + 1) % speeds.length];
    setSpeed(nextSpeed);

    if (book?.format === 'AUDIOBOOK') {
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

  const isAudioFile = book?.format === 'AUDIOBOOK';
  const progressPercent = isAudioFile
    ? audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0
    : totalChunks > 0 ? ((currentChunkIndex + 1) / totalChunks) * 100 : 0;

  // Swipe Down Gesture to minimize player
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 15,
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 60) {
        onClose();
      }
    },
  });

  if (!visible || !book) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]} {...panResponder.panHandlers}>
        {/* Top Minimize Handle */}
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.minimizeBtn} onPress={onClose}>
            <Feather name="chevron-down" size={28} color={theme.textPrimary} />
          </TouchableOpacity>

          <View style={[styles.dragBarHint, { backgroundColor: theme.border }]} />

          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.fullPlayerContent}>
          {/* Cover Artwork */}
          <View style={styles.coverWrapper}>
            {book.coverPath && book.coverPath.length > 50 ? (
              <Image source={{ uri: book.coverPath }} style={styles.coverArt} resizeMode="cover" />
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
            {book.title}
          </Text>
          <Text style={[styles.songAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
            {book.author}
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
  );
};

const styles = StyleSheet.create({
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
