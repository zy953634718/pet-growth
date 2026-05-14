import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Shadows } from '@/theme/tokens';

export default function ParentTabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + Math.max(insets.bottom, Spacing[2]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary500,
        tabBarInactiveTintColor: Colors.neutral400,
        tabBarLabelStyle: {
          fontSize: Typography.xs,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
          ...styles.tabBar,
          paddingBottom: Math.max(insets.bottom, Spacing[2]),
          height: tabBarHeight,
        },
        tabBarItemStyle: styles.tabBarItem,
        headerShown: true,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '主页',
          headerTitle: '家长中心',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="behavior"
        options={{
          title: '行为',
          headerTitle: '行为规则',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? 'star' : 'star-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: '任务',
          headerTitle: '任务管理',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: '商城',
          headerTitle: '商城管理',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: '统计',
          headerTitle: '成长统计',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          headerTitle: '设置',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.neutral0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral200,
  },
  headerTitle: {
    color: Colors.neutral900,
    fontWeight: '700',
    fontSize: Typography.lg,
    letterSpacing: 0.2,
  },
  tabBar: {
    backgroundColor: Colors.neutral0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.neutral200,
    paddingTop: Spacing[1],
    ...Shadows.sm,
  },
  tabBarItem: {
    paddingTop: Spacing[1],
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: Colors.primary50,
  },
});
