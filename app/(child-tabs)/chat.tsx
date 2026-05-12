import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { usePetStore } from '@/stores/usePetStore';
import { useAIStore } from '@/stores/useAIStore';
import { getStageInfo, getSpeciesInfo } from '@/constants/evolution';
import PetAvatar from '@/components/PetAvatar';

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

export default function ChatScreen() {
  const scrollRef = React.useRef<any>(null);
  const [inputText, setInputText] = useState('');
  const { currentChild, currentFamily } = useFamilyStore();
  const { pet } = usePetStore();
  const { messages, isLoading, isOnline, sendMessage, loadHistory, loadConfig, loadSafetyConfig } = useAIStore();

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

  const handleSend = async () => {
    if (!inputText.trim() || !pet?.id || !currentChild) return;

    const speciesEmoji = getSpeciesInfo(pet.species_id).emoji;

    try {
      await sendMessage(
        pet.id,
        inputText.trim(),
        pet.name,
        speciesEmoji,
        currentChild.name,
        pet.level,
        pet.current_stage,
        pet.mood_type,
        pet.health_type
      );
      setInputText('');
    } catch (e: any) {
      Alert.alert('发送失败', e.message || '请稍后再试');
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
            Alert.alert('离线模式', '当前使用预设回复，配置 API Key 后可启用在线对话');
          }
        }}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 聊天消息区 */}
      <ScrollView
        ref={(ref) => { scrollRef.current = ref; }}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputArea}>
          <TextInput
            style={styles.textInput}
            placeholder="跟小团子说点什么..."
            placeholderTextColor={Colors.neutral400}
            value={inputText}
            onChangeText={setInputText}
            multiline={false}
            maxLength={200}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
    paddingVertical: Spacing.sm,
    fontSize: Typography.base + 1,
    color: Colors.neutral900,
    maxHeight: Spacing[5],
  },
  sendBtn: {
    width: Spacing[5] + 2,
    height: Spacing[5] + 2,
    borderRadius: (Spacing[5] + 2) / 2,
    backgroundColor: Colors.primary500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.neutral300,
  },
  sendIcon: {
    fontSize: Typography.base + 6,
    color: Colors.bgCard,
  },
});
