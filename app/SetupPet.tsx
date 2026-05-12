import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PET_SPECIES } from '@/constants/evolution';
import { useFamilyStore } from '@/stores/useFamilyStore';
import { usePetStore } from '@/stores/usePetStore';

import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

export default function SetupPetScreen() {
  const params = useLocalSearchParams<{ childId?: string }>();
  const router = useRouter();
  const { selectChild } = useFamilyStore();
  const { createPet } = usePetStore();
  const [selectedSpecies, setSelectedSpecies] = useState(PET_SPECIES[0].id);
  const [petName, setPetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const selected = PET_SPECIES.find(s => s.id === selectedSpecies);

  const handleComplete = async () => {
    if (!petName.trim()) return;
    if (!params.childId) return;

    setIsCreating(true);
    try {
      selectChild(params.childId);
      await createPet(params.childId, selectedSpecies, petName.trim());
      router.replace('/RoleSelect');
    } catch (error) {
      console.error('创建宠物失败:', error);
      Alert.alert('错误', '创建宠物失败，请重试');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepIndicator}>第 2 步 / 共 2 步</Text>
      <Text style={styles.title}>选择你的宠物伙伴</Text>
      <Text style={styles.subtitle}>选一个你喜欢的宠物吧！</Text>

      <View style={styles.grid}>
        {PET_SPECIES.map((s) => (
          <TouchableOpacity key={s.id} style={[styles.petCard, selectedSpecies === s.id && styles.petCardSelected, { borderColor: selectedSpecies === s.id ? s.color : Colors.neutral200 }]}
            onPress={() => setSelectedSpecies(s.id)} activeOpacity={0.8}>
            <Text style={{ fontSize: 48 }}>{s.emoji}</Text>
            <Text style={styles.petName}>{s.name}</Text>
            {selectedSpecies === s.id && <View style={[styles.checkBadge, { backgroundColor: s.color }]}><Text style={styles.checkText}>✓</Text></View>}
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <View style={styles.descBox}>
          <Text style={styles.descText}>{selected.description}</Text>
        </View>
      )}

      <View style={styles.nameGroup}>
        <Text style={styles.label}>给宠物取个名字吧 🏷️</Text>
        <TextInput style={styles.input} placeholder="例如：小团子" value={petName} onChangeText={setPetName} maxLength={10} textAlign="center" />
      </View>

      <TouchableOpacity
        style={styles.completeBtn}
        onPress={handleComplete}
        activeOpacity={0.85}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.completeBtnText}>🎉 开始养宠生活！</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 24, paddingTop: 16 },
  stepIndicator: { fontSize: 13, color: Colors.primary500, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: Colors.neutral900, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, color: Colors.neutral400, textAlign: 'center', marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 16 },
  petCard: { width: '30%', aspectRatio: 0.9, borderRadius: 18, borderWidth: 2.5, borderColor: Colors.neutral200, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.neutral50, paddingVertical: 10 },
  petCardSelected: { shadowColor: Colors.primary500, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5, transform: [{ scale: 1.04 }] },
  petName: { marginTop: 6, fontSize: 13, fontWeight: '600', color: Colors.neutral700 },
  checkBadge: { position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: Colors.bgCard, fontSize: 12, fontWeight: 'bold' },
  descBox: { backgroundColor: '#FFF9F0', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 20 },
  descText: { fontSize: 14, color: '#997A33', textAlign: 'center' },
  nameGroup: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: Colors.neutral800, textAlign: 'center', marginBottom: 10 },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13, fontSize: 17, backgroundColor: Colors.neutral50 },
  completeBtn: { backgroundColor: Colors.secondary300, borderRadius: 20, paddingVertical: 17, alignItems: 'center', shadowColor: Colors.secondary300, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  completeBtnText: { color: Colors.bgCard, fontSize: 18, fontWeight: 'bold' },
});
