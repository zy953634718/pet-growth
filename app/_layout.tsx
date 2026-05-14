// 必须在所有 import 之前引入，为 React Native 注入 crypto.getRandomValues polyfill
import 'react-native-get-random-values';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { initDatabase, getDatabase } from '@/db/database';
import { clearFamilySessionPersist } from '@/db/sqlitePersistStorage';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { Colors, Typography } from '@/theme/tokens';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase();
        // 等待 Zustand persist hydration 完成
        await new Promise<void>((resolve) => {
          if (useFamilyStore.persist.hasHydrated()) {
            resolve();
            return;
          }
          const unsub = useFamilyStore.persist.onFinishHydration(() => {
            unsub();
            resolve();
          });
          // 5 秒超时兜底
          setTimeout(() => {
            unsub();
            resolve();
          }, 5000);
        });
        const { currentFamily, isSetupComplete, resetFamily, loadFamily } = useFamilyStore.getState();
        if (currentFamily?.id && isSetupComplete) {
          const row = await getDatabase().getFirstAsync<{ id: string }>(
            'SELECT id FROM family WHERE id = ?',
            [currentFamily.id]
          );
          if (!row) {
            console.warn('[_layout] Family not found in DB, resetting session');
            resetFamily();
            await clearFamilySessionPersist();
          } else {
            await loadFamily(currentFamily.id);
          }
        }
      } catch (e) {
        console.error('Database init failed:', e);
      } finally {
        setDbReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!dbReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingEmoji}>🐾</Text>
          <Text style={styles.loadingText}>萌宠成长记</Text>
          <ActivityIndicator size="large" color={Colors.primary500} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={DefaultTheme}>
        <Stack screenOptions={{ animation: 'slide_from_right', headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="ImportBackup" options={{ presentation: 'modal' }} />
          {/* Onboarding flow */}
          <Stack.Screen name="Welcome" />
          <Stack.Screen name="SetupFamily" options={{ presentation: 'card' }} />
          <Stack.Screen name="SetupPet" options={{ presentation: 'card' }} />

          {/* Role selection & parent lock */}
          <Stack.Screen name="RoleSelect" />
          <Stack.Screen name="ParentLock" options={{ presentation: 'modal' }} />

          {/* Child tabs */}
          <Stack.Screen name="(child-tabs)" options={{ headerShown: false }} />

          {/* Parent tabs */}
          <Stack.Screen name="(parent-tabs)" options={{ headerShown: false }} />

          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primary50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingEmoji: {
    fontSize: Typography['5xl'],
    marginBottom: 12,
  },
  loadingText: {
    fontSize: Typography['4xl'],
    fontWeight: 'bold',
    color: Colors.neutral900,
    letterSpacing: Typography.letterSpacing.wider,
  },
});
