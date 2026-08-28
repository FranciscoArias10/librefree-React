import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../services/database';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function RootLayoutInner() {
  const { theme } = useTheme();
  return (
    <>
      <StatusBar style={theme.statusBar} backgroundColor={theme.bgHeader} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="reader/[id]"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initDatabase().catch((err) => console.error('Error inicializando DB:', err));
  }, []);

  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

