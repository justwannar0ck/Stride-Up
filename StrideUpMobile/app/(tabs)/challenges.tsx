import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChallengesScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles. content}>
      <View style={styles.pageHeader}>
        <Ionicons name="trophy-outline" size={20} color="#d9e3d0" />
        <Text style={styles. pageTitle}>Challenges</Text>
      </View>

      {/* Active Challenges */}
      <Text style={styles.sectionTitle}>Active Challenges</Text>
      <View style={styles.emptyState}>
        <Ionicons name="trophy" size={48} color="#8a8d6a" />
        <Text style={styles.emptyText}>No active challenges</Text>
        <Text style={styles.emptySubtext}>
          Join a club to participate in challenges! 
        </Text>
        <Text style={styles.comingSoon}>Coming in Sprint 6</Text>
      </View>

      {/* Available Challenges */}
      <Text style={styles.sectionTitle}>Available Challenges</Text>
      <View style={styles.challengeCard}>
        <View style={styles.challengeIcon}>
          <Ionicons name="walk" size={24} color="#d9e3d0" />
        </View>
        <View style={styles. challengeInfo}>
          <Text style={styles.challengeTitle}>Weekly 50km Challenge</Text>
          <Text style={styles.challengeDesc}>Run or walk 50km this week</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '0%' }]} />
          </View>
          <Text style={styles.progressText}>0 / 50 km</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    marginBottom:  12,
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#d9e3d0',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color:  '#8a8d6a',
    marginTop: 4,
  },
  comingSoon: {
    fontSize: 11,
    color: '#b8c4a8',
    marginTop: 12,
    fontStyle: 'italic',
  },
  challengeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding:  16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize:  16,
    fontWeight:  '600',
    color: '#d9e3d0',
  },
  challengeDesc:  {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d9e3d0',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 4,
  },
});