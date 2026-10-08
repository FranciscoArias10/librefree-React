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
  DeviceEventEmitter,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Profile } from '../types/book';
import { useTheme } from '../context/ThemeContext';
import {
  getAllProfiles,
  getActiveProfile,
  setActiveProfile,
  createProfile,
  deleteProfile,
} from '../services/database';

interface ProfileManagerModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileChanged?: (newProfile: Profile) => void;
}

const PRESET_AVATARS = ['👤', '📚', '🎓', '🚀', '🦊', '🌟', '🦉', '💼', '🎧', '⚡'];

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

export const ProfileManagerModal: React.FC<ProfileManagerModalProps> = ({
  visible,
  onClose,
  onProfileChanged,
}) => {
  const { theme } = useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👤');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');

  useEffect(() => {
    if (visible) {
      loadData();
      setIsCreating(false);
      setNewProfileName('');
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const all = await getAllProfiles();
      const current = await getActiveProfile();
      setProfiles(all);
      setActiveProfileState(current);
    } catch (e) {
      console.error('Error loading profiles:', e);
    }
  };

  const handleSelectProfile = async (profile: Profile) => {
    if (activeProfile?.id === profile.id) return;
    try {
      await setActiveProfile(profile.id);
      setActiveProfileState(profile);
      DeviceEventEmitter.emit('PROFILE_CHANGED', profile);
      if (onProfileChanged) onProfileChanged(profile);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'No se pudo cambiar el perfil.');
    }
  };

  const handleCreateProfile = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      Alert.alert('Nombre requerido', 'Por favor ingresa un nombre para el nuevo perfil.');
      return;
    }

    try {
      const created = await createProfile(trimmed, selectedAvatar, selectedColor);
      await setActiveProfile(created.id);
      setActiveProfileState(created);
      DeviceEventEmitter.emit('PROFILE_CHANGED', created);
      if (onProfileChanged) onProfileChanged(created);
      setIsCreating(false);
      setNewProfileName('');
      await loadData();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear el perfil.');
    }
  };

  const handleDeleteProfile = (profile: Profile) => {
    if (profiles.length <= 1) {
      Alert.alert('Aviso', 'No puedes eliminar el único perfil disponible.');
      return;
    }

    Alert.alert(
      'Eliminar Perfil',
      `¿Deseas eliminar el perfil "${profile.name}"? Se perderá el avance de lectura y marcadores asociados a este perfil.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profile.id);
              const remaining = await getAllProfiles();
              const current = await getActiveProfile();
              setProfiles(remaining);
              setActiveProfileState(current);
              DeviceEventEmitter.emit('PROFILE_CHANGED', current);
              if (onProfileChanged) onProfileChanged(current);
            } catch (e) {
              console.error('Error deleting profile:', e);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.headerIconCircle, { backgroundColor: theme.accent + '20' }]}>
                <Feather name="users" size={20} color={theme.accent} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.textCard }]}>Perfiles de Lectura</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Progreso, favoritos y notas independientes
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* List of Profiles */}
          <ScrollView style={styles.profileList} contentContainerStyle={{ paddingVertical: 6 }}>
            {profiles.map((p) => {
              const isActive = activeProfile?.id === p.id;
              const profileColor = p.color || '#3B82F6';

              return (
                <View
                  key={p.id}
                  style={[
                    styles.profileItem,
                    {
                      backgroundColor: isActive ? theme.bg : theme.bgCard,
                      borderColor: isActive ? profileColor : theme.border,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.profileItemPress}
                    activeOpacity={0.7}
                    onPress={() => handleSelectProfile(p)}
                  >
                    <View style={[styles.avatarCircle, { backgroundColor: profileColor + '25', borderColor: profileColor }]}>
                      <Text style={styles.avatarEmoji}>{p.avatar || '👤'}</Text>
                    </View>

                    <View style={styles.profileInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.profileName, { color: theme.textCard }]}>{p.name}</Text>
                        {isActive && (
                          <View style={[styles.activeTag, { backgroundColor: profileColor }]}>
                            <Text style={styles.activeTagText}>Activo</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.profileMeta, { color: theme.textMuted }]}>
                        Perfil local sin conexión
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {profiles.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteProfile(p)}
                    >
                      <Feather name="trash-2" size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Create Profile Section */}
          {isCreating ? (
            <View style={[styles.createCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[styles.createTitle, { color: theme.textCard }]}>Nuevo Perfil</Text>

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.bgCard, color: theme.textCard, borderColor: theme.border },
                ]}
                placeholder="Nombre del perfil (ej. Estudio, Trabajo, Papá)"
                placeholderTextColor={theme.textMuted}
                value={newProfileName}
                onChangeText={setNewProfileName}
                autoFocus
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Selecciona un Icono:</Text>
              <View style={styles.avatarPickerRow}>
                {PRESET_AVATARS.map((av) => (
                  <TouchableOpacity
                    key={av}
                    style={[
                      styles.avatarPickBtn,
                      { backgroundColor: theme.bgCard, borderColor: selectedAvatar === av ? selectedColor : theme.border },
                      selectedAvatar === av && { borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedAvatar(av)}
                  >
                    <Text style={styles.avatarPickEmoji}>{av}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Color Temático:</Text>
              <View style={styles.colorPickerRow}>
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
                    {selectedColor === c && <Feather name="check" size={14} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: theme.bgChip }]}
                  onPress={() => setIsCreating(false)}
                >
                  <Text style={{ color: theme.textCard, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: selectedColor }]}
                  onPress={handleCreateProfile}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Crear y Activar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addNewBtn, { borderColor: theme.border }]}
              onPress={() => setIsCreating(true)}
            >
              <Feather name="plus-circle" size={18} color={theme.accent} />
              <Text style={[styles.addNewText, { color: theme.accent }]}>Crear nuevo perfil</Text>
            </TouchableOpacity>
          )}

          {/* Footer */}
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: theme.bgChip }]}
            onPress={onClose}
          >
            <Text style={[styles.doneBtnText, { color: theme.textCard }]}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
  },
  closeBtn: {
    padding: 6,
  },
  profileList: {
    maxHeight: 220,
    marginBottom: 14,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  profileItemPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
  },
  activeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  profileMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 6,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 14,
    gap: 8,
  },
  addNewText: {
    fontSize: 14,
    fontWeight: '700',
  },
  createCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  createTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  avatarPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  avatarPickBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPickEmoji: {
    fontSize: 18,
  },
  colorPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  doneBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
