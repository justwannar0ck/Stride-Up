import api from '../api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChallengeType = 'distance' | 'duration' | 'count' | 'elevation';
export type ContributionScope = 'collective' | 'individual';
export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike';

export interface ChallengeParticipant {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  joined_at: string;
  total_contributed: number;
  is_completed: boolean;
}

export interface ChallengeContribution {
  id: number;
  username: string;
  full_name: string;
  activity_title: string;
  activity_type: ActivityType;
  value: number;
  contributed_at: string;
}

export interface Challenge {
  id: number;
  title: string;
  description: string;
  challenge_type: ChallengeType;
  contribution_scope: ContributionScope;
  activity_types: ActivityType[];
  target_value: number;
  target_unit: string;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
  current_status: ChallengeStatus;
  participants_count: number;
  total_progress: number;
  progress_percentage: number;
  is_joined: boolean;
  created_by_username: string;
  created_at: string;
}

export interface ChallengeDetail extends Challenge {
  leaderboard: ChallengeParticipant[];
  my_progress: {
    total_contributed: number;
    is_completed: boolean;
    joined_at: string;
    percentage: number;
  } | null;
  recent_contributions: ChallengeContribution[];
}

export interface CreateChallengeData {
  title: string;
  description?: string;
  challenge_type: ChallengeType;
  contribution_scope: ContributionScope;
  activity_types: ActivityType[];
  target_value: number;
  target_unit: string;
  start_date: string;
  end_date: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const challengeService = {
  /**
   * List all challenges for a community
   */
  getChallenges: async (communityId: number): Promise<Challenge[]> => {
    const response = await api.get(
      `/api/v1/communities/${communityId}/challenges/`
    );
    return response.data;
  },

  /**
   * Get challenge detail with leaderboard and progress
   */
  getChallenge: async (
    communityId: number,
    challengeId: number
  ): Promise<ChallengeDetail> => {
    const response = await api.get(
      `/api/v1/communities/${communityId}/challenges/${challengeId}/`
    );
    return response.data;
  },

  /**
   * Create a new challenge (leaders only)
   */
  createChallenge: async (
    communityId: number,
    data: CreateChallengeData
  ): Promise<ChallengeDetail> => {
    const response = await api.post(
      `/api/v1/communities/${communityId}/challenges/`,
      data
    );
    return response.data;
  },

  /**
   * Update challenge description (admins only)
   */
  updateChallenge: async (
    communityId: number,
    challengeId: number,
    data: { description: string }
  ): Promise<ChallengeDetail> => {
    const response = await api.patch(
      `/api/v1/communities/${communityId}/challenges/${challengeId}/`,
      data
    );
    return response.data;
  },

  /**
   * Cancel a challenge (admins only)
   */
  cancelChallenge: async (
    communityId: number,
    challengeId: number
  ): Promise<{ detail: string }> => {
    const response = await api.delete(
      `/api/v1/communities/${communityId}/challenges/${challengeId}/`
    );
    return response.data;
  },

  /**
   * Join a challenge
   */
  joinChallenge: async (
    communityId: number,
    challengeId: number
  ): Promise<{ detail: string }> => {
    const response = await api.post(
      `/api/v1/communities/${communityId}/challenges/${challengeId}/join/`
    );
    return response.data;
  },

  /**
   * Leave a challenge
   */
  leaveChallenge: async (
    communityId: number,
    challengeId: number
  ): Promise<{ detail: string }> => {
    const response = await api.post(
      `/api/v1/communities/${communityId}/challenges/${challengeId}/leave/`
    );
    return response.data;
  },
};