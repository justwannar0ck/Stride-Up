import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useActivity } from './context/ActivityContext';
import api from './api';

interface Activity {
  id: number;
  title: string;
  description: string;
  activity_type: string;
  status: string;
  distance: number;
  distance_km: number;
  duration_formatted: string;
  pace_formatted: string;
  average_speed: number;
  elevation_gain: number;
  elevation_loss: number;
  calories_burned: number;
  started_at: string;
  finished_at: string;
  visibility: 'public' | 'followers' | 'private';
  hide_start_end: boolean;
  route_geojson: {
    type: string;
    coordinates: number[][];
  } | null;
}

export default function ActivitySummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { resetActivity } = useActivity();
  const activityId = Number(params.activityId);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [hideStartEnd, setHideStartEnd] = useState(false);

  useEffect(() => {
    if (activityId) {
      loadActivity();
    }
  }, [activityId]);

  const loadActivity = async () => {
    try {
      const response = await api.get(`/api/v1/activities/${activityId}/`);
      const data = response.data;
      setActivity(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setVisibility(data.visibility || 'public');
      setHideStartEnd(data.hide_start_end || false);
    } catch (error) {
      console.error('Failed to load activity:', error);
      Alert.alert('Error', 'Failed to load activity details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activity) return;

    setIsSaving(true);
    try {
      await api.patch(`/api/v1/activities/${activity.id}/`, {
        title,
        description,
        visibility,
        hide_start_end: hideStartEnd,
      });

      Alert.alert('Saved!', 'Your activity has been updated.', [
        {
          text: 'OK',
          onPress: () => {
            resetActivity();
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to save activity:', error);
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!activity) return;

    try {
      const message =
        `🏃 Just completed a ${activity.activity_type}!\n\n` +
        `📏 Distance: ${activity.distance_km} km\n` +
        `⏱️ Duration: ${activity.duration_formatted}\n` +
        `⚡ Pace: ${activity.pace_formatted} /km\n\n` +
        `#StrideUp #Fitness`;

      await Share.share({
        message,
        title: activity.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/v1/activities/${activityId}/`);
              resetActivity();
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete activity.');
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    resetActivity();
    router.replace('/(tabs)');
  };

  const getRouteCoordinates = () => {
    if (!activity?.route_geojson?.coordinates) return [];
    return activity.route_geojson.coordinates.map((coord) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));
  };

  const getMapRegion = () => {
    const coords = getRouteCoordinates();
    if (coords.length === 0) {
      return {
        latitude: 27.7172,
        longitude: 85.324,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    let minLat = coords[0].latitude;
    let maxLat = coords[0].latitude;
    let minLon = coords[0].longitude;
    let maxLon = coords[0].longitude;

    coords.forEach((coord) => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLon = Math.min(minLon, coord.longitude);
      maxLon = Math.max(maxLon, coord.longitude);
    });

    const padding = 0.002;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(maxLat - minLat + padding, 0.005),
      longitudeDelta: Math.max(maxLon - minLon + padding, 0.005),
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d9e3d0" />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#e74c3c" />
        <Text style={styles.errorText}>Activity not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const routeCoordinates = getRouteCoordinates();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#d9e3d0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Summary</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#d9e3d0" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={getMapRegion()}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            {routeCoordinates.length > 0 && (
              <>
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#4CAF50"
                  strokeWidth={4}
                />
                <Marker coordinate={routeCoordinates[0]} title="Start">
                  <View style={styles.markerStart}>
                    <Ionicons name="flag" size={16} color="#fff" />
                  </View>
                </Marker>
                <Marker
                  coordinate={routeCoordinates[routeCoordinates.length - 1]}
                  title="Finish"
                >
                  <View style={styles.markerEnd}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                </Marker>
              </>
            )}
          </MapView>

          <View style={styles.activityBadge}>
            <Ionicons
              name={
                activity.activity_type === 'run'
                  ? 'walk'
                  : activity.activity_type === 'cycle'
                  ? 'bicycle'
                  : activity.activity_type === 'hike'
                  ? 'trail-sign'
                  : 'footsteps'
              }
              size={16}
              color="#d9e3d0"
            />
            <Text style={styles.activityBadgeText}>
              {activity.activity_type.charAt(0).toUpperCase() +
                activity.activity_type.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activity.distance_km}</Text>
            <Text style={styles.statLabel}>Kilometers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activity.duration_formatted}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activity.pace_formatted}</Text>
            <Text style={styles.statLabel}>Avg Pace /km</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {activity.average_speed ? activity.average_speed.toFixed(1) : '0'}
            </Text>
            <Text style={styles.statLabel}>Avg Speed km/h</Text>
          </View>
          {activity.elevation_gain > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.round(activity.elevation_gain)}
              </Text>
              <Text style={styles.statLabel}>Elevation Gain m</Text>
            </View>
          )}
          {activity.calories_burned > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.round(activity.calories_burned)}
              </Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
          )}
        </View>

        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={18} color="#8a8d6a" />
          <Text style={styles.dateText}>{formatDate(activity.started_at)}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Give your activity a name"
            placeholderTextColor="#8a8d6a"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="How did it go?"
            placeholderTextColor="#8a8d6a"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Visibility</Text>
          <View style={styles.visibilityOptions}>
            {(['public', 'followers', 'private'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.visibilityOption,
                  visibility === option && styles.visibilityOptionActive,
                ]}
                onPress={() => setVisibility(option)}
              >
                <Ionicons
                  name={
                    option === 'public'
                      ? 'globe-outline'
                      : option === 'followers'
                      ? 'people-outline'
                      : 'lock-closed-outline'
                  }
                  size={18}
                  color={visibility === option ? '#d9e3d0' : '#8a8d6a'}
                />
                <Text
                  style={[
                    styles.visibilityText,
                    visibility === option && styles.visibilityTextActive,
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.privacyToggle}
          onPress={() => setHideStartEnd(!hideStartEnd)}
        >
          <View style={styles.privacyToggleLeft}>
            <Ionicons name="eye-off-outline" size={22} color="#d9e3d0" />
            <View style={styles.privacyToggleText}>
              <Text style={styles.privacyToggleTitle}>Hide Start/End Points</Text>
              <Text style={styles.privacyToggleSubtitle}>
                Masks your location for privacy
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.toggleSwitch,
              hideStartEnd && styles.toggleSwitchActive,
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                hideStartEnd && styles.toggleKnobActive,
              ]}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#4a4d2e" />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color="#4a4d2e" />
                <Text style={styles.saveButtonText}>Save Activity</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },
  loadingText: {
    color: '#d9e3d0',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
    padding: 20,
  },
  errorText: {
    color: '#d9e3d0',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#d9e3d0',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#4a4d2e',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  shareButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    flex: 1,
  },
  markerStart: {
    backgroundColor: '#4CAF50',
    padding: 6,
    borderRadius: 12,
  },
  markerEnd: {
    backgroundColor: '#e74c3c',
    padding: 6,
    borderRadius: 12,
  },
  activityBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activityBadgeText: {
    color: '#d9e3d0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  statItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  statLabel: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 4,
    textAlign: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateText: {
    color: '#b8c4a8',
    fontSize: 14,
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#d9e3d0',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  visibilityOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  visibilityOptionActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  visibilityText: {
    color: '#8a8d6a',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  visibilityTextActive: {
    color: '#d9e3d0',
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  privacyToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privacyToggleText: {
    marginLeft: 12,
  },
  privacyToggleTitle: {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: '600',
  },
  privacyToggleSubtitle: {
    color: '#8a8d6a',
    fontSize: 12,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#4CAF50',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d9e3d0',
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  actionButtons: {
    marginBottom: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9e3d0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#4a4d2e',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    padding: 14,
    borderRadius: 12,
  },
  deleteButtonText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
});