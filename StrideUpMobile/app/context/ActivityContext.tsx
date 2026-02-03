import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { Alert } from 'react-native';
import api from '../api';

type ActivityType = 'run' | 'walk' | 'cycle' | 'hike';
type ActivityStatus = 'idle' | 'recording' | 'paused' | 'completed';
type Visibility = 'public' | 'followers' | 'private';

interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  elevation?:  number | null;
  accuracy?: number | null;
  speed?: number | null;
}

interface CompletedActivity {
  id:  number;
  title: string;
  distance_km: number;
  duration_formatted: string;
  pace_formatted: string;
}

interface ActivityState {
  activityId: number | null;
  activityType:  ActivityType;
  status: ActivityStatus;
  visibility: Visibility;
  hideStartEnd: boolean;
  startTime: Date | null;
  elapsedTime: number;
  activeTime: number;
  distance: number;
  currentPace: number;
  averagePace: number;
  currentSpeed: number;
  averageSpeed: number;
  elevation: number | null;
  calories: number;
  routeCoordinates: GPSPoint[];
  completedActivity:  CompletedActivity | null;
}

interface ActivityContextType extends ActivityState {
  setActivityType: (type: ActivityType) => void;
  setVisibility: (visibility: Visibility) => void;
  setHideStartEnd: (hide: boolean) => void;
  startActivity: () => Promise<boolean>;
  pauseActivity: () => Promise<void>;
  resumeActivity: () => Promise<void>;
  stopActivity: () => Promise<CompletedActivity | null>;
  discardActivity: () => Promise<void>;
  addGPSPoint: (point: GPSPoint) => void;
  updateDistance: (distance: number) => void;
  updateElevation: (elevation: number | null) => void;
  updateSpeed: (speed: number) => void;
  resetActivity: () => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

const UPLOAD_BATCH_SIZE = 10;

export function ActivityProvider({ children }: { children:  ReactNode }) {
  const [state, setState] = useState<ActivityState>({
    activityId:  null,
    activityType:  'run',
    status:  'idle',
    visibility:  'public',
    hideStartEnd: false,
    startTime: null,
    elapsedTime: 0,
    activeTime: 0,
    distance: 0,
    currentPace: 0,
    averagePace: 0,
    currentSpeed: 0,
    averageSpeed: 0,
    elevation: null,
    calories: 0,
    routeCoordinates: [],
    completedActivity: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPointsRef = useRef<GPSPoint[]>([]);

  const calculatePace = useCallback((distanceMeters: number, timeSeconds: number): number => {
    if (distanceMeters === 0 || timeSeconds === 0) return 0;
    const distanceKm = distanceMeters / 1000;
    return timeSeconds / distanceKm;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.status !== 'recording') return prev;

        const newActive = prev.activeTime + 1;
        const newPace = calculatePace(prev. distance, newActive);

        return {
          ...prev,
          elapsedTime: prev.elapsedTime + 1,
          activeTime: newActive,
          averagePace: newPace,
          averageSpeed: prev.distance > 0 ? (prev.distance / 1000) / (newActive / 3600) : 0,
        };
      });
    }, 1000);
  }, [calculatePace]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const uploadPendingPoints = useCallback(async (activityId: number, force: boolean = false) => {
    if (force || pendingPointsRef.current.length >= UPLOAD_BATCH_SIZE) {
      if (pendingPointsRef.current.length > 0) {
        try {
          await api.post('/api/v1/activities/upload_gps/', {
            activity_id: activityId,
            points: pendingPointsRef.current,
          });
          pendingPointsRef.current = [];
        } catch (error) {
          console.error('Failed to upload GPS points:', error);
        }
      }
    }
  }, []);

  const setActivityType = useCallback((type:  ActivityType) => {
    setState((prev) => ({ ...prev, activityType: type }));
  }, []);

  const setVisibility = useCallback((visibility: Visibility) => {
    setState((prev) => ({ ...prev, visibility }));
  }, []);

  const setHideStartEnd = useCallback((hide: boolean) => {
    setState((prev) => ({ ...prev, hideStartEnd: hide }));
  }, []);

  const startActivity = useCallback(async (): Promise<boolean> => {
    try {
      const response = await api.post('/api/v1/activities/', {
        activity_type: state.activityType,
        visibility: state.visibility,
        hide_start_end: state.hideStartEnd,
      });

      setState((prev) => ({
        ...prev,
        activityId:  response.data.id,
        status: 'recording',
        startTime: new Date(),
        elapsedTime: 0,
        activeTime: 0,
        distance: 0,
        routeCoordinates: [],
        completedActivity: null,
      }));

      startTimer();
      return true;
    } catch (error) {
      console.error('Failed to start activity:', error);
      Alert.alert('Error', 'Failed to start activity. Please try again.');
      return false;
    }
  }, [state.activityType, state.visibility, state. hideStartEnd, startTimer]);

  const pauseActivity = useCallback(async () => {
    if (! state.activityId || state.status !== 'recording') return;

    try {
      await api.post(`/api/v1/activities/${state.activityId}/pause/`);
      stopTimer();
      await uploadPendingPoints(state. activityId, true);
      setState((prev) => ({ ...prev, status: 'paused' }));
    } catch (error) {
      console.error('Failed to pause activity:', error);
      Alert.alert('Error', 'Failed to pause activity.');
    }
  }, [state.activityId, state.status, stopTimer, uploadPendingPoints]);

  const resumeActivity = useCallback(async () => {
    if (!state.activityId || state.status !== 'paused') return;

    try {
      await api.post(`/api/v1/activities/${state.activityId}/resume/`);
      startTimer();
      setState((prev) => ({ ...prev, status: 'recording' }));
    } catch (error) {
      console.error('Failed to resume activity:', error);
      Alert.alert('Error', 'Failed to resume activity.');
    }
  }, [state.activityId, state. status, startTimer]);

  const stopActivity = useCallback(async (): Promise<CompletedActivity | null> => {
    if (! state.activityId) return null;

    try {
      stopTimer();
      await uploadPendingPoints(state.activityId, true);

      const response = await api.post(`/api/v1/activities/${state.activityId}/complete/`, {
        visibility: state.visibility,
        hide_start_end: state.hideStartEnd,
      });

      const completedActivity = response.data;

      setState((prev) => ({
        ...prev,
        status: 'completed',
        completedActivity,
      }));

      return completedActivity;
    } catch (error) {
      console.error('Failed to stop activity:', error);
      Alert.alert('Error', 'Failed to save activity.');
      return null;
    }
  }, [state. activityId, state.visibility, state.hideStartEnd, stopTimer, uploadPendingPoints]);

  const discardActivity = useCallback(async () => {
    if (!state.activityId) return;

    try {
      stopTimer();
      await api.post(`/api/v1/activities/${state.activityId}/discard/`);

      setState((prev) => ({
        ...prev,
        activityId: null,
        status: 'idle',
        startTime: null,
        elapsedTime: 0,
        activeTime: 0,
        distance: 0,
        routeCoordinates: [],
        completedActivity: null,
      }));

      pendingPointsRef.current = [];
    } catch (error) {
      console.error('Failed to discard activity:', error);
      Alert.alert('Error', 'Failed to discard activity.');
    }
  }, [state.activityId, stopTimer]);

  const addGPSPoint = useCallback((point: GPSPoint) => {
    setState((prev) => ({
      ...prev,
      routeCoordinates: [...prev.routeCoordinates, point],
    }));

    pendingPointsRef.current.push(point);

    if (state.activityId) {
      uploadPendingPoints(state. activityId, false);
    }
  }, [state.activityId, uploadPendingPoints]);

  const updateDistance = useCallback((distance:  number) => {
    setState((prev) => {
      const newPace = calculatePace(distance, prev.activeTime);
      return {
        ...prev,
        distance,
        currentPace: newPace,
        averagePace: newPace,
      };
    });
  }, [calculatePace]);

  const updateElevation = useCallback((elevation: number | null) => {
    setState((prev) => ({ ...prev, elevation }));
  }, []);

  const updateSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, currentSpeed: speed }));
  }, []);

  const resetActivity = useCallback(() => {
    stopTimer();
    pendingPointsRef.current = [];

    setState({
      activityId: null,
      activityType: 'run',
      status: 'idle',
      visibility: 'public',
      hideStartEnd:  false,
      startTime: null,
      elapsedTime:  0,
      activeTime:  0,
      distance: 0,
      currentPace:  0,
      averagePace: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      elevation: null,
      calories:  0,
      routeCoordinates: [],
      completedActivity: null,
    });
  }, [stopTimer]);

  return (
    <ActivityContext.Provider
      value={{
        ...state,
        setActivityType,
        setVisibility,
        setHideStartEnd,
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
      }}
    >
      {children}
    </ActivityContext. Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}