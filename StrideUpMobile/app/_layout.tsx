import React from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActivityProvider } from './context/ActivityContext';

function RootLayoutNav() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles. loadingContainer}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown:  false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen 
        name="account" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="activity-summary" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="privacy-settings" 
        options={{ 
        headerShown: false,
        presentation: 'modal',
        }} 
      />
      <Stack.Screen
        name="community-detail"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="community-create"
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="community-settings"
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ActivityProvider>
        <RootLayoutNav />
      </ActivityProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex:  1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },
});