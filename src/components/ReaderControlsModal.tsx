import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { ReadingSettings, ReadingThemeMode } from '../types/book';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ReaderControlsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: ReadingSettings;
  onUpdateSettings: (newSettings: Partial<ReadingSettings>) => void;
  format?: string;
}

export const ReaderControlsModal: React.FC<ReaderControlsModalProps> = ({
  visible,
  onClose,
  settings,
  onUpdateSettings,
  format,
}) => {
  const { theme } = useTheme();
  const isPdf = format === 'PDF';

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
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.bgCard, borderColor: theme.border },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.textCard }]}>
                Ajustes de {isPdf ? 'PDF' : 'EPUB'}
              </Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                Personaliza la apariencia del lector
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Theme Selector - Applicable to BOTH PDF and EPUB */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Tono & Modo de Lectura</Text>
            <View style={styles.themeGrid}>
              {themes.map((t) => (
                <TouchableOpacity
                  key={t.mode}
                  style={[
                    styles.themeCard,
                    { backgroundColor: t.bg, borderColor: settings.themeMode === t.mode ? theme.accent : theme.border },
                    settings.themeMode === t.mode && styles.selectedThemeCard,
                  ]}
                  onPress={() => onUpdateSettings({ themeMode: t.mode })}
                >
                  <Text style={[styles.themeLabel, { color: t.text }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isPdf ? (
              /* PDF Format Info Banner */
              <View style={[styles.pdfInfoBox, { backgroundColor: theme.bgChip, borderColor: theme.border }]}>
                <Feather name="info" size={18} color={theme.accent} style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pdfInfoTitle, { color: theme.textCard }]}>Formato de Documento Fijo (PDF)</Text>
                  <Text style={[styles.pdfInfoDesc, { color: theme.textSecondary }]}>
                    Los archivos PDF mantienen el diseño y tamaño de fuente original del documento. Puedes usar el selector de arriba para cambiar el tono de color (Modo Noche, Sepia o Día).
                  </Text>
                </View>
              </View>
            ) : (
              /* EPUB & TXT Reflowable Text Options */
              <>
                {/* Font Size */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Tamaño de Letra ({settings.fontSize}px)
                </Text>
                <View style={[styles.controlsRow, { backgroundColor: theme.bgInput }]}>
                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: theme.bgChip }]}
                    onPress={() => onUpdateSettings({ fontSize: Math.max(12, settings.fontSize - 2) })}
                  >
                    <Text style={[styles.adjustBtnText, { color: theme.textCard }]}>A-</Text>
                  </TouchableOpacity>

                  <View style={styles.fontSizePreview}>
                    <Text style={{ fontSize: settings.fontSize, color: theme.textCard }}>Texto de muestra</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: theme.bgChip }]}
                    onPress={() => onUpdateSettings({ fontSize: Math.min(36, settings.fontSize + 2) })}
                  >
                    <Text style={[styles.adjustBtnText, { color: theme.textCard }]}>A+</Text>
                  </TouchableOpacity>
                </View>

                {/* Typography / Font Family */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Tipografía</Text>
                <View style={styles.fontRow}>
                  {fontFamilies.map((font) => (
                    <TouchableOpacity
                      key={font}
                      style={[
                        styles.fontChip,
                        { backgroundColor: settings.fontFamily === font ? theme.accent : theme.bgChip },
                      ]}
                      onPress={() => onUpdateSettings({ fontFamily: font })}
                    >
                      <Text
                        style={[
                          styles.fontChipText,
                          { color: settings.fontFamily === font ? theme.accentText : theme.textChip },
                        ]}
                      >
                        {font}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Line Height */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Interlineado ({settings.lineHeight.toFixed(1)})
                </Text>
                <View style={[styles.controlsRow, { backgroundColor: theme.bgInput }]}>
                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: theme.bgChip }]}
                    onPress={() => onUpdateSettings({ lineHeight: Math.max(1.1, Number((settings.lineHeight - 0.1).toFixed(1))) })}
                  >
                    <Text style={[styles.adjustBtnText, { color: theme.textCard }]}>-</Text>
                  </TouchableOpacity>

                  <Text style={[styles.valueText, { color: theme.textCard }]}>{settings.lineHeight.toFixed(1)}x</Text>

                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: theme.bgChip }]}
                    onPress={() => onUpdateSettings({ lineHeight: Math.min(2.5, Number((settings.lineHeight + 0.1).toFixed(1))) })}
                  >
                    <Text style={[styles.adjustBtnText, { color: theme.textCard }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 30,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
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
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedThemeCard: {
    elevation: 3,
    shadowColor: '#3182CE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  pdfInfoBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  pdfInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  pdfInfoDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 8,
  },
  adjustBtn: {
    borderRadius: 10,
    width: 44,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  fontSizePreview: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  fontRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  fontChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
