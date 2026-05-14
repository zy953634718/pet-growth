import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const { currentChild, currentFamily } = useFamilyStore();
  const { pet } = usePetStore();
  const { messages, isLoading, isOnline, sendMessage, loadHistory, loadConfig, loadSafetyConfig, safetyConfig } = useAIStore();

  useEffect(() => {
    if (currentFamily?.id) {
      void loadConfig(currentFamily.id);
      void loadSafetyConfig(currentFamily.id);
    }
  }, [currentFamily?.id, loadConfig, loadSafetyConfig]);

  useEffect(() => {
    if (pet?.id) {
      loadHistory(pet.id);
    }
  }, [pet?.id, loadHistory]);

  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !pet?.id || !currentChild) return;

    const text = inputText.trim();
    setInputText('');
    setInputHeight(40);
    Keyboard.dismiss();

    const speciesEmoji = getSpeciesInfo(pet.species_id).emoji;

    try {
      const reply = await sendMessage(
        pet.id,
        text,
        pet.name,
        speciesEmoji,
        currentChild.name,
        pet.level,
        pet.current_stage,
        pet.mood_type,
        pet.health_type
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

  const stageName = pet ? getStageInfo(pet.current_stage).name : '';
  const moodEmoji = pet ? (
    pet.mood_type === 'happy' ? '😄' :
    pet.mood_type === 'excited' ? '🤩' :
    pet.mood_type === 'unhappy' ? '😐' :
    pet.mood_type === 'sad' ? '😢' : '😄'
  ) : '😄';

  return (
    <SafeAreaView style={styles.container}>
      {/* 宠物信息栏 */}
      <View style={styles.chatHeader}>
          <View style={styles.petAvatarArea}>
            {pet ? (
              <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={50} />
            ) : (
              <Text style={styles.petAvatarEmoji}>🐾</Text>
          )}
          <View style={[styles.statusDot, !isOnline && { backgroundColor: Colors.neutral400 }]} />
        </View>
        <View style={styles.petHeaderInfo}>
          <Text style={styles.petName}>{pet?.name || '宠物'}</Text>
          <Text style={styles.petStatus}>{moodEmoji} {pet?.mood_type || 'normal'} · Lv.{pet?.level || 1} {stageName}</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => {
          if (!isOnline) {
            setModalTitle('离线模式');
            setModalMessage('当前使用预设回复，配置 API Key 后可启用在线对话');
            setModalVisible(true);
          }
        }}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 聊天消息区 */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
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
            </View>
            {msg.role === 'user' && (
              <View style={[styles.avatarSmall, styles.avatarUser]}>
                <Text>👦</Text>
              </View>
            )}
          </View>
        ))}

        {/* 打字中指示器 */}
        {isLoading && (
          <View style={styles.typingRow}>
            <View style={styles.avatarSmall}><PetAvatar speciesId={pet?.species_id || 'dragon'} stage={pet?.current_stage || 1} size={28} /></View>
            <View style={styles.bubblePet}>
              <View style={styles.typingDots}>
                <Text style={styles.typingDot}>●</Text>
                <Text style={styles.typingDot}>●</Text>
                <Text style={styles.typingDot}>●</Text>
              </View>
            </View>
          </View>
        )}

        {/* 离线提示 */}
        {!isOnline && (
          <View style={styles.offlineHint}>
            <Text style={styles.offlineText}>📡 AI 对话需要联网，当前使用预设回复模式</Text>
          </View>
        )}

        <View style={{ height: Spacing.sm }} />
      </ScrollView>

      {/* 输入区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputArea}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { height: Math.max(40, Math.min(inputHeight, 100)) }]}
            placeholder="跟小团子说点什么..."
            placeholderTextColor={Colors.neutral400}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={200}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            onContentSizeChange={(e) => {
              setInputHeight(e.nativeEvent.contentSize.height + 12);
            }}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.75}
          >
            {isLoading
              ? <Ionicons name="ellipsis-horizontal" size={18} color={Colors.bgCard} />
              : <Ionicons name="send" size={18} color={Colors.bgCard} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 提示弹窗 */}
      <Modal visible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle}>
        <Text style={{ fontSize: 15, color: Colors.neutral600, textAlign: 'center', marginBottom: 20 }}>
          {modalMessage}
        </Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  petAvatarArea: {
    position: 'relative',
  },
  petAvatarEmoji: {
    fontSize: Typography['4xl'] - 4,
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: Spacing.sm + 2,
    height: Spacing.sm + 2,
    borderRadius: (Spacing.sm + 2) / 2,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.bgCard,
  },
  petHeaderInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  petName: {
    fontSize: Typography.base + 2,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  petStatus: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
  },
  settingsBtn: {
    padding: Spacing.xs,
  },
  settingsIcon: {
    fontSize: Typography.base + 6,
  },
  messageList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.xs + 3,
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  avatarSmall: {
    width: Spacing[4] * 2,
    height: Spacing[4] * 2,
    borderRadius: Spacing[4],
    backgroundColor: Colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUser: {
    backgroundColor: Colors.secondary50,
  },
  bubble: {
    maxWidth: '70%',
    borderRadius: BorderRadius['3xl'],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadows.xs,
  },
  bubblePet: {
    borderTopLeftRadius: Spacing.xs,
    backgroundColor: Colors.bgCard,
  },
  bubbleUser: {
    borderTopRightRadius: Spacing.xs,
    backgroundColor: Colors.primary500,
  },
  msgText: {
    fontSize: Typography.sm,
    lineHeight: Typography.base + 6,
  },
  msgTextPet: {
    color: Colors.neutral800,
  },
  msgTextUser: {
    color: Colors.bgCard,
  },
  typingRow: {
    flexDirection: 'row',
    gap: Spacing.xs + 3,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  typingDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  typingDot: {
    fontSize: Typography.xs,
    color: Colors.neutral400,
  },
  offlineHint: {
    marginTop: Spacing.sm,
    alignSelf: 'center',
  },
  offlineText: {
    fontSize: Typography.xs - 1,
    color: Colors.neutral400,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.neutral100,
    borderRadius: BorderRadius['3xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.base,
    color: Colors.neutral900,
    lineHeight: Typography.base + 6,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary500,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.neutral300,
  },
});
