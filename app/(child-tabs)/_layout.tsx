import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/theme/tokens';

export default function ChildTabsLayout() {
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
      <Tabs.Screen
        name="index"
        options={{ title: '首页', headerTitle: '萌宠成长记' }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: '任务', headerTitle: '今日任务' }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: '商城', headerTitle: '兑换商城' }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: '对话', headerTitle: 'AI 对话' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: '我的', headerTitle: '我的' }}
      />
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
