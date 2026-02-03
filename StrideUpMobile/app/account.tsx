import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
import api from './api';

interface UserData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function AccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await api.get('/auth/users/me/');
      setUserData(response.data);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress:  async () => {
            await logout();
            // Navigation happens automatically via AuthContext
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles. backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles. headerTitle}>Account</Text>
          <View style={styles.placeholder} />
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={48} color="#8a8d6a" />
          </View>
          {userData ? (
            <>
              <Text style={styles. userName}>
                {userData.first_name} {userData.last_name}
              </Text>
              <Text style={styles.userHandle}>@{userData.username}</Text>
              <Text style={styles.userEmail}>{userData.email}</Text>
            </>
          ) : (
            <Text style={styles. loadingText}>Loading...</Text>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={22} color="#d9e3d0" />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="lock-closed-outline" size={22} color="#d9e3d0" />
            <Text style={styles. menuText}>Privacy Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#8a8d6a" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles. menuItem}>
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
    paddingTop: Platform.OS === 'ios' ?  50 : (StatusBar.currentHeight || 30) + 10,
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
    width:  100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems:  'center',
    marginBottom: 16,
  },
  userName: {
    fontSize:  24,
    fontWeight:  'bold',
    color: '#d9e3d0',
  },
  userHandle: {
    fontSize: 14,
    color: '#8a8d6a',
    marginTop: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#b8c4a8',
    marginTop: 4,
  },
  loadingText: {
    fontSize:  16,
    color: '#8a8d6a',
  },
  menuSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems:  'center',
    padding:  16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuText: {
    flex: 1,
    fontSize:  16,
    color: '#d9e3d0',
    marginLeft: 16,
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
    color:  '#e74c3c',
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