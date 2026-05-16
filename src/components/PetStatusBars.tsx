import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MoodType, MOOD_EMOJI, HealthType, HEALTH_EMOJI } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget } from '@/theme';

interface PetStatusBarsProps {
  hungerValue: number;
  cleanValue: number;
  moodValue: number;
  healthType: HealthType;
  moodType: MoodType;
  compact?: boolean;
}

// D-01 修复：颜色阈值对齐到类型定义 mood 分级 [90/70/50/30]
function getStatusColor(value: number): string {
  if (value >= 90) return Colors.success;     // excited
  if (value >= 70) return Colors.star;         // happy
  if (value >= 50) return Colors.warning;      // normal
  if (value >= 30) return Colors.warningDark;  // unhappy
  return Colors.error;                         // sad
}

export default function PetStatusBars({
  hungerValue,
  cleanValue,
  moodValue,
  healthType,
  moodType,
  compact = false,
}: PetStatusBarsProps) {
  const barHeight = compact ? 6 : 10;
  const labelSize = compact ? 11 : 13;

  return (
    <View style={styles.container}>
      {/* 饥饿值 */}
      <View style={styles.row}>
        <Text style={[styles.label, { fontSize: labelSize }]}>
          {HEALTH_EMOJI[healthType]} 饱食度
        </Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barFill,
              { width: `${hungerValue}%`, height: barHeight, backgroundColor: getStatusColor(hungerValue) },
            ]}
          />
        </View>
        <Text style={[styles.value, { fontSize: labelSize }]}>{hungerValue}</Text>
      </View>

      {/* 清洁值 */}
      <View style={styles.row}>
        <Text style={[styles.label, { fontSize: labelSize }]}>🛁 清洁度</Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barFill,
              { width: `${cleanValue}%`, height: barHeight, backgroundColor: getStatusColor(cleanValue) },
            ]}
          />
        </View>
        <Text style={[styles.value, { fontSize: labelSize }]}>{cleanValue}</Text>
      </View>

      {/* 心情值 */}
      <View style={styles.row}>
        <Text style={[styles.label, { fontSize: labelSize }]}>
          {MOOD_EMOJI[moodType]} 心情值
        </Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barFill,
              { width: `${moodValue}%`, height: barHeight, backgroundColor: getStatusColor(moodValue) },
            ]}
          />
        </View>
        <Text style={[styles.value, { fontSize: labelSize }]}>{moodValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: Colors.neutral700,
    fontWeight: '500',
    width: 70,
  },
  barContainer: {
    flex: 1,
    height: 12,
    backgroundColor: '#ECECEC',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 6,
    minWidth: 2,
  },
  value: {
    color: Colors.neutral600,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
});
