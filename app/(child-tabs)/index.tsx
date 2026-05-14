import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, TextInput, ActivityIndicator } from 'react-native';
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
import { getStageInfo, getSpeciesInfo, PET_SPECIES } from '@/constants/evolution';
import { MoodType, HealthType } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal from '@/components/Modal';

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

  // Modal 状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalActions, setModalActions] = useState<{ text: string; onPress?: () => void; primary?: boolean }[]>([]);

  const showModal = useCallback((title: string, message: string, actions?: { text: string; onPress?: () => void; primary?: boolean }[]) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalActions(actions || [{ text: '知道了', primary: true }]);
    setModalVisible(true);
  }, []);

  const hideModal = useCallback(() => setModalVisible(false), []);

  // 图鉴 + 领养状态
  const [showAdoptModal, setShowAdoptModal] = useState(false);
  const [adoptSpeciesId, setAdoptSpeciesId] = useState(PET_SPECIES[0].id);
  const [adoptPetName, setAdoptPetName] = useState('');
  const [isAdopting, setIsAdopting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
    saveToCollection,
    adoptNewPet,
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
          showModal('成功', '照顾完成！');
          if (currentChild) loadPet(currentChild.id);
        }).catch((err: Error) => {
          showModal('提示', err.message || '操作失败');
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
    showModal(
      '接宠物回家',
      `消耗 ${RETURN_HOME_POINTS} 积分，把 TA 接回家并恢复健康状态。`,
      [
        { text: '取消' },
        {
          text: '确认接回',
          primary: true,
          onPress: () => {
            returnFromRunaway(true)
              .then((ok) => {
                if (ok && currentChild) {
                  loadPet(currentChild.id);
                  showModal('欢迎回家', '小家伙回来了！');
                }
              })
              .catch((err: Error) => showModal('提示', err.message || '操作失败'));
          },
        },
      ]
    );
  }, [pet?.ran_away_at, currentChild, returnFromRunaway, loadPet, showModal]);

  const handleSubmitTask = useCallback((taskId: string) => {
    if (!currentChild || !currentFamily) return;
    submitTask(taskId, currentChild.id).then(() => {
      const familyId = currentFamily.id;
      loadTasks(familyId, currentChild.id);
      loadRecords(currentChild.id);
      showModal('成功', '任务已提交！');
    }).catch((e: Error) => showModal('提示', e.message));
  }, [currentChild, currentFamily, submitTask, loadTasks, loadRecords]);

  const handleSaveToCollection = useCallback(() => {
    if (!currentChild || !pet) return;
    showModal(
      '保存到图鉴',
      `将「${pet.name}」保存到图鉴？保存后可以领取一只新宠物继续冒险！`,
      [
        { text: '再想想' },
        {
          text: '保存',
          primary: true,
          onPress: () => {
            setIsSaving(true);
            saveToCollection(currentChild.id)
              .then(() => {
                setShowAdoptModal(true);
                setAdoptSpeciesId(PET_SPECIES[0].id);
                setAdoptPetName('');
              })
              .catch((err: Error) => showModal('提示', err.message))
              .finally(() => setIsSaving(false));
          },
        },
      ]
    );
  }, [currentChild, pet, saveToCollection, showModal]);

  const handleAdoptPet = useCallback(() => {
    if (!currentChild) return;
    if (!adoptPetName.trim()) {
      showModal('提示', '请给新宠物取个名字');
      return;
    }
    setIsAdopting(true);
    adoptNewPet(currentChild.id, adoptSpeciesId, adoptPetName.trim())
      .then(() => {
        setShowAdoptModal(false);
        loadPet(currentChild.id);
        showModal('🎉 欢迎新伙伴', '新宠物已加入你的家庭！');
      })
      .catch((err: Error) => showModal('提示', err.message))
      .finally(() => setIsAdopting(false));
  }, [currentChild, adoptSpeciesId, adoptPetName, adoptNewPet, loadPet, showModal]);

  const selectedAdoptSpecies = PET_SPECIES.find(s => s.id === adoptSpeciesId);

  if (!currentChild) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>请先选择孩子档案</Text>
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
              <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={90} />
            ) : (
              <Text style={styles.petEmojiLarge}>🥚</Text>
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

        {/* 满级保存到图鉴入口 */}
        {pet && pet.level >= 8 && !showAdoptModal && (
          <TouchableOpacity
            style={styles.collectionBtn}
            activeOpacity={0.8}
            onPress={handleSaveToCollection}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.bgCard} size="small" />
            ) : (
              <>
                <Text style={styles.collectionBtnEmoji}>📖</Text>
                <View style={styles.collectionBtnTextWrap}>
                  <Text style={styles.collectionBtnTitle}>保存到图鉴</Text>
                  <Text style={styles.collectionBtnHint}>恭喜满级！保存后可以领取新宠物继续冒险</Text>
                </View>
                <Text style={styles.collectionBtnArrow}>›</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* 无活跃宠物：领养入口 */}
        {!pet && !showAdoptModal && (
          <TouchableOpacity
            style={styles.collectionBtn}
            activeOpacity={0.8}
            onPress={() => {
              setAdoptSpeciesId(PET_SPECIES[0].id);
              setAdoptPetName('');
              setShowAdoptModal(true);
            }}
          >
            <Text style={styles.collectionBtnEmoji}>🐣</Text>
            <View style={styles.collectionBtnTextWrap}>
              <Text style={styles.collectionBtnTitle}>领取新宠物</Text>
              <Text style={styles.collectionBtnHint}>消耗 100 积分，开始新的养成冒险</Text>
            </View>
            <Text style={styles.collectionBtnArrow}>›</Text>
          </TouchableOpacity>
        )}

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
            <Text style={styles.statusLoadingText}>加载宠物状态中...</Text>
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

      {/* 自定义弹窗 */}
      <Modal visible={modalVisible} onClose={hideModal} title={modalTitle}>
        <Text style={{ fontSize: 15, color: Colors.neutral600, marginBottom: 20, lineHeight: 22 }}>
          {modalMessage}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
          {modalActions.map((action, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                hideModal();
                action.onPress?.();
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: 10,
                backgroundColor: action.primary ? Colors.primary500 : Colors.neutral100,
              }}
            >
              <Text style={{
                fontSize: 15,
                fontWeight: action.primary ? '700' : '500',
                color: action.primary ? Colors.neutral0 : Colors.neutral600,
              }}>
                {action.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* 领养新宠物弹窗 */}
      <Modal visible={showAdoptModal} onClose={() => setShowAdoptModal(false)} title="领取新宠物">
        <Text style={{ fontSize: Typography.sm, color: Colors.neutral500, marginBottom: Spacing['2.5'], textAlign: 'center' }}>
          消耗 100 积分（当前: {currentChild?.current_points ?? 0}）
        </Text>

        {/* 物种选择网格 */}
        <View style={styles.adoptGrid}>
          {PET_SPECIES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.adoptPetCard,
                adoptSpeciesId === s.id && styles.adoptPetCardSelected,
                { borderColor: adoptSpeciesId === s.id ? s.color : Colors.neutral200 },
              ]}
              onPress={() => setAdoptSpeciesId(s.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.adoptPetEmoji}>{s.emoji}</Text>
              <Text style={styles.adoptPetName}>{s.name}</Text>
              {adoptSpeciesId === s.id && (
                <View style={[styles.adoptCheckBadge, { backgroundColor: s.color }]}>
                  <Text style={styles.adoptCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {selectedAdoptSpecies && (
          <View style={styles.adoptDescBox}>
            <Text style={styles.adoptDescText}>{selectedAdoptSpecies.description}</Text>
          </View>
        )}

        {/* 取名 */}
        <View style={{ marginBottom: Spacing['3.5'] }}>
          <Text style={{ fontSize: Typography.base, fontWeight: '600', color: Colors.neutral800, textAlign: 'center', marginBottom: Spacing['2'] }}>
            给新宠物取个名字 🏷️
          </Text>
          <TextInput
            style={styles.adoptNameInput}
            placeholder="例如：小团子"
            value={adoptPetName}
            onChangeText={setAdoptPetName}
            maxLength={10}
            textAlign="center"
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={styles.adoptCancelBtn}
            onPress={() => setShowAdoptModal(false)}
          >
            <Text style={styles.adoptCancelText}>以后再说</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.adoptConfirmBtn,
              ((currentChild?.current_points ?? 0) < 100 || !adoptPetName.trim() || isAdopting) && { opacity: 0.5 },
            ]}
            onPress={handleAdoptPet}
            disabled={(currentChild?.current_points ?? 0) < 100 || !adoptPetName.trim() || isAdopting}
          >
            {isAdopting ? (
              <ActivityIndicator color={Colors.bgCard} size="small" />
            ) : (
              <Text style={styles.adoptConfirmText}>
                {adoptPetName.trim() ? `🎉 领养「${adoptPetName.trim()}」` : '🎉 领养新宠物'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scrollContent: {
    padding: Spacing['4.5'],
    paddingBottom: Spacing['7'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.xl,
    color: Colors.neutral500,
  },
  statusLoadingText: {
    textAlign: 'center',
    color: Colors.neutral500,
    padding: Spacing['2.5'],
  },
  petEmojiLarge: {
    fontSize: 90,
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
    gap: Spacing['1.5'],
  },
  petArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing[4],
    marginBottom: Spacing['3.5'],
    ...Shadows.md,
  },
  petCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.bgPetCircle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing['3.5'],
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  petLevel: {
    fontSize: Typography.sm,
    color: Colors.primary500,
    marginTop: 2,
    fontWeight: '500',
  },
  pointsBar: {
    marginTop: Spacing['2.5'],
    position: 'relative',
  },
  pointsFill: {
    height: Spacing[2],
    backgroundColor: Colors.secondary300,
    borderRadius: Spacing[1],
  },
  pointsText: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['3.5'],
    marginBottom: Spacing['3.5'],
    ...Shadows.sm,
  },
  statusText: {
    fontSize: Typography.sm,
    color: Colors.neutral600,
    textAlign: 'center',
    marginTop: Spacing['2.5'],
    lineHeight: 19,
  },
  careScroll: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing['3.5'],
    paddingVertical: Spacing[1],
    marginBottom: Spacing['4.5'],
    paddingRight: Spacing[2],
  },
  careBtn: {
    alignItems: 'center',
    width: Spacing[14],
  },
  runawayCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    marginBottom: Spacing['4.5'],
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  runawayTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.warningDark,
    marginBottom: Spacing[1],
  },
  runawayHint: {
    fontSize: Typography.sm,
    color: Colors.warningDeepDark,
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
    fontSize: Typography.base,
    fontWeight: '700',
  },
  careEmoji: {
    fontSize: Typography['4xl'],
    marginBottom: 2,
  },
  careLabel: {
    fontSize: Typography.xs,
    color: Colors.neutral600,
  },
  cost: {
    fontSize: Typography.xs,
    color: Colors.primary500,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing['2.5'],
    marginTop: Spacing['1.5'],
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  moreLink: {
    fontSize: Typography.sm,
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
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.neutral900,
  },
  progressPercent: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.secondary300,
  },
  progressBarBg: {
    height: Spacing['2.5'],
    backgroundColor: Colors.neutral200,
    borderRadius: Spacing['1.5'],
    overflow: 'hidden',
    marginBottom: Spacing['1.5'],
  },
  progressBarFill: {
    height: Spacing['2.5'],
    backgroundColor: Colors.secondary300,
    borderRadius: Spacing['1.5'],
  },
  progressDetail: {
    fontSize: Typography.sm,
    color: Colors.neutral400,
    textAlign: 'center',
  },
  // 图鉴 / 领养相关样式
  collectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['3.5'],
    marginBottom: Spacing['3.5'],
    ...Shadows.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary200,
  },
  collectionBtnEmoji: {
    fontSize: Typography['3xl'],
    marginRight: Spacing[3],
  },
  collectionBtnTextWrap: {
    flex: 1,
  },
  collectionBtnTitle: {
    fontSize: Typography.base + 1,
    fontWeight: '700',
    color: Colors.primary500,
  },
  collectionBtnHint: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
    marginTop: 2,
  },
  collectionBtnArrow: {
    fontSize: Typography['2xl'],
    color: Colors.neutral300,
    fontWeight: '700',
  },
  adoptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing['2.5'],
    justifyContent: 'center',
    marginBottom: Spacing['2.5'],
  },
  adoptPetCard: {
    width: '30%',
    aspectRatio: 0.9,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 2.5,
    borderColor: Colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral50,
    paddingVertical: Spacing['2.5'],
  },
  adoptPetCardSelected: {
    shadowColor: Colors.primary500,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    transform: [{ scale: 1.04 }],
  },
  adoptPetEmoji: {
    fontSize: 36,
  },
  adoptPetName: {
    marginTop: Spacing[1],
    fontSize: Typography.xs,
    fontWeight: '600',
    color: Colors.neutral700,
  },
  adoptCheckBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adoptCheckText: {
    color: Colors.bgCard,
    fontSize: Typography.xs,
    fontWeight: 'bold',
  },
  adoptDescBox: {
    backgroundColor: Colors.bgCreamWarm,
    borderRadius: BorderRadius.lg,
    padding: Spacing[3],
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  adoptDescText: {
    fontSize: Typography.sm,
    color: Colors.textCreamWarm,
    textAlign: 'center',
  },
  adoptNameInput: {
    borderWidth: 1.5,
    borderColor: Colors.borderInput,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: Typography.base + 1,
    backgroundColor: Colors.neutral50,
  },
  adoptCancelBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
  },
  adoptCancelText: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.neutral600,
  },
  adoptConfirmBtn: {
    flex: 2,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.button,
    backgroundColor: Colors.primary500,
    alignItems: 'center',
  },
  adoptConfirmText: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.bgCard,
  },
});
