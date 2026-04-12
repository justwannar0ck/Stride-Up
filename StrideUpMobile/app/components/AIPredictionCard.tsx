import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import api from '../api'; // Global axios instance

interface PredictionData {
  message?: string;
  predicted_class?: string;
  target_distance: number;
  target_pace: number;
  chronic_load: number;
  dist_last_7d: number;
  acwr?: number;
  status?: string;
}

export const AIPredictionCard = () => {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedDist, setPlannedDist] = useState<number>(0);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const response = await api.get('/api/v1/activities/predict/');
        setData(response.data);
        setPlannedDist(response.data.target_distance || 0);
      } catch (error) {
        console.error('Failed to fetch ML prediction:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrediction();
  }, []);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#d9e3d0" />
        <Text style={styles.loadingText}>AI Coach is analyzing your runs...</Text>
      </View>
    );
  }

  if (!data) return null;

  // Handles case where user doesn't have 3 runs yet
  if (data.status === 'baseline') {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="footsteps" size={24} color="#d9e3d0" />
          <Text style={styles.title}>Ready to run?</Text>
        </View>
        <Text style={styles.text}>{data.message}</Text>
        <Text style={styles.subText}>Complete a few more runs to unlock your ML Coach.</Text>
      </View>
    );
  }

  // REAL-TIME MATH FOR INJURY RISK
  const simulatedAcwr = (data.dist_last_7d + plannedDist) / (data.chronic_load + 0.1);
  
  let riskColor = '#a8c686'; // Safe/Greenish
  let riskText = 'Optimal Load';
  // BEGINNER SAFEGUARD: If their chronic load is super low (< 5km/week)
  if (data.chronic_load < 5 && plannedDist <= 5) {
    riskColor = '#a8c686'; 
    riskText = 'Good Beginner Distance';
  } else {
    // Normal Pro-Level ACWR Logic
    if (simulatedAcwr < 0.8) {
      riskColor = '#8a8d6a'; 
      riskText = 'Under-training';
    } else if (simulatedAcwr > 1.3 && simulatedAcwr <= 1.5) {
      riskColor = '#e6cc80'; 
      riskText = 'Caution: Volume Spiking';
    } else if (simulatedAcwr > 1.5) {
      riskColor = '#e07a5f'; 
      riskText = 'High Fatigue Risk!';
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="hardware-chip" size={24} color="#d9e3d0" />
        <Text style={styles.title}>ML Target Prediction</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Class</Text>
          <Text style={styles.statValue}>{data.predicted_class?.split(' ')[0]}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Target Pace</Text>
          <Text style={styles.statValue}>{data.target_pace} /km</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>Planned Distance</Text>
        <Text style={styles.sliderValue}>{plannedDist.toFixed(1)} km</Text>
      </View>
      
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={30}
        step={0.5}
        value={plannedDist}
        onValueChange={setPlannedDist}
        minimumTrackTintColor={riskColor}
        maximumTrackTintColor="rgba(217, 227, 208, 0.2)"
        thumbTintColor={riskColor}
      />
      
      <View style={styles.riskContainer}>
        <Ionicons 
          name={simulatedAcwr > 1.5 ? "warning" : "shield-checkmark"} 
          size={16} 
          color={riskColor} 
        />
        <Text style={[styles.riskText, { color: riskColor }]}>
          Readiness: {riskText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#4a4d2e',
    borderRadius: 16,
    padding: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d9e3d0',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    flex: 0.48,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#8a8d6a',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(217, 227, 208, 0.1)',
    marginVertical: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#d9e3d0',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  riskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 8,
    borderRadius: 8,
  },
  riskText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  text: {
    fontSize: 14,
    color: '#d9e3d0',
    marginBottom: 4,
  },
  subText: {
    fontSize: 13,
    color: '#8a8d6a',
  },
  loadingText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#8a8d6a',
  }
});