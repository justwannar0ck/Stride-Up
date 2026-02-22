import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { followService, UserProfile } from '../services/followService';

type FollowStatus = 'self' | 'following' | 'requested' | 'not_following';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    
    try {
      setError(null);
      const data = await followService.getUserProfile(username);
      setProfile(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleFollowPress = async () => {
    if (!profile || followLoading) return;

    const currentStatus = profile.follow_status;

    // If already following or requested, shows confirmation
    if (currentStatus === 'following' || currentStatus === 'requested') {
      const message = currentStatus === 'following'
        ? `Unfollow @${profile.username}?`
        : `Cancel follow request to @${profile.username}?`;

      Alert.alert('Confirm', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setFollowLoading(true);
            try {
              const response = await followService.unfollowUser(profile.username);
              setProfile({
                ...profile,
                follow_status: response.status,
                followers_count: currentStatus === 'following' 
                  ? profile.followers_count - 1 
                  : profile.followers_count,
              });
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to unfollow');
            } finally {
              setFollowLoading(false);
            }
          },
        },
      ]);
      return;
    }

    // Follow or send request
    setFollowLoading(true);
    try {
      const response = await followService.followUser(profile.username);
      setProfile({
        ...profile,
        follow_status: response.status,
        followers_count: response.status === 'following' 
          ? profile.followers_count + 1 
          : profile.followers_count,
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to follow');
    } finally {
      setFollowLoading(false);
    }
  };

  const navigateToFollowers = () => {
    if (profile) {
      router.push(`/followers/${profile.username}`);
    }
  };

  const navigateToFollowing = () => {
    if (profile) {
      router.push(`/following/${profile.username}`);
    }
  };

  const getFollowButtonText = (status: FollowStatus): string => {
    switch (status) {
      case 'following':
        return 'Following';
      case 'requested':
        return 'Requested';
      case 'not_following':
      default:
        return 'Follow';
    }
  };

  const getFollowButtonStyle = (status: FollowStatus) => {
    switch (status) {
      case 'following':
        return styles.followingButton;
      case 'requested':
        return styles.requestedButton;
      case 'not_following':
      default:
        return styles.followButton;
    }
  };

  const getFollowButtonTextStyle = (status: FollowStatus) => {
    switch (status) {
      case 'following':
      case 'requested':
        return styles.followingButtonText;
      case 'not_following':
      default:
        return styles.followButtonText;
    }
  };

  // Checks if profile is private and user is not following
  const isPrivateAndNotFollowing = profile?.is_private && 
    profile?.follow_status !== 'following' && 
    profile?.follow_status !== 'self';

  return (
    <View style={styles.container}>

      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {profile?.username || 'Profile'}
          </Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#d9e3d0" />
        </View>
      ) : error || !profile ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#8a8d6a" />
          <Text style={styles.errorText}>{error || 'User not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#d9e3d0"
            />
          }
        >

          <View style={styles.profileSection}>
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={48} color="#8a8d6a" />
            </View>
            
            <Text style={styles.fullName}>
              {profile.full_name || profile.username}
            </Text>
            <Text style={styles.username}>@{profile.username}</Text>
            
            {profile.is_private && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={12} color="#8a8d6a" />
                <Text style={styles.privateText}>Private Account</Text>
              </View>
            )}
          </View>

          <View style={styles.statsRow}>
            <TouchableOpacity 
              style={styles.statItem} 
              onPress={navigateToFollowers}
              disabled={isPrivateAndNotFollowing}
              activeOpacity={isPrivateAndNotFollowing ? 1 : 0.7}
            >
              <Text style={styles.statNumber}>{profile.followers_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            
            <View style={styles.statDivider} />
            
            <TouchableOpacity 
              style={styles.statItem} 
              onPress={navigateToFollowing}
              disabled={isPrivateAndNotFollowing}
              activeOpacity={isPrivateAndNotFollowing ? 1 : 0.7}
            >
              <Text style={styles.statNumber}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          {profile.follow_status !== 'self' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, getFollowButtonStyle(profile.follow_status)]}
                onPress={handleFollowPress}
                disabled={followLoading}
                activeOpacity={0.7}
              >
                {followLoading ? (
                  <ActivityIndicator 
                    size="small" 
                    color={profile.follow_status === 'not_following' ? '#4a4d2e' : '#d9e3d0'} 
                  />
                ) : (
                  <Text style={getFollowButtonTextStyle(profile.follow_status)}>
                    {getFollowButtonText(profile.follow_status)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {profile.bio && !isPrivateAndNotFollowing && (
            <View style={styles.bioSection}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          )}

          {isPrivateAndNotFollowing && (
            <View style={styles.privateMessage}>
              <Ionicons name="lock-closed" size={40} color="#8a8d6a" />
              <Text style={styles.privateMessageTitle}>This Account is Private</Text>
              <Text style={styles.privateMessageText}>
                Follow this account to see their activities and stats.
              </Text>
            </View>
          )}

          {!isPrivateAndNotFollowing && (
            <View style={styles.activitiesSection}>
              <Text style={styles.sectionTitle}>Recent Activities</Text>

              <View style={styles.activityPlaceholder}>
                <Ionicons name="fitness-outline" size={32} color="#8a8d6a" />
                <Text style={styles.placeholderText}>
                  Activities will appear here
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
  },
  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  username: {
    fontSize: 16,
    color: '#8a8d6a',
    marginTop: 4,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privateText: {
    fontSize: 12,
    color: '#8a8d6a',
    marginLeft: 4,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  statLabel: {
    fontSize: 13,
    color: '#8a8d6a',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  // Action Row
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  followButton: {
    backgroundColor: '#d9e3d0',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(217, 227, 208, 0.5)',
  },
  requestedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(217, 227, 208, 0.5)',
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a4d2e',
  },
  followingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  // Bio Section
  bioSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bioText: {
    fontSize: 15,
    color: '#d9e3d0',
    lineHeight: 22,
    textAlign: 'center',
  },
  // Private Message
  privateMessage: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  privateMessageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    marginTop: 16,
  },
  privateMessageText: {
    fontSize: 14,
    color: '#8a8d6a',
    marginTop: 8,
    textAlign: 'center',
  },
  // Activities Section
  activitiesSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    marginBottom: 16,
  },
  activityPlaceholder: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#8a8d6a',
    marginTop: 12,
  },
  // Error States
  errorText: {
    fontSize: 16,
    color: '#8a8d6a',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  retryText: {
    color: '#d9e3d0',
    fontWeight: '600',
  },
});