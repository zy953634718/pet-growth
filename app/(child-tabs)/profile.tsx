import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PointBadge from '@/components/PointBadge';

import { useFamilyStore } from '@/stores/useFamilyStore';
import { usePetStore } from '@/stores/usePetStore';
import { useShopStore } from '@/stores/useShopStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { getStageInfo } from '@/constants/evolution';
import PetAvatar from '@/components/PetAvatar';
import CollectionSection from '@/components/CollectionSection';
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
  const router = useRouter();

  const currentFamily = useFamilyStore(s => s.currentFamily);
  const currentChild = useFamilyStore(s => s.currentChild);
  const pet = usePetStore(s => s.pet);
  const evolutionHistory = usePetStore(s => s.evolutionHistory);
  const collection = usePetStore(s => s.collection);
  const loadCollection = usePetStore(s => s.loadCollection);
  const equipments = useShopStore(s => s.equipments);
  const equipItem = useShopStore(s => s.equipItem);
  const unequipItem = useShopStore(s => s.unequipItem);
  const tasks = useTaskStore(s => s.tasks);
  const streaks = useTaskStore(s => s.streaks);



  useEffect(() => {
    if (!currentChild?.id || !pet?.id) return;
    useShopStore.getState().loadOwnedEquipments(pet.id);
    useTaskStore.getState().loadStreaks(currentChild.id);
    if (currentFamily?.id) {
      useTaskStore.getState().loadTasks(currentFamily.id, currentChild.id);
    }
  }, [currentChild?.id, pet?.id]);

  const handleToggleEquip = (eq: typeof equipments[0]) => {
    if (!pet) return;
    if (eq.equipped === 1) {
      unequipItem(eq.id).then(() => useShopStore.getState().loadOwnedEquipments(pet.id));
    } else {
      equipItem(pet.id, eq.item_id, eq.slot_type).then(() => useShopStore.getState().loadOwnedEquipments(pet.id));
    }
  };

  useEffect(() => {
    if (currentChild?.id) {
      loadCollection(currentChild.id);
    }
  }, [currentChild?.id]);

  if (!currentChild) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyMessage}>请先选择孩子档案</Text>
        </View>
      </SafeAreaView>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const currentStreak = streaks[0]?.current_streak ?? 0;
  const bestStreak = streaks[0]?.best_streak ?? 0;

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
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/PointsHistory', params: { childId: currentChild?.id ?? '' } })}
          >
            <PointBadge type="points" amount={currentChild?.current_points ?? 0} size="medium" />
            <Text style={styles.statLabel}>当前积分 ›</Text>
          </TouchableOpacity>
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
          {equipments.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.equipmentRow}>
              {equipments.map((eq) => (
                <TouchableOpacity
                  key={eq.id}
                  style={[
                    styles.equipCard,
                    eq.equipped === 1 && styles.equipCardEquipped,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleToggleEquip(eq)}
                >
                  <Text style={styles.equipEmoji}>
                    {eq.item_image || SLOT_EMOJI[eq.slot_type] || '✨'}
                  </Text>
                  <Text style={styles.equipName} numberOfLines={1}>{eq.item_name || SLOT_LABELS[eq.slot_type as keyof typeof SLOT_LABELS] || eq.slot_type}</Text>
                  <Text style={eq.equipped === 1 ? styles.equipBadgeOn : styles.equipBadgeOff}>
                    {eq.equipped === 1 ? '穿戴中' : '未穿戴'}
                  </Text>
                </TouchableOpacity>
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

        {/* 我的图鉴 */}
        <CollectionSection entries={collection} />
        {collection.length === 0 && (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>📖 我的图鉴</Text>
            <Text style={styles.emptyHint}>还没有满级宠物哦，继续加油吧~</Text>
          </View>
        )}

        {/* 切换到家长端 */}
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => router.push({ pathname: '/ParentLock', params: { target: 'parent' } })}
          activeOpacity={0.8}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary500} />
          <Text style={styles.switchBtnText}>切换到家长端</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.neutral300} />
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessage: {
    fontSize: Typography.lg,
    color: Colors.neutral400,
  },
  bottomSpacer: {
    height: Spacing[8] - 2,
  },
  scrollContent: {
    padding: Spacing['4.5'],
    paddingTop: Spacing['2.5'],
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing[6],
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.bgPinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
    borderWidth: 3,
    borderColor: Colors.primary200,
  },
  avatarEmoji: {
    fontSize: 48,
  },
  profileName: {
    fontSize: Typography['2xl'] + 2,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  profileLevel: {
    fontSize: Typography.sm + 1,
    color: Colors.primary500,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing['2.5'],
    marginBottom: Spacing['5.5'],
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    alignItems: 'center',
    ...Shadows.sm,
  },
  statLabel: {
    fontSize: Typography.sm,
    color: Colors.neutral400,
    marginTop: Spacing['1.5'],
  },
  statNumber: {
    fontSize: Typography.xl,
    fontWeight: 'bold',
    color: Colors.neutral900,
    textAlign: 'center',
  },
  sectionBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['4.5'],
    marginBottom: Spacing['3.5'],
  },
  sectionTitle: {
    fontSize: Typography.lg + 1,
    fontWeight: '700',
    color: Colors.neutral900,
    marginBottom: Spacing['3.5'],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing['2.5'] - 1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  detailLabel: {
    fontSize: Typography.base,
    color: Colors.neutral600,
  },
  detailValue: {
    fontSize: Typography.base + 1,
    fontWeight: '700',
    color: Colors.primary500,
  },
  equipmentRow: {
    gap: Spacing[3],
    paddingRight: Spacing[1],
  },
  equipCard: {
    width: 88,
    minHeight: 100,
    backgroundColor: Colors.bgPetCircle,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipCardEquipped: {
    borderWidth: 2,
    borderColor: Colors.primary400,
  },
  equipEmoji: {
    fontSize: Typography['2xl'],
    textAlign: 'center',
    marginBottom: 4,
  },
  equipName: {
    fontSize: Typography.xs,
    fontWeight: '500',
    color: Colors.neutral600,
    textAlign: 'center',
    maxWidth: 72,
  },
  equipBadgeOn: {
    fontSize: 9,
    color: Colors.primary500,
    fontWeight: '700',
    marginTop: 2,
  },
  equipBadgeOff: {
    fontSize: 9,
    color: Colors.neutral400,
    marginTop: 2,
  },
  emptyHint: {
    fontSize: Typography.sm + 1,
    color: Colors.neutral300,
    textAlign: 'center',
    paddingVertical: Spacing['2.5'],
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing['2.5'],
    borderLeftWidth: 2,
    borderColor: Colors.primary200,
    paddingLeft: Spacing['3.5'],
    marginLeft: Spacing['1.5'] + 1,
  },
  evoDot: {
    width: Spacing[9],
    height: Spacing[9],
    borderRadius: 18,
    backgroundColor: Colors.bgPeachSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
    position: 'relative',
    left: -26,
  },
  evoDotLast: {},
  evoInfo: {
    flex: 1,
  },
  evoName: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.neutral800,
  },
  evoDate: {
    fontSize: Typography.sm,
    color: Colors.neutral400,
    marginTop: 2,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    paddingVertical: Spacing['3.5'],
    paddingHorizontal: Spacing['4.5'],
    gap: Spacing[3],
    ...Shadows.sm,
  },
  switchBtnText: {
    flex: 1,
    fontSize: Typography.base + 1,
    fontWeight: '600',
    color: Colors.primary500,
  },
});
