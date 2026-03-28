import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { gamificationService, PointBalance } from '../services/gamificationService';

export default function PointsWidget() {
  const router = useRouter();
  const [balance, setBalance] = useState<PointBalance | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadBalance();
    }, [])
  );

  const loadBalance = async () => {
    try {
      const data = await gamificationService.getBalance();
      setBalance(data);
    } catch (error) {
      console.error('Failed to load points:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.pointsInfo}>
          <Ionicons name="star" size={22} color="#FFD700" />
          <Text style={styles.pointsLabel}>My Points</Text>
        </View>
        <TouchableOpacity
          style={styles.redeemButton}
          onPress={() => router.push('/rewards')}
        >
          <Ionicons name="gift-outline" size={16} color="#4a4d2e" />
          <Text style={styles.redeemText}>Redeem</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceValue}>
          {balance?.balance ?? 0}
        </Text>
        <Text style={styles.balanceUnit}>pts</Text>
      </View>

      <Text style={styles.lifetimeText}>
        Lifetime earned: {balance?.lifetime_earned ?? 0} pts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 8,
  },
  redeemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d9e3d0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  redeemText: {
    color: '#4a4d2e',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  balanceUnit: {
    fontSize: 16,
    color: '#8a8d6a',
    marginLeft: 6,
  },
  lifetimeText: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 6,
  },
});