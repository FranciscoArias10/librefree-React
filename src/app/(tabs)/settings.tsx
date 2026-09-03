import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Toast } from '../../components/Toast';

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);

  const isDark = themeMode === 'dark';
  const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10;

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
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Configura la apariencia, lectura y almacenamiento</Text>

        {/* ── Apariencia ─────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Apariencia</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>

          {/* Dark / Light toggle with 2 visual buttons */}
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

        {/* ── Preferencias de Lectura ────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Preferencias de Lectura</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.settingRowBtn}>
            <Feather name="volume-2" size={20} color={theme.iconDefault} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.textCard }]}>Voz Predeterminada TTS</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Español (España / México)</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.iconMuted} />
          </TouchableOpacity>
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
});
