import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  showBackButton?: boolean;
  title?: string;
}

export default function Header({ showBackButton = false, title }: HeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.headerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
      
      <View style={styles.header}>
        <View style={styles.leftSection}>
          {showBackButton ?  (
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles. backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Ionicons name="footsteps" size={20} color="#4a4d2e" />
              </View>
              <Text style={styles.logoText}>Stride Up</Text>
            </View>
          )}
        </View>

        {title && (
          <View style={styles.centerSection}>
            <Text style={styles.titleText}>{title}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.accountButton}
          onPress={() => router.push('/account')}
        >
          <Ionicons name="person-outline" size={16} color="#d9e3d0" />
          <Text style={styles.accountText}>Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection:  'row',
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
  backButton: {
    padding: 4,
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  accountButton: {
    flexDirection: 'row',
    alignItems:  'center',
    backgroundColor:  'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  accountText: {
    color: '#d9e3d0',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
});