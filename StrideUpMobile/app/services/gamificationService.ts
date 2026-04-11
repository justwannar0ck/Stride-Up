import api from '../api';

// Types

export interface RankTier {
  name: string;
  color_hex: string;
  icon_name: string;
  min_lifetime_points: number;
}

export interface PointBalance {
  username: string;
  balance: number;
  lifetime_earned: number;
  updated_at: string;
  tier?: RankTier | null;
  next_tier?: RankTier | null;
  progress_percentage?: number;
}

export interface SampleVoucher {
  id: number;
  title: string;
  brand: string;
  description: string;
  category: string;
  discount_percent?: number;
  discount_amount?: number;
  points_cost: number;
  image_url: string;
  can_afford: boolean;
}

export interface VouchersResponse {
  user_balance: number;
  vouchers: SampleVoucher[];
}

// Service

export const gamificationService = {
  // Gets user's current point balance
  getBalance: async (): Promise<PointBalance> => {
    const response = await api.get('/api/v1/gamification/balance/');
    return response.data;
  },

  // Gets sample vouchers with can_afford flag
  getVouchers: async (): Promise<VouchersResponse> => {
    const response = await api.get('/api/v1/gamification/vouchers/');
    return response.data;
  },
};