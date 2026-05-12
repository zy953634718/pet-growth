import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { getPetImageSource, getStageInfo } from '@/constants/evolution';

const STAGE_EMOJI: Record<number, string> = {
  1: '🥚',
  2: '🐣',
  3: '🦊',
  4: '🦁',
  5: '🐉',
};

export interface PetAvatarProps {
  speciesId: string;   // 宠物种类：dragon|cat|dog|rabbit|panda|fox
  stage: number;        // 进化阶段 1-5
  size?: number;        // 图片尺寸（正方形），默认 80
  showFallbackEmoji?: boolean; // 图片加载失败时是否显示 emoji，默认 true
}

/**
 * 宠物形象组件：根据种类和进化阶段显示对应 PNG 图片，
 * 图片不存在时自动回退为 emoji。
 *
 * 使用方式：
 *   <PetAvatar speciesId={pet.species_id} stage={pet.current_stage} size={90} />
 */
export default function PetAvatar({
  speciesId,
  stage,
  size = 80,
  showFallbackEmoji = true,
}: PetAvatarProps) {
  const safeStage = Math.max(1, Math.min(5, stage || 1));
  const source: ImageSourcePropType | null = getPetImageSource(speciesId, safeStage);

  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: size * 0.1 }}
        resizeMode="contain"
      />
    );
  }

  // 回退：显示 emoji
  if (showFallbackEmoji) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.7 }}>{STAGE_EMOJI[safeStage] ?? '🐾'}</Text>
      </View>
    );
  }

  return null;
}
