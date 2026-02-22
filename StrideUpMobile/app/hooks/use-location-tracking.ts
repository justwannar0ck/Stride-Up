import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { GPSPoint } from '../services/activityService';

const LOCATION_TASK_NAME = 'background-location-task';
const LOCATION_INTERVAL = 3000; // 3 seconds
const LOCATION_DISTANCE_FILTER = 5; // 5 meters minimum movement

// Stores for background task data
let backgroundPoints: GPSPoint[] = [];

// Defines the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    locations.forEach((location: Location.LocationObject) => {
      const point: GPSPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords. longitude,
        timestamp: new Date(location.timestamp).toISOString(),
        elevation: location. coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
      };
      backgroundPoints.push(point);
    });
  }
});

interface UseLocationTrackingProps {
  onLocationUpdate?: (point: GPSPoint) => void;
  isTracking:  boolean;
}

interface LocationTrackingState {
  currentLocation: Location.LocationObject | null;
  routeCoordinates: GPSPoint[];
  distance: number;
  currentSpeed: number;
  currentElevation: number | null;
  error: string | null;
}

export function useLocationTracking({ onLocationUpdate, isTracking }:  UseLocationTrackingProps) {
  const [state, setState] = useState<LocationTrackingState>({
    currentLocation: null,
    routeCoordinates: [],
    distance: 0,
    currentSpeed: 0,
    currentElevation:  null,
    error: null,
  });
  
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'pending'>('pending');
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const appState = useRef(AppState.currentState);
  const lastLocation = useRef<GPSPoint | null>(null);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    try {
      const { status:  foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setPermissionStatus('denied');
        setState(prev => ({ ...prev, error: 'Location permission denied' }));
        return false;
      }

      // Request background permission for when screen is locked
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Background Location',
          'Background location access is recommended for accurate tracking when your screen is locked.',
          [{ text: 'OK' }]
        );
      }

      setPermissionStatus('granted');
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      setState(prev => ({ ...prev, error: 'Failed to get location permissions' }));
      return false;
    }
  }, []);

  // Calculates distance between two points using Haversine formula
  const calculateDistance = useCallback((point1: GPSPoint, point2: GPSPoint): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }, []);

  // Processes a new location
  const processLocation = useCallback((location: Location.LocationObject) => {
    const newPoint: GPSPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date(location.timestamp).toISOString(),
      elevation: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
    };

    // Filters out inaccurate points
    if (newPoint.accuracy && newPoint.accuracy > 50) {
      console.log('Skipping inaccurate point:', newPoint. accuracy);
      return;
    }

    setState(prev => {
      let newDistance = prev.distance;
      
      // Calculates distance from last point
      if (lastLocation.current) {
        const segmentDistance = calculateDistance(lastLocation.current, newPoint);
        // Only adds distance if movement is significant (reduces GPS drift noise)
        if (segmentDistance > 2 && segmentDistance < 100) { // Between 2m and 100m
          newDistance += segmentDistance;
        }
      }
      
      lastLocation.current = newPoint;

      return {
        ...prev,
        currentLocation: location,
        routeCoordinates: [...prev. routeCoordinates, newPoint],
        distance: newDistance,
        currentSpeed: location.coords.speed || 0,
        currentElevation: location.coords.altitude,
      };
    });

    // Callback for parent component
    if (onLocationUpdate) {
      onLocationUpdate(newPoint);
    }
  }, [calculateDistance, onLocationUpdate]);

  // Starts tracking
  const startTracking = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return false;

    try {
      // Gets initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      processLocation(initialLocation);

      // Starts foreground tracking
      locationSubscription.current = await Location. watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval:  LOCATION_INTERVAL,
          distanceInterval:  LOCATION_DISTANCE_FILTER,
        },
        processLocation
      );

      // Starts background tracking
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: LOCATION_INTERVAL,
        distanceInterval:  LOCATION_DISTANCE_FILTER,
        foregroundService: {
          notificationTitle: 'StrideUp is tracking your activity',
          notificationBody: 'Tap to return to the app',
          notificationColor: '#4a4d2e',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      return true;
    } catch (error) {
      console.error('Start tracking error:', error);
      setState(prev => ({ ...prev, error: 'Failed to start location tracking' }));
      return false;
    }
  }, [requestPermissions, processLocation]);

  // Stops tracking
  const stopTracking = useCallback(async () => {
    try {
      // Stops foreground tracking
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      // Stops background tracking
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // Merge's any background points
      if (backgroundPoints. length > 0) {
        setState(prev => ({
          ...prev,
          routeCoordinates: [... prev.routeCoordinates, ...backgroundPoints],
        }));
        backgroundPoints = [];
      }
    } catch (error) {
      console.error('Stop tracking error:', error);
    }
  }, []);

  // Resets tracking data
  const resetTracking = useCallback(() => {
    lastLocation.current = null;
    backgroundPoints = [];
    setState({
      currentLocation: null,
      routeCoordinates: [],
      distance: 0,
      currentSpeed: 0,
      currentElevation: null,
      error: null,
    });
  }, []);

  // Gets all collected points (including background)
  const getAllPoints = useCallback((): GPSPoint[] => {
    return [...state.routeCoordinates, ... backgroundPoints];
  }, [state.routeCoordinates]);

  // Handles app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState:  AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isTracking
      ) {
        // App comes to foreground, merges background points
        if (backgroundPoints. length > 0) {
          setState(prev => ({
            ... prev,
            routeCoordinates: [...prev.routeCoordinates, ...backgroundPoints],
          }));
          backgroundPoints = [];
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isTracking]);

  // Starts/stops tracking based on isTracking prop
  useEffect(() => {
    if (isTracking) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [isTracking, startTracking, stopTracking]);

  return {
    ... state,
    permissionStatus,
    startTracking,
    stopTracking,
    resetTracking,
    getAllPoints,
    requestPermissions,
  };
}