import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PointBadge from '@/components/PointBadge';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { usePetStore } from '@/stores/usePetStore';
import { useShopStore } from '@/stores/useShopStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { getStageInfo } from '@/constants/evolution';
import PetAvatar from '@/components/PetAvatar';
import { SLOT_LABELS } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

const SLOT_EMOJI: Record<string, string> = {
  hat: '👒',
  clothes: '👗',
  accessory: '🎀',
  background: '🖼️',
  effect: '✨',
};

export default function ProfileScreen() {
  const currentFamily = useFamilyStore(s => s.currentFamily);
  const currentChild = useFamilyStore(s => s.currentChild);
  const pet = usePetStore(s => s.pet);
  const evolutionHistory = usePetStore(s => s.evolutionHistory);
  const equipments = useShopStore(s => s.equipments);
  const tasks = useTaskStore(s => s.tasks);
  const streaks = useTaskStore(s => s.streaks);

  useEffect(() => {
    if (!currentChild?.id || !pet?.id) return;
    useShopStore.getState().loadEquipments(pet.id);
    useTaskStore.getState().loadStreaks(currentChild.id);
    if (currentFamily?.id) {
      useTaskStore.getState().loadTasks(currentFamily.id, currentChild.id);
    }
  }, [currentChild?.id, pet?.id]);

  if (!currentChild) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, color: Colors.neutral400 }}>请先选择孩子档案</Text>
        </View>
      </SafeAreaView>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const currentStreak = streaks[0]?.current_streak ?? 0;
  const bestStreak = streaks[0]?.best_streak ?? 0;
  const equippedItems = equipments.filter(e => e.equipped === 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 头像区域 */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            {pet ? (
              <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={80} />
            ) : (
              <Text style={styles.avatarEmoji}>🐾</Text>
            )}
          </View>
          <Text style={styles.profileName}>{currentChild?.name || '未设置'}</Text>
          <Text style={styles.profileLevel}>Lv.{pet?.level ?? 1} · 宠物主人</Text>
        </View>

        {/* 统计数据卡片 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <PointBadge type="points" amount={currentChild?.current_points ?? 0} size="medium" />
            <Text style={styles.statLabel}>当前积分</Text>
          </View>
          <View style={styles.statCard}>
            <PointBadge type="stars" amount={currentChild?.current_stars ?? 0} size="medium" />
            <Text style={styles.statLabel}>当前星星</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>📋 {completedTasks}</Text>
            <Text style={styles.statLabel}>完成任务</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>🔥 {currentStreak}天</Text>
            <Text style={styles.statLabel}>连续完成</Text>
          </View>
        </View>

        {/* 累计数据 */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>📊 成长数据</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>累计获得积分</Text>
            <Text style={styles.detailValue}>{currentChild?.total_points ?? 0}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>累计获得星星</Text>
            <Text style={styles.detailValue}>{currentChild?.total_stars ?? 0}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>最佳连续天数</Text>
            <Text style={styles.detailValue}>{bestStreak} 天</Text>
          </View>
        </View>

        {/* 我的装扮 */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>🎨 我的装扮</Text>
          {equippedItems.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.equipmentRow}>
              {equippedItems.map((eq) => (
                <View key={eq.id} style={styles.equipCard}>
                  <Text style={styles.equipEmoji}>
                    {SLOT_EMOJI[eq.slot_type] || '✨'}
                  </Text>
                  <Text style={styles.equipName}>{SLOT_LABELS[eq.slot_type as keyof typeof SLOT_LABELS] || eq.slot_type}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyHint}>还没有装扮哦，去商城看看吧~</Text>
          )}
        </View>

        {/* 进化记录 */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>🌱 进化记录</Text>
          {evolutionHistory.length > 0 ? evolutionHistory.map((evo, i) => (
            <View key={i} style={styles.evoRow}>
              <View style={[styles.evoDot, i === evolutionHistory.length - 1 && styles.evoDotLast]}>
                <Text>{evo.emoji || '🥚'}</Text>
              </View>
              <View style={styles.evoInfo}>
                <Text style={styles.evoName}>{evo.name}</Text>
              </View>
            </View>
          )) : (
            <Text style={styles.emptyHint}>还没有进化记录，继续照顾宠物吧~</Text>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 10,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: Colors.primary200,
  },
  avatarEmoji: {
    fontSize: 48,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  profileLevel: {
    fontSize: 13,
    color: Colors.primary500,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.neutral400,
    marginTop: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  sectionBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.neutral900,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.neutral600,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary500,
  },
  equipmentRow: {
    gap: 12,
    paddingRight: 4,
  },
  equipCard: {
    width: 80,
    backgroundColor: '#FFF9F5',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  equipEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  equipName: {
    fontSize: 11,
    color: Colors.neutral600,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.neutral300,
    textAlign: 'center',
    paddingVertical: 10,
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderLeftWidth: 2,
    borderColor: Colors.primary200,
    paddingLeft: 14,
    marginLeft: 7,
  },
  evoDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
    left: -26,
  },
  evoDotLast: {},
  evoInfo: {
    flex: 1,
  },
  evoName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral800,
  },
  evoDate: {
    fontSize: 12,
    color: Colors.neutral400,
    marginTop: 2,
  },
});
