import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from './context/AuthContext';
import api from './api';

export default function LoginScreen() {
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username. trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/jwt/create/', {
        username:  username.toLowerCase().trim(),
        password: password,
      });

      if (response.data.access && response.data.refresh) {
        // Use the auth context login function
        await login(response. data.access, response.data. refresh);
        // Navigation happens automatically via AuthContext
      }
    } catch (error:  any) {
      console.error('Login error:', error. response?.data);
      
      if (error.response?.status === 401) {
        setError('Invalid username or password');
      } else if (error.message === 'Network Error') {
        setError('Cannot connect to server. Please check your connection.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ?  'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={styles.logo}>StrideUp</Text>
          <Text style={styles.subtitle}>Welcome back!</Text>
        </View>

        <View style={styles.formContainer}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor="#8a8d6a"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#8a8d6a"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={! showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showButtonText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles. buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#d9e3d0" />
            ) : (
              <Text style={styles.loginButtonText}>LOG IN</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account?  </Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={styles. signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:  1,
    backgroundColor: '#6b6e44',
  },
  content:  {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom:  40,
  },
  logo:  {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginBottom: 8,
  },
  subtitle:  {
    fontSize: 18,
    color: '#b8c4a8',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
  },
  errorBanner: {
    backgroundColor:  '#c0392b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorBannerText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input:  {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 14,
    color: '#d9e3d0',
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    backgroundColor:  'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 14,
    color: '#d9e3d0',
    fontSize:  16,
  },
  showButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  showButtonText: {
    color: '#b8c4a8',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#4d4d12',
    padding: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#d9e3d0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#b8c4a8',
    fontSize: 14,
  },
  signupLink: {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: 'bold',
  },
});