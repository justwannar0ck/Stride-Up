import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useActivity } from '../context/ActivityContext';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

type ActivityType = 'run' | 'walk' | 'cycle' | 'hike';

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  elevation?: number | null;
  accuracy?: number | null;
  speed?: number | null;
}

const activityIcons: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
  run: 'walk',
  walk: 'footsteps',
  cycle: 'bicycle',
  hike: 'trail-sign',
};

export default function TrackScreen() {
  const router = useRouter();
  const {
    activityId,
    activityType,
    status,
    activeTime,
    distance,
    averagePace,
    currentSpeed,
    elevation,
    setActivityType,
    startActivity,
    pauseActivity,
    resumeActivity,
    stopActivity,
    discardActivity,
    addGPSPoint,
    updateDistance,
    updateElevation,
    updateSpeed,
    resetActivity,
  } = useActivity();

  const [mapRef, setMapRef] = useState<MapView | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<GPSPoint[]>([]);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [trackedDistance, setTrackedDistance] = useState(0);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const lastLocationRef = React.useRef<GPSPoint | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionStatus('granted');
        getCurrentLocation();
      } else {
        setPermissionStatus('denied');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionStatus('denied');
    } finally {
      setPermissionChecked(true);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status:  foregroundStatus } = await Location. requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        setPermissionStatus('denied');
        Alert.alert(
          'Location Permission Required',
          'StrideUp needs location access to track your activities.  Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress:  () => Linking.openSettings() 
            },
          ]
        );
        return false;
      }

      if (Platform.OS === 'ios') {
        const { status:  backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          Alert.alert(
            'Background Location',
            'For best tracking accuracy when your screen is locked, please enable "Always" location access in Settings.',
            [{ text: 'OK' }]
          );
        }
      } else {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          Alert.alert(
            'Background Location',
            'For best tracking accuracy, please enable "Allow all the time" location access in Settings.',
            [{ text: 'OK' }]
          );
        }
      }

      setPermissionStatus('granted');
      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      Alert.alert('Error', 'Failed to request location permissions.  Please try again.');
      return false;
    }
  };

  // Gets current location (initial)
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy. Balanced,
      });
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  // Calculates distance between two points
  const calculateDistanceBetweenPoints = (point1: GPSPoint, point2: GPSPoint): number => {
    const R = 6371e3;
    const lat1 = (point1.latitude * Math.PI) / 180;
    const lat2 = (point2.latitude * Math.PI) / 180;
    const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math. sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Processes new location
  const processLocation = useCallback(
    (location: Location.LocationObject) => {
      const newPoint: GPSPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords. longitude,
        timestamp: new Date(location.timestamp).toISOString(),
        elevation:  location.coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
      };

      // Filters inaccurate points
      if (newPoint.accuracy && newPoint.accuracy > 50) {
        return;
      }

      setCurrentLocation(location);
      setRouteCoordinates((prev) => [...prev, newPoint]);

      // Calculates distance
      if (lastLocationRef.current) {
        const segmentDistance = calculateDistanceBetweenPoints(lastLocationRef.current, newPoint);
        if (segmentDistance > 2 && segmentDistance < 100) {
          setTrackedDistance((prev) => prev + segmentDistance);
        }
      }

      lastLocationRef.current = newPoint;

      // Updates activity context
      addGPSPoint(newPoint);
      updateSpeed(location.coords.speed || 0);
      if (location.coords.altitude !== null) {
        updateElevation(location.coords.altitude);
      }
    },
    [addGPSPoint, updateSpeed, updateElevation]
  );

  // Starts location tracking
  const startLocationTracking = async () => {
    try {
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location. Accuracy.BestForNavigation,
      });
      processLocation(initialLocation);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval:  5,
        },
        processLocation
      );

      setLocationSubscription(subscription);
    } catch (error) {
      console.error('Location tracking error:', error);
      Alert.alert('Error', 'Failed to start location tracking. Please try again.');
    }
  };

  // Stops location tracking
  const stopLocationTracking = () => {
    if (locationSubscription) {
      locationSubscription. remove();
      setLocationSubscription(null);
    }
  };

  // Updates distance in context
  useEffect(() => {
    if (status === 'recording') {
      updateDistance(trackedDistance);
    }
  }, [trackedDistance, status, updateDistance]);

  // Keeps screen awake during recording
  useEffect(() => {
    if (status === 'recording' || status === 'paused') {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }

    return () => {
      deactivateKeepAwake();
    };
  }, [status]);

  // Centers the map on current location
  useEffect(() => {
    if (currentLocation && mapRef) {
      mapRef.animateToRegion({
        latitude: currentLocation.coords. latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta:  LONGITUDE_DELTA,
      });
    }
  }, [currentLocation, mapRef]);

  // Formats time display
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Formats pace display
  const formatPace = (secondsPerKm: number): string => {
    if (secondsPerKm === 0 || ! isFinite(secondsPerKm)) return '--:--';
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handles activity type selection
  const handleActivityTypeSelect = (type: ActivityType) => {
    if (status === 'idle') {
      setActivityType(type);
    }
  };

  // Handles start
  const handleStart = async () => {
    if (permissionStatus !== 'granted') {
      const granted = await requestPermissions();
      if (!granted) return;
    }

    const success = await startActivity();
    if (success) {
      setRouteCoordinates([]);
      setTrackedDistance(0);
      lastLocationRef.current = null;
      startLocationTracking();
    }
  };

  // Handles pause
  const handlePause = async () => {
    stopLocationTracking();
    await pauseActivity();
  };

  // Handles resume
  const handleResume = async () => {
    await resumeActivity();
    startLocationTracking();
  };

  // Handles stop
  const handleStop = () => {
    Alert.alert(
      'Finish Activity',
      'Do you want to save this activity?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            stopLocationTracking();
            await discardActivity();
            resetActivity();
            setRouteCoordinates([]);
            setTrackedDistance(0);
          },
        },
        {
          text: 'Continue',
          style: 'cancel',
        },
        {
          text: 'Save',
          onPress: async () => {
            stopLocationTracking();
            const activity = await stopActivity();
            if (activity) {
              router.push({
                pathname: '/activity-summary',
                params: { activityId: activity.id. toString() },
              });
            }
          },
        },
      ]
    );
  };

  // Gets map coordinates for polyline
  const getMapCoordinates = () => {
    return routeCoordinates.map((point) => ({
      latitude:  point.latitude,
      longitude: point.longitude,
    }));
  };

  const mapCoordinates = getMapCoordinates();

  // Renders permission request screen
  if (permissionChecked && permissionStatus === 'denied' && status === 'idle') {
    return (
      <View style={styles.container}>
        <View style={styles.pageHeader}>
          <Ionicons name="navigate-outline" size={20} color="#d9e3d0" />
          <Text style={styles.pageTitle}>Track</Text>
        </View>

        <View style={styles.permissionContainer}>
          <Ionicons name="location-outline" size={64} color="#8a8d6a" />
          <Text style={styles.permissionTitle}>Location Access Required</Text>
          <Text style={styles.permissionText}>
            StrideUp needs access to your location to track your activities and show your routes on the map. 
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
            <Ionicons name="location" size={20} color="#4a4d2e" />
            <Text style={styles.permissionButtonText}>Enable Location</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingsButton} 
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Ionicons name="navigate-outline" size={20} color="#d9e3d0" />
        <Text style={styles. pageTitle}>
          {status === 'idle' ? 'Track' : status === 'paused' ? 'Paused' : 'Recording'}
        </Text>
        {status !== 'idle' && (
          <View style={styles.recordingIndicator}>
            <View
              style={[
                styles. recordingDot,
                status === 'recording' && styles.recordingDotActive,
              ]}
            />
          </View>
        )}
      </View>

      {status === 'idle' && (
        <View style={styles. activityTypes}>
          {(['run', 'walk', 'cycle', 'hike'] as ActivityType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles. activityType,
                activityType === type && styles.activityTypeActive,
              ]}
              onPress={() => handleActivityTypeSelect(type)}
            >
              <Ionicons
                name={activityIcons[type]}
                size={28}
                color={activityType === type ? '#d9e3d0' : '#8a8d6a'}
              />
              <Text
                style={[
                  styles.activityTypeText,
                  activityType === type && styles.activityTypeTextActive,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={(ref) => setMapRef(ref)}
          style={styles.map}
          initialRegion={{
            latitude: currentLocation?.coords. latitude || 27.7172,
            longitude: currentLocation?. coords.longitude || 85.3240,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          followsUserLocation={status === 'recording'}
        >
          {mapCoordinates.length > 1 && (
            <Polyline coordinates={mapCoordinates} strokeColor="#4CAF50" strokeWidth={4} />
          )}
          {mapCoordinates.length > 0 && (
            <Marker coordinate={mapCoordinates[0]} title="Start" pinColor="green" />
          )}
        </MapView>

        {currentLocation && (
          <TouchableOpacity
            style={styles.centerButton}
            onPress={() => {
              mapRef?.animateToRegion({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
              });
            }}
          >
            <Ionicons name="locate" size={24} color="#d9e3d0" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{(distance / 1000).toFixed(2)}</Text>
          <Text style={styles.mainStatUnit}>km</Text>
        </View>

        <View style={styles.secondaryStats}>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryStatValue}>{formatTime(activeTime)}</Text>
            <Text style={styles.secondaryStatLabel}>Duration</Text>
          </View>
          <View style={styles. statDivider} />
          <View style={styles.secondaryStat}>
            <Text style={styles. secondaryStatValue}>{formatPace(averagePace)}</Text>
            <Text style={styles.secondaryStatLabel}>Pace /km</Text>
          </View>
        </View>

        {status !== 'idle' && (
          <View style={styles.additionalStats}>
            <View style={styles.additionalStat}>
              <Ionicons name="speedometer-outline" size={16} color="#8a8d6a" />
              <Text style={styles.additionalStatValue}>
                {(currentSpeed * 3.6).toFixed(1)} km/h
              </Text>
            </View>
            {elevation !== null && (
              <View style={styles.additionalStat}>
                <Ionicons name="trending-up" size={16} color="#8a8d6a" />
                <Text style={styles.additionalStatValue}>{Math.round(elevation)} m</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        {status === 'idle' ?  (
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Ionicons name="play" size={32} color="#4a4d2e" />
            <Text style={styles.startButtonText}>START</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
              <Ionicons name="stop" size={28} color="#fff" />
            </TouchableOpacity>

            {status === 'recording' ?  (
              <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
                <Ionicons name="pause" size={36} color="#4a4d2e" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.resumeButton} onPress={handleResume}>
                <Ionicons name="play" size={36} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles. lockButton}>
              <Ionicons name="lock-open-outline" size={28} color="#d9e3d0" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {status === 'paused' && (
        <View style={styles.pausedBanner}>
          <Ionicons name="pause-circle" size={20} color="#f39c12" />
          <Text style={styles.pausedText}>Activity Paused</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems:  'center',
    padding: 16,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
  },
  recordingIndicator: {
    marginLeft: 'auto',
  },
  recordingDot:  {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8a8d6a',
  },
  recordingDotActive: {
    backgroundColor: '#e74c3c',
  },
  // Permission styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionText:  {
    fontSize: 14,
    color: '#b8c4a8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  permissionButton: {
    flexDirection:  'row',
    alignItems: 'center',
    backgroundColor: '#d9e3d0',
    paddingHorizontal: 32,
    paddingVertical:  14,
    borderRadius: 30,
    marginTop: 32,
  },
  permissionButtonText: {
    color:  '#4a4d2e',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft:  8,
  },
  settingsButton: {
    marginTop: 16,
    padding: 12,
  },
  settingsButtonText:  {
    color: '#b8c4a8',
    fontSize: 14,
  },
  // Activity types
  activityTypes: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  activityType: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical:  12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activityTypeActive:  {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  activityTypeText: {
    color:  '#8a8d6a',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  activityTypeTextActive: {
    color: '#d9e3d0',
  },
  // Map
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  centerButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  // Stats
  statsContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    flex: 1,
  },
  mainStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  mainStatValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  mainStatUnit:  {
    fontSize: 24,
    color: '#b8c4a8',
    marginLeft: 8,
  },
  secondaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryStat: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statDivider: {
    width: 1,
    height:  40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  secondaryStatValue: {
    fontSize:  28,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  secondaryStatLabel: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 4,
  },
  additionalStats: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  additionalStat:  {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  additionalStatValue:  {
    color: '#b8c4a8',
    fontSize: 14,
    marginLeft: 6,
  },
  // Controls
  controlsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    alignItems: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d9e3d0',
    paddingHorizontal: 48,
    paddingVertical:  16,
    borderRadius:  50,
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a4d2e',
    marginLeft: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  pauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d9e3d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeButton: {
    width:  80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems:  'center',
    marginHorizontal: 16,
  },
  pausedBanner: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedText: {
    color: '#f39c12',
    fontSize:  14,
    fontWeight: '600',
    marginLeft: 8,
  },
});