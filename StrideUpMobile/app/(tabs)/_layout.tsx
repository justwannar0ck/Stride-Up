import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Tab Icon Component
interface TabIconProps {
  name:  keyof typeof Ionicons.glyphMap;
  focused:  boolean;
  label: string;
}

function TabIcon({ name, focused, label }: TabIconProps) {
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
        <Ionicons 
          name={name} 
          size={24} 
          color={focused ? '#d9e3d0' : '#8a8d6a'} 
        />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

// Header Component
function Header() {
  const router = useRouter();

  return (
    <View style={styles.headerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="footsteps" size={18} color="#4a4d2e" />
          </View>
          <Text style={styles.logoText}>Stride Up</Text>
        </View>

        <TouchableOpacity 
          style={styles.accountButton}
          onPress={() => router.push('/account')}
        >
          <Ionicons name="person-outline" size={14} color="#d9e3d0" />
          <Text style={styles.accountText}>Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Header />
      
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="newspaper-outline" focused={focused} label="Feed" />
            ),
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: 'Track',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="navigate-outline" focused={focused} label="Track" />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="home" focused={focused} label="Home" />
            ),
          }}
        />
        <Tabs. Screen
          name="challenges"
          options={{
            title: 'Challenges',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="trophy-outline" focused={focused} label="Challenges" />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarIcon: ({ focused }) => (
              <TabIcon name="people-outline" focused={focused} label="Community" />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet. create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  // Header Styles
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d9e3d0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d9e3d0',
  },
  accountButton: {
    flexDirection:  'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical:  8,
    borderRadius:  20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  accountText: {
    color: '#d9e3d0',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  // Tab Bar Styles
  tabBar: {
    backgroundColor: '#3d3f2a',
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ?  85 : 70,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ?  25 : 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    left: 0,
    right:  0,
    bottom: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity:  0.3,
    shadowRadius: 8,
  },
  tabIconContainer: {
    alignItems:  'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  iconWrapper: {
    padding: 8,
    borderRadius: 12,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabLabel: {
    fontSize: 10,
    color: '#8a8d6a',
    marginTop: 2,
  },
  tabLabelActive:  {
    color: '#d9e3d0',
    fontWeight: '600',
  },
});