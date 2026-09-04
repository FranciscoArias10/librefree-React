import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../services/database';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

LogBox.ignoreLogs([
  "Can't perform a React state update",
  "hasn't mounted yet",
  "useLinking",
  "ExponentAV",
]);

const origConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes("Can't perform a React state update") || msg.includes("hasn't mounted yet")) {
    return;
  }
  origConsoleError(...args);
};

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

