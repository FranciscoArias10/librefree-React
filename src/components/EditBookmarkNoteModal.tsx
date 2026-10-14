import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface EditBookmarkNoteModalProps {
  visible: boolean;
  bookmark: {
    id: string;
    cfiOrPage: string;
    chapterTitle?: string;
    snippet?: string;
    note?: string;
    color?: string;
    bookTitle?: string;
  } | null;
  bookTitle?: string;
  onClose: () => void;
  onSave: (id: string, note: string, color?: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const COLOR_OPTIONS = [
  { color: '#FACC15', label: 'Amarillo' },
  { color: '#38BDF8', label: 'Azul' },
  { color: '#4ADE80', label: 'Verde' },
  { color: '#A855F7', label: 'Morado' },
  { color: '#F87171', label: 'Coral' },
];

export const EditBookmarkNoteModal: React.FC<EditBookmarkNoteModalProps> = ({
  visible,
  bookmark,
  bookTitle,
  onClose,
  onSave,
  onDelete,
}) => {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FACC15');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (bookmark) {
      setNoteText(bookmark.note || '');
      setSelectedColor(bookmark.color || '#FACC15');
    }
  }, [bookmark, visible]);

  if (!visible || !bookmark) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(bookmark.id, noteText.trim(), selectedColor);
      setIsSaving(false);
      onClose();
    } catch (e) {
      setIsSaving(false);
    }
  };

  const getPageDisplay = () => {
    if (bookmark.chapterTitle && bookmark.chapterTitle.toLowerCase().includes('página')) {
      return bookmark.chapterTitle;
    }
    if (bookmark.cfiOrPage && !isNaN(Number(bookmark.cfiOrPage))) {
      return `Página ${bookmark.cfiOrPage}`;
    }
    return bookmark.chapterTitle || 'Marcador';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconCircle, { backgroundColor: selectedColor + '25' }]}>
                <Feather name="bookmark" size={18} color={selectedColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
                  {bookmark.note ? 'Editar Nota de Marcador' : 'Agregar Nota al Marcador'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {getPageDisplay()} {(bookTitle || bookmark.bookTitle) ? `• ${bookTitle || bookmark.bookTitle}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Snippet quote if present */}
            {bookmark.snippet && bookmark.snippet.trim().length > 0 && (
              <View style={[styles.snippetBox, { backgroundColor: selectedColor + '12', borderLeftColor: selectedColor }]}>
                <Text style={[styles.snippetText, { color: theme.textPrimary }]} numberOfLines={3}>
                  "{bookmark.snippet.trim()}"
                </Text>
              </View>
            )}

            {/* Color Selector */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Color del marcador</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((c) => {
                const isSelected = selectedColor === c.color;
                return (
                  <TouchableOpacity
                    key={c.color}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c.color },
                      isSelected && { borderColor: theme.textPrimary, borderWidth: 3, transform: [{ scale: 1.15 }] },
                    ]}
                    onPress={() => setSelectedColor(c.color)}
                    activeOpacity={0.8}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#000000" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note text input */}
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nota / Comentario personal</Text>
              <Text style={[styles.charCount, { color: theme.textSecondary }]}>{noteText.length}/500</Text>
            </View>

            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
                  color: theme.textPrimary,
                },
              ]}
              multiline
              numberOfLines={4}
              maxLength={500}
              placeholder="Escribe tus reflexiones, ideas clave o apuntes sobre esta página..."
              placeholderTextColor={theme.textSecondary + '99'}
              value={noteText}
              onChangeText={setNoteText}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Footer actions */}
          <View style={styles.footer}>
            {onDelete && (
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: isDark ? '#EF444420' : '#FEE2E2' }]}
                onPress={() => {
                  onClose();
                  onDelete(bookmark.id);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textPrimary }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Feather name="check" size={16} color={theme.accentText} style={{ marginRight: 6 }} />
              <Text style={[styles.saveBtnText, { color: theme.accentText }]}>
                {isSaving ? 'Guardando...' : 'Guardar Nota'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    maxHeight: 340,
  },
  snippetBox: {
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    marginBottom: 14,
  },
  snippetText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 11,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
