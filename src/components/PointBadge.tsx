import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CurrencyType, CURRENCY_EMOJI, CURRENCY_LABELS } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

interface PointBadgeProps {
  type: CurrencyType;
  amount: number;
  size?: 'small' | 'medium' | 'large';
}

const SIZE_CONFIG = {
  small: { fontSize: 12, iconSize: 14, paddingH: 8, paddingV: 3 },
  medium: { fontSize: 16, iconSize: 18, paddingH: 12, paddingV: 5 },
  large: { fontSize: 20, iconSize: 22, paddingH: 16, paddingV: 7 },
};

export default function PointBadge({ type, amount, size = 'medium' }: PointBadgeProps) {
  const config = SIZE_CONFIG[size];
  const isPoints = type === 'points';

  return (
    <View style={[
      styles.badge,
      isPoints ? styles.pointsBadge : styles.starsBadge,
      { paddingHorizontal: config.paddingH, paddingVertical: config.paddingV },
      size === 'large' && styles.largeBadge,
    ]}>
      <Text style={{ fontSize: config.iconSize }}>{CURRENCY_EMOJI[type]}</Text>
      <Text style={[
        styles.amount,
        { fontSize: config.fontSize, color: isPoints ? Colors.primary500 : Colors.star }
      ]}>
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 4,
    backgroundColor: Colors.primary50,
  },
  largeBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointsBadge: {
    borderColor: Colors.primary200,
    borderWidth: 1,
  },
  starsBadge: {
    borderColor: Colors.starBorder,
    borderWidth: 1,
    backgroundColor: Colors.starLight,
  },
  amount: {
    fontWeight: 'bold',
  },
});
