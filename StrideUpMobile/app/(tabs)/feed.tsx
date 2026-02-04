import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { followService, UserMinimal, FeedActivity } from '../services/followService';
import { debounce } from '../utils/debounce';

export default function FeedScreen() {
  const router = useRouter();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserMinimal[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Feed state
  const [feedActivities, setFeedActivities] = useState<FeedActivity[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Like loading state
  const [likingIds, setLikingIds] = useState<Set<number>>(new Set());

  // Fetch feed on mount
  useEffect(() => {
    fetchFeed(1, true);
  }, []);

  const fetchFeed = async (pageNum: number = 1, reset: boolean = false) => {
    if (reset) {
      setFeedLoading(true);
    }
    
    try {
      const response = await followService.getFeed(pageNum, 20);
      
      if (reset) {
        setFeedActivities(response.results);
      } else {
        setFeedActivities(prev => [...prev, ...response.results]);
      }
      
      setPage(pageNum);
      setHasMore(response.has_more);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setFeedLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed(1, true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !feedLoading) {
      setLoadingMore(true);
      fetchFeed(page + 1, false);
    }
  };

  // Handle like/unlike
  const handleLikePress = async (activity: FeedActivity) => {
    if (likingIds.has(activity.id)) return;
    
    setLikingIds(prev => new Set(prev).add(activity.id));
    
    try {
      if (activity.is_liked) {
        const response = await followService.unlikeActivity(activity.id);
        setFeedActivities(prev => 
          prev.map(a => 
            a.id === activity.id 
              ? { ...a, is_liked: false, likes_count: response.likes_count }
              : a
          )
        );
      } else {
        const response = await followService.likeActivity(activity.id);
        setFeedActivities(prev => 
          prev.map(a => 
            a.id === activity.id 
              ? { ...a, is_liked: true, likes_count: response.likes_count }
              : a
          )
        );
      }
    } catch (error: any) {
      console.error('Like error:', error.response?.data?.error || error);
    } finally {
      setLikingIds(prev => {
        const next = new Set(prev);
        next.delete(activity.id);
        return next;
      });
    }
  };

  // Debounced search function
  const searchUsers = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      try {
        const results = await followService.searchUsers(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setIsSearching(text.length > 0);
    
    if (text.length >= 2) {
      setSearchLoading(true);
      searchUsers(text);
    } else {
      setSearchResults([]);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  const navigateToProfile = (username: string) => {
    router.push(`/user/${username}`);
  };

  // Get activity type icon
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

  // Format relative time
  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render search result item
  const renderSearchResult = ({ item }: { item: UserMinimal }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => navigateToProfile(item.username)}
      activeOpacity={0.7}
    >
      <View style={styles.searchResultAvatar}>
        <Ionicons name="person" size={20} color="#8a8d6a" />
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName} numberOfLines={1}>
          {item.full_name || item.username}
        </Text>
        <Text style={styles.searchResultUsername} numberOfLines={1}>
          @{item.username}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
    </TouchableOpacity>
  );

  // Render feed activity item
  const renderFeedItem = ({ item }: { item: FeedActivity }) => {
    const isLiking = likingIds.has(item.id);
    
    return (
      <View style={styles.feedItem}>
        {/* User Header */}
        <TouchableOpacity 
          style={styles.feedItemHeader}
          onPress={() => navigateToProfile(item.user.username)}
          activeOpacity={0.7}
        >
          <View style={styles.feedItemAvatar}>
            <Ionicons name="person" size={20} color="#8a8d6a" />
          </View>
          <View style={styles.feedItemUserInfo}>
            <Text style={styles.feedItemUserName}>
              {item.user.full_name || item.user.username}
            </Text>
            <Text style={styles.feedItemTime}>
              {getRelativeTime(item.started_at)}
            </Text>
          </View>
          {item.visibility === 'followers' && (
            <View style={styles.visibilityBadge}>
              <Ionicons name="people" size={12} color="#8a8d6a" />
            </View>
          )}
        </TouchableOpacity>

        {/* Activity Content - Tappable for detail */}
        <TouchableOpacity
          style={styles.feedItemContent}
          onPress={() => router.push(`/activity/${item.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.feedItemTitleRow}>
            <Ionicons 
              name={getActivityIcon(item.activity_type)} 
              size={20} 
              color="#d9e3d0" 
            />
            <Text style={styles.feedItemTitle}>{item.title}</Text>
          </View>
          
          {item.description ? (
            <Text style={styles.feedItemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          
          <View style={styles.feedItemStats}>
            <View style={styles.feedItemStat}>
              <Text style={styles.feedItemStatValue}>
                {item.distance_km.toFixed(2)}
              </Text>
              <Text style={styles.feedItemStatLabel}>km</Text>
            </View>
            <View style={styles.feedItemStatDivider} />
            <View style={styles.feedItemStat}>
              <Text style={styles.feedItemStatValue}>{item.duration_formatted}</Text>
              <Text style={styles.feedItemStatLabel}>time</Text>
            </View>
            <View style={styles.feedItemStatDivider} />
            <View style={styles.feedItemStat}>
              <Text style={styles.feedItemStatValue}>{item.pace_formatted}</Text>
              <Text style={styles.feedItemStatLabel}>pace</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Like Section */}
        <View style={styles.feedItemActions}>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => handleLikePress(item)}
            disabled={isLiking}
            activeOpacity={0.7}
          >
            {isLiking ? (
              <ActivityIndicator size="small" color="#d9e3d0" />
            ) : (
              <>
                <Ionicons 
                  name={item.is_liked ? 'heart' : 'heart-outline'} 
                  size={22} 
                  color={item.is_liked ? '#e74c3c' : '#d9e3d0'} 
                />
                <Text style={[
                  styles.likeCount,
                  item.is_liked && styles.likeCountActive
                ]}>
                  {item.likes_count}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <Text style={styles.likesText}>
            {item.likes_count === 1 ? '1 like' : `${item.likes_count} likes`}
          </Text>
        </View>
      </View>
    );
  };

  // Render footer for loading more
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#d9e3d0" />
      </View>
    );
  };

  // Render empty feed state
  const renderEmptyFeed = () => (
    <View style={styles.emptyState}>
      <Ionicons name="newspaper-outline" size={64} color="#8a8d6a" />
      <Text style={styles.emptyTitle}>Your Feed is Empty</Text>
      <Text style={styles.emptyText}>
        Follow other athletes to see their activities here!
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => setIsSearching(true)}
      >
        <Ionicons name="search" size={18} color="#4a4d2e" />
        <Text style={styles.emptyButtonText}>Find People to Follow</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Page Title */}
      <View style={styles.titleContainer}>
        <Ionicons name="newspaper-outline" size={24} color="#d9e3d0" />
        <Text style={styles.title}>Feed</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#8a8d6a" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#8a8d6a"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#8a8d6a" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results or Feed */}
      {isSearching ? (
        <View style={styles.searchResultsContainer}>
          {searchLoading ? (
            <View style={styles.searchLoading}>
              <ActivityIndicator size="small" color="#d9e3d0" />
            </View>
          ) : searchQuery.length < 2 ? (
            <View style={styles.searchHint}>
              <Text style={styles.searchHintText}>
                Type at least 2 characters to search
              </Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchHint}>
              <Ionicons name="search-outline" size={32} color="#8a8d6a" />
              <Text style={styles.searchHintText}>No users found</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              style={styles.searchResultsList}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={feedActivities}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.feedList}
          contentContainerStyle={feedActivities.length === 0 ? styles.emptyContainer : styles.feedListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#d9e3d0"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={feedLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#d9e3d0" />
            </View>
          ) : (
            renderEmptyFeed()
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  // Title
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#d9e3d0',
  },
  clearButton: {
    padding: 4,
  },
  // Search Results
  searchResultsContainer: {
    flex: 1,
  },
  searchLoading: {
    padding: 20,
    alignItems: 'center',
  },
  searchHint: {
    alignItems: 'center',
    padding: 40,
  },
  searchHintText: {
    fontSize: 15,
    color: '#8a8d6a',
    marginTop: 8,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchResultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  searchResultUsername: {
    fontSize: 14,
    color: '#8a8d6a',
    marginTop: 2,
  },
  // Feed
  feedList: {
    flex: 1,
  },
  feedListContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  // Feed Item
  feedItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  feedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  feedItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedItemUserInfo: {
    flex: 1,
    marginLeft: 10,
  },
  feedItemUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  feedItemTime: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 2,
  },
  visibilityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 6,
    borderRadius: 12,
  },
  feedItemContent: {
    padding: 16,
  },
  feedItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedItemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 8,
    flex: 1,
  },
  feedItemDescription: {
    fontSize: 14,
    color: '#b8c4a8',
    marginBottom: 12,
    lineHeight: 20,
  },
  feedItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 10,
    paddingVertical: 12,
  },
  feedItemStat: {
    flex: 1,
    alignItems: 'center',
  },
  feedItemStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  feedItemStatLabel: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 2,
  },
  feedItemStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  // Like Section
  feedItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 60,
    justifyContent: 'center',
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 6,
  },
  likeCountActive: {
    color: '#e74c3c',
  },
  likesText: {
    fontSize: 13,
    color: '#8a8d6a',
    marginLeft: 12,
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#d9e3d0',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 15,
    color: '#8a8d6a',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d9e3d0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a4d2e',
    marginLeft: 8,
  },
});