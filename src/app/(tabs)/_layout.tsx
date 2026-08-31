import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

export default function TabsLayout() {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const insets = useSafeAreaInsets();

  // Dynamic bottom offset using Safe Area Insets to float above native Android/iOS system bars
  const dynamicBottom = Math.max(insets.bottom + 8, 16);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: isDark ? '#64748B' : '#94A3B8',
        tabBarStyle: {
          position: 'absolute',
          bottom: dynamicBottom,
          left: 36,
          right: 36,
          height: 60,
          borderRadius: 30,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.95)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 16,
          paddingHorizontal: 8,
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarItemStyle: {
          height: 60,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 0,
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Estantería',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.accent + '22' }]}>
              <Ionicons name={focused ? "book" : "book-outline"} size={26} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explorer"
        options={{
          title: 'Explorador',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.accent + '22' }]}>
              <Feather name="folder" size={26} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="audiobooks"
        options={{
          title: 'Audiolibros',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.accent + '22' }]}>
              <Feather name="headphones" size={26} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: theme.accent + '22' }]}>
              <Feather name="settings" size={26} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
