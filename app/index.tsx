import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useFamilyStore } from '@/stores/useFamilyStore';

export default function Index() {
  const [hydrated, setHydrated] = useState(() => useFamilyStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useFamilyStore.persist.onFinishHydration(() => setHydrated(true));
    if (useFamilyStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const isSetupComplete = useFamilyStore((s) => s.isSetupComplete);
  const currentFamily = useFamilyStore((s) => s.currentFamily);

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  if (isSetupComplete && currentFamily) {
    return <Redirect href="/RoleSelect" />;
  }

  return <Redirect href="/Welcome" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F7' },
});
