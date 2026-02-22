import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import {
  challengeService,
  ChallengeDetail as ChallengeDetailType,
  ChallengeParticipant,
  RouteWaypoint,
} from './services/challengeService';

// Helpers

const TYPE_LABELS: Record<string, string> = {
  distance: 'Distance',
  duration: 'Duration',
  count: 'Activity Count',
  elevation: 'Elevation',
};

const TYPE_ICONS: Record<string, string> = {
  distance: 'map-outline',
  duration: 'time-outline',
  count: 'list-outline',
  elevation: 'trending-up-outline',
};

const ACTIVITY_ICONS: Record<string, string> = {
  run: 'walk-outline',
  walk: 'footsteps-outline',
  cycle: 'bicycle-outline',
  hike: 'trail-sign-outline',
};

const WAYPOINT_COLORS: Record<string, string> = {
  start: '#2ecc71',
  checkpoint: '#f1c40f',
  end: '#e74c3c',
};

const WAYPOINT_ICONS: Record<string, string> = {
  start: 'flag',
  checkpoint: 'location',
  end: 'checkmark-circle',
};

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeAgo(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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

// Computes a region that fits all waypoints with padding
function getRegionForWaypoints(waypoints: RouteWaypoint[]) {
  if (waypoints.length === 0) {
    return {
      latitude: 27.7172,
      longitude: 85.324,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }

  let minLat = waypoints[0].latitude;
  let maxLat = waypoints[0].latitude;
  let minLng = waypoints[0].longitude;
  let maxLng = waypoints[0].longitude;

  for (const wp of waypoints) {
    minLat = Math.min(minLat, wp.latitude);
    maxLat = Math.max(maxLat, wp.latitude);
    minLng = Math.min(minLng, wp.longitude);
    maxLng = Math.max(maxLng, wp.longitude);
  }

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const deltaLat = (maxLat - minLat) * 1.4 || 0.01;
  const deltaLng = (maxLng - minLng) * 1.4 || 0.01;

  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: Math.max(deltaLat, 0.005),
    longitudeDelta: Math.max(deltaLng, 0.005),
  };
}

// Components

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { communityId, challengeId } = useLocalSearchParams<{
    communityId: string;
    challengeId: string;
  }>();

  const [challenge, setChallenge] = useState<ChallengeDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const mapRef = useRef<MapView>(null);

  const loadChallenge = useCallback(async () => {
    if (!communityId || !challengeId) return;
    try {
      const data = await challengeService.getChallenge(
        parseInt(communityId),
        parseInt(challengeId)
      );
      setChallenge(data);
    } catch (error) {
      console.error('Failed to load challenge:', error);
      Alert.alert('Error', 'Failed to load challenge details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId, challengeId]);

  useFocusEffect(
    useCallback(() => {
      loadChallenge();
    }, [loadChallenge])
  );

  const handleJoin = async () => {
    if (!challenge || !communityId) return;
    setJoining(true);
    try {
      const result = await challengeService.joinChallenge(
        parseInt(communityId),
        challenge.id
      );
      Alert.alert('Joined!', result.detail);
      loadChallenge();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to join challenge'
      );
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!challenge || !communityId) return;
    Alert.alert('Leave Challenge', 'Your contributions will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await challengeService.leaveChallenge(
              parseInt(communityId),
              challenge.id
            );
            loadChallenge();
          } catch (error: any) {
            Alert.alert(
              'Error',
              error.response?.data?.detail || 'Failed to leave'
            );
          }
        },
      },
    ]);
  };

  // Render

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#d9e3d0' }}>Challenge not found</Text>
      </View>
    );
  }

  const isActive = challenge.current_status === 'active';
  const isUpcoming = challenge.current_status === 'upcoming';
  const isCollective = challenge.contribution_scope === 'collective';
  const progressPct = isCollective
    ? challenge.progress_percentage
    : challenge.my_progress?.percentage || 0;
  const progressValue = isCollective
    ? challenge.total_progress
    : challenge.my_progress?.total_contributed || 0;

  // Route data
  const hasRoute =
    challenge.is_route_challenge &&
    challenge.route_waypoints &&
    challenge.route_waypoints.length > 0;
  const waypoints = hasRoute ? challenge.route_waypoints : [];
  const polyCoords = waypoints.map((wp) => ({
    latitude: wp.latitude,
    longitude: wp.longitude,
  }));

  return (
    <View style={styles.container}>

      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Challenge
          </Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadChallenge();
            }}
            tintColor="#d9e3d0"
          />
        }
      >

        <View style={styles.heroSection}>
          <View style={styles.heroIconRow}>
            <View style={styles.heroIcon}>
              <Ionicons
                name={(TYPE_ICONS[challenge.challenge_type] || 'trophy-outline') as any}
                size={28}
                color="#d9e3d0"
              />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle}>{challenge.title}</Text>
              <Text style={styles.heroMeta}>
                {TYPE_LABELS[challenge.challenge_type]} ·{' '}
                {isCollective ? 'Collective' : 'Individual'}
                {hasRoute ? ' · Route Challenge' : ''}
              </Text>
            </View>
          </View>

          {challenge.description ? (
            <Text style={styles.heroDescription}>{challenge.description}</Text>
          ) : null}

          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color="#8a8d6a"
              />
              <Text style={styles.dateText}>
                {formatFullDate(challenge.start_date)} –{' '}
                {formatFullDate(challenge.end_date)}
              </Text>
            </View>
            {(isActive || isUpcoming) && (
              <Text style={styles.daysRemaining}>
                {getDaysRemaining(challenge.end_date)}
              </Text>
            )}
          </View>

          <View style={styles.activityTypesRow}>
            {challenge.activity_types.map((t) => (
              <View key={t} style={styles.activityTypeChip}>
                <Ionicons
                  name={(ACTIVITY_ICONS[t] || 'fitness-outline') as any}
                  size={14}
                  color="#d9e3d0"
                />
                <Text style={styles.activityTypeText}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {hasRoute && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="navigate-outline" size={18} color="#2ecc71" />
              <Text style={styles.sectionTitle}>Challenge Route</Text>
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>
                  {waypoints.length} points
                </Text>
              </View>
            </View>

            <View style={styles.routeMapContainer}>
              <MapView
                ref={mapRef}
                style={styles.routeMap}
                initialRegion={getRegionForWaypoints(waypoints)}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >

                {polyCoords.length > 1 && (
                  <Polyline
                    coordinates={polyCoords}
                    strokeColor="#d9e3d0"
                    strokeWidth={3}
                    lineDashPattern={[10, 6]}
                  />
                )}

                {waypoints.map((wp, index) => (
                  <Marker
                    key={wp.id || index}
                    coordinate={{
                      latitude: wp.latitude,
                      longitude: wp.longitude,
                    }}
                    title={wp.name || wp.waypoint_type}
                    description={`${wp.waypoint_type.charAt(0).toUpperCase() + wp.waypoint_type.slice(1)} #${index + 1}`}
                  >
                    <View
                      style={[
                        styles.waypointMarker,
                        {
                          backgroundColor:
                            WAYPOINT_COLORS[wp.waypoint_type] || '#f1c40f',
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          (WAYPOINT_ICONS[wp.waypoint_type] || 'location') as any
                        }
                        size={12}
                        color="#fff"
                      />
                      <Text style={styles.waypointMarkerText}>{index + 1}</Text>
                    </View>
                  </Marker>
                ))}
              </MapView>

              <TouchableOpacity
                style={styles.mapOverlay}
                activeOpacity={0.7}
                onPress={() => {
                  // Fits map to all markers
                  if (mapRef.current && waypoints.length > 0) {
                    mapRef.current.animateToRegion(
                      getRegionForWaypoints(waypoints),
                      500
                    );
                  }
                }}
              >
                <Ionicons name="expand-outline" size={16} color="#d9e3d0" />
              </TouchableOpacity>
            </View>

            <View style={styles.waypointList}>
              {waypoints.map((wp, index) => {
                const isStart = wp.waypoint_type === 'start';
                const isEnd = wp.waypoint_type === 'end';
                const color = WAYPOINT_COLORS[wp.waypoint_type] || '#f1c40f';

                return (
                  <View key={wp.id || index} style={styles.waypointRow}>

                    <View style={styles.waypointTimeline}>
                      {index > 0 && (
                        <View style={styles.timelineLineTop} />
                      )}
                      <View
                        style={[styles.timelineDot, { backgroundColor: color }]}
                      >
                        <Ionicons
                          name={
                            (WAYPOINT_ICONS[wp.waypoint_type] ||
                              'location') as any
                          }
                          size={10}
                          color="#fff"
                        />
                      </View>
                      {index < waypoints.length - 1 && (
                        <View style={styles.timelineLineBottom} />
                      )}
                    </View>

                    <View style={styles.waypointInfo}>
                      <View style={styles.waypointNameRow}>
                        <Text style={styles.waypointName} numberOfLines={1}>
                          {wp.name ||
                            `${wp.waypoint_type.charAt(0).toUpperCase() + wp.waypoint_type.slice(1)} #${index + 1}`}
                        </Text>
                        <View
                          style={[
                            styles.waypointTypeBadge,
                            { backgroundColor: `${color}20`, borderColor: `${color}40` },
                          ]}
                        >
                          <Text
                            style={[styles.waypointTypeText, { color }]}
                          >
                            {isStart ? 'START' : isEnd ? 'END' : `CP ${index}`}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.waypointCoords}>
                        {wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}
                        {wp.radius_meters
                          ? ` · ${wp.radius_meters}m radius`
                          : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>
              {isCollective ? 'Community Progress' : 'Your Progress'}
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progressPct, 100)}%`,
                  backgroundColor:
                    progressPct >= 100 ? '#2ecc71' : '#f1c40f',
                },
              ]}
            />
          </View>
          <View style={styles.progressNumbers}>
            <Text style={styles.progressCurrent}>
              {progressValue.toFixed(1)} {challenge.target_unit}
            </Text>
            <Text style={styles.progressTarget}>
              / {challenge.target_value} {challenge.target_unit} ({progressPct}
              %)
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {challenge.participants_count}
              </Text>
              <Text style={styles.statLabel}>Participants</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {challenge.total_progress.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>
                Total {challenge.target_unit}
              </Text>
            </View>
            {challenge.my_progress && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {challenge.my_progress.total_contributed.toFixed(1)}
                </Text>
                <Text style={styles.statLabel}>Your Contribution</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="podium-outline" size={18} color="#f1c40f" />
            <Text style={styles.sectionTitle}>Leaderboard</Text>
          </View>

          {challenge.leaderboard.length > 0 ? (
            challenge.leaderboard.map(
              (participant: ChallengeParticipant, index: number) => (
                <View key={participant.id} style={styles.leaderboardRow}>
                  <Text
                    style={[
                      styles.rank,
                      index < 3 && { color: '#f1c40f', fontWeight: '700' },
                    ]}
                  >
                    {index + 1}
                  </Text>
                  <View style={styles.leaderAvatar}>
                    <Ionicons name="person" size={16} color="#8a8d6a" />
                  </View>
                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderName} numberOfLines={1}>
                      {participant.full_name || participant.username}
                    </Text>
                    <Text style={styles.leaderUsername}>
                      @{participant.username}
                    </Text>
                  </View>
                  <View style={styles.leaderValue}>
                    <Text style={styles.leaderValueText}>
                      {participant.total_contributed.toFixed(1)}{' '}
                      {challenge.target_unit}
                    </Text>
                    {participant.is_completed && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#2ecc71"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                </View>
              )
            )
          ) : (
            <Text style={styles.emptySubtext}>
              No participants yet. Be the first to join!
            </Text>
          )}
        </View>

        {challenge.recent_contributions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="flash-outline"
                size={18}
                color="#d9e3d0"
              />
              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </View>

            {challenge.recent_contributions.map((c) => (
              <View key={c.id} style={styles.contributionRow}>
                <View style={styles.contributionIcon}>
                  <Ionicons
                    name={
                      (ACTIVITY_ICONS[c.activity_type] ||
                        'fitness-outline') as any
                    }
                    size={16}
                    color="#8a8d6a"
                  />
                </View>
                <View style={styles.contributionInfo}>
                  <Text style={styles.contributionUser}>
                    {c.full_name || c.username}
                  </Text>
                  <Text style={styles.contributionDetail}>
                    {c.activity_title} · +{c.value.toFixed(1)}{' '}
                    {challenge.target_unit}
                  </Text>
                </View>
                <Text style={styles.contributionTime}>
                  {formatTimeAgo(c.contributed_at)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {(isActive || isUpcoming) && (
          <View style={styles.actionSection}>
            {!challenge.is_joined ? (
              <TouchableOpacity
                style={[styles.joinButton, joining && { opacity: 0.6 }]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#4a4d2e" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="enter-outline"
                      size={20}
                      color="#4a4d2e"
                    />
                    <Text style={styles.joinButtonText}>Join Challenge</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={handleLeave}
              >
                <Ionicons
                  name="exit-outline"
                  size={18}
                  color="#e74c3c"
                />
                <Text style={styles.leaveButtonText}>Leave Challenge</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {challenge.my_progress?.is_completed && (
          <View style={styles.completedBanner}>
            <Ionicons name="trophy" size={24} color="#f1c40f" />
            <Text style={styles.completedText}>
              You completed this challenge! 🎉
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Styles

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5c5f3d' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },

  // Header
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop:
      Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4, width: 32 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: { width: 32 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Hero Section
  heroSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  heroIconRow: { flexDirection: 'row', alignItems: 'center' },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: { flex: 1, marginLeft: 12 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#d9e3d0' },
  heroMeta: { fontSize: 13, color: '#8a8d6a', marginTop: 2 },
  heroDescription: {
    fontSize: 14,
    color: '#b8c4a8',
    lineHeight: 20,
    marginTop: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  dateItem: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 12, color: '#8a8d6a', marginLeft: 4 },
  daysRemaining: {
    fontSize: 12,
    color: '#f1c40f',
    fontWeight: '600',
    marginLeft: 'auto',
  },
  activityTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  activityTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  activityTypeText: {
    fontSize: 12,
    color: '#d9e3d0',
    marginLeft: 4,
  },

  // Sections
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 8,
  },

  // Route Map styles
  routeBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  routeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2ecc71',
  },
  routeMapContainer: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
  },
  routeMap: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    padding: 6,
  },
  waypointMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 2,
  },
  waypointMarkerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Waypoint list (timeline style)
  waypointList: {
    paddingLeft: 4,
  },
  waypointRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  waypointTimeline: {
    width: 28,
    alignItems: 'center',
    position: 'relative',
  },
  timelineLineTop: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '50%',
    backgroundColor: 'rgba(217, 227, 208, 0.2)',
  },
  timelineLineBottom: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    height: '50%',
    backgroundColor: 'rgba(217, 227, 208, 0.2)',
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: '50%',
    marginTop: -11,
    zIndex: 1,
  },
  waypointInfo: {
    flex: 1,
    paddingLeft: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  waypointNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waypointName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9e3d0',
    flex: 1,
    marginRight: 8,
  },
  waypointTypeBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  waypointTypeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  waypointCoords: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 3,
  },

  // Progress
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  progressCurrent: {
    fontSize: 22,
    fontWeight: '700',
    color: '#d9e3d0',
  },
  progressTarget: {
    fontSize: 14,
    color: '#8a8d6a',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d9e3d0',
  },
  statLabel: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 4,
    textAlign: 'center',
  },

  // Leaderboard
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  rank: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    color: '#8a8d6a',
    textAlign: 'center',
  },
  leaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  leaderInfo: { flex: 1, marginLeft: 10 },
  leaderName: { fontSize: 14, fontWeight: '600', color: '#d9e3d0' },
  leaderUsername: { fontSize: 12, color: '#8a8d6a' },
  leaderValue: { flexDirection: 'row', alignItems: 'center' },
  leaderValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b8c4a8',
  },

  // Contributions
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  contributionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contributionInfo: { flex: 1, marginLeft: 10 },
  contributionUser: { fontSize: 13, fontWeight: '600', color: '#d9e3d0' },
  contributionDetail: { fontSize: 12, color: '#8a8d6a', marginTop: 2 },
  contributionTime: { fontSize: 11, color: '#8a8d6a' },

  // Actions
  actionSection: { marginBottom: 16 },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9e3d0',
    paddingVertical: 14,
    borderRadius: 14,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a4d2e',
    marginLeft: 8,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
    paddingVertical: 14,
    borderRadius: 14,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e74c3c',
    marginLeft: 8,
  },

  // Completed banner
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(241, 196, 15, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(241, 196, 15, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  completedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1c40f',
    marginLeft: 10,
  },

  emptySubtext: {
    fontSize: 13,
    color: '#8a8d6a',
    textAlign: 'center',
    paddingVertical: 16,
  },
});