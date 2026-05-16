import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing['4.5'] * 2 - CARD_GAP) / 2;

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
    if (currentChild?.id) loadCollection(currentChild.id);
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

  const statItems = [
    {
      key: 'points',
      content: <PointBadge type="points" amount={currentChild?.current_points ?? 0} size="medium" />,
      label: '当前积分',
      onPress: () => router.push({ pathname: '/PointsHistory', params: { childId: currentChild?.id ?? '' } }),
      arrow: true,
    },
    {
      key: 'stars',
      content: <PointBadge type="stars" amount={currentChild?.current_stars ?? 0} size="medium" />,
      label: '当前星星',
    },
    {
      key: 'tasks',
      content: <Text style={styles.statNumber}>📋 {completedTasks}</Text>,
      label: '完成任务',
    },
    {
      key: 'streak',
      content: <Text style={styles.statNumber}>🔥 {currentStreak}天</Text>,
      label: '连续完成',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 头像区域 */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              {pet
                ? <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={84} />
                : <Text style={styles.avatarEmoji}>🐾</Text>}
            </View>
          </View>
          <Text style={styles.profileName}>{currentChild?.name || '未设置'}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Lv.{pet?.level ?? 1} · 宠物主人</Text>
          </View>
        </View>

        {/* 统计数据卡片 */}
        <View style={styles.statsGrid}>
          {statItems.map((item) =>
            item.onPress ? (
              <TouchableOpacity
                key={item.key}
                style={styles.statCard}
                activeOpacity={0.7}
                onPress={item.onPress}
              >
                <View style={styles.statContent}>{item.content}</View>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel}>{item.label}</Text>
                  {item.arrow && <Ionicons name="chevron-forward" size={12} color={Colors.neutral400} />}
                </View>
              </TouchableOpacity>
            ) : (
              <View key={item.key} style={styles.statCard}>
                <View style={styles.statContent}>{item.content}</View>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            )
          )}
        </View>

        {/* 累计数据 */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>📊 成长数据</Text>
          {[
            { label: '累计获得积分', value: currentChild?.total_points ?? 0 },
            { label: '累计获得星星', value: currentChild?.total_stars ?? 0 },
            { label: '最佳连续天数', value: `${bestStreak} 天` },
          ].map((row, i, arr) => (
            <View key={row.label} style={[styles.detailRow, i === arr.length - 1 && styles.detailRowLast]}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* 我的装扮 */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>🎨 我的装扮</Text>
          {equipments.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.equipmentRow}
            >
              {equipments.map((eq) => (
                <TouchableOpacity
                  key={eq.id}
                  style={[styles.equipCard, eq.equipped === 1 && styles.equipCardEquipped]}
                  activeOpacity={0.7}
                  onPress={() => handleToggleEquip(eq)}
                >
                  <Text style={styles.equipEmoji}>
                    {eq.item_image || SLOT_EMOJI[eq.slot_type] || '✨'}
                  </Text>
                  <Text style={styles.equipName} numberOfLines={1}>
                    {eq.item_name || SLOT_LABELS[eq.slot_type as keyof typeof SLOT_LABELS] || eq.slot_type}
                  </Text>
                  <View style={[styles.equipBadge, eq.equipped === 1 ? styles.equipBadgeOn : styles.equipBadgeOff]}>
                    <Text style={[styles.equipBadgeText, eq.equipped === 1 ? styles.equipBadgeTextOn : styles.equipBadgeTextOff]}>
                      {eq.equipped === 1 ? '穿戴中' : '未穿戴'}
                    </Text>
                  </View>
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
          {evolutionHistory.length > 0 ? (
            <View style={styles.evoList}>
              {evolutionHistory.map((evo, i) => (
                <View key={i} style={styles.evoRow}>
                  {/* 时间轴线 */}
                  <View style={styles.evoTrack}>
                    <View style={[styles.evoDot, i === evolutionHistory.length - 1 && styles.evoDotLast]}>
                      <Text style={styles.evoDotEmoji}>{evo.emoji || '🥚'}</Text>
                    </View>
                    {i < evolutionHistory.length - 1 && <View style={styles.evoLine} />}
                  </View>
                  <View style={styles.evoInfo}>
                    <Text style={styles.evoName}>{evo.name}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>还没有进化记录，继续照顾宠物吧~</Text>
          )}
        </View>

        {/* 我的图鉴 */}
        {collection.length > 0 ? (
          <CollectionSection entries={collection} />
        ) : (
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
          <View style={styles.switchBtnIcon}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary500} />
          </View>
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
  scrollContent: {
    paddingHorizontal: Spacing['4.5'],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[4],
  },
  bottomSpacer: {
    height: Spacing[4],
  },

  // ── 头像区 ──────────────────────────────────────────────
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing[5],
    marginBottom: Spacing[4],
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    ...Shadows.sm,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.primary200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
    backgroundColor: Colors.bgPinkSoft,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.bgPinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 44,
  },
  profileName: {
    fontSize: Typography['2xl'],
    fontWeight: '700',
    color: Colors.neutral900,
    marginBottom: Spacing[1],
  },
  levelBadge: {
    backgroundColor: Colors.primary50,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary200,
  },
  levelBadgeText: {
    fontSize: Typography.sm,
    color: Colors.primary500,
    fontWeight: '600',
  },

  // ── 统计卡片 ─────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginBottom: Spacing[4],
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[3],
    alignItems: 'center',
    ...Shadows.sm,
  },
  statContent: {
    marginBottom: Spacing[2],
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: Typography.sm,
    color: Colors.neutral400,
  },
  statNumber: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.neutral900,
  },

  // ── 通用 section ─────────────────────────────────────────
  sectionBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['4.5'],
    marginBottom: Spacing[3],
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Typography.base + 1,
    fontWeight: '700',
    color: Colors.neutral900,
    marginBottom: Spacing[3],
  },

  // ── 成长数据 ─────────────────────────────────────────────
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing['2.5'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral100,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  detailLabel: {
    fontSize: Typography.base,
    color: Colors.neutral600,
  },
  detailValue: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.primary500,
  },

  // ── 装扮 ─────────────────────────────────────────────────
  equipmentRow: {
    gap: Spacing[3],
    paddingBottom: Spacing[1],
  },
  equipCard: {
    width: 84,
    backgroundColor: Colors.bgPetCircle,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  equipCardEquipped: {
    borderColor: Colors.primary400,
    backgroundColor: Colors.primary50,
  },
  equipEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  equipName: {
    fontSize: Typography.xs,
    fontWeight: '500',
    color: Colors.neutral600,
    textAlign: 'center',
    maxWidth: 72,
    marginBottom: 4,
  },
  equipBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  equipBadgeOn: {
    backgroundColor: Colors.primary100,
  },
  equipBadgeOff: {
    backgroundColor: Colors.neutral100,
  },
  equipBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  equipBadgeTextOn: {
    color: Colors.primary600,
  },
  equipBadgeTextOff: {
    color: Colors.neutral400,
  },

  // ── 进化记录 ─────────────────────────────────────────────
  evoList: {
    paddingLeft: Spacing[1],
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
  },
  evoTrack: {
    width: 36,
    alignItems: 'center',
  },
  evoDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgPeachSoft,
    borderWidth: 2,
    borderColor: Colors.primary200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evoDotLast: {
    borderColor: Colors.primary400,
    backgroundColor: Colors.primary50,
  },
  evoDotEmoji: {
    fontSize: 16,
  },
  evoLine: {
    width: 2,
    flex: 1,
    minHeight: 12,
    backgroundColor: Colors.primary100,
    marginVertical: 2,
  },
  evoInfo: {
    flex: 1,
    paddingLeft: Spacing[3],
    paddingTop: 8,
    paddingBottom: Spacing[3],
  },
  evoName: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.neutral800,
  },

  // ── 空状态 ───────────────────────────────────────────────
  emptyHint: {
    fontSize: Typography.sm,
    color: Colors.neutral300,
    textAlign: 'center',
    paddingVertical: Spacing[3],
  },

  // ── 切换家长端 ───────────────────────────────────────────
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing['4.5'],
    gap: Spacing[3],
    marginBottom: Spacing[3],
    ...Shadows.sm,
  },
  switchBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnText: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.primary500,
  },
});
