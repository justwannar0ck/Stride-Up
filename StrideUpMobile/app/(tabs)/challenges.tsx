import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  challengeService,
  ChallengeWithCommunity,
} from '../services/challengeService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  distance: 'map-outline',
  duration: 'time-outline',
  count: 'list-outline',
  elevation: 'trending-up-outline',
};

function getDaysRemaining(endDate: string) {
  const now = new Date();
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Ended';
  if (diff === 0) return 'Ends today';
  if (diff === 1) return '1 day left';
  return `${diff} days left`;
}

// ─── Challenge Card Component ─────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  onPress,
  showCommunity = true,
}: {
  challenge: ChallengeWithCommunity;
  onPress: () => void;
  showCommunity?: boolean;
}) {
  const progressPct =
    challenge.contribution_scope === 'collective'
      ? challenge.progress_percentage
      : 0;
  const isActive = challenge.current_status === 'active';

  return (
    <TouchableOpacity style={styles.challengeCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.challengeIcon}>
        <Ionicons
          name={(TYPE_ICONS[challenge.challenge_type] || 'trophy-outline') as any}
          size={24}
          color="#d9e3d0"
        />
      </View>
      <View style={styles.challengeInfo}>
        <Text style={styles.challengeTitle} numberOfLines={1}>
          {challenge.title}
        </Text>

        {showCommunity && (
          <Text style={styles.communityName} numberOfLines={1}>
            {challenge.community_name}
          </Text>
        )}

        <View style={styles.metaRow}>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? '#2ecc71' : '#f39c12' },
              ]}
            />
            <Text style={styles.statusText}>
              {isActive ? 'Active' : 'Upcoming'}
            </Text>
          </View>
          <Text style={styles.daysLeft}>{getDaysRemaining(challenge.end_date)}</Text>
        </View>

        {/* Progress bar (only for active collective challenges) */}
        {isActive && challenge.contribution_scope === 'collective' && (
          <>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(progressPct, 100)}%`,
                    backgroundColor: progressPct >= 100 ? '#2ecc71' : '#f1c40f',
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {challenge.total_progress.toFixed(1)} / {challenge.target_value}{' '}
              {challenge.target_unit} ({progressPct}%)
            </Text>
          </>
        )}

        <View style={styles.bottomRow}>
          <View style={styles.participantsChip}>
            <Ionicons name="people-outline" size={12} color="#8a8d6a" />
            <Text style={styles.participantsText}>
              {challenge.participants_count}
            </Text>
          </View>
          {challenge.is_joined && (
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#2ecc71" />
              <Text style={styles.joinedText}>Joined</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChallengesScreen() {
  const router = useRouter();
  const [myChallenges, setMyChallenges] = useState<ChallengeWithCommunity[]>([]);
  const [discoverChallenges, setDiscoverChallenges] = useState<ChallengeWithCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const data = await challengeService.getChallengeFeed();
      setMyChallenges(data.my_challenges);
      setDiscoverChallenges(data.discover_challenges);
    } catch (error) {
      console.error('Failed to load challenge feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const navigateToChallenge = (challenge: ChallengeWithCommunity) => {
    router.push({
      pathname: '/challenge-detail',
      params: {
        communityId: String(challenge.community_id),
        challengeId: String(challenge.id),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
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
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadFeed();
          }}
          tintColor="#d9e3d0"
        />
      }
    >
      <View style={styles.pageHeader}>
        <Ionicons name="trophy-outline" size={20} color="#d9e3d0" />
        <Text style={styles.pageTitle}>Challenges</Text>
      </View>

      {/* ── My Challenges ── */}
      <Text style={styles.sectionTitle}>My Active Challenges</Text>
      {myChallenges.length > 0 ? (
        myChallenges.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            onPress={() => navigateToChallenge(c)}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="trophy" size={48} color="#8a8d6a" />
          <Text style={styles.emptyText}>No active challenges</Text>
          <Text style={styles.emptySubtext}>
            Join a community to participate in challenges!
          </Text>
        </View>
      )}

      {/* ── Discover Challenges ── */}
      <Text style={styles.sectionTitle}>Discover Challenges</Text>
      <Text style={styles.sectionSubtitle}>
        From public communities you have not joined
      </Text>
      {discoverChallenges.length > 0 ? (
        discoverChallenges.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            onPress={() => navigateToChallenge(c)}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color="#8a8d6a" />
          <Text style={styles.emptyText}>No challenges to discover</Text>
          <Text style={styles.emptySubtext}>
            Check back later for new public challenges!
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5c5f3d' },
  content: { padding: 16, paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },

  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    marginBottom: 4,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#8a8d6a',
    marginBottom: 12,
  },

  // Empty state
  emptyState: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 16, color: '#d9e3d0', marginTop: 12 },
  emptySubtext: { fontSize: 12, color: '#8a8d6a', marginTop: 4, textAlign: 'center' },

  // Challenge card
  challengeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  challengeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  challengeInfo: { flex: 1 },
  challengeTitle: { fontSize: 15, fontWeight: '600', color: '#d9e3d0' },
  communityName: { fontSize: 12, color: '#b8c4a8', marginTop: 2 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, color: '#8a8d6a' },
  daysLeft: { fontSize: 11, color: '#f1c40f', fontWeight: '600' },

  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, color: '#8a8d6a', marginTop: 4 },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  participantsChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  participantsText: { fontSize: 11, color: '#8a8d6a' },
  joinedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  joinedText: { fontSize: 11, color: '#2ecc71', fontWeight: '600' },
});