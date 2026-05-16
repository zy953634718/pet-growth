import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePetStore } from '@/stores/usePetStore';
import { useShopStore } from '@/stores/useShopStore';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { getStageInfo, getSpeciesInfo } from '@/constants/evolution';
import PetAvatar from '@/components/PetAvatar';
import Modal, { ModalStyles } from '@/components/Modal';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import { SLOT_LABELS, SlotType, MOOD_EMOJI, HEALTH_EMOJI } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROOM_HEIGHT = SCREEN_WIDTH * 0.72;

// ── 房间主题（魔法星空风格）───────────────────────────────────
const ROOM_THEMES = [
  {
    id: 'magic',
    label: '魔法圣殿',
    emoji: '🔮',
    bg: '#0c1445',
    floor: '#1a237e',
    wall: '#0c1445',
    glowColor: 'rgba(124,58,237,0.4)',
    particleColor: '#FFD700',
    accentColor: '#A78BFA',
  },
  {
    id: 'aurora',
    label: '极光之境',
    emoji: '🌌',
    bg: '#0B1026',
    floor: '#1B2A4A',
    wall: '#0B1026',
    glowColor: 'rgba(56,189,248,0.4)',
    particleColor: '#38BDF8',
    accentColor: '#7DD3FC',
  },
  {
    id: 'golden',
    label: '黄金神殿',
    emoji: '👑',
    bg: '#1A1208',
    floor: '#3D2B1F',
    wall: '#1A1208',
    glowColor: 'rgba(251,191,36,0.4)',
    particleColor: '#FBBF24',
    accentColor: '#FCD34D',
  },
  {
    id: 'forest',
    label: '精灵森林',
    emoji: '🌲',
    bg: '#0F2817',
    floor: '#1A3D26',
    wall: '#0F2817',
    glowColor: 'rgba(74,222,128,0.4)',
    particleColor: '#4ADE80',
    accentColor: '#86EFAC',
  },
  {
    id: 'candy',
    label: '糖果仙境',
    emoji: '🍭',
    bg: '#2D1B2E',
    floor: '#4A2D4B',
    wall: '#2D1B2E',
    glowColor: 'rgba(244,114,182,0.4)',
    particleColor: '#F472B6',
    accentColor: '#F9A8D4',
  },
];

// ── 房间家具摆件 ─────────────────────────────────────────────
const FURNITURE_OPTIONS = [
  { id: 'sofa',    emoji: '🛋️',  label: '沙发',    x: 0.08, y: 0.55 },
  { id: 'plant',   emoji: '🪴',   label: '植物',    x: 0.75, y: 0.48 },
  { id: 'lamp',    emoji: '💡',   label: '台灯',    x: 0.82, y: 0.20 },
  { id: 'bed',     emoji: '🛏️',  label: '小床',    x: 0.55, y: 0.52 },
  { id: 'table',   emoji: '🪑',   label: '小桌',    x: 0.25, y: 0.58 },
  { id: 'fish',    emoji: '🐠',   label: '鱼缸',    x: 0.70, y: 0.22 },
  { id: 'rainbow', emoji: '🌈',   label: '彩虹窗',  x: 0.10, y: 0.08 },
  { id: 'star',    emoji: '⭐',   label: '星星灯',  x: 0.50, y: 0.06 },
];

// ── 互动动作 ─────────────────────────────────────────────────
const INTERACT_ACTIONS = [
  { key: 'feed',  emoji: '🍖', label: '喂食',  cost: '2积分',  color: '#FF8E53' },
  { key: 'bathe', emoji: '🛁', label: '洗澡',  cost: '1积分',  color: '#4FC3F7' },
  { key: 'play',  emoji: '🎾', label: '玩耍',  cost: '免费',   color: '#66BB6A' },
  { key: 'pet',   emoji: '🤗', label: '抚摸',  cost: '免费',   color: '#FF80AB' },
  { key: 'rest',  emoji: '🛏️', label: '休息',  cost: '免费',   color: '#9575CD' },
  { key: 'heal',  emoji: '💊', label: '治疗',  cost: '3⭐',    color: '#EF5350' },
];

type TabKey = 'room' | 'dress' | 'interact';

export default function HomeScreen() {
  const { pet } = usePetStore();
  const { equipments, equipItem, unequipItem } = useShopStore();
  const { currentChild } = useFamilyStore();

  // ── Tab ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('room');

  // ── 房间状态 ─────────────────────────────────────────────────
  const [selectedTheme, setSelectedTheme] = useState(ROOM_THEMES[0]);
  const [placedFurniture, setPlacedFurniture] = useState<string[]>(['sofa', 'plant']);

  // ── 漂浮粒子动画值 ─────────────────────────────────────────
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => new Animated.Value(0))
  ).current;

  // 启动粒子浮动动画
  useEffect(() => {
    const animations = particleAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000 + Math.random() * 2000,
            useNativeDriver: true,
            delay: i * 300,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  // ── 互动反馈 ─────────────────────────────────────────────────
  const [feedbackText, setFeedbackText] = useState('');
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const petBounceAnim = useRef(new Animated.Value(1)).current;
  const [isActing, setIsActing] = useState(false);

  // ── 弹窗 ─────────────────────────────────────────────────────
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (title: string, msg: string) => {
    setToastTitle(title); setToastMsg(msg); setToastVisible(true);
  };

  // 加载装备
  useEffect(() => {
    if (pet?.id) useShopStore.getState().loadOwnedEquipments(pet.id);
  }, [pet?.id]);

  // ── 宠物跳跃动画 ─────────────────────────────────────────────
  const triggerPetBounce = useCallback(() => {
    Animated.sequence([
      Animated.timing(petBounceAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
      Animated.timing(petBounceAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(petBounceAnim, { toValue: 1.0,  duration: 120, useNativeDriver: true }),
    ]).start();
  }, [petBounceAnim]);

  // ── 互动反馈浮字 ─────────────────────────────────────────────
  const showFeedback = useCallback((text: string) => {
    setFeedbackText(text);
    feedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [feedbackAnim]);

  // ── 执行互动 ─────────────────────────────────────────────────
  const handleInteract = useCallback(async (key: string) => {
    if (isActing || !pet) return;
    setIsActing(true);
    triggerPetBounce();
    try {
      const store = usePetStore.getState();
      const feedbackMap: Record<string, string> = {
        feed: '😋 好吃！', bathe: '✨ 好舒服～', play: '🎉 太好玩了！',
        pet: '😊 喜欢～', rest: '😴 zzz...', heal: '💊 好多了！',
      };
      switch (key) {
        case 'feed':  await store.feedPet();      break;
        case 'bathe': await store.bathePet();     break;
        case 'play':  await store.playWithPet();  break;
        case 'pet':   await store.petPet();       break;
        case 'rest':  await store.restPet();      break;
        case 'heal':  await store.healPet();      break;
      }
      showFeedback(feedbackMap[key] || '❤️');
    } catch (e: any) {
      showToast('提示', e.message || '操作失败');
    } finally {
      setIsActing(false);
    }
  }, [isActing, pet, triggerPetBounce, showFeedback]);

  // ── 装扮切换 ─────────────────────────────────────────────────
  const handleToggleEquip = useCallback(async (eq: typeof equipments[0]) => {
    if (!pet) return;
    try {
      if (eq.equipped === 1) {
        await unequipItem(eq.id);
      } else {
        await equipItem(pet.id, eq.item_id, eq.slot_type);
      }
      await useShopStore.getState().loadOwnedEquipments(pet.id);
    } catch (e: any) {
      showToast('提示', e.message);
    }
  }, [pet, equipItem, unequipItem]);

  // ── 家具切换 ─────────────────────────────────────────────────
  const toggleFurniture = (id: string) => {
    setPlacedFurniture(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const stageInfo = pet ? getStageInfo(pet.current_stage) : null;
  const moodEmoji = pet ? (MOOD_EMOJI[pet.mood_type] ?? '😊') : '😊';
  const healthEmoji = pet ? (HEALTH_EMOJI[pet.health_type] ?? '💚') : '💚';
  const equippedItems = equipments.filter(e => e.equipped === 1);

  // ── 按槽位分组 ───────────────────────────────────────────────
  const slotGroups = (Object.keys(SLOT_LABELS) as SlotType[]).map(slot => ({
    slot,
    label: SLOT_LABELS[slot],
    items: equipments.filter(e => e.slot_type === slot),
  })).filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* ── 房间场景区（魔法星空风格）──────────────────────── */}
      <View style={[styles.room, { backgroundColor: selectedTheme.bg }]}>
        {/* 星空粒子层 */}
        <View style={styles.starsLayer} pointerEvents="none">
          {[
            { top: 16, left: 58, size: 2 },
            { top: 24, left: 280, size: 3 },
            { top: 50, left: 340, size: 2 },
            { top: 36, left: 160, size: 2 },
            { top: 10, left: 220, size: 3 },
            { top: 60, left: 40, size: 1.5 },
            { top: 30, left: 100, size: 2 },
            { top: 44, left: 240, size: 2 },
          ].map((star, i) => (
            <Animated.View
              key={i}
              style={[
                styles.star,
                {
                  top: star.top,
                  left: star.left,
                  width: star.size,
                  height: star.size,
                  opacity: particleAnims[i]?.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }) ?? 0.5,
                  backgroundColor: selectedTheme.particleColor || '#FFD700',
                },
              ]}
            />
          ))}
        </View>

        {/* 魔法地板光晕 */}
        <View style={[styles.magicFloor, { backgroundColor: selectedTheme.glowColor }]} />

        {/* 地面 */}
        <View style={[styles.floor, { backgroundColor: selectedTheme.floor }]} />

        {/* 已放置家具 */}
        {FURNITURE_OPTIONS.filter(f => placedFurniture.includes(f.id)).map(f => (
          <Text
            key={f.id}
            style={[styles.furnitureItem, {
              left: SCREEN_WIDTH * f.x,
              top: ROOM_HEIGHT * f.y,
            }]}
          >
            {f.emoji}
          </Text>
        ))}

        {/* 宠物 + 互动反馈 */}
        <View style={styles.petCenter}>
          {/* 装备 tag 展示（毛玻璃风格） */}
          {equippedItems.length > 0 && (
            <View style={styles.equippedTags}>
              {equippedItems.slice(0, 3).map(eq => (
                <View key={eq.id} style={styles.equippedTagGlass}>
                  <Text style={styles.equippedTagText}>{eq.item_image || '✨'}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 宠物光环底光 */}
          <View style={[styles.petGlow, { backgroundColor: selectedTheme.glowColor }]} />
          <View style={[styles.petGlowFloor, { backgroundColor: selectedTheme.glowColor }]} />

          <Animated.View style={{ transform: [{ scale: petBounceAnim }] }}>
            {pet ? (
              <View style={styles.petAvatarContainer}>
                <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={110} />
                {/* 脉冲光环 */}
                <View style={[styles.petPulseRing, { borderColor: selectedTheme.accentColor }]} />
              </View>
            ) : (
              <Text style={styles.noPetEmoji}>🥚</Text>
            )}
          </Animated.View>

          {/* 浮字反馈（发光效果） */}
          <Animated.Text style={[
            styles.feedbackTextGlow,
            {
              opacity: feedbackAnim,
              transform: [{ translateY: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
            },
          ]}>
            {feedbackText}
          </Animated.Text>
        </View>

        {/* 宠物状态角标（毛玻璃风格） */}
        {pet && (
          <View style={styles.statusBadges}>
            <View style={styles.statusBadgeGlass}>
              <Text style={styles.statusBadgeText}>{moodEmoji}</Text>
              <Text style={styles.statusBadgeValue}>{pet.mood_value}</Text>
            </View>
            <View style={styles.statusBadgeGlass}>
              <Text style={styles.statusBadgeText}>{healthEmoji}</Text>
              <Text style={styles.statusBadgeValue}>{pet.health_type === 'healthy' ? '健康' : '一般'}</Text>
            </View>
            <View style={[styles.statusBadgeGlass, styles.levelBadgeGlass]}>
              <Text style={styles.levelBadgeText}>Lv.{pet.level}</Text>
            </View>
          </View>
        )}

        {/* 宠物名字（毛玻璃风格） */}
        {pet && (
          <View style={styles.petNameTagGlass}>
            <Text style={styles.petNameTextGlow}>{pet.name}</Text>
            <Text style={styles.petStageTextGlow}>{stageInfo?.name}</Text>
          </View>
        )}
      </View>

      {/* ── Tab 切换（暗黑风格）───────────────────────────── */}
      <View style={styles.tabBarDark}>
        {([
          { key: 'room',     label: '房间', emoji: '🏠' },
          { key: 'dress',    label: '装扮', emoji: '👗' },
          { key: 'interact', label: '互动', emoji: '🎮' },
        ] as { key: TabKey; label: string; emoji: string }[]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtnDark, activeTab === tab.key && styles.tabBtnActiveDark]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabEmoji, activeTab === tab.key && styles.tabEmojiActive]}>{tab.emoji}</Text>
            <Text style={[styles.tabLabelDark, activeTab === tab.key && styles.tabLabelActiveDark]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 内容区 ────────────────────────────────────────── */}
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 房间装修面板 ────────────────────────────────── */}
        {activeTab === 'room' && (
          <>
            {/* 主题选择 */}
            <Text style={styles.panelTitle}>🎨 房间主题</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
              {ROOM_THEMES.map(theme => (
                <TouchableOpacity
                  key={theme.id}
                  style={[styles.themeCard, selectedTheme.id === theme.id && styles.themeCardActive]}
                  onPress={() => setSelectedTheme(theme)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                  <Text style={[styles.themeLabel, selectedTheme.id === theme.id && styles.themeLabelActive]}>
                    {theme.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 家具摆放 */}
            <Text style={styles.panelTitle}>🛋️ 家具摆放</Text>
            <View style={styles.furnitureGrid}>
              {FURNITURE_OPTIONS.map(f => {
                const placed = placedFurniture.includes(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.furnitureCard, placed && styles.furnitureCardActive]}
                    onPress={() => toggleFurniture(f.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.furnitureEmoji}>{f.emoji}</Text>
                    <Text style={[styles.furnitureLabel, placed && styles.furnitureLabelActive]}>
                      {f.label}
                    </Text>
                    {placed && (
                      <View style={styles.furniturePlacedDot}>
                        <Ionicons name="checkmark" size={10} color={Colors.bgCard} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── 宠物装扮面板 ────────────────────────────────── */}
        {activeTab === 'dress' && (
          <>
            {slotGroups.length === 0 ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyEmoji}>👗</Text>
                <Text style={styles.emptyText}>还没有装扮道具</Text>
                <Text style={styles.emptyHint}>去商城兑换装扮吧～</Text>
              </View>
            ) : (
              slotGroups.map(group => (
                <View key={group.slot}>
                  <Text style={styles.panelTitle}>
                    {group.label}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dressRow}
                  >
                    {group.items.map(eq => (
                      <TouchableOpacity
                        key={eq.id}
                        style={[styles.dressCard, eq.equipped === 1 && styles.dressCardActive]}
                        onPress={() => handleToggleEquip(eq)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.dressEmoji}>
                          {eq.item_image || '✨'}
                        </Text>
                        <Text style={styles.dressName} numberOfLines={1}>
                          {eq.item_name || group.label}
                        </Text>
                        <View style={[
                          styles.dressBadge,
                          eq.equipped === 1 ? styles.dressBadgeOn : styles.dressBadgeOff,
                        ]}>
                          <Text style={[
                            styles.dressBadgeText,
                            eq.equipped === 1 ? styles.dressBadgeTextOn : styles.dressBadgeTextOff,
                          ]}>
                            {eq.equipped === 1 ? '已穿戴' : '穿戴'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ))
            )}
          </>
        )}

        {/* ── 互动面板 ────────────────────────────────────── */}
        {activeTab === 'interact' && (
          <>
            {!pet ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyEmoji}>🥚</Text>
                <Text style={styles.emptyText}>还没有宠物</Text>
                <Text style={styles.emptyHint}>先去首页领养一只吧～</Text>
              </View>
            ) : (
              <>
                {/* 状态概览（毛玻璃发光版） */}
                <View style={styles.statusCardGlass}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusIcon}>🍖</Text>
                    <View style={styles.statusBarDark}>
                      <View style={[styles.statusBarFillGlow, { width: `${pet.hunger_value}%`, backgroundColor: '#FF8E53', shadowColor: '#FF8E53' }]} />
                    </View>
                    <Text style={styles.statusValGlow}>{pet.hunger_value}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusIcon}>✨</Text>
                    <View style={styles.statusBarDark}>
                      <View style={[styles.statusBarFillGlow, { width: `${pet.clean_value}%`, backgroundColor: '#4FC3F7', shadowColor: '#4FC3F7' }]} />
                    </View>
                    <Text style={styles.statusValGlow}>{pet.clean_value}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusIcon}>😊</Text>
                    <View style={styles.statusBarDark}>
                      <View style={[styles.statusBarFillGlow, { width: `${pet.mood_value}%`, backgroundColor: '#66BB6A', shadowColor: '#66BB6A' }]} />
                    </View>
                    <Text style={styles.statusValGlow}>{pet.mood_value}</Text>
                  </View>
                </View>

                {/* 互动按钮（发光玻璃质感） */}
                <Text style={styles.panelTitleGlow}>💝 和宠物互动</Text>
                <View style={styles.interactGrid}>
                  {INTERACT_ACTIONS.map(action => (
                    <TouchableOpacity
                      key={action.key}
                      style={[styles.interactCardGlass, isActing && styles.interactCardDisabled]}
                      onPress={() => handleInteract(action.key)}
                      activeOpacity={0.7}
                      disabled={isActing}
                    >
                      <View style={[styles.interactIconBgGlow, { backgroundColor: action.color + '22', shadowColor: action.color }]}>
                        <Text style={styles.interactEmoji}>{action.emoji}</Text>
                      </View>
                      <Text style={styles.interactLabelGlow}>{action.label}</Text>
                      <Text style={styles.interactCostGlow}>{action.cost}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: Spacing[4] }} />
      </ScrollView>

      {/* ── 提示弹窗 ─────────────────────────────────────── */}
      <Modal visible={toastVisible} onClose={() => setToastVisible(false)} title={toastTitle} showCloseButton={false} maxWidth={300}>
        <Text style={styles.toastMsg}>{toastMsg}</Text>
        <TouchableOpacity style={styles.toastBtn} onPress={() => setToastVisible(false)}>
          <Text style={styles.toastBtnText}>知道了</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },

  // ── 房间场景（魔法星空版）──────────────────────────────────
  room: {
    height: ROOM_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  roomBgImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.85,
  },
  starsLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  star: {
    position: 'absolute',
    borderRadius: 99,
  },
  magicFloor: {
    position: 'absolute',
    bottom: 0,
    left: '-10%', right: '-10%',
    height: '45%',
    borderRadius: 999,
    opacity: 0.35,
  },
  wall: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: ROOM_HEIGHT * 0.6,
    opacity: 0.3,
  },
  floor: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: ROOM_HEIGHT * 0.42,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    opacity: 0.5,
  },
  furnitureItem: {
    position: 'absolute',
    fontSize: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  petCenter: {
    position: 'absolute',
    bottom: ROOM_HEIGHT * 0.14,
    left: 0, right: 0,
    alignItems: 'center',
  },
  petAvatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petGlow: {
    position: 'absolute',
    bottom: -10,
    width: 140, height: 140,
    borderRadius: 70,
    opacity: 0.3,
  },
  petGlowFloor: {
    position: 'absolute',
    bottom: -20,
    width: 180, height: 60,
    borderRadius: 90,
    opacity: 0.25,
  },
  petPulseRing: {
    position: 'absolute',
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 2,
    opacity: 0.5,
  },
  equippedTags: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  equippedTagGlass: {
    backgroundColor: Colors.glassBg,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  equippedTagText: { fontSize: 14 },
  noPetEmoji: { fontSize: 80 },
  feedbackTextGlow: {
    position: 'absolute',
    top: -44,
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.magicGold300,
    textShadowColor: 'rgba(251,191,36,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  statusBadges: {
    position: 'absolute',
    top: 10, right: 12,
    flexDirection: 'row',
    gap: 6,
  },
  statusBadgeGlass: {
    backgroundColor: Colors.glassBg,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadgeValue: {
    fontSize: 10,
    color: Colors.darkTextMuted,
  },
  statusBadgeText: { fontSize: 14 },
  levelBadgeGlass: {
    backgroundColor: Colors.primary500,
    borderColor: 'transparent',
    shadowColor: Colors.primary500,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  levelBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.bgCard },
  petNameTagGlass: {
    position: 'absolute',
    bottom: 6, left: 0, right: 0,
    alignItems: 'center',
  },
  petNameTextGlow: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.darkText,
    backgroundColor: Colors.glassBg,
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    textShadowColor: 'rgba(255,255,255,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  petStageTextGlow: {
    fontSize: Typography.xs,
    color: Colors.darkTextMuted,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ── Tab（暗黑风格）───────────────────────────────────────
  tabBarDark: {
    flexDirection: 'row',
    backgroundColor: Colors.darkSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.darkBorder,
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
  },
  tabBtnDark: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActiveDark: {
    borderBottomColor: Colors.magicGold400,
  },
  tabEmoji: { fontSize: 18, opacity: 0.5 },
  tabEmojiActive: { opacity: 1 },
  tabLabelDark: {
    fontSize: Typography.xs,
    color: Colors.darkTextMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActiveDark: { color: Colors.magicGold400, fontWeight: '700' },

  // ── 面板 ─────────────────────────────────────────────────
  panelScroll: { flex: 1, backgroundColor: Colors.darkBg },
  panelContent: { padding: Spacing.md },
  panelTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.neutral800,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  panelTitleGlow: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.darkText,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // ── 主题 ─────────────────────────────────────────────────
  themeRow: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  themeCard: {
    width: 76,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Shadows.xs,
  },
  themeCardActive: { borderColor: Colors.primary500, backgroundColor: Colors.primary50 },
  themeEmoji: { fontSize: 28 },
  themeLabel: { fontSize: 11, color: Colors.neutral500, marginTop: 4, textAlign: 'center' },
  themeLabelActive: { color: Colors.primary500, fontWeight: '700' },

  // ── 家具 ─────────────────────────────────────────────────
  furnitureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  furnitureCard: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 3) / 4,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
    ...Shadows.xs,
  },
  furnitureCardActive: { borderColor: Colors.primary400, backgroundColor: Colors.primary50 },
  furnitureEmoji: { fontSize: 28 },
  furnitureLabel: { fontSize: 10, color: Colors.neutral400, marginTop: 3 },
  furnitureLabelActive: { color: Colors.primary500 },
  furniturePlacedDot: {
    position: 'absolute',
    top: 4, right: 4,
    width: 16, height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary500,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 装扮 ─────────────────────────────────────────────────
  dressRow: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  dressCard: {
    width: 80,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Shadows.xs,
  },
  dressCardActive: { borderColor: Colors.primary400, backgroundColor: Colors.primary50 },
  dressEmoji: { fontSize: 28, marginBottom: 4 },
  dressName: { fontSize: 10, color: Colors.neutral600, textAlign: 'center', maxWidth: 70 },
  dressBadge: {
    marginTop: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  dressBadgeOn: { backgroundColor: Colors.primary100 },
  dressBadgeOff: { backgroundColor: Colors.neutral100 },
  dressBadgeText: { fontSize: 10, fontWeight: '600' },
  dressBadgeTextOn: { color: Colors.primary600 },
  dressBadgeTextOff: { color: Colors.neutral400 },

  // ── 互动状态（毛玻璃发光版）──────────────────────────────
  statusCardGlass: {
    backgroundColor: Colors.glassBg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusIcon: { fontSize: 16, width: 22 },
  statusBarDark: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusBarFillGlow: {
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 2,
  },
  statusValGlow: { fontSize: Typography.xs, color: Colors.darkTextMuted, width: 28, textAlign: 'right' },

  // ── 互动按钮（发光玻璃质感）──────────────────────────────
  interactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  interactCardGlass: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2) / 3,
    alignItems: 'center',
    backgroundColor: Colors.glassBg,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  interactCardDisabled: { opacity: 0.4 },
  interactIconBgGlow: {
    width: 48, height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 4,
  },
  interactEmoji: { fontSize: 24 },
  interactLabelGlow: { fontSize: Typography.sm, fontWeight: '600', color: Colors.darkText },
  interactCostGlow: { fontSize: 10, color: Colors.darkTextMuted, marginTop: 2 },

  // ── 空状态 ───────────────────────────────────────────────
  emptyPanel: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  emptyText: { fontSize: Typography.base, fontWeight: '600', color: Colors.neutral600 },
  emptyHint: { fontSize: Typography.sm, color: Colors.neutral400, marginTop: 4 },

  // ── 弹窗 ─────────────────────────────────────────────────
  toastMsg: { fontSize: 15, color: Colors.neutral600, textAlign: 'center', marginBottom: Spacing.lg },
  toastBtn: {
    backgroundColor: Colors.primary500,
    borderRadius: BorderRadius.button,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  toastBtnText: { fontSize: 15, color: Colors.bgCard, fontWeight: '700' },
});
