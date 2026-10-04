import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { ReadingSettings, ReadingThemeMode, PdfPageFit, PdfContrastMode, TextAlignmentMode } from '../types/book';
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

  const fontFamilies = ['Serif', 'Sans-Serif', 'Monospace', 'Georgia', 'Merriweather'];

  const pdfFits: { mode: PdfPageFit; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
    { mode: 'fitPage', label: 'Página Completa', icon: 'maximize-2', desc: 'Ajusta la página entera en pantalla' },
    { mode: 'fitWidth', label: 'Ajustar al Ancho', icon: 'move', desc: 'Maximiza el ancho y permite desplazamiento' },
    { mode: 'fitHeight', label: 'Ajustar a Altura', icon: 'more-vertical', desc: 'Optimiza la lectura vertical' },
  ];

  const pdfContrasts: { mode: PdfContrastMode; label: string }[] = [
    { mode: 'normal', label: 'Estándar' },
    { mode: 'high', label: 'Alto Contraste' },
    { mode: 'soft', label: 'Suave / Descanso' },
  ];

  const marginOptions: { size: number; label: string }[] = [
    { size: 10, label: 'Estrecho (10px)' },
    { size: 20, label: 'Normal (20px)' },
    { size: 32, label: 'Ancho (32px)' },
  ];

  const alignments: { mode: TextAlignmentMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { mode: 'left', label: 'Izquierda', icon: 'align-left' },
    { mode: 'justify', label: 'Justificado', icon: 'align-justify' },
    { mode: 'center', label: 'Centro', icon: 'align-center' },
  ];

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
                Ajustes de {isPdf ? 'PDF (Diseño Fijo)' : 'EPUB / Texto (Adaptable)'}
              </Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                {isPdf ? 'Ajustes independientes de visualización y nitidez' : 'Personaliza la tipografía y márgenes del libro'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Tono & Modo de Lectura */}
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
              /* PDF Format Independent Controls */
              <>
                {/* PDF Page Fit Options */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Ajuste de Vista de Página (PDF)</Text>
                <View style={styles.optionsColumn}>
                  {pdfFits.map((fit) => {
                    const isSelected = (settings.pdfPageFit || 'fitPage') === fit.mode;
                    return (
                      <TouchableOpacity
                        key={fit.mode}
                        style={[
                          styles.optionCard,
                          { backgroundColor: isSelected ? theme.accent + '15' : theme.bgInput, borderColor: isSelected ? theme.accent : theme.border },
                        ]}
                        onPress={() => onUpdateSettings({ pdfPageFit: fit.mode })}
                      >
                        <View style={[styles.optionIconBox, { backgroundColor: isSelected ? theme.accent : theme.bgChip }]}>
                          <Feather name={fit.icon} size={16} color={isSelected ? theme.accentText : theme.textCard} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.optionTitle, { color: theme.textCard }]}>{fit.label}</Text>
                          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>{fit.desc}</Text>
                        </View>
                        {isSelected && <Feather name="check" size={18} color={theme.accent} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* PDF Contrast Options */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Filtro de Contraste y Nitidez</Text>
                <View style={styles.chipsRow}>
                  {pdfContrasts.map((c) => {
                    const isSelected = (settings.pdfContrast || 'normal') === c.mode;
                    return (
                      <TouchableOpacity
                        key={c.mode}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? theme.accent : theme.bgChip },
                        ]}
                        onPress={() => onUpdateSettings({ pdfContrast: c.mode })}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? theme.accentText : theme.textChip }]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* PDF Color Inversion Switch */}
                <View style={[styles.switchRow, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.switchLabel, { color: theme.textCard }]}>Inversión Nocturna de Páginas</Text>
                    <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                      Invierte los colores de las páginas PDF para lectura con luz tenue.
                    </Text>
                  </View>
                  <Switch
                    value={Boolean(settings.pdfInvertColors)}
                    onValueChange={(val) => onUpdateSettings({ pdfInvertColors: val })}
                    trackColor={{ false: theme.border, true: theme.accent }}
                  />
                </View>

                {/* PDF Info Banner */}
                <View style={[styles.pdfInfoBox, { backgroundColor: theme.bgChip, borderColor: theme.border }]}>
                  <Feather name="info" size={16} color={theme.accent} style={{ marginRight: 10, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pdfInfoTitle, { color: theme.textCard }]}>Nota de Zoom en PDF</Text>
                    <Text style={[styles.pdfInfoDesc, { color: theme.textSecondary }]}>
                      Los PDF mantienen su composición original. Puedes realizar doble toque o gesto de pellizco en la página para hacer zoom libre en cualquier momento.
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              /* EPUB & TXT Independent Controls */
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
                    <Text style={{ fontSize: Math.min(22, settings.fontSize), color: theme.textCard }}>Texto de muestra ({settings.fontSize}px)</Text>
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
                <View style={styles.chipsRow}>
                  {fontFamilies.map((font) => {
                    const isSelected = settings.fontFamily === font;
                    return (
                      <TouchableOpacity
                        key={font}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? theme.accent : theme.bgChip },
                        ]}
                        onPress={() => onUpdateSettings({ fontFamily: font })}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? theme.accentText : theme.textChip }]}>
                          {font}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
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

                {/* Margins */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Márgenes Laterales</Text>
                <View style={styles.chipsRow}>
                  {marginOptions.map((m) => {
                    const isSelected = (settings.marginSize || 20) === m.size;
                    return (
                      <TouchableOpacity
                        key={m.size}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? theme.accent : theme.bgChip },
                        ]}
                        onPress={() => onUpdateSettings({ marginSize: m.size })}
                      >
                        <Text style={[styles.chipText, { color: isSelected ? theme.accentText : theme.textChip }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Text Alignment */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Alineación del Texto</Text>
                <View style={styles.chipsRow}>
                  {alignments.map((a) => {
                    const isSelected = (settings.textAlignment || 'left') === a.mode;
                    return (
                      <TouchableOpacity
                        key={a.mode}
                        style={[
                          styles.chip,
                          { backgroundColor: isSelected ? theme.accent : theme.bgChip, flexDirection: 'row', alignItems: 'center', gap: 6 },
                        ]}
                        onPress={() => onUpdateSettings({ textAlignment: a.mode })}
                      >
                        <Feather name={a.icon} size={14} color={isSelected ? theme.accentText : theme.textChip} />
                        <Text style={[styles.chipText, { color: isSelected ? theme.accentText : theme.textChip }]}>
                          {a.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
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
    maxHeight: '85%',
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
    fontSize: 16,
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
    marginTop: 16,
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
    height: 46,
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
  optionsColumn: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  pdfInfoBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

