import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Tag } from '../types/book';
import { useTheme } from '../context/ThemeContext';
import { getAllTags, createTag, deleteTag } from '../services/database';

interface AssignTagsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedBookIds: string[];
  initialAssignedTagIds?: string[];
  onSaveTags: (selectedTagIds: string[]) => void;
  onTagsUpdated?: () => void; // Called when new tags are created/deleted
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
];

export const AssignTagsModal: React.FC<AssignTagsModalProps> = ({
  visible,
  onClose,
  selectedBookIds,
  initialAssignedTagIds = [],
  onSaveTags,
  onTagsUpdated,
}) => {
  const { theme } = useTheme();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTags();
      setSelectedTagIds(initialAssignedTagIds);
      setNewTagName('');
      setIsCreatingTag(false);
    }
  }, [visible, initialAssignedTagIds]);

  const loadTags = async () => {
    try {
      const fetchedTags = await getAllTags();
      setTags(fetchedTags);
    } catch (e) {
      console.error('Error loading tags in modal:', e);
    }
  };

  const toggleTagSelection = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Ingresa un nombre para la etiqueta');
      return;
    }

    try {
      const created = await createTag(trimmed, selectedColor);
      setTags((prev) => [...prev, created]);
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName('');
      setIsCreatingTag(false);
      if (onTagsUpdated) onTagsUpdated();
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear la etiqueta (quizás ya existe).');
    }
  };

  const handleDeleteTag = (tag: Tag) => {
    Alert.alert(
      'Eliminar Etiqueta',
      `¿Deseas eliminar la etiqueta "${tag.name}" de todas las lecturas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTag(tag.id);
              setTags((prev) => prev.filter((t) => t.id !== tag.id));
              setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
              if (onTagsUpdated) onTagsUpdated();
            } catch (e) {
              console.error('Error deleting tag:', e);
            }
          },
        },
      ]
    );
  };

  const handleSave = () => {
    onSaveTags(selectedTagIds);
    onClose();
  };

  const titleText =
    selectedBookIds.length > 1
      ? `Etiquetar ${selectedBookIds.length} libros`
      : 'Asignar Etiquetas';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="tag" size={20} color={theme.accent} />
              <Text style={[styles.title, { color: theme.textCard }]}>{titleText}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Selecciona las etiquetas que deseas asignar a este libro:
          </Text>

          {/* Tags List */}
          <ScrollView style={styles.tagsContainer} contentContainerStyle={styles.tagsContent}>
            {tags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              const tagColor = tag.color || '#3B82F6';

              return (
                <View key={tag.id} style={styles.tagChipWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: isSelected ? tagColor : theme.bgChip,
                        borderColor: tagColor,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => toggleTagSelection(tag.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={isSelected ? '#FFFFFF' : tagColor}
                    />
                    <Text
                      style={[
                        styles.tagChipText,
                        { color: isSelected ? '#FFFFFF' : theme.textCard },
                      ]}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteTagButton}
                    onPress={() => handleDeleteTag(tag)}
                  >
                    <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {tags.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No hay etiquetas creadas todavía.
              </Text>
            )}
          </ScrollView>

          {/* Create New Tag Section */}
          {isCreatingTag ? (
            <View style={[styles.createSection, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[styles.createTitle, { color: theme.textCard }]}>Nueva Etiqueta</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.bgCard, color: theme.textCard, borderColor: theme.border },
                ]}
                placeholder="Nombre de etiqueta (ej. Favoritos)"
                placeholderTextColor={theme.textMuted}
                value={newTagName}
                onChangeText={setNewTagName}
                autoFocus
              />

              {/* Color Selector */}
              <View style={styles.colorPalette}>
                {PRESET_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      selectedColor === c && styles.selectedColorCircle,
                    ]}
                    onPress={() => setSelectedColor(c)}
                  >
                    {selectedColor === c && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.smallButton, { backgroundColor: theme.bgChip }]}
                  onPress={() => setIsCreatingTag(false)}
                >
                  <Text style={{ color: theme.textCard, fontWeight: '600', fontSize: 13 }}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallButton, { backgroundColor: theme.accent }]}
                  onPress={handleCreateTag}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Crear Etiqueta</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addTagButton, { borderColor: theme.border }]}
              onPress={() => setIsCreatingTag(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.accent} />
              <Text style={[styles.addTagText, { color: theme.accent }]}>Crear nueva etiqueta</Text>
            </TouchableOpacity>
          )}

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.bgChip, marginRight: 10 }]}
              onPress={onClose}
            >
              <Text style={[styles.actionButtonText, { color: theme.textCard }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.accent }]}
              onPress={handleSave}
            >
              <Text style={[styles.actionButtonText, { color: '#FFFFFF', fontWeight: '700' }]}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '82%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  tagsContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  tagsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  tagChipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteTagButton: {
    padding: 6,
    marginLeft: -4,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    width: '100%',
    marginVertical: 12,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
    gap: 8,
  },
  addTagText: {
    fontSize: 14,
    fontWeight: '700',
  },
  createSection: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorCircle: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
  },
});
