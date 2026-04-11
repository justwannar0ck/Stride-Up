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

  // Fallback to Gold if tier data isn't loaded yet
  const themeColor = balance?.tier?.color_hex || '#FFD700';
  const rankName = balance?.tier?.name || 'Unranked';
  const iconName = (balance?.tier?.icon_name as any) || 'star';

  return (
    <View style={[styles.container, { borderColor: themeColor }]}>
      
      {/* Top Row: Rank Identity & Redeem Action */}
      <View style={styles.topRow}>
        <View style={styles.rankInfo}>
          <Ionicons name={iconName} size={24} color={themeColor} />
          <Text style={[styles.rankLabel, { color: themeColor }]}>{rankName} Rank</Text>
        </View>
        <TouchableOpacity
          style={styles.redeemButton}
          onPress={() => router.push('/rewards')}
        >
          <Ionicons name="gift-outline" size={16} color="#4a4d2e" />
          <Text style={styles.redeemText}>Rewards</Text>
        </TouchableOpacity>
      </View>

      {/* Middle Row: Spendable Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.balanceValue}>
          {balance?.balance ?? 0}
        </Text>
        <Text style={styles.balanceUnit}>spendable pts</Text>
      </View>

      {/* Bottom Row: Progress Bar to Next Rank */}
      {balance?.next_tier && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.lifetimeText}>
              Lifetime: {balance?.lifetime_earned ?? 0} pts
            </Text>
            <Text style={styles.nextTierText}>
              {balance.next_tier.name} at {balance.next_tier.min_lifetime_points}
            </Text>
          </View>
          
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${balance?.progress_percentage ?? 0}%`, 
                  backgroundColor: themeColor 
                }
              ]} 
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankLabel: {
    fontSize: 18,
    fontWeight: 'bold',
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
    marginBottom: 16,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  balanceUnit: {
    fontSize: 16,
    color: '#8a8d6a',
    marginLeft: 8,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lifetimeText: {
    fontSize: 13,
    color: '#8a8d6a',
  },
  nextTierText: {
    fontSize: 13,
    color: '#8a8d6a',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});