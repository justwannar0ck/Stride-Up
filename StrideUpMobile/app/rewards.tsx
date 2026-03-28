import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { gamificationService, SampleVoucher } from './services/gamificationService';

export default function RewardsScreen() {
  const router = useRouter();
  const [vouchers, setVouchers] = useState<SampleVoucher[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await gamificationService.getVouchers();
      setVouchers(data.vouchers);
      setUserBalance(data.user_balance);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    switch (category) {
      case 'sports': return 'fitness-outline';
      case 'food': return 'nutrition-outline';
      case 'apparel': return 'shirt-outline';
      case 'electronics': return 'watch-outline';
      default: return 'gift-outline';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#d9e3d0"
          colors={['#d9e3d0']}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Ionicons name="star" size={28} color="#FFD700" />
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>Your Points</Text>
          <Text style={styles.balanceValue}>{userBalance} pts</Text>
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color="#b8c4a8" />
        <Text style={styles.infoText}>
          Complete activities to earn points! Redemption coming soon.
        </Text>
      </View>

      {/* Voucher List */}
      <Text style={styles.sectionTitle}>Available Rewards</Text>

      {vouchers.map((voucher) => (
        <View
          key={voucher.id}
          style={[
            styles.voucherCard,
            !voucher.can_afford && styles.voucherCardDisabled,
          ]}
        >
          <View style={styles.voucherIconContainer}>
            <Ionicons
              name={getCategoryIcon(voucher.category)}
              size={28}
              color={voucher.can_afford ? '#FFD700' : '#555'}
            />
          </View>

          <View style={styles.voucherInfo}>
            <Text
              style={[
                styles.voucherTitle,
                !voucher.can_afford && styles.textDisabled,
              ]}
            >
              {voucher.title}
            </Text>
            <Text
              style={[
                styles.voucherBrand,
                !voucher.can_afford && styles.textDisabled,
              ]}
            >
              {voucher.brand}
            </Text>
            <Text style={styles.voucherDescription} numberOfLines={2}>
              {voucher.description}
            </Text>
          </View>

          <View style={styles.voucherCost}>
            <Text
              style={[
                styles.costValue,
                voucher.can_afford ? styles.costAffordable : styles.costUnaffordable,
              ]}
            >
              {voucher.points_cost}
            </Text>
            <Text style={styles.costLabel}>pts</Text>
            {voucher.can_afford ? (
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={{ marginTop: 4 }} />
            ) : (
              <Ionicons name="lock-closed" size={16} color="#666" style={{ marginTop: 4 }} />
            )}
          </View>
        </View>
      ))}

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  balanceInfo: {
    marginLeft: 14,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#8a8d6a',
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#b8c4a8',
    marginLeft: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    marginBottom: 12,
  },
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  voucherCardDisabled: {
    opacity: 0.5,
  },
  voucherIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  voucherTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  voucherBrand: {
    fontSize: 12,
    color: '#b8c4a8',
    marginTop: 2,
  },
  voucherDescription: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 4,
  },
  textDisabled: {
    color: '#666',
  },
  voucherCost: {
    alignItems: 'center',
    minWidth: 50,
  },
  costValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  costAffordable: {
    color: '#4CAF50',
  },
  costUnaffordable: {
    color: '#666',
  },
  costLabel: {
    fontSize: 10,
    color: '#8a8d6a',
  },
  bottomSpacing: {
    height: 20,
  },
});