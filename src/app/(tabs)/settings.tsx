import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useTheme } from '../../context/ThemeContext';
import { Toast } from '../../components/Toast';
import { getReadingSettings, saveReadingSettings } from '../../services/database';
import { fetchDeviceVoices, setTTSVoice, testVoiceSample, stopTTS } from '../../services/ttsService';
import { ReadingSettings } from '../../types/book';

function getLanguageFlag(lang: string): string {
  if (!lang) return '🌐';
  const l = lang.toLowerCase();
  if (l.includes('es-es') || l === 'es_es' || l === 'spa-esp') return '🇪🇸';
  if (l.includes('es-mx') || l === 'es_mx') return '🇲🇽';
  if (l.includes('es-us') || l === 'es_us') return '🇺🇸';
  if (l.includes('es-ar') || l === 'es_ar') return '🇦🇷';
  if (l.includes('es-co') || l === 'es_co') return '🇨🇴';
  if (l.includes('es-cl') || l === 'es_cl') return '🇨🇱';
  if (l.includes('es-pe') || l === 'es_pe') return '🇵🇪';
  if (l.includes('es-ve') || l === 'es_ve') return '🇻🇪';
  if (l.startsWith('es')) return '🇪🇸';
  if (l.includes('en-us')) return '🇺🇸';
  if (l.includes('en-gb')) return '🇬🇧';
  if (l.startsWith('en')) return '🇬🇧';
  if (l.startsWith('fr')) return '🇫🇷';
  if (l.startsWith('de')) return '🇩🇪';
  if (l.startsWith('it')) return '🇮🇹';
  if (l.startsWith('pt')) return '🇧🇷';
  return '🌐';
}

function getVoiceDisplayName(voice: Speech.Voice): string {
  if (!voice) return 'Voz Predeterminada del Sistema';
  const name = voice.name || voice.identifier || 'Voz';
  const lang = voice.language ? voice.language.toUpperCase() : '';
  
  // Format clean human-readable titles
  let cleanName = name
    .replace(/es-es-x-/i, 'España ')
    .replace(/es-mx-x-/i, 'México ')
    .replace(/es-us-x-/i, 'EE.UU. ')
    .replace(/-/g, ' ')
    .replace(/network/i, '(Alta calidad)')
    .replace(/local/i, '(Local)')
    .trim();

  if (lang) {
    return `${cleanName} (${lang})`;
  }
  return cleanName;
}

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);

  // Settings & Voices State
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 18,
    fontFamily: 'Serif',
    lineHeight: 1.6,
    marginSize: 20,
    themeMode: 'sepia',
    textAlignment: 'left',
    isContinuousScroll: false,
  });

  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Speech.Voice | null>(null);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceFilterCategory, setVoiceFilterCategory] = useState<'es' | 'all'>('es');
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);

  const isDark = themeMode === 'dark';
  const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10;

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingVoices(true);
        const savedSettings = await getReadingSettings();
        setSettings(savedSettings);

        const voices = await fetchDeviceVoices();
        setAvailableVoices(voices);

        if (savedSettings.selectedVoiceIdentifier) {
          const match = voices.find((v) => v.identifier === savedSettings.selectedVoiceIdentifier);
          if (match) {
            setSelectedVoice(match);
            setTTSVoice(match.identifier);
          }
        } else if (voices.length > 0) {
          // Default to first Spanish voice if available
          const defaultEs = voices.find((v) => v.language && v.language.toLowerCase().startsWith('es'));
          if (defaultEs) {
            setSelectedVoice(defaultEs);
            setTTSVoice(defaultEs.identifier);
          }
        }
      } catch (err) {
        console.error('Error cargando ajustes o voces:', err);
      } finally {
        setLoadingVoices(false);
      }
    }
    loadInitialData();
  }, []);

  const handleSelectVoice = async (voice: Speech.Voice) => {
    try {
      setSelectedVoice(voice);
      setTTSVoice(voice.identifier);
      const updated = { ...settings, selectedVoiceIdentifier: voice.identifier };
      setSettings(updated);
      await saveReadingSettings(updated);

      setToast({
        visible: true,
        message: `✓ Voz seleccionada: ${getVoiceDisplayName(voice)}`,
        type: 'success',
      });
      setIsVoiceModalVisible(false);
    } catch (err) {
      setToast({ visible: true, message: 'Error guardando voz seleccionada', type: 'error' });
    }
  };

  const handleTestVoiceSample = (voice?: Speech.Voice) => {
    const targetVoiceId = voice?.identifier || selectedVoice?.identifier;
    setTestingVoiceId(targetVoiceId || 'default');
    testVoiceSample(
      targetVoiceId,
      'Hola, esta es una prueba de la voz seleccionada para la lectura en voz alta en LibreFree.',
      () => setTestingVoiceId(null)
    );
  };

  const filteredVoices = useMemo(() => {
    return availableVoices.filter((v) => {
      const lang = (v.language || '').toLowerCase();
      const matchesCategory = voiceFilterCategory === 'es' ? lang.startsWith('es') : true;

      if (!matchesCategory) return false;

      if (!voiceSearchQuery.trim()) return true;
      const q = voiceSearchQuery.toLowerCase();
      const name = (v.name || '').toLowerCase();
      const id = (v.identifier || '').toLowerCase();
      return name.includes(q) || id.includes(q) || lang.includes(q);
    });
  }, [availableVoices, voiceFilterCategory, voiceSearchQuery]);

  const spanishVoicesCount = useMemo(() => {
    return availableVoices.filter((v) => (v.language || '').toLowerCase().startsWith('es')).length;
  }, [availableVoices]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg, paddingTop: androidStatusBarPadding }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <Text style={[styles.title, { color: theme.textPrimary }]}>Ajustes de la App</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Configura la apariencia, voz TTS y almacenamiento</Text>

        {/* ── Apariencia ─────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Apariencia</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Text style={[styles.settingTitle, { color: theme.textCard, marginBottom: 12 }]}>Tema de la Aplicación</Text>
          <View style={styles.themeButtonRow}>
            {/* Light Mode Button */}
            <TouchableOpacity
              style={[
                styles.themeBtn,
                { borderColor: !isDark ? theme.accent : theme.border },
                !isDark && { backgroundColor: theme.accent + '18' },
              ]}
              onPress={() => setThemeMode('light')}
              activeOpacity={0.8}
            >
              <View style={[styles.themeBtnIcon, { backgroundColor: '#FFF9EC' }]}>
                <Feather name="sun" size={22} color="#F59E0B" />
              </View>
              <Text style={[styles.themeBtnLabel, { color: !isDark ? theme.accent : theme.textSecondary }]}>
                Modo Claro
              </Text>
              {!isDark && (
                <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]}>
                  <Feather name="check" size={10} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Dark Mode Button */}
            <TouchableOpacity
              style={[
                styles.themeBtn,
                { borderColor: isDark ? theme.accent : theme.border },
                isDark && { backgroundColor: theme.accent + '18' },
              ]}
              onPress={() => setThemeMode('dark')}
              activeOpacity={0.8}
            >
              <View style={[styles.themeBtnIcon, { backgroundColor: '#1E293B' }]}>
                <Feather name="moon" size={22} color="#A78BFA" />
              </View>
              <Text style={[styles.themeBtnLabel, { color: isDark ? theme.accent : theme.textSecondary }]}>
                Modo Oscuro
              </Text>
              {isDark && (
                <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]}>
                  <Feather name="check" size={10} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sintetizador de Voz (TTS) ────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Voz y Lectura en Voz Alta (TTS)</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.voiceCardHeader}>
            <View style={[styles.voiceIconBg, { backgroundColor: theme.accent + '20' }]}>
              <Feather name="mic" size={22} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.textCard }]}>Voz Predeterminada TTS</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                {selectedVoice
                  ? `${getLanguageFlag(selectedVoice.language)} ${getVoiceDisplayName(selectedVoice)}`
                  : 'Voz del sistema por defecto'}
              </Text>
            </View>
          </View>

          <View style={styles.voiceActionsRow}>
            {/* Probar voz actual */}
            <TouchableOpacity
              style={[styles.voiceActionBtn, { backgroundColor: theme.bgChip, borderColor: theme.border }]}
              onPress={() => handleTestVoiceSample()}
              disabled={testingVoiceId !== null}
            >
              {testingVoiceId ? (
                <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 6 }} />
              ) : (
                <Feather name="volume-2" size={16} color={theme.accent} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.voiceActionText, { color: theme.textCard }]}>Probar Voz</Text>
            </TouchableOpacity>

            {/* Seleccionar / Cambiar Voz */}
            <TouchableOpacity
              style={[styles.voiceActionBtn, { backgroundColor: theme.accent }]}
              onPress={() => setIsVoiceModalVisible(true)}
            >
              <Feather name="sliders" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.voiceActionText, { color: '#FFFFFF' }]}>
                Cambiar Voz ({spanishVoicesCount > 0 ? `${spanishVoicesCount} en es` : availableVoices.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Cuenta y Sincronización ───────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Cuenta y Sincronización</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.accountRow}>
            <View style={[styles.avatarBg, { backgroundColor: theme.accent }]}>
              <Feather name="user" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.textCard }]}>Usuario LibreFree</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>usuario@librefree.org</Text>
            </View>
            <View style={[styles.cloudBadge, { backgroundColor: theme.bgBadgeCloud }]}>
              <Feather name="cloud" size={14} color="#27AE60" />
              <Text style={styles.cloudBadgeText}>Conectado</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.bgDivider }]} />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.textCard }]}>Sincronización en la Nube</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                Sincroniza avance, notas y marcadores entre dispositivos
              </Text>
            </View>
            <Switch
              value={cloudSyncEnabled}
              onValueChange={setCloudSyncEnabled}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor={cloudSyncEnabled ? '#FFFFFF' : '#CBD5E1'}
            />
          </View>
        </View>

        {/* ── Almacenamiento ─────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Almacenamiento Local</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.settingRowBtn}>
            <Feather name="database" size={20} color={theme.iconDefault} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.textCard }]}>Base de Datos SQLite</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                Estado: WAL Activo (Tablas de marcadores e historia)
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.bgDivider }]} />

          <TouchableOpacity
            style={styles.settingRowBtn}
            onPress={() => setToast({ visible: true, message: '✓ Se ha liberado el espacio en la memoria temporal.', type: 'success' })}
          >
            <Feather name="trash-2" size={20} color="#E53E3E" style={{ marginRight: 12 }} />
            <Text style={[styles.settingTitle, { color: '#E53E3E' }]}>Limpiar Caché del Lector</Text>
            <Feather name="chevron-right" size={18} color={theme.iconMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* App info */}
        <View style={styles.infoFooter}>
          <Text style={[styles.infoAppTitle, { color: theme.textSecondary }]}>LibreFree</Text>
          <Text style={[styles.infoAppVersion, { color: theme.textMuted }]}>Versión 1.0.0 (Expo SDK v54)</Text>
        </View>
      </ScrollView>

      {/* ── MODAL SELECTOR DE VOCES ───────────────────────────── */}
      <Modal
        visible={isVoiceModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          stopTTS();
          setIsVoiceModalVisible(false);
        }}
      >
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Seleccionar Voz para Lectura</Text>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => {
                stopTTS();
                setIsVoiceModalVisible(false);
              }}
            >
              <Feather name="x" size={22} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={[styles.searchBox, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            <Feather name="search" size={18} color={theme.iconMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Buscar por nombre, país o idioma..."
              placeholderTextColor={theme.textMuted}
              value={voiceSearchQuery}
              onChangeText={setVoiceSearchQuery}
            />
            {voiceSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setVoiceSearchQuery('')}>
                <Feather name="x-circle" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Categories Tabs */}
          <View style={styles.filterTabsRow}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                voiceFilterCategory === 'es'
                  ? { backgroundColor: theme.accent }
                  : { backgroundColor: theme.bgCard, borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() => setVoiceFilterCategory('es')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: voiceFilterCategory === 'es' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                🇪🇸 Voces en Español ({spanishVoicesCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTab,
                voiceFilterCategory === 'all'
                  ? { backgroundColor: theme.accent }
                  : { backgroundColor: theme.bgCard, borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() => setVoiceFilterCategory('all')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: voiceFilterCategory === 'all' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                🌐 Todas ({availableVoices.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Voice List */}
          {loadingVoices ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando voces del dispositivo...</Text>
            </View>
          ) : filteredVoices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="mic-off" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.textCard }]}>No se encontraron voces</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Intenta cambiando el filtro o instalando voces adicionales en los ajustes de síntesis de voz de tu dispositivo.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredVoices}
              keyExtractor={(item) => item.identifier || item.name}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const isSelected = selectedVoice?.identifier === item.identifier;
                const isTesting = testingVoiceId === item.identifier;
                const flag = getLanguageFlag(item.language);
                const displayName = getVoiceDisplayName(item);

                return (
                  <TouchableOpacity
                    style={[
                      styles.voiceListItem,
                      { backgroundColor: theme.bgCard, borderColor: theme.border },
                      isSelected && { borderColor: theme.accent, borderWidth: 2 },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleSelectVoice(item)}
                  >
                    <Text style={styles.flagIcon}>{flag}</Text>

                    <View style={styles.voiceDetails}>
                      <Text style={[styles.voiceNameText, { color: theme.textCard }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={[styles.voiceIdText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {item.identifier}
                      </Text>
                    </View>

                    {/* Probar voz individual */}
                    <TouchableOpacity
                      style={[
                        styles.testBtnCircle,
                        { backgroundColor: isTesting ? theme.accent + '25' : theme.bgChip },
                      ]}
                      onPress={() => handleTestVoiceSample(item)}
                    >
                      {isTesting ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                      ) : (
                        <FontAwesome name="play" size={12} color={theme.accent} style={{ marginLeft: 2 }} />
                      )}
                    </TouchableOpacity>

                    {/* Selection Checkmark */}
                    <View style={styles.radioWrapper}>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: isSelected ? theme.accent : theme.border },
                          isSelected && { backgroundColor: theme.accent },
                        ]}
                      >
                        {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: 110,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  // Theme selector buttons
  themeButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    alignItems: 'center',
    position: 'relative',
  },
  themeBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  themeBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Voice Card
  voiceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  voiceIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  voiceActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voiceActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  voiceActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Account row
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cloudBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27AE60',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  infoFooter: {
    alignItems: 'center',
    marginTop: 20,
  },
  infoAppTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoAppVersion: {
    fontSize: 12,
    marginTop: 2,
  },

  // Modal Voice Selector Styles
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeModalBtn: {
    padding: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  voiceListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  flagIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  voiceDetails: {
    flex: 1,
    marginRight: 8,
  },
  voiceNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  voiceIdText: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
  },
  testBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
