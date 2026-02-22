import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../api';

interface UserStats {
  total_activities: number;
  total_distance_km: number;
  total_duration_hours: number;
  total_calories:  number;
  total_elevation_gain: number;
  average_pace: string;
  average_speed: number;
  this_week_distance_km: number;
  this_month_distance_km: number;
  activities_by_type: Record<string, {
    count: number;
    distance_km: number;
    duration_hours: number;
  }>;
  personal_bests: {
    longest_distance_km: number;
    longest_duration:  string;
    fastest_pace: string;
  };
}

interface RecentActivity {
  id: number;
  title: string;
  activity_type: string;
  distance_km: number;
  duration_formatted: string;
  pace_formatted: string;
  started_at: string;
  visibility: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [statsResponse, activitiesResponse] = await Promise. all([
        api.get('/api/v1/activities/statistics/'),
        api.get('/api/v1/activities/? limit=5'),
      ]);

      setStats(statsResponse.data);
      
      const activities = Array.isArray(activitiesResponse.data) 
        ? activitiesResponse.data 
        : activitiesResponse.data.results || [];
      setRecentActivities(activities. slice(0, 5));
    } catch (error) {
      console.error('Failed to load home data:', error);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now. getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'run':  return 'walk';
      case 'cycle': return 'bicycle';
      case 'hike': return 'trail-sign';
      case 'walk': return 'footsteps';
      default: return 'fitness';
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
      <View style={styles.pageHeader}>
        <Ionicons name="home" size={20} color="#d9e3d0" />
        <Text style={styles.pageTitle}>Home</Text>
      </View>

      <View style={styles.weeklyCard}>
        <View style={styles.weeklyHeader}>
          <Text style={styles.weeklyTitle}>This Week</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/challenges')}>
            <Text style={styles.viewAllText}>View Goals →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles. weeklyStats}>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatValue}>
              {stats?.this_week_distance_km?. toFixed(1) || '0'}
            </Text>
            <Text style={styles.weeklyStatLabel}>km</Text>
          </View>
          <View style={styles.weeklyDivider} />
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatValue}>
              {stats?.total_activities || 0}
            </Text>
            <Text style={styles. weeklyStatLabel}>activities</Text>
          </View>
          <View style={styles.weeklyDivider} />
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatValue}>
              {Math.round(stats?.total_calories || 0)}
            </Text>
            <Text style={styles.weeklyStatLabel}>calories</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min((stats?.this_week_distance_km || 0) / 50 * 100, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {stats?.this_week_distance_km?.toFixed(1) || '0'} / 50 km weekly goal
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="speedometer-outline" size={24} color="#4CAF50" />
          <Text style={styles.statValue}>{stats?.average_pace || '--: --'}</Text>
          <Text style={styles.statLabel}>Avg Pace</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#FF9800" />
          <Text style={styles.statValue}>
            {Math.round(stats?.total_elevation_gain || 0)}m
          </Text>
          <Text style={styles.statLabel}>Elevation</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#2196F3" />
          <Text style={styles.statValue}>
            {stats?.total_duration_hours?. toFixed(1) || '0'}h
          </Text>
          <Text style={styles.statLabel}>Total Time</Text>
        </View>
      </View>

      {stats?.personal_bests && stats.personal_bests.longest_distance_km > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Bests 🏆</Text>
          <View style={styles.bestsContainer}>
            <View style={styles.bestItem}>
              <Ionicons name="ribbon-outline" size={20} color="#FFD700" />
              <Text style={styles.bestValue}>
                {stats.personal_bests.longest_distance_km} km
              </Text>
              <Text style={styles.bestLabel}>Longest Run</Text>
            </View>
            <View style={styles. bestItem}>
              <Ionicons name="flash-outline" size={20} color="#FFD700" />
              <Text style={styles.bestValue}>
                {stats.personal_bests.fastest_pace}
              </Text>
              <Text style={styles.bestLabel}>Fastest Pace</Text>
            </View>
            <View style={styles.bestItem}>
              <Ionicons name="hourglass-outline" size={20} color="#FFD700" />
              <Text style={styles. bestValue}>
                {stats. personal_bests.longest_duration}
              </Text>
              <Text style={styles.bestLabel}>Longest Time</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles. sectionTitle}>Recent Activities</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/map')}>
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {recentActivities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="walk-outline" size={48} color="#8a8d6a" />
            <Text style={styles.emptyText}>No activities yet</Text>
            <Text style={styles.emptySubtext}>
              Go to Track tab to record your first activity! 
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => router.push('/(tabs)/track')}
            >
              <Ionicons name="play" size={20} color="#4a4d2e" />
              <Text style={styles.startButtonText}>Start Activity</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentActivities.map((activity) => (
            <TouchableOpacity
              key={activity.id}
              style={styles.activityCard}
              onPress={() =>
                router.push({
                  pathname: '../activity-summary',
                  params: { activityId: activity.id. toString() },
                })
              }
            >
              <View style={styles.activityIcon}>
                <Ionicons
                  name={getActivityIcon(activity.activity_type)}
                  size={24}
                  color="#d9e3d0"
                />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{activity. title}</Text>
                <Text style={styles.activityDate}>
                  {formatDate(activity.started_at)}
                </Text>
              </View>
              <View style={styles.activityStats}>
                <Text style={styles.activityDistance}>
                  {activity.distance_km} km
                </Text>
                <Text style={styles.activityDuration}>
                  {activity.duration_formatted}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
            </TouchableOpacity>
          ))
        )}
      </View>

      {recentActivities.length > 0 && (
        <TouchableOpacity
          style={styles. floatingButton}
          onPress={() => router.push('/(tabs)/track')}
        >
          <Ionicons name="add" size={28} color="#4a4d2e" />
          <Text style={styles.floatingButtonText}>New Activity</Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  content:  {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex:  1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },
  pageHeader: {
    flexDirection:  'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
  },
  weeklyCard: {
    backgroundColor:  'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  viewAllText:  {
    color: '#b8c4a8',
    fontSize: 14,
  },
  weeklyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  weeklyStat: {
    alignItems: 'center',
  },
  weeklyStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  weeklyStatLabel:  {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 4,
  },
  weeklyDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 8,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#8a8d6a',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  bestsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  bestItem:  {
    alignItems: 'center',
    flex: 1,
  },
  bestValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginTop: 8,
  },
  bestLabel: {
    fontSize: 10,
    color: '#8a8d6a',
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#d9e3d0',
    marginTop: 12,
  },
  emptySubtext:  {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d9e3d0',
    paddingHorizontal: 24,
    paddingVertical:  12,
    borderRadius:  25,
  },
  startButtonText: {
    color: '#4a4d2e',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  activityDate: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 2,
  },
  activityStats: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  activityDistance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  activityDuration: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 2,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9e3d0',
    paddingHorizontal: 24,
    paddingVertical:  14,
    borderRadius: 30,
    marginTop: 10,
  },
  floatingButtonText: {
    color:  '#4a4d2e',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  bottomSpacing: {
    height: 20,
  },
});