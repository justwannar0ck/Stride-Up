import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../api';

const { width } = Dimensions.get('window');

interface Activity {
  id: number;
  title: string;
  activity_type: string;
  distance_km: number;
  duration_formatted: string;
  pace_formatted: string;
  started_at: string;
  route_geojson: {
    type: string;
    coordinates: number[][];
  } | null;
}

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export default function MapScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapRef, setMapRef] = useState<MapView | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [])
  );

  const loadActivities = async () => {
    try {
      const response = await api.get('/api/v1/activities/');
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      setActivities(data);
      
      if (data.length > 0) {
        loadActivityDetails(data[0]. id);
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivityDetails = async (activityId: number) => {
    try {
      const response = await api.get(`/api/v1/activities/${activityId}/`);
      setSelectedActivity(response.data);
      
      if (response.data.route_geojson?. coordinates?. length > 0 && mapRef) {
        const coords = response.data.route_geojson.coordinates;
        const firstCoord = coords[0];
        mapRef.animateToRegion({
          latitude: firstCoord[1],
          longitude: firstCoord[0],
          latitudeDelta:  0.02,
          longitudeDelta: 0.02,
        });
      }
    } catch (error) {
      console.error('Failed to load activity details:', error);
    }
  };

  const getRouteCoordinates = (activity: Activity): RouteCoordinate[] => {
    if (!activity?. route_geojson?. coordinates) return [];
    return activity.route_geojson. coordinates. map((coord) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'run':  return '#4CAF50';
      case 'cycle': return '#2196F3';
      case 'hike': return '#FF9800';
      case 'walk': return '#9C27B0';
      default: return '#4CAF50';
    }
  };

  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'run': return 'walk';
      case 'cycle': return 'bicycle';
      case 'hike': return 'trail-sign';
      case 'walk':  return 'footsteps';
      default: return 'fitness';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderActivityItem = ({ item }: { item:  Activity }) => {
    const isSelected = selectedActivity?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.activityItem, isSelected && styles.activityItemSelected]}
        onPress={() => loadActivityDetails(item.id)}
      >
        <View
          style={[
            styles. activityIconContainer,
            { backgroundColor: getActivityColor(item. activity_type) + '30' },
          ]}
        >
          <Ionicons
            name={getActivityIcon(item.activity_type)}
            size={20}
            color={getActivityColor(item.activity_type)}
          />
        </View>
        <View style={styles.activityItemInfo}>
          <Text style={styles.activityItemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.activityItemDate}>{formatDate(item.started_at)}</Text>
        </View>
        <View style={styles.activityItemStats}>
          <Text style={styles.activityItemDistance}>{item.distance_km} km</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

  const routeCoordinates = selectedActivity
    ? getRouteCoordinates(selectedActivity)
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Ionicons name="map-outline" size={20} color="#d9e3d0" />
        <Text style={styles.pageTitle}>My Routes</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons
              name="map"
              size={18}
              color={viewMode === 'map' ?  '#4a4d2e' : '#8a8d6a'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list"
              size={18}
              color={viewMode === 'list' ? '#4a4d2e' : '#8a8d6a'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {activities.length === 0 ? (
        <View style={styles. emptyState}>
          <Ionicons name="map" size={64} color="#8a8d6a" />
          <Text style={styles.emptyText}>No routes yet</Text>
          <Text style={styles.emptySubtext}>
            Complete an activity to see your routes here
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push('/(tabs)/track')}
          >
            <Ionicons name="play" size={20} color="#4a4d2e" />
            <Text style={styles.startButtonText}>Start Activity</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'map' ? (
        <>
          {/* Map View */}
          <View style={styles.mapContainer}>
            <MapView
              ref={(ref) => setMapRef(ref)}
              style={styles.map}
              initialRegion={{
                latitude: routeCoordinates[0]?. latitude || 27.7172,
                longitude: routeCoordinates[0]?.longitude || 85.3240,
                latitudeDelta:  0.02,
                longitudeDelta: 0.02,
              }}
            >
              {routeCoordinates.length > 0 && (
                <>
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor={getActivityColor(selectedActivity?.activity_type || 'run')}
                    strokeWidth={4}
                  />
                  <Marker coordinate={routeCoordinates[0]} title="Start">
                    <View style={styles.markerStart}>
                      <Ionicons name="flag" size={14} color="#fff" />
                    </View>
                  </Marker>
                  <Marker
                    coordinate={routeCoordinates[routeCoordinates. length - 1]}
                    title="End"
                  >
                    <View style={styles.markerEnd}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  </Marker>
                </>
              )}
            </MapView>

            {/* Selected Activity Info */}
            {selectedActivity && (
              <TouchableOpacity
                style={styles.selectedActivityCard}
                onPress={() =>
                  router.push({
                    pathname: '../activity-summary',
                    params: { activityId: selectedActivity.id. toString() },
                  })
                }
              >
                <View style={styles.selectedActivityHeader}>
                  <Ionicons
                    name={getActivityIcon(selectedActivity.activity_type)}
                    size={20}
                    color="#d9e3d0"
                  />
                  <Text style={styles.selectedActivityTitle}>
                    {selectedActivity.title}
                  </Text>
                </View>
                <View style={styles.selectedActivityStats}>
                  <Text style={styles.selectedActivityStat}>
                    {selectedActivity.distance_km} km
                  </Text>
                  <Text style={styles.selectedActivityStatDivider}>•</Text>
                  <Text style={styles.selectedActivityStat}>
                    {selectedActivity. duration_formatted}
                  </Text>
                  <Text style={styles.selectedActivityStatDivider}>•</Text>
                  <Text style={styles.selectedActivityStat}>
                    {selectedActivity.pace_formatted} /km
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Activity List (horizontal) */}
          <View style={styles.activityListContainer}>
            <FlatList
              data={activities}
              renderItem={renderActivityItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activityListContent}
            />
          </View>
        </>
      ) : (
        /* List View */
        <FlatList
          data={activities}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() =>
                router.push({
                  pathname: '../activity-summary',
                  params: { activityId: item.id.toString() },
                })
              }
            >
              <View
                style={[
                  styles.listItemIcon,
                  { backgroundColor: getActivityColor(item.activity_type) + '30' },
                ]}
              >
                <Ionicons
                  name={getActivityIcon(item.activity_type)}
                  size={24}
                  color={getActivityColor(item.activity_type)}
                />
              </View>
              <View style={styles. listItemInfo}>
                <Text style={styles.listItemTitle}>{item.title}</Text>
                <Text style={styles.listItemDate}>{formatDate(item.started_at)}</Text>
              </View>
              <View style={styles.listItemStats}>
                <Text style={styles.listItemDistance}>{item. distance_km} km</Text>
                <Text style={styles.listItemDuration}>{item.duration_formatted}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet. create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
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
    padding: 16,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
    flex: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical:  6,
    borderRadius:  6,
  },
  toggleButtonActive: {
    backgroundColor: '#d9e3d0',
  },
  emptyState: {
    flex:  1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#d9e3d0',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize:  14,
    color: '#8a8d6a',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems:  'center',
    backgroundColor:  '#d9e3d0',
    paddingHorizontal:  24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startButtonText: {
    color: '#4a4d2e',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  map:  {
    flex: 1,
  },
  markerStart: {
    backgroundColor: '#4CAF50',
    padding: 6,
    borderRadius: 12,
  },
  markerEnd: {
    backgroundColor: '#e74c3c',
    padding:  6,
    borderRadius:  12,
  },
  selectedActivityCard: {
    position: 'absolute',
    bottom: 16,
    left:  16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 16,
  },
  selectedActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedActivityTitle: {
    color: '#d9e3d0',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  selectedActivityStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedActivityStat:  {
    color: '#b8c4a8',
    fontSize: 14,
  },
  selectedActivityStatDivider: {
    color: '#8a8d6a',
    marginHorizontal: 8,
  },
  activityListContainer: {
    paddingBottom: 90,
  },
  activityListContent: {
    paddingHorizontal: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems:  'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: width * 0.6,
  },
  activityItemSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityItemInfo:  {
    flex: 1,
    marginLeft: 12,
  },
  activityItemTitle: {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: '600',
  },
  activityItemDate: {
    color:  '#8a8d6a',
    fontSize: 12,
    marginTop: 2,
  },
  activityItemStats: {
    alignItems: 'flex-end',
  },
  activityItemDistance: {
    color: '#d9e3d0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  listItem: {
    flexDirection: 'row',
    alignItems:  'center',
    backgroundColor:  'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  listItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listItemTitle: {
    color: '#d9e3d0',
    fontSize:  16,
    fontWeight:  '600',
  },
  listItemDate: {
    color: '#8a8d6a',
    fontSize: 12,
    marginTop: 4,
  },
  listItemStats: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  listItemDistance: {
    color: '#d9e3d0',
    fontSize: 18,
    fontWeight: 'bold',
  },
  listItemDuration: {
    color: '#8a8d6a',
    fontSize: 12,
    marginTop: 2,
  },
});