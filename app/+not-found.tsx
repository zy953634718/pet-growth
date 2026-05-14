import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>页面未找到</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>返回首页 →</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[5] },
  title: { fontSize: Typography['2xl'], fontWeight: 'bold', color: Colors.neutral900 },
  link: { marginTop: Spacing['3.5'] + 1, paddingVertical: Spacing['3.5'] + 1 },
  linkText: { fontSize: Typography.base, color: Colors.primary500 },
});
