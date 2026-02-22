import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { communityService, Community } from '../services/communityService';

export default function CommunityScreen() {
  const router = useRouter();
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [discoverCommunities, setDiscoverCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'discover'>('my');

  const loadData = useCallback(async () => {
    try {
      const [mine, all] = await Promise.all([
        communityService.getMyCommunities(),
        communityService.listCommunities(),
      ]);
      setMyCommunities(mine);
      const myIds = new Set(mine.map((c) => c.id));
      setDiscoverCommunities(all.filter((c) => !myIds.has(c.id)));
    } catch (error) {
      console.error('Failed to load communities:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    try {
      const results = await communityService.listCommunities({ q: searchQuery });
      setDiscoverCommunities(results);
      setActiveTab('discover');
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleJoin = async (community: Community) => {
    try {
      const result = await communityService.joinCommunity(community.id);
      Alert.alert('Success', result.detail);
      loadData(); // Refresh's list
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to join');
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const renderCommunityCard = (community: Community, showJoin: boolean) => (
    <TouchableOpacity
      key={community.id}
      style={styles.communityCard}
      onPress={() =>
        router.push({
          pathname: '/community-detail',
          params: { communityId: community.id.toString() },
        })
      }
      activeOpacity={0.7}
    >

      <View style={styles.communityIcon}>
        <Ionicons
          name={
            community.visibility === 'private'
              ? 'lock-closed'
              : 'people'
          }
          size={24}
          color="#d9e3d0"
        />
      </View>

      <View style={styles.communityInfo}>
        <Text style={styles.communityName} numberOfLines={1}>
          {community.name}
        </Text>
        <Text style={styles.communityMeta} numberOfLines={1}>
          {community.members_count} member{community.members_count !== 1 ? 's' : ''}
          {community.activity_types?.length > 0 &&
            ` · ${community.activity_types.join(', ')}`}
        </Text>
        {community.description ? (
          <Text style={styles.communityDesc} numberOfLines={2}>
            {community.description}
          </Text>
        ) : null}
      </View>

      {showJoin && !community.is_member ? (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={(e) => {
            e.stopPropagation();
            handleJoin(community);
          }}
        >
          <Text style={styles.joinButtonText}>
            {community.visibility === 'private' ? 'Request' : 'Join'}
          </Text>
        </TouchableOpacity>
      ) : community.my_role ? (
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {community.my_role.charAt(0).toUpperCase() +
              community.my_role.slice(1)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

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
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#d9e3d0" />
      }
    >

      <View style={styles.pageHeader}>
        <Ionicons name="people-outline" size={20} color="#d9e3d0" />
        <Text style={styles.pageTitle}>Communities</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/community-create')}
        >
          <Ionicons name="add" size={22} color="#4a4d2e" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#8a8d6a" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          placeholderTextColor="#8a8d6a"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              loadData();
            }}
          >
            <Ionicons name="close-circle" size={18} color="#8a8d6a" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
            My Communities
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text
            style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}
          >
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'my' ? (
        myCommunities.length > 0 ? (
          myCommunities.map((c) => renderCommunityCard(c, false))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people" size={48} color="#8a8d6a" />
            <Text style={styles.emptyText}>No communities yet</Text>
            <Text style={styles.emptySubtext}>
              Create one or discover communities to join!
            </Text>
          </View>
        )
      ) : discoverCommunities.length > 0 ? (
        discoverCommunities.map((c) => renderCommunityCard(c, true))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={48} color="#8a8d6a" />
          <Text style={styles.emptyText}>No communities found</Text>
          <Text style={styles.emptySubtext}>Try a different search or create your own!</Text>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
    flex: 1,
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d9e3d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#d9e3d0',
    fontSize: 14,
    marginLeft: 8,
  },
  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#d9e3d0',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8a8d6a',
  },
  tabTextActive: {
    color: '#d9e3d0',
    fontWeight: '600',
  },
  // Community Card
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  communityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  communityMeta: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 2,
  },
  communityDesc: {
    fontSize: 12,
    color: '#b8c4a8',
    marginTop: 4,
  },
  joinButton: {
    backgroundColor: '#d9e3d0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a4d2e',
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 11,
    color: '#b8c4a8',
    fontWeight: '500',
  },
  // Empty State
  emptyState: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#d9e3d0',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 4,
    textAlign: 'center',
  },
});