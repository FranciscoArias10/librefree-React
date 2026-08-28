import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { ReadingSettings, ReadingThemeMode } from '../types/book';
import { Feather } from '@expo/vector-icons';

interface ReaderControlsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: ReadingSettings;
  onUpdateSettings: (newSettings: Partial<ReadingSettings>) => void;
}

export const ReaderControlsModal: React.FC<ReaderControlsModalProps> = ({
  visible,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const themes: { mode: ReadingThemeMode; label: string; bg: string; text: string }[] = [
    { mode: 'light', label: 'Día', bg: '#FFFFFF', text: '#111111' },
    { mode: 'sepia', label: 'Sepia', bg: '#F8F1E3', text: '#433422' },
    { mode: 'dark', label: 'Noche', bg: '#1E1E2E', text: '#CDD6F4' },
    { mode: 'oled', label: 'OLED', bg: '#000000', text: '#E0E0E0' },
  ];

  const fontFamilies = ['Serif', 'Sans-Serif', 'Monospace', 'Georgia'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Personalizar Lector</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#718096" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Theme Selector */}
            <Text style={styles.sectionLabel}>Modo de Lectura</Text>
            <View style={styles.themeGrid}>
              {themes.map((t) => (
                <TouchableOpacity
                  key={t.mode}
                  style={[
                    styles.themeCard,
                    { backgroundColor: t.bg, borderColor: settings.themeMode === t.mode ? '#3182CE' : '#E2E8F0' },
                    settings.themeMode === t.mode && styles.selectedThemeCard,
                  ]}
                  onPress={() => onUpdateSettings({ themeMode: t.mode })}
                >
                  <Text style={[styles.themeLabel, { color: t.text }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Font Size */}
            <Text style={styles.sectionLabel}>Tamaño de Letra ({settings.fontSize}px)</Text>
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => onUpdateSettings({ fontSize: Math.max(12, settings.fontSize - 2) })}
              >
                <Text style={styles.adjustBtnText}>A-</Text>
              </TouchableOpacity>

              <View style={styles.fontSizePreview}>
                <Text style={{ fontSize: settings.fontSize, color: '#2D3748' }}>Texto de muestra</Text>
              </View>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => onUpdateSettings({ fontSize: Math.min(36, settings.fontSize + 2) })}
              >
                <Text style={styles.adjustBtnText}>A+</Text>
              </TouchableOpacity>
            </View>

            {/* Typography / Font Family */}
            <Text style={styles.sectionLabel}>Tipografía</Text>
            <View style={styles.fontRow}>
              {fontFamilies.map((font) => (
                <TouchableOpacity
                  key={font}
                  style={[
                    styles.fontChip,
                    settings.fontFamily === font && styles.selectedFontChip,
                  ]}
                  onPress={() => onUpdateSettings({ fontFamily: font })}
                >
                  <Text style={[styles.fontChipText, settings.fontFamily === font && styles.selectedFontChipText]}>
                    {font}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Line Height */}
            <Text style={styles.sectionLabel}>Interlineado ({settings.lineHeight.toFixed(1)})</Text>
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => onUpdateSettings({ lineHeight: Math.max(1.1, Number((settings.lineHeight - 0.1).toFixed(1))) })}
              >
                <Text style={styles.adjustBtnText}>-</Text>
              </TouchableOpacity>

              <Text style={styles.valueText}>{settings.lineHeight.toFixed(1)}x</Text>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => onUpdateSettings({ lineHeight: Math.min(2.5, Number((settings.lineHeight + 0.1).toFixed(1))) })}
              >
                <Text style={styles.adjustBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A5568',
    marginTop: 14,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  themeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  themeCard: {
    width: '23%',
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedThemeCard: {
    borderColor: '#3182CE',
    shadowColor: '#3182CE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7FAFC',
    borderRadius: 10,
    padding: 8,
  },
  adjustBtn: {
    backgroundColor: '#EDF2F7',
    borderRadius: 8,
    width: 44,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
  },
  fontSizePreview: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3748',
  },
  fontRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EDF2F7',
    borderRadius: 8,
  },
  selectedFontChip: {
    backgroundColor: '#3182CE',
  },
  fontChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A5568',
  },
  selectedFontChipText: {
    color: '#FFFFFF',
  },
});
