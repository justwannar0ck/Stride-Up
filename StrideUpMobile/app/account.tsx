import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
import { followService, UserProfile } from './services/followService';

export default function AccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch profile and follow requests in parallel
      const [profileData, requestsData] = await Promise.all([
        followService.getMyProfile(),
        followService.getFollowRequests(),
      ]);
      
      setProfile(profileData);
      setPendingRequestsCount(requestsData.count);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
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

  const navigateToFollowRequests = () => {
    router.push('/follow-requests');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={styles.placeholder} />
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={48} color="#8a8d6a" />
          </View>
          
          {loading ? (
            <ActivityIndicator size="small" color="#d9e3d0" style={{ marginTop: 16 }} />
          ) : profile ? (
            <>
              <Text style={styles.userName}>
                {profile.full_name || profile.username}
              </Text>
              <Text style={styles.userHandle}>@{profile.username}</Text>
              
              {/* Followers/Following Stats */}
              <View style={styles.statsRow}>
                <TouchableOpacity 
                  style={styles.statItem} 
                  onPress={navigateToFollowers}
                  activeOpacity={0.7}
                >
                  <Text style={styles.statNumber}>{profile.followers_count}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>
                
                <View style={styles.statDivider} />
                
                <TouchableOpacity 
                  style={styles.statItem} 
                  onPress={navigateToFollowing}
                  activeOpacity={0.7}
                >
                  <Text style={styles.statNumber}>{profile.following_count}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.loadingText}>Failed to load profile</Text>
          )}
        </View>

        {/* Follow Requests (only show if there are pending requests) */}
        {pendingRequestsCount > 0 && (
          <TouchableOpacity 
            style={styles.followRequestsBanner}
            onPress={navigateToFollowRequests}
            activeOpacity={0.7}
          >
            <View style={styles.followRequestsLeft}>
              <Ionicons name="person-add" size={22} color="#d9e3d0" />
              <Text style={styles.followRequestsText}>Follow Requests</Text>
            </View>
            <View style={styles.followRequestsRight}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
            </View>
          </TouchableOpacity>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={22} color="#d9e3d0" />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/privacy-settings')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#d9e3d0" />
            <Text style={styles.menuText}>Privacy Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>
          
          {/* Follow Requests menu item (always visible, with badge if pending) */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={navigateToFollowRequests}
          >
            <Ionicons name="person-add-outline" size={22} color="#d9e3d0" />
            <Text style={styles.menuText}>Follow Requests</Text>
            <View style={styles.menuRight}>
              {pendingRequestsCount > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{pendingRequestsCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={22} color="#d9e3d0" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings-outline" size={22} color="#d9e3d0" />
            <Text style={styles.menuText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]}>
            <Ionicons name="help-circle-outline" size={22} color="#d9e3d0" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#e74c3c" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>StrideUp v1.0.0</Text>
      </ScrollView>
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
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
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
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  userHandle: {
    fontSize: 14,
    color: '#8a8d6a',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#8a8d6a',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
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
  // Follow Requests Banner
  followRequestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(217, 227, 208, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(217, 227, 208, 0.3)',
  },
  followRequestsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  followRequestsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 12,
  },
  followRequestsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  // Menu Section
  menuSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#d9e3d0',
    marginLeft: 16,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    color: '#e74c3c',
    marginLeft: 8,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#8a8d6a',
    marginBottom: 40,
  },
});