import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFF5F7', '#F0FAFF', '#FFF9E6']}
        style={styles.gradient}
      >
        <View style={styles.logoArea}>
          <Text style={styles.emoji}>🐾</Text>
          <Text style={styles.title}>萌宠成长记</Text>
          <Text style={styles.subtitle}>和你的宠物伙伴一起成长</Text>
          <View style={styles.decoRow}>
            {['🐱', '🦊', '🐰', '🐶', '🐼'].map((e, i) => (
              <Text key={i} style={styles.decoEmoji}>{e}</Text>
            ))}
          </View>
        </View>

        <View style={styles.buttonArea}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/SetupFamily', params: { fresh: '1' } })}
            activeOpacity={0.85}
            style={{ borderRadius: 20, overflow: 'hidden' }}
          >
            <LinearGradient colors={[Colors.primary500, Colors.primary400]} style={styles.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.primaryBtnText}>✨ 创建家庭</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={() => router.push('/ImportBackup')}>
            <Text style={styles.secondaryBtnText}>📂 导入已有数据</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            一款面向家庭场景的亲子互动养成应用{'\n'}
            帮助孩子养成良好的学习与生活习惯
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  logoArea: { alignItems: 'center', marginBottom: 60 },
  emoji: { fontSize: 80, marginBottom: 16 },
  title: { fontSize: 36, fontWeight: 'bold', color: Colors.neutral900, letterSpacing: 2 },
  subtitle: { fontSize: 16, color: Colors.neutral400, marginTop: 10 },
  decoRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  decoEmoji: { fontSize: 28 },
  buttonArea: { gap: 14 },
  primaryBtn: { paddingVertical: 16, alignItems: 'center', shadowColor: Colors.primary500, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  primaryBtnText: { color: Colors.bgCard, fontSize: 18, fontWeight: 'bold' },
  secondaryBtn: { paddingVertical: 14, borderRadius: 20, borderWidth: 2, borderColor: Colors.neutral300, backgroundColor: Colors.bgCard, alignItems: 'center' },
  secondaryBtnText: { color: Colors.neutral500, fontSize: 15, fontWeight: '500' },
  footer: { marginTop: 50, alignItems: 'center' },
  footerText: { color: Colors.neutral400, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
