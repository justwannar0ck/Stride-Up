import React, { useEffect, useState, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { activityService, Activity } from '../services/activityService';
import { followService } from '../services/followService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!id) return;

    try {
      setError(null);
      const data = await activityService.getActivity(parseInt(id));
      setActivity(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
  if (activity) {
    setIsLiked(activity.is_liked || false);
    setLikesCount(activity.likes_count || 0);
  }
}, [activity]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivity();
  };

  const navigateToUserProfile = () => {
    if (activity) {
      router.push(`/user/${activity.user_username}`);
    }
  };

  const handleLikePress = async () => {
  if (!activity || likeLoading) return;
  
  setLikeLoading(true);
  
  try {
    if (isLiked) {
      const response = await followService.unlikeActivity(activity.id);
      setIsLiked(false);
      setLikesCount(response.likes_count);
    } else {
      const response = await followService.likeActivity(activity.id);
      setIsLiked(true);
      setLikesCount(response.likes_count);
    }
  } catch (error: any) {
    console.error('Like error:', error.response?.data?.error || error);
  } finally {
    setLikeLoading(false);
  }
};

  // Gets activity type icon
  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'run':
        return 'fitness-outline';
      case 'walk':
        return 'walk-outline';
      case 'cycle':
        return 'bicycle-outline';
      case 'hike':
        return 'trail-sign-outline';
      default:
        return 'footsteps-outline';
    }
  };

  // Formats date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Formats time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Gets map region from route coordinates
  const getMapRegion = () => {
    if (!activity?.route_geojson?.coordinates?.length) {
      return null;
    }

    const coords = activity.route_geojson.coordinates;
    
    let minLat = coords[0][1];
    let maxLat = coords[0][1];
    let minLng = coords[0][0];
    let maxLng = coords[0][0];

    coords.forEach(([lng, lat]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.3 || 0.01;
    const lngDelta = (maxLng - minLng) * 1.3 || 0.01;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.005),
      longitudeDelta: Math.max(lngDelta, 0.005),
    };
  };

  // Converts GeoJSON coordinates to map format
  const getRouteCoordinates = () => {
    if (!activity?.route_geojson?.coordinates) return [];
    
    return activity.route_geojson.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
  };

  const mapRegion = activity ? getMapRegion() : null;
  const routeCoordinates = activity ? getRouteCoordinates() : [];

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
          <Text style={styles.headerTitle}>Activity</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#d9e3d0" />
        </View>
      ) : error || !activity ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#8a8d6a" />
          <Text style={styles.errorText}>{error || 'Activity not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchActivity}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#d9e3d0"
            />
          }
        >

          <TouchableOpacity
            style={styles.userSection}
            onPress={navigateToUserProfile}
            activeOpacity={0.7}
          >
            <View style={styles.userAvatar}>
              <Ionicons name="person" size={24} color="#8a8d6a" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{activity.user_username}</Text>
              <Text style={styles.activityDate}>
                {formatDate(activity.started_at)} at {formatTime(activity.started_at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>

          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Ionicons
                name={getActivityIcon(activity.activity_type)}
                size={28}
                color="#d9e3d0"
              />
              <Text style={styles.activityTitle}>{activity.title}</Text>
            </View>
            {activity.description ? (
              <Text style={styles.activityDescription}>{activity.description}</Text>
            ) : null}
          </View>

          {mapRegion && routeCoordinates.length > 0 && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#d9e3d0"
                  strokeWidth={4}
                />
              </MapView>
            </View>
          )}

          <View style={styles.mainStatsContainer}>
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>
                {activity.distance_km.toFixed(2)}
              </Text>
              <Text style={styles.mainStatLabel}>Kilometers</Text>
            </View>
            <View style={styles.mainStatDivider} />
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>
                {activity.duration_formatted}
              </Text>
              <Text style={styles.mainStatLabel}>Duration</Text>
            </View>
            <View style={styles.mainStatDivider} />
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>
                {activity.pace_formatted}
              </Text>
              <Text style={styles.mainStatLabel}>Avg Pace</Text>
            </View>
          </View>

          <View style={styles.secondaryStatsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.secondaryStat}>
                <Ionicons name="speedometer-outline" size={20} color="#8a8d6a" />
                <View style={styles.secondaryStatInfo}>
                  <Text style={styles.secondaryStatValue}>
                    {activity.average_speed?.toFixed(1) || '--'} km/h
                  </Text>
                  <Text style={styles.secondaryStatLabel}>Avg Speed</Text>
                </View>
              </View>
              <View style={styles.secondaryStat}>
                <Ionicons name="flash-outline" size={20} color="#8a8d6a" />
                <View style={styles.secondaryStatInfo}>
                  <Text style={styles.secondaryStatValue}>
                    {activity.max_speed?.toFixed(1) || '--'} km/h
                  </Text>
                  <Text style={styles.secondaryStatLabel}>Max Speed</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.secondaryStat}>
                <Ionicons name="trending-up-outline" size={20} color="#8a8d6a" />
                <View style={styles.secondaryStatInfo}>
                  <Text style={styles.secondaryStatValue}>
                    {activity.elevation_gain?.toFixed(0) || '--'} m
                  </Text>
                  <Text style={styles.secondaryStatLabel}>Elevation Gain</Text>
                </View>
              </View>
              <View style={styles.secondaryStat}>
                <Ionicons name="trending-down-outline" size={20} color="#8a8d6a" />
                <View style={styles.secondaryStatInfo}>
                  <Text style={styles.secondaryStatValue}>
                    {activity.elevation_loss?.toFixed(0) || '--'} m
                  </Text>
                  <Text style={styles.secondaryStatLabel}>Elevation Loss</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.secondaryStat}>
                <Ionicons name="flame-outline" size={20} color="#8a8d6a" />
                <View style={styles.secondaryStatInfo}>
                  <Text style={styles.secondaryStatValue}>
                    {activity.calories_burned?.toFixed(0) || '--'} kcal
                  </Text>
                  <Text style={styles.secondaryStatLabel}>Calories</Text>
                </View>
              </View>
              <View style={styles.secondaryStat}>
                <Ionicons name="time-outline" size={20} color="#8a8d6a" />
                <View style={styles.secondaryStatInfo}>
                  <Text style={styles.secondaryStatValue}>
                    {activity.total_elapsed_time || '--'}
                  </Text>
                  <Text style={styles.secondaryStatLabel}>Elapsed Time</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.visibilitySection}>
            <Ionicons
              name={
                activity.visibility === 'public'
                  ? 'globe-outline'
                  : activity.visibility === 'followers'
                  ? 'people-outline'
                  : 'lock-closed-outline'
              }
              size={16}
              color="#8a8d6a"
            />
            <Text style={styles.visibilityText}>
              {activity.visibility === 'public'
                ? 'Public'
                : activity.visibility === 'followers'
                ? 'Followers Only'
                : 'Private'}
            </Text>
          </View>

          {activity.user_username !== 'YOUR_USERNAME' && (
            <View style={styles.likeSection}>
              <TouchableOpacity
                style={styles.likeButton}
                onPress={handleLikePress}
                disabled={likeLoading}
                activeOpacity={0.7}
              >
                {likeLoading ? (
                  <ActivityIndicator size="small" color="#d9e3d0" />
                ) : (
                  <>
                    <Ionicons 
                      name={isLiked ? 'heart' : 'heart-outline'} 
                      size={24} 
                      color={isLiked ? '#e74c3c' : '#d9e3d0'} 
                    />
                    <Text style={[styles.likeButtonText, isLiked && styles.likeButtonTextActive]}>
                      {isLiked ? 'Liked' : 'Like'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.likesCountText}>
                {likesCount} {likesCount === 1 ? 'like' : 'likes'}
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  placeholder: {
    width: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
  },
  // User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  activityDate: {
    fontSize: 13,
    color: '#8a8d6a',
    marginTop: 2,
  },
  // Title Section
  titleSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
    flex: 1,
  },
  activityDescription: {
    fontSize: 15,
    color: '#b8c4a8',
    marginTop: 10,
    lineHeight: 22,
  },
  // Map
  mapContainer: {
    height: 200,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  // Main Stats
  mainStatsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 20,
  },
  mainStat: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  mainStatLabel: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 4,
  },
  mainStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  // Secondary Stats
  secondaryStatsContainer: {
    margin: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  secondaryStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryStatInfo: {
    marginLeft: 10,
  },
  secondaryStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  secondaryStatLabel: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 2,
  },
  // Visibility
  visibilitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  visibilityText: {
    fontSize: 13,
    color: '#8a8d6a',
    marginLeft: 6,
  },
  // Error States
  errorText: {
    fontSize: 16,
    color: '#8a8d6a',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  retryText: {
    color: '#d9e3d0',
    fontWeight: '600',
  },
    // Like Section
  likeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    marginTop: 16,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  likeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 8,
  },
  likeButtonTextActive: {
    color: '#e74c3c',
  },
  likesCountText: {
    fontSize: 14,
    color: '#8a8d6a',
    marginLeft: 16,
  },
});