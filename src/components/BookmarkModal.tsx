import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Bookmark } from '../types/book';

export interface BookmarkModalProps {
  visible: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle?: string;
  currentCfiOrPage: string;
  currentChapter?: string;
  selectedText?: string;
  bookmarks: Bookmark[];
  onSaveBookmark: (data: { cfiOrPage: string; chapterTitle?: string; snippet?: string; note?: string; color?: string; id?: string }) => Promise<void> | void;
  onDeleteBookmark: (id: string) => Promise<void> | void;
  onJumpToBookmark: (bookmark: Bookmark) => void;
}

const COLOR_OPTIONS = [
  { color: '#FACC15', label: 'Amarillo' },
  { color: '#38BDF8', label: 'Azul' },
  { color: '#4ADE80', label: 'Verde' },
  { color: '#A855F7', label: 'Morado' },
  { color: '#F87171', label: 'Coral' },
];

export const BookmarkModal: React.FC<BookmarkModalProps> = ({
  visible,
  onClose,
  bookId,
  bookTitle,
  currentCfiOrPage,
  currentChapter,
  selectedText,
  bookmarks,
  onSaveBookmark,
  onDeleteBookmark,
  onJumpToBookmark,
}) => {
  const { theme, themeMode } = useTheme();
  const isDark = theme.mode === 'dark';

  const [activeTab, setActiveTab] = useState<'current' | 'list'>('current');
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FACC15');
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check if current page already has a bookmark
  const existingCurrentBookmark = useMemo(() => {
    return bookmarks.find(
      (b) => b.cfiOrPage === currentCfiOrPage || (currentChapter && b.chapterTitle === currentChapter)
    );
  }, [bookmarks, currentCfiOrPage, currentChapter]);

  useEffect(() => {
    if (visible) {
      if (existingCurrentBookmark) {
        setEditingBookmarkId(existingCurrentBookmark.id);
        setNoteText(existingCurrentBookmark.note || '');
        setSelectedColor(existingCurrentBookmark.color || '#FACC15');
      } else {
        setEditingBookmarkId(null);
        setNoteText('');
        setSelectedColor('#FACC15');
      }
      setActiveTab('current');
    }
  }, [visible, existingCurrentBookmark]);

  if (!visible) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSaveBookmark({
        id: editingBookmarkId || undefined,
        cfiOrPage: editingBookmarkId && existingCurrentBookmark ? existingCurrentBookmark.cfiOrPage : currentCfiOrPage,
        chapterTitle: editingBookmarkId && existingCurrentBookmark ? existingCurrentBookmark.chapterTitle : currentChapter || `Página ${currentCfiOrPage}`,
        snippet: (editingBookmarkId && existingCurrentBookmark ? existingCurrentBookmark.snippet : selectedText) || (currentChapter ? `Capítulo: ${currentChapter}` : `Página ${currentCfiOrPage}`),
        note: noteText.trim(),
        color: selectedColor,
      });
      setIsSaving(false);
      onClose();
    } catch (e) {
      setIsSaving(false);
    }
  };

  const startEditExisting = (bm: Bookmark) => {
    setEditingBookmarkId(bm.id);
    setNoteText(bm.note || '');
    setSelectedColor(bm.color || '#FACC15');
    setActiveTab('current');
  };

  const formatDate = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const getPageDisplay = (cfiOrPage?: string, chapter?: string) => {
    if (chapter && chapter.toLowerCase().includes('página')) return chapter;
    if (cfiOrPage && !isNaN(Number(cfiOrPage))) return `Página ${cfiOrPage}`;
    return chapter || (cfiOrPage ? `Pág. ${cfiOrPage}` : 'Marcador');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: selectedColor + '25' }]}>
                <Feather name="bookmark" size={18} color={selectedColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
                  {editingBookmarkId ? 'Editar Marcador y Nota' : 'Nuevo Marcador'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {bookTitle || 'Documento'}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'current' && [styles.activeTabBtn, { backgroundColor: theme.bgCard }],
              ]}
              onPress={() => setActiveTab('current')}
              activeOpacity={0.7}
            >
              <Feather
                name="edit-3"
                size={14}
                color={activeTab === 'current' ? theme.accent : theme.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'current' ? theme.accent : theme.textSecondary },
                  activeTab === 'current' && { fontWeight: '700' },
                ]}
              >
                {editingBookmarkId ? 'Editar Marcador' : 'Página Actual'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'list' && [styles.activeTabBtn, { backgroundColor: theme.bgCard }],
              ]}
              onPress={() => setActiveTab('list')}
              activeOpacity={0.7}
            >
              <Feather
                name="list"
                size={14}
                color={activeTab === 'list' ? theme.accent : theme.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'list' ? theme.accent : theme.textSecondary },
                  activeTab === 'list' && { fontWeight: '700' },
                ]}
              >
                Marcadores ({bookmarks.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: CURRENT / EDIT BOOKMARK */}
          {activeTab === 'current' ? (
            <ScrollView style={styles.tabScrollBody} showsVerticalScrollIndicator={false}>
              {/* Position badge */}
              <View style={[styles.pageInfoBadge, { backgroundColor: selectedColor + '18', borderColor: selectedColor + '40' }]}>
                <Feather name="map-pin" size={13} color={selectedColor} style={{ marginRight: 6 }} />
                <Text style={[styles.pageInfoText, { color: theme.textPrimary }]}>
                  {getPageDisplay(currentCfiOrPage, currentChapter)}
                </Text>
              </View>

              {/* Snippet / Excerpt */}
              {(selectedText || (editingBookmarkId && existingCurrentBookmark?.snippet)) ? (
                <View style={[styles.snippetContainer, { backgroundColor: selectedColor + '10', borderLeftColor: selectedColor }]}>
                  <Text style={[styles.snippetText, { color: theme.textPrimary }]} numberOfLines={3}>
                    "{selectedText || existingCurrentBookmark?.snippet}"
                  </Text>
                </View>
              ) : null}

              {/* Color selector */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Color del marcador</Text>
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

              {/* Note input */}
              <View style={styles.noteLabelRow}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>
                  Nota / Comentario de lectura
                </Text>
                <Text style={[styles.charCount, { color: theme.textSecondary }]}>{noteText.length}/500</Text>
              </View>

              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                    color: theme.textPrimary,
                  },
                ]}
                multiline
                numberOfLines={4}
                maxLength={500}
                placeholder="Escribe un apunte, reflexión, recordatorio o cita importante de esta página..."
                placeholderTextColor={theme.textSecondary + '88'}
                value={noteText}
                onChangeText={setNoteText}
                textAlignVertical="top"
              />

              {/* Actions */}
              <View style={styles.formActions}>
                {editingBookmarkId && (
                  <TouchableOpacity
                    style={[styles.deleteCurrentBtn, { backgroundColor: isDark ? '#EF444420' : '#FEE2E2' }]}
                    onPress={async () => {
                      if (editingBookmarkId) {
                        await onDeleteBookmark(editingBookmarkId);
                        setEditingBookmarkId(null);
                        setNoteText('');
                        onClose();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    <Text style={styles.deleteCurrentText}>Eliminar</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.saveCurrentBtn, { backgroundColor: theme.accent }]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  <Feather name="check" size={16} color={theme.accentText} style={{ marginRight: 6 }} />
                  <Text style={[styles.saveCurrentText, { color: theme.accentText }]}>
                    {isSaving ? 'Guardando...' : editingBookmarkId ? 'Actualizar Marcador' : 'Guardar Marcador'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            /* TAB 2: BOOKMARK LIST */
            <View style={styles.listContainer}>
              {bookmarks.length === 0 ? (
                <View style={styles.emptyList}>
                  <Feather name="bookmark" size={40} color={theme.textMuted} style={{ marginBottom: 10 }} />
                  <Text style={[styles.emptyListTitle, { color: theme.textPrimary }]}>
                    No hay marcadores en este libro
                  </Text>
                  <Text style={[styles.emptyListSub, { color: theme.textSecondary }]}>
                    Guarda la posición actual o resalta texto en la página para crear uno.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={bookmarks}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item }) => {
                    const bmColor = item.color || '#FACC15';
                    return (
                      <View
                        style={[
                          styles.listItemCard,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                          },
                        ]}
                      >
                        {/* Color edge indicator */}
                        <View style={[styles.listColorEdge, { backgroundColor: bmColor }]} />

                        <View style={styles.listItemContent}>
                          {/* Item header */}
                          <View style={styles.itemHeader}>
                            <View style={[styles.itemPageBadge, { backgroundColor: bmColor + '20', borderColor: bmColor + '50' }]}>
                              <Text style={[styles.itemPageText, { color: theme.textPrimary }]}>
                                {getPageDisplay(item.cfiOrPage, item.chapterTitle)}
                              </Text>
                            </View>

                            <View style={styles.itemActions}>
                              <TouchableOpacity
                                style={styles.itemIconBtn}
                                onPress={() => startEditExisting(item)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="edit-3" size={14} color={theme.accent} />
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.itemIconBtn}
                                onPress={() => onDeleteBookmark(item.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Snippet */}
                          {item.snippet ? (
                            <Text style={[styles.itemSnippet, { color: theme.textPrimary }]} numberOfLines={2}>
                              "{item.snippet}"
                            </Text>
                          ) : null}

                          {/* Personal Note if exists */}
                          {item.note && item.note.trim().length > 0 ? (
                            <View style={[styles.itemNoteBox, { backgroundColor: bmColor + '10', borderColor: bmColor + '30' }]}>
                              <View style={styles.itemNoteHeader}>
                                <Feather name="file-text" size={11} color={theme.accent} style={{ marginRight: 4 }} />
                                <Text style={[styles.itemNoteLabel, { color: theme.accent }]}>Nota:</Text>
                              </View>
                              <Text style={[styles.itemNoteText, { color: theme.textCard }]} numberOfLines={3}>
                                {item.note}
                              </Text>
                            </View>
                          ) : null}

                          {/* Jump Button & Date */}
                          <View style={styles.itemFooter}>
                            <Text style={[styles.itemDate, { color: theme.textSecondary }]}>
                              {formatDate(item.createdAt)}
                            </Text>

                            <TouchableOpacity
                              style={[styles.jumpBtn, { backgroundColor: theme.accent }]}
                              onPress={() => onJumpToBookmark(item)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.jumpBtnText, { color: theme.accentText }]}>Ir a la página</Text>
                              <Feather name="arrow-right" size={12} color={theme.accentText} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
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
  headerIcon: {
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
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  activeTabBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
  },
  tabScrollBody: {
    maxHeight: 400,
  },
  pageInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  pageInfoText: {
    fontSize: 13,
    fontWeight: '700',
  },
  snippetContainer: {
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 14,
  },
  snippetText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
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
  noteLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  charCount: {
    fontSize: 11,
  },
  noteInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  deleteCurrentText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  saveCurrentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
  },
  saveCurrentText: {
    fontSize: 14,
    fontWeight: '800',
  },
  listContainer: {
    minHeight: 220,
    maxHeight: 400,
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyListTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyListSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  listItemCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  listColorEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  listItemContent: {
    padding: 12,
    paddingLeft: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemPageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  itemPageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  itemIconBtn: {
    padding: 2,
  },
  itemSnippet: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
    marginBottom: 6,
  },
  itemNoteBox: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemNoteText: {
    fontSize: 12,
    lineHeight: 16,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemDate: {
    fontSize: 11,
  },
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  jumpBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
