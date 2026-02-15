import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  challengeService,
  Challenge,
  ChallengeStatus,
} from '../services/challengeService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  distance: { icon: 'map-outline', label: 'Distance' },
  duration: { icon: 'time-outline', label: 'Duration' },
  count: { icon: 'list-outline', label: 'Activity Count' },
  elevation: { icon: 'trending-up-outline', label: 'Elevation' },
};

const STATUS_CONFIG: Record<
  ChallengeStatus,
  { color: string; bg: string; label: string }
> = {
  upcoming: { color: '#3498db', bg: 'rgba(52,152,219,0.15)', label: 'Upcoming' },
  active: { color: '#2ecc71', bg: 'rgba(46,204,113,0.15)', label: 'Active' },
  completed: { color: '#8a8d6a', bg: 'rgba(138,141,106,0.15)', label: 'Completed' },
  cancelled: { color: '#e74c3c', bg: 'rgba(231,76,60,0.15)', label: 'Cancelled' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDaysRemaining(endDate: string) {
  const now = new Date();
  const end = new Date(endDate);
  const diff = Math.ceil(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return 'Ended';
  if (diff === 0) return 'Ends today';
  if (diff === 1) return '1 day left';
  return `${diff} days left`;
}

// ─── Component ─────────────────────────────────────────────���─────────────────

interface Props {
  communityId: number;
  isAdmin: boolean;
}

export default function ChallengesList({ communityId, isAdmin }: Props) {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'upcoming' | 'past'>('active');

  const loadChallenges = useCallback(async () => {
    try {
      const data = await challengeService.getChallenges(communityId);
      setChallenges(data);
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId]);

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [loadChallenges])
  );

  const filteredChallenges = challenges.filter((c) => {
    const s = c.current_status;
    if (filter === 'active') return s === 'active';
    if (filter === 'upcoming') return s === 'upcoming';
    return s === 'completed' || s === 'cancelled';
  });

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadChallenges();
          }}
          tintColor="#d9e3d0"
        />
      }
    >
      {/* Create button — leaders only */}
      {isAdmin && (
        <TouchableOpacity
          style={s.createButton}
          onPress={() =>
            router.push({
              pathname: '/challenge-create',
              params: { communityId: communityId.toString() },
            })
          }
        >
          <Ionicons name="add-circle-outline" size={20} color="#4a4d2e" />
          <Text style={s.createButtonText}>Create Challenge</Text>
        </TouchableOpacity>
      )}

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {(['active', 'upcoming', 'past'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[s.filterTabText, filter === f && s.filterTabTextActive]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Challenge cards */}
      {filteredChallenges.length > 0 ? (
        filteredChallenges.map((challenge) => {
          const typeConf = TYPE_CONFIG[challenge.challenge_type] || TYPE_CONFIG.distance;
          const statusConf = STATUS_CONFIG[challenge.current_status] || STATUS_CONFIG.active;
          const progress =
            challenge.contribution_scope === 'collective'
              ? challenge.progress_percentage
              : 0;

          return (
            <TouchableOpacity
              key={challenge.id}
              style={s.card}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/challenge-detail',
                  params: {
                    communityId: communityId.toString(),
                    challengeId: challenge.id.toString(),
                  },
                })
              }
            >
              {/* Header row */}
              <View style={s.cardHeader}>
                <View style={s.typeIconContainer}>
                  <Ionicons
                    name={typeConf.icon as any}
                    size={18}
                    color="#d9e3d0"
                  />
                </View>
                <View style={s.cardHeaderInfo}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {challenge.title}
                  </Text>
                  <Text style={s.cardMeta}>
                    {challenge.contribution_scope === 'collective'
                      ? 'Collective'
                      : 'Individual'}{' '}
                    · {typeConf.label}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusConf.bg }]}>
                  <Text style={[s.statusText, { color: statusConf.color }]}>
                    {statusConf.label}
                  </Text>
                </View>
              </View>

              {/* Progress bar (collective only) */}
              {challenge.contribution_scope === 'collective' &&
                challenge.current_status === 'active' && (
                  <View style={s.progressSection}>
                    <View style={s.progressBar}>
                      <View
                        style={[
                          s.progressFill,
                          { width: `${Math.min(progress, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={s.progressText}>
                      {challenge.total_progress.toFixed(1)} /{' '}
                      {challenge.target_value} {challenge.target_unit} (
                      {progress}%)
                    </Text>
                  </View>
                )}

              {/* Footer */}
              <View style={s.cardFooter}>
                <View style={s.footerItem}>
                  <Ionicons name="people-outline" size={14} color="#8a8d6a" />
                  <Text style={s.footerText}>
                    {challenge.participants_count} joined
                  </Text>
                </View>
                <View style={s.footerItem}>
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color="#8a8d6a"
                  />
                  <Text style={s.footerText}>
                    {formatDate(challenge.start_date)} –{' '}
                    {formatDate(challenge.end_date)}
                  </Text>
                </View>
                {challenge.current_status === 'active' && (
                  <Text style={s.daysLeft}>
                    {getDaysRemaining(challenge.end_date)}
                  </Text>
                )}
              </View>

              {/* Join indicator */}
              {challenge.is_joined && (
                <View style={s.joinedBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color="#2ecc71"
                  />
                  <Text style={s.joinedText}>Joined</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={s.emptyState}>
          <Ionicons name="trophy-outline" size={48} color="#8a8d6a" />
          <Text style={s.emptyText}>
            {filter === 'active'
              ? 'No active challenges'
              : filter === 'upcoming'
              ? 'No upcoming challenges'
              : 'No past challenges'}
          </Text>
          {isAdmin && filter === 'active' && (
            <Text style={s.emptySubtext}>
              Create one to get your community moving!
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },

  // Create button
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9e3d0',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a4d2e',
    marginLeft: 6,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  filterTabText: {
    fontSize: 13,
    color: '#8a8d6a',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#d9e3d0',
    fontWeight: '600',
  },

  // Card
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  cardMeta: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Progress
  progressSection: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2ecc71',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#b8c4a8',
    marginTop: 6,
  },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#8a8d6a',
    marginLeft: 4,
  },
  daysLeft: {
    fontSize: 12,
    color: '#f1c40f',
    fontWeight: '600',
    marginLeft: 'auto',
  },

  // Joined badge
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  joinedText: {
    fontSize: 12,
    color: '#2ecc71',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8a8d6a',
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#8a8d6a',
    marginTop: 4,
  },
});