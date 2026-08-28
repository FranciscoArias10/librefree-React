import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { speakText, stopSpeech } from '../services/ttsService';

interface TTSControlBarProps {
  currentText: string;
  onClose: () => void;
}

export const TTSControlBar: React.FC<TTSControlBarProps> = ({ currentText, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);

  const rates = [0.75, 1.0, 1.25, 1.5];

  const handleTogglePlay = async () => {
    if (isPlaying) {
      await stopSpeech();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      await speakText(currentText || 'Comenzando lectura en voz alta del libro.', {
        rate: speechRate,
        onDone: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });
    }
  };

  const handleCycleRate = () => {
    const currentIndex = rates.indexOf(speechRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setSpeechRate(nextRate);
    if (isPlaying) {
      stopSpeech().then(() => {
        speakText(currentText, {
          rate: nextRate,
          onDone: () => setIsPlaying(false),
        });
      });
    }
  };

  const handleStop = async () => {
    await stopSpeech();
    setIsPlaying(false);
    onClose();
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoRow}>
        <Feather name="volume-2" size={18} color="#3182CE" style={{ marginRight: 8 }} />
        <Text style={styles.statusText} numberOfLines={1}>
          {isPlaying ? 'Leyendo en voz alta...' : 'Lectura TTS lista'}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        {/* Play / Pause */}
        <TouchableOpacity style={styles.mainButton} onPress={handleTogglePlay}>
          <FontAwesome name={isPlaying ? 'pause' : 'play'} size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Speed Rate */}
        <TouchableOpacity style={styles.speedButton} onPress={handleCycleRate}>
          <Text style={styles.speedText}>{speechRate}x</Text>
        </TouchableOpacity>

        {/* Stop / Close */}
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <FontAwesome name="stop" size={14} color="#E53E3E" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1A202C',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainButton: {
    backgroundColor: '#3182CE',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedButton: {
    backgroundColor: '#2D3748',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  speedText: {
    color: '#CBD5E0',
    fontSize: 12,
    fontWeight: '700',
  },
  stopButton: {
    backgroundColor: '#2D3748',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
