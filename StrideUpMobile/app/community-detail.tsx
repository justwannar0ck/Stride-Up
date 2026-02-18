import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  communityService,
  CommunityDetail,
  CommunityMember,
} from './services/communityService';
import ChallengesList from './components/ChallengesList';

export default function CommunityDetailScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'about' | 'members' | 'challenges'>('about');

  const fetchData = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const [communityData, membersData] = await Promise.all([
        communityService.getCommunity(parseInt(communityId)),
        communityService.getMembers(parseInt(communityId)),
      ]);
      setCommunity(communityData);
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to load community:', error);
      Alert.alert('Error', 'Failed to load community details');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleJoinLeave = async () => {
    if (!community) return;

    if (community.is_member) {
      Alert.alert('Leave Community', `Leave "${community.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.leaveCommunity(community.id);
              Alert.alert('Done', 'You left the community.');
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to leave');
            }
          },
        },
      ]);
    } else {
      try {
        const result = await communityService.joinCommunity(community.id);
        Alert.alert('Success', result.detail);
        fetchData();
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.detail || 'Failed to join');
      }
    }
  };

  const isAdmin = community?.my_role === 'owner' || community?.my_role === 'admin';

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return '#f1c40f';
      case 'admin': return '#e67e22';
      case 'moderator': return '#3498db';
      default: return '#8a8d6a';
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#d9e3d0' }}>Community not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {community.name}
          </Text>

          {isAdmin ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() =>
                router.push({
                  pathname: '/community-settings',
                  params: { communityId: communityId },
                })
              }
            >
              <Ionicons name="settings-outline" size={24} color="#d9e3d0" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>
      </View>

      <ScrollView style={styles.contentScroll}>
        {/* Hero Section */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons
              name={community.visibility === 'private' ? 'lock-closed' : 'people'}
              size={40}
              color="#d9e3d0"
            />
          </View>
          <Text style={styles.heroName}>{community.name}</Text>
          <Text style={styles.heroMeta}>
            {community.members_count} member{community.members_count !== 1 ? 's' : ''}
            {community.visibility === 'private' ? ' · Private' : ' · Public'}
          </Text>

          <TouchableOpacity
            style={[
              styles.heroButton,
              community.is_member && styles.heroButtonLeave,
            ]}
            onPress={handleJoinLeave}
          >
            <Ionicons
              name={community.is_member ? 'log-out-outline' : 'add'}
              size={18}
              color={community.is_member ? '#e74c3c' : '#4a4d2e'}
            />
            <Text
              style={[
                styles.heroButtonText,
                community.is_member && styles.heroButtonTextLeave,
              ]}
            >
              {community.is_member ? 'Leave' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.sectionTabs}>
          {(['about', 'members', 'challenges'] as const).map((section) => (
            <TouchableOpacity
              key={section}
              style={[styles.sectionTab, activeSection === section && styles.sectionTabActive]}
              onPress={() => setActiveSection(section)}
            >
              <Text
                style={[
                  styles.sectionTabText,
                  activeSection === section && styles.sectionTabTextActive,
                ]}
              >
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* About Section */}
        {activeSection === 'about' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>
              {community.description || 'No description yet.'}
            </Text>

            {community.activity_types?.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Activity Focus</Text>
                <View style={styles.tagsRow}>
                  {community.activity_types.map((type) => (
                    <View key={type} style={styles.tag}>
                      <Text style={styles.tagText}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Info</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color="#8a8d6a" />
              <Text style={styles.infoText}>
                Created by {community.created_by?.full_name || community.created_by?.username}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color="#8a8d6a" />
              <Text style={styles.infoText}>
                Created {new Date(community.created_at).toLocaleDateString()}
              </Text>
            </View>

            {isAdmin && community.pending_count > 0 && (
              <TouchableOpacity
                style={styles.pendingBanner}
                onPress={() =>
                  router.push({
                    pathname: '/community-settings',
                    params: { communityId: communityId },
                  })
                }
              >
                <Ionicons name="person-add" size={20} color="#d9e3d0" />
                <Text style={styles.pendingText}>
                  {community.pending_count} pending join request
                  {community.pending_count !== 1 ? 's' : ''}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#8a8d6a" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Members Section */}
        {activeSection === 'members' && (
          <View style={styles.section}>
            {members.map((membership) => (
              <View key={membership.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Ionicons name="person" size={20} color="#8a8d6a" />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {membership.user.full_name || membership.user.username}
                  </Text>
                  <Text style={styles.memberUsername}>@{membership.user.username}</Text>
                </View>
                <View style={[styles.memberRole, { borderColor: getRoleColor(membership.role) }]}>
                  <Text style={[styles.memberRoleText, { color: getRoleColor(membership.role) }]}>
                    {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Challenges Section */}
        {activeSection === 'challenges' && (
          <ChallengesList
            communityId={parseInt(communityId!)}
            isAdmin={
              community?.my_role === 'owner' ||
              community?.my_role === 'admin' ||
              community?.my_role === 'moderator'
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5c5f3d' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#5c5f3d' },
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d9e3d0',
    flex: 1,
    textAlign: 'center',
  },
  contentScroll: { flex: 1 },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  heroName: { fontSize: 24, fontWeight: 'bold', color: '#d9e3d0' },
  heroMeta: { fontSize: 14, color: '#8a8d6a', marginTop: 4 },
  heroButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#d9e3d0', paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 24, marginTop: 20,
  },
  heroButtonLeave: { backgroundColor: 'rgba(231,76,60,0.1)' },
  heroButtonText: { fontSize: 14, fontWeight: '700', color: '#4a4d2e', marginLeft: 8 },
  heroButtonTextLeave: { color: '#e74c3c' },
  sectionTabs: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12 },
  sectionTab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sectionTabActive: { borderBottomColor: '#d9e3d0' },
  sectionTabText: { fontSize: 14, fontWeight: '500', color: '#8a8d6a' },
  sectionTabTextActive: { color: '#d9e3d0', fontWeight: '700' },
  section: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#d9e3d0', marginBottom: 10 },
  descriptionText: { fontSize: 15, color: '#b8c4a8', lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  tag: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, marginBottom: 8 },
  tagText: { fontSize: 12, color: '#d9e3d0', fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoText: { fontSize: 14, color: '#b8c4a8', marginLeft: 10 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(241,196,15,0.1)', borderRadius: 12, padding: 16, marginTop: 20 },
  pendingText: { flex: 1, color: '#f1c40f', fontSize: 14, fontWeight: '600', marginLeft: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#d9e3d0' },
  memberUsername: { fontSize: 13, color: '#8a8d6a' },
  memberRole: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  memberRoleText: { fontSize: 11, fontWeight: '700' },
  challengePlaceholder: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 20, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#d9e3d0', fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#8a8d6a', marginTop: 8, textAlign: 'center', lineHeight: 20 },
});