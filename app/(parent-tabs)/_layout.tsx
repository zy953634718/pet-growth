import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/theme/tokens';

export default function ParentTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary500,
        tabBarInactiveTintColor: Colors.neutral400,
        tabBarLabelStyle: { fontSize: Typography.xs, fontWeight: '600' },
        tabBarStyle: {
          ...styles.tabBar,
          paddingBottom: Math.max(insets.bottom, Spacing[2]),
          height: 50 + Math.max(insets.bottom, Spacing[2]),
        },
        headerShown: true,
        headerStyle: { backgroundColor: Colors.neutral0 },
        headerTitleStyle: { color: Colors.neutral900, fontWeight: 'bold', fontSize: Typography.lg },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '家长主页', headerTitle: '家长端' }} />
      <Tabs.Screen name="behavior" options={{ title: '行为规则' }} />
      <Tabs.Screen name="tasks" options={{ title: '任务管理' }} />
      <Tabs.Screen name="shop" options={{ title: '商城管理' }} />
      <Tabs.Screen name="stats" options={{ title: '数据统计' }} />
      <Tabs.Screen name="settings" options={{ title: '设置' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.neutral0,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing[1],
  },
});
