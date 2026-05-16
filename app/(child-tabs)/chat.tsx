import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Animated, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { usePetStore } from '@/stores/usePetStore';
import { useAIStore } from '@/stores/useAIStore';
import { getStageInfo, getSpeciesInfo } from '@/constants/evolution';
import PetAvatar from '@/components/PetAvatar';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';
import Modal from '@/components/Modal';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(36);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  // Voice input state
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingAnim = useRef(new Animated.Value(1)).current;

  // Voice playback state
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const playProgressAnim = useRef(new Animated.Value(0)).current;
  const playAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const { currentChild, currentFamily } = useFamilyStore();
  const { pet } = usePetStore();
  const {
    messages, isLoading, isOnline, sendMessage, loadHistory, loadConfig,
    loadSafetyConfig, safetyConfig,
  } = useAIStore();

  const bottomInset = insets.bottom;

  useEffect(() => {
    if (currentFamily?.id) { void loadConfig(currentFamily.id); void loadSafetyConfig(currentFamily.id); }
  }, [currentFamily?.id]);

  useEffect(() => {
    if (pet?.id) loadHistory(pet.id);
  }, [pet?.id]);

  useEffect(() => {
    return () => { Speech.stop(); playAnimRef.current?.stop(); };
  }, []);

  // Start recording animation loop
  useEffect(() => {
    if (isRecording) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnim, { toValue: 1.3, duration: 400, useNativeDriver: true }),
          Animated.timing(recordingAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      recordingAnim.setValue(1);
    }
  }, [isRecording]);

  const handleSendText = async () => {
    if (!inputText.trim() || !pet?.id || !currentChild) return;
    const text = inputText.trim();
    setInputText('');
    setInputHeight(36);
    dismissKb();

    const speciesEmoji = getSpeciesInfo(pet.species_id).emoji;
    try {
      const reply = await sendMessage(
        pet.id, text, pet.name, speciesEmoji, currentChild.name,
        pet.level, pet.current_stage, pet.mood_type, pet.health_type,
      );
      if (safetyConfig?.enable_voice === 1 && reply) {
        Speech.stop();
        Speech.speak(reply, { language: 'zh-CN', rate: 0.9, pitch: 1.1 });
      }
    } catch (e: any) {
      setModalTitle('发送失败');
      setModalMessage(e.message || '请稍后再试');
      setModalVisible(true);
    }
  };

  // Simulate voice recording end (placeholder until expo-av is integrated)
  const handleVoiceStop = useCallback(() => {
    setIsRecording(false);
    if (!pet?.id || !currentChild) return;
    // Placeholder: send a transcript text
    // Placeholder: voice-to-text result
    setVoiceMode(false);
  }, [pet?.id, currentChild]);

  // Voice playback: speak a message and animate progress bar
  const handlePlayVoice = (msgId: string, text: string) => {
    if (playingMsgId === msgId) {
      Speech.stop();
      playAnimRef.current?.stop();
      playProgressAnim.setValue(0);
      setPlayingMsgId(null);
      return;
    }
    Speech.stop();
    playAnimRef.current?.stop();
    playProgressAnim.setValue(0);
    setPlayingMsgId(msgId);

    // 估算朗读时长：中文约 4 字/秒，rate=0.9 时约 3.6 字/秒
    const charCount = text.length;
    const durationMs = Math.max(1500, (charCount / 3.6) * 1000);

    const anim = Animated.timing(playProgressAnim, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    });
    playAnimRef.current = anim;
    anim.start();

    Speech.speak(text, {
      language: 'zh-CN',
      rate: 0.9,
      pitch: 1.1,
      onDone: () => {
        playProgressAnim.setValue(0);
        setPlayingMsgId(null);
      },
      onError: () => {
        playProgressAnim.setValue(0);
        setPlayingMsgId(null);
      },
    });
  };

  const stageName = pet ? getStageInfo(pet.current_stage).name : '';
  const moodEmoji = pet ? (
    pet.mood_type === 'happy' ? '😄' :
    pet.mood_type === 'excited' ? '🤩' :
    pet.mood_type === 'unhappy' ? '😐' :
    pet.mood_type === 'sad' ? '😢' : '😄'
  ) : '😄';

  const dismissKb = () => { try { Keyboard.dismiss(); } catch {} };

  // Keyboard listener: scroll to end when keyboard shows
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 宠物信息栏 */}
      <View style={styles.chatHeader}>
        <View style={styles.petAvatarArea}>
          {pet
            ? <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={50} />
            : <Text style={styles.petAvatarEmoji}>🐾</Text>}
          <View style={[styles.statusDot, !isOnline && { backgroundColor: Colors.neutral400 }]} />
        </View>
        <View style={styles.petHeaderInfo}>
          <Text style={styles.petName}>{pet?.name || '宠物'}</Text>
          <Text style={styles.petStatus}>{moodEmoji} {pet?.mood_type || 'normal'} · Lv.{pet?.level || 1} {stageName}</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => {
          if (!isOnline) { setModalTitle('离线模式'); setModalMessage('当前使用预设回复，配置 API Key 后可启用在线对话'); setModalVisible(true); }
        }}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 聊天消息区 */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
              {msg.role === 'assistant' && (
                <View style={styles.avatarSmall}>
                  <PetAvatar speciesId={pet?.species_id || 'dragon'} stage={pet?.current_stage || 1} size={28} />
                </View>
              )}
              <View style={[
                styles.bubble,
                msg.role === 'assistant' ? styles.bubblePet : styles.bubbleUser,
              ]}>
                <Text style={[
                  styles.msgText,
                  msg.role === 'user' ? styles.msgTextUser : styles.msgTextPet,
                ]}>
                  {msg.content}
                </Text>
                {/* Voice playback bar on assistant messages when voice synth enabled */}
                {msg.role === 'assistant' && safetyConfig?.enable_voice === 1 && (
                  <TouchableOpacity
                    style={styles.voicePlayBar}
                    onPress={() => handlePlayVoice(msg.id, msg.content)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={playingMsgId === msg.id ? 'pause-circle' : 'play-circle'}
                      size={18}
                      color={Colors.primary500}
                    />
                    <View style={styles.playProgressTrack}>
                      <Animated.View style={[
                        styles.playProgressFill,
                        {
                          width: playingMsgId === msg.id
                            ? playProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                            : '0%',
                        },
                      ]} />
                    </View>
                    <Text style={styles.playLabel}>
                      {playingMsgId === msg.id ? '播放中' : '播放'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {msg.role === 'user' && (
                <View style={[styles.avatarSmall, styles.avatarUser]}>
                  <Text>👦</Text>
                </View>
              )}
            </View>
          ))}

          {isLoading && (
            <View style={styles.typingRow}>
              <View style={styles.avatarSmall}><PetAvatar speciesId={pet?.species_id || 'dragon'} stage={pet?.current_stage || 1} size={28} /></View>
              <View style={styles.bubblePet}>
                <View style={styles.typingDots}>
                  <Text style={styles.typingDot}>●</Text><Text style={styles.typingDot}>●</Text><Text style={styles.typingDot}>●</Text>
                </View>
              </View>
            </View>
          )}

          {!isOnline && (
            <View style={styles.offlineHint}>
              <Text style={styles.offlineText}>📡 AI 对话需要联网，当前使用预设回复模式</Text>
            </View>
          )}
          <View style={{ height: Spacing.sm }} />
        </ScrollView>

        {/* 输入区域 */}
        <View style={[styles.inputArea, { paddingBottom: 8 + bottomInset }]}>
          {/* Voice mode toggle */}
          <TouchableOpacity
            style={styles.micBtn}
            onPress={() => { setVoiceMode(!voiceMode); dismissKb(); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={voiceMode ? 'chatbubble-ellipses' : 'mic'}
              size={24}
              color={voiceMode ? Colors.primary500 : Colors.neutral500}
            />
          </TouchableOpacity>

          {voiceMode ? (
            /* Voice recording area */
            <Animated.View style={[styles.voiceRecordBtn, { transform: [{ scale: recordingAnim }] }]}>
              <TouchableOpacity
                style={styles.voiceRecordInner}
                activeOpacity={0.8}
                onPressIn={() => setIsRecording(true)}
                onPressOut={handleVoiceStop}
              >
                <Ionicons name="mic" size={24} color={Colors.bgCard} />
                <Text style={styles.voiceRecordText}>
                  {isRecording ? '松开 发送' : '按住 说话'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            /* Text input */
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { height: Math.max(36, Math.min(inputHeight, 100)) }]}
              placeholder="跟小团子说点什么..."
              placeholderTextColor={Colors.neutral400}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={200}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSendText}
              onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height + 12)}
            />
          )}

          {!voiceMode && (
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
              onPress={handleSendText}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.75}
            >
              {isLoading
                ? <Ionicons name="ellipsis-horizontal" size={18} color={Colors.bgCard} />
                : <Ionicons name="send" size={18} color={Colors.bgCard} />}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle}>
        <Text style={{ fontSize: 15, color: Colors.neutral600, textAlign: 'center', marginBottom: 20 }}>{modalMessage}</Text>
        <TouchableOpacity
          style={{ backgroundColor: Colors.primary500, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
          onPress={() => setModalVisible(false)}
        >
          <Text style={{ color: Colors.neutral0, fontSize: 15, fontWeight: '700' }}>知道了</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  flex: { flex: 1 },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[4], paddingVertical: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral100,
  },
  petAvatarArea: { position: 'relative' },
  petAvatarEmoji: { fontSize: Typography['4xl'] - 4 },
  statusDot: {
    position: 'absolute', bottom: -1, right: -1,
    width: Spacing.sm + 2, height: Spacing.sm + 2,
    borderRadius: (Spacing.sm + 2) / 2,
    backgroundColor: Colors.success,
    borderWidth: 2, borderColor: Colors.bgCard,
  },
  petHeaderInfo: { flex: 1, marginLeft: Spacing.sm },
  petName: { fontSize: Typography.base + 2, fontWeight: '700', color: Colors.neutral900 },
  petStatus: { fontSize: Typography.xs, color: Colors.neutral400 },
  settingsBtn: { padding: Spacing.xs },
  settingsIcon: { fontSize: Typography.base + 6 },
  messageList: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  msgRow: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.xs + 3 },
  msgRowUser: { justifyContent: 'flex-end' },
  avatarSmall: {
    width: Spacing[4] * 2, height: Spacing[4] * 2, borderRadius: Spacing[4],
    backgroundColor: Colors.primary50, alignItems: 'center', justifyContent: 'center',
  },
  avatarUser: { backgroundColor: Colors.secondary50 },
  bubble: {
    maxWidth: '70%', borderRadius: BorderRadius['3xl'],
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, ...Shadows.xs,
  },
  bubblePet: { borderTopLeftRadius: Spacing.xs, backgroundColor: Colors.bgCard },
  bubbleUser: { borderTopRightRadius: Spacing.xs, backgroundColor: Colors.primary500 },
  msgText: { fontSize: Typography.sm, lineHeight: Typography.base + 6 },
  msgTextPet: { color: Colors.neutral800 },
  msgTextUser: { color: Colors.bgCard },
  typingRow: { flexDirection: 'row', gap: Spacing.xs + 3, marginBottom: Spacing.md, alignItems: 'center' },
  typingDots: { flexDirection: 'row', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  typingDot: { fontSize: Typography.xs, color: Colors.neutral400 },
  offlineHint: { marginTop: Spacing.sm, alignSelf: 'center' },
  offlineText: { fontSize: Typography.xs - 1, color: Colors.neutral400 },

  // Input area
  inputArea: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1, borderTopColor: Colors.neutral200,
    gap: Spacing.sm,
  },
  micBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.neutral100,
    borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 6,
    fontSize: Typography.base, color: Colors.neutral900,
    lineHeight: Typography.base + 4,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary500,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.xs,
  },
  sendBtnDisabled: { backgroundColor: Colors.neutral300 },

  // Voice mode
  voiceRecordBtn: {
    flex: 1, height: 36,
    borderRadius: BorderRadius['3xl'],
    backgroundColor: Colors.primary500,
    overflow: 'hidden',
  },
  voiceRecordInner: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  voiceRecordText: {
    fontSize: Typography.base,
    fontWeight: '600', color: Colors.bgCard,
  },

  // Voice playback bar
  voicePlayBar: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.neutral200,
    gap: 6,
  },
  playProgressTrack: {
    flex: 1, height: 4,
    backgroundColor: Colors.neutral200,
    borderRadius: 2, overflow: 'hidden',
  },
  playProgressFill: {
    height: 4, backgroundColor: Colors.primary500,
    borderRadius: 2,
  },
  playLabel: {
    fontSize: Typography.xs,
    color: Colors.neutral500,
  },
});
