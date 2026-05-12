import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import PetStatusBars from '@/components/PetStatusBars';
import PointBadge from '@/components/PointBadge';
import TaskCard from '@/components/TaskCard';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { usePetStore } from '@/stores/usePetStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useBehaviorStore } from '@/stores/useBehaviorStore';
import PetAvatar from '@/components/PetAvatar';
import { getStageInfo, getSpeciesInfo } from '@/constants/evolution';
import { MoodType, HealthType } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

/** 与 usePetStore 中 HEAL_COST_STARS / RETURN_HOME_POINTS 保持一致 */
const HEAL_COST_STARS = 3;
const RETURN_HOME_POINTS = 100;

type CareAction = {
  key: string;
  emoji: string;
  label: string;
  cost: number;
  costType: 'points' | 'stars';
};

const BASE_CARE_ACTIONS: CareAction[] = [
  { key: 'feed', emoji: '🍖', label: '喂食', cost: 2, costType: 'points' },
  { key: 'bathe', emoji: '🛁', label: '洗澡', cost: 1, costType: 'points' },
  { key: 'play', emoji: '🎾', label: '玩耍', cost: 0, costType: 'points' },
  { key: 'pet', emoji: '🤗', label: '抚摸', cost: 0, costType: 'points' },
  { key: 'rest', emoji: '🛏️', label: '休息', cost: 0, costType: 'points' },
];

export default function ChildHomeScreen() {
  const router = useRouter();
  const careCooldownRef = useRef(false);
  const careScaleRef = useRef(new Animated.Value(1));
  const { currentFamily, currentChild } = useFamilyStore();
  const {
    pet,
    loadPet,
    calculateDecay,
    feedPet,
    bathePet,
    playWithPet,
    petPet,
    restPet,
    healPet,
    returnFromRunaway,
  } = usePetStore();
  const { tasks, loadTasks, submitTask } = useTaskStore();
  const { records, loadRecords } = useBehaviorStore();

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return '凌晨好 🌙';
    if (hour < 9) return '早上好 ☀️';
    if (hour < 12) return '上午好 👋';
    if (hour < 14) return '中午好 🌞';
    if (hour < 18) return '下午好 🌤';
    if (hour < 22) return '晚上好 🌙';
    return '夜深了 💤';
  }, []);

  // Dynamic status text based on pet mood and health
  const statusText = useMemo(() => {
    if (!pet) return '等待宠物数据...';
    const mood = pet.mood_type as MoodType;
    const health = pet.health_type as HealthType;
    if (mood === 'excited' || mood === 'happy') {
      return health === 'healthy'
        ? `${pet.name || '小家伙'}今天心情不错呢！吃饱喝足，精力充沛~`
        : `${pet.name || '小家伙'}心情不错，但需要注意身体状态哦~`;
    }
    if (mood === 'normal') {
      return `${pet.name || '小家伙'}状态平稳，一起玩耍吧~`;
    }
    if (mood === 'unhappy') {
      return `${pet.name || '小家伙'}今天有点低落，安慰一下它吧~`;
    }
    if (mood === 'sad') {
      return `😢 ${pet.name || '小家伙'}很伤心，快去照顾它！`;
    }
    return `${pet.name || '小家伙'}在等你呢~`;
  }, [pet?.mood_type, pet?.health_type, pet?.name]);

  useEffect(() => {
    if (!currentFamily || !currentChild) return;
    const childId = currentChild.id;
    const familyId = currentFamily.id;

    loadPet(childId);
    loadTasks(familyId, childId);
    loadRecords(childId);
    calculateDecay();
  }, [currentChild?.id]);

  const careActions = useMemo((): CareAction[] => {
    const list = [...BASE_CARE_ACTIONS];
    if (pet?.health_type === 'sick') {
      list.push({
        key: 'heal',
        emoji: '💊',
        label: '治疗',
        cost: HEAL_COST_STARS,
        costType: 'stars',
      });
    }
    return list;
  }, [pet?.health_type]);

  // 今日任务：进行中状态
  const today = new Date().toISOString().split('T')[0];
  const activeTasks = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'active' || t.status === 'submitted'
  );
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // 今日获得积分
  const todayPoints = records
    .filter((r) => r.approved === 1 && r.currency_type === 'points' && r.created_at?.startsWith(today))
    .reduce((sum, r) => sum + r.points_change, 0);

  const handleCareAction = useCallback(
    (key: string) => {
      if (!pet || !currentChild || careCooldownRef.current) return;
      careCooldownRef.current = true;

      // Button press animation
      Animated.sequence([
        Animated.timing(careScaleRef.current, { toValue: 0.9, duration: 100, useNativeDriver: true }),
        Animated.timing(careScaleRef.current, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const actionMap: Record<string, () => Promise<void>> = {
        feed: () => feedPet(),
        bathe: () => bathePet(),
        play: () => playWithPet(),
        pet: () => petPet(),
        rest: () => restPet(),
        heal: () => healPet(),
      };
      const fn = actionMap[key];
      if (fn) {
        fn().then(() => {
          Alert.alert('成功', '照顾完成！');
          if (currentChild) loadPet(currentChild.id);
        }).catch((err: Error) => {
          Alert.alert('提示', err.message || '操作失败');
        }).finally(() => {
          setTimeout(() => { careCooldownRef.current = false; }, 800);
        });
      } else {
        careCooldownRef.current = false;
      }
    },
    [pet, currentChild, feedPet, bathePet, playWithPet, petPet, restPet, healPet, loadPet]
  );

  const handleReturnHome = useCallback(() => {
    if (!pet?.ran_away_at) return;
    Alert.alert(
      '接宠物回家',
      `消耗 ${RETURN_HOME_POINTS} 积分，把 TA 接回家并恢复健康状态。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认接回',
          onPress: () => {
            returnFromRunaway(true)
              .then((ok) => {
                if (ok && currentChild) {
                  loadPet(currentChild.id);
                  Alert.alert('欢迎回家', '小家伙回来了！');
                }
              })
              .catch((err: Error) => Alert.alert('提示', err.message || '操作失败'));
          },
        },
      ]
    );
  }, [pet?.ran_away_at, currentChild, returnFromRunaway, loadPet]);

  const handleSubmitTask = useCallback((taskId: string) => {
    if (!currentChild || !currentFamily) return;
    submitTask(taskId, currentChild.id).then(() => {
      const familyId = currentFamily.id;
      loadTasks(familyId, currentChild.id);
      loadRecords(currentChild.id);
      Alert.alert('成功', '任务已提交！');
    }).catch((e: Error) => Alert.alert('提示', e.message));
  }, [currentChild, currentFamily, submitTask, loadTasks, loadRecords]);

  if (!currentChild) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={{ fontSize: 18, color: '#999' }}>请先选择孩子档案</Text>
        </View>
      </SafeAreaView>
    );
  }

  const petStageInfo = pet ? getStageInfo(pet.current_stage) : null;
  const stageName = petStageInfo?.name || '';
  const pointsPercent = pet ? Math.min(100, (pet.current_points / (pet.points_to_next_level || 1)) * 100) : 0;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 头部：积分和星星 */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.currencyRow}>
            <PointBadge type="points" amount={currentChild?.current_points || 0} size="small" />
            <PointBadge type="stars" amount={currentChild?.current_stars || 0} size="small" />
          </View>
        </View>

        {/* 宠物展示区 */}
        <View style={styles.petArea}>
          <View style={styles.petCircle}>
            {pet ? (
              <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={140} />
            ) : (
              <Text style={{ fontSize: 90 }}>🥚</Text>
            )}
          </View>
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{pet?.name || '宠物'}</Text>
            <Text style={styles.petLevel}>
              Lv.{pet?.level || 1} · {stageName}
            </Text>

            {/* 积分条 */}
            <View style={styles.pointsBar}>
              <View style={[styles.pointsFill, { width: `${pointsPercent}%` }]} />
              <Text style={styles.pointsText}>
                {pet?.current_points || 0}/{pet?.points_to_next_level || 100} 积分
              </Text>
            </View>
          </View>
        </View>

        {/* 状态条 */}
        <View style={styles.statusCard}>
          {pet ? (
            <PetStatusBars
              hungerValue={pet.hunger_value}
              cleanValue={pet.clean_value}
              moodValue={pet.mood_value}
              healthType={pet.health_type}
              moodType={pet.mood_type}
            />
          ) : (
            <Text style={{ textAlign: 'center', color: '#999', padding: 10 }}>加载宠物状态中...</Text>
          )}
          <Text style={styles.statusText}>
            {statusText}
          </Text>
        </View>

        {/* 离家出走：优先接回 */}
        {pet?.ran_away_at ? (
          <View style={styles.runawayCard}>
            <Text style={styles.runawayTitle}>小家伙离家出走了…</Text>
            <Text style={styles.runawayHint}>用积分把 TA 接回家吧</Text>
            <TouchableOpacity style={styles.runawayBtn} activeOpacity={0.8} onPress={handleReturnHome}>
              <Text style={styles.runawayBtnText}>🏠 接回家（-{RETURN_HOME_POINTS} 积分）</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.careScroll}
          >
            {careActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.careBtn}
                activeOpacity={0.7}
                onPress={() => handleCareAction(action.key)}
              >
                <Animated.View style={{ transform: [{ scale: careScaleRef.current }] }}>
                  <Text style={styles.careEmoji}>{action.emoji}</Text>
                </Animated.View>
                <Text style={styles.careLabel}>{action.label}</Text>
                {action.cost > 0 && (
                  <Text style={styles.cost}>
                    -{action.cost}
                    {action.costType === 'stars' ? '⭐' : '分'}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 今日任务预览 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📋 今日任务</Text>
          <TouchableOpacity onPress={() => router.push('/(child-tabs)/tasks')}>
            <Text style={styles.moreLink}>查看全部 →</Text>
          </TouchableOpacity>
        </View>

        {activeTasks.slice(0, 3).map((task) => (
          <TaskCard
            key={task.id}
            task={task as any}
            onSubmit={() => handleSubmitTask(task.id)}
          />
        ))}

        {/* 今日进度 */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>今日进度</Text>
            <Text style={styles.progressPercent}>{taskProgress}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${taskProgress}%` }]} />
          </View>
          <Text style={styles.progressDetail}>已获 {todayPoints} 积分 · 完成 {completedTasks.length}/{tasks.length} 任务</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scrollContent: {
    padding: Spacing[4] + 2,
    paddingBottom: Spacing[6] + 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  greeting: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: Spacing[2] - 1,
  },
  petArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing[4],
    marginBottom: Spacing[3] + 2,
    ...Shadows.md,
  },
  petCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF9F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3] + 2,
  },
  petEmoji: {},
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  petLevel: {
    fontSize: Typography.sm + 1,
    color: Colors.primary500,
    marginTop: Spacing[1] / 2,
    fontWeight: '500',
  },
  pointsBar: {
    marginTop: Spacing[2] + 2,
    position: 'relative',
  },
  pointsFill: {
    height: Spacing[2],
    backgroundColor: Colors.secondary300,
    borderRadius: Spacing[1],
  },
  pointsText: {
    fontSize: Typography.xs + 1,
    color: Colors.neutral400,
    marginTop: Spacing[1] / 2,
  },
  statusCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl + 4,
    padding: Spacing[3] + 2,
    marginBottom: Spacing[3] + 2,
    ...Shadows.sm,
  },
  statusText: {
    fontSize: Typography.sm + 1,
    color: Colors.neutral600,
    textAlign: 'center',
    marginTop: Spacing[2] + 2,
    lineHeight: Typography.sm + 7,
  },
  careScroll: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3] + 2,
    paddingVertical: Spacing[1],
    marginBottom: Spacing[4] + 2,
    paddingRight: Spacing[2],
  },
  careBtn: {
    alignItems: 'center',
    width: Spacing[8] + 24,
  },
  runawayCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4] + 2,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  runawayTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: Spacing[1],
  },
  runawayHint: {
    fontSize: Typography.sm + 1,
    color: '#BF360C',
    marginBottom: Spacing[3],
  },
  runawayBtn: {
    backgroundColor: Colors.primary500,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  runawayBtnText: {
    color: Colors.neutral0,
    fontSize: Typography.base + 1,
    fontWeight: '700',
  },
  careEmoji: {
    fontSize: Typography['3xl'] + 8,
    marginBottom: Spacing[1] / 2,
  },
  careLabel: {
    fontSize: Typography.xs + 1,
    color: Colors.neutral600,
  },
  cost: {
    fontSize: Typography.xs - 1,
    color: Colors.primary500,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[2] + 2,
    marginTop: Spacing[1] + 2,
  },
  sectionTitle: {
    fontSize: Typography.lg + 1,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  moreLink: {
    fontSize: Typography.sm + 1,
    color: Colors.secondary300,
    fontWeight: '500',
  },
  progressCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    marginTop: Spacing[3],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing[2],
  },
  progressTitle: {
    fontSize: Typography.base + 1,
    fontWeight: '600',
    color: Colors.neutral900,
  },
  progressPercent: {
    fontSize: Typography.base + 1,
    fontWeight: '700',
    color: Colors.secondary300,
  },
  progressBarBg: {
    height: Spacing[2] + 2,
    backgroundColor: Colors.neutral200,
    borderRadius: Spacing[1] + 1,
    overflow: 'hidden',
    marginBottom: Spacing[1] + 2,
  },
  progressBarFill: {
    height: Spacing[2] + 2,
    backgroundColor: Colors.secondary300,
    borderRadius: Spacing[1] + 1,
  },
  progressDetail: {
    fontSize: Typography.sm + 1,
    color: Colors.neutral400,
    textAlign: 'center',
  },
});
