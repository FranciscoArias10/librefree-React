import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ConfirmDeleteModalProps {
  visible: boolean;
  count: number;
  bookTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  visible,
  count,
  bookTitle,
  onConfirm,
  onCancel,
}) => {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === 'dark' || themeMode === 'oled';

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <View style={styles.iconCircle}>
            <Feather name="trash-2" size={26} color="#EF4444" />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {count > 1 ? `¿Eliminar ${count} libros?` : `¿Eliminar de la estantería?`}
          </Text>

          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {count === 1 && bookTitle
              ? `¿Deseas quitar "${bookTitle}" de tu estantería?\n\n(El archivo original guardado en tu teléfono no será borrado).`
              : `¿Deseas quitar los ${count} libros seleccionados de tu estantería?\n\n(Los archivos originales guardados en tu teléfono no serán borrados).`}
          </Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textPrimary }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={onConfirm} activeOpacity={0.8}>
              <Feather name="trash-2" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>Eliminar {count > 1 ? `(${count})` : ''}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 12,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
