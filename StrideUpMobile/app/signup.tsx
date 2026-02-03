import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import api from './api';

interface FormErrors {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  confirm_password?: string;
  general?: string;
}

export default function SignupScreen() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password:  '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.username. trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    
    if (!formData. last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one lowercase letter';
    } else if (!/\d/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one digit';
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = 'Please confirm your password';
    } else if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value:  string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await api.post('/auth/users/', {
        username: formData.username.toLowerCase().trim(),
        email: formData.email.toLowerCase().trim(),
        first_name: formData.first_name. trim(),
        last_name:  formData.last_name.trim(),
        password: formData. password,
        confirm_password: formData.confirm_password,
      });

      if (response.status === 201) {
        Alert.alert(
          'Success!  🎉',
          'Your account has been created.  Please log in to continue.',
          [
            {
              text: 'Go to Login',
              onPress:  () => router.replace('/login'),
            },
          ]
        );
      }
    } catch (error: any) {
      if (error.response?.data) {
        const backendErrors:  FormErrors = {};
        const data = error.response.data;

        if (data.username) {
          backendErrors.username = Array.isArray(data.username) 
            ? data.username[0] :  data.username;
        }
        if (data.email) {
          backendErrors.email = Array.isArray(data.email) 
            ? data.email[0] : data.email;
        }
        if (data.password) {
          backendErrors. password = Array.isArray(data.password) 
            ? data.password[0] : data. password;
        }
        if (data.confirm_password) {
          backendErrors.confirm_password = Array.isArray(data.confirm_password) 
            ? data.confirm_password[0] : data.confirm_password;
        }
        if (data.non_field_errors) {
          backendErrors.general = Array.isArray(data.non_field_errors) 
            ? data.non_field_errors[0] : data.non_field_errors;
        }

        setErrors(backendErrors);
      } else if (error.message === 'Network Error') {
        setErrors({ general: 'Cannot connect to server. Please check your connection.' });
      } else {
        setErrors({ general: 'An error occurred. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text style={styles.logo}>StrideUp</Text>
          <Text style={styles.subtitle}>Join the community</Text>
        </View>

        <View style={styles.formContainer}>
          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              placeholder="Choose a username"
              placeholderTextColor="#8a8d6a"
              value={formData.username}
              onChangeText={(value) => handleChange('username', value)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.username && (
              <Text style={styles. errorText}>{errors.username}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Enter your email"
              placeholderTextColor="#8a8d6a"
              value={formData. email}
              onChangeText={(value) => handleChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors. email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          <View style={styles.nameRow}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={[styles.input, errors.first_name && styles. inputError]}
                placeholder="First"
                placeholderTextColor="#8a8d6a"
                value={formData.first_name}
                onChangeText={(value) => handleChange('first_name', value)}
                autoCapitalize="words"
              />
              {errors.first_name && (
                <Text style={styles.errorText}>{errors.first_name}</Text>
              )}
            </View>

            <View style={[styles. inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[styles.input, errors. last_name && styles.inputError]}
                placeholder="Last"
                placeholderTextColor="#8a8d6a"
                value={formData.last_name}
                onChangeText={(value) => handleChange('last_name', value)}
                autoCapitalize="words"
              />
              {errors.last_name && (
                <Text style={styles.errorText}>{errors.last_name}</Text>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.password && styles.inputError]}
                placeholder="Create a password"
                placeholderTextColor="#8a8d6a"
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles. showButtonText}>
                  {showPassword ? 'Hide' :  'Show'}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
            <Text style={styles.hint}>
              Min 8 characters with uppercase, lowercase & number
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.confirm_password && styles. inputError]}
                placeholder="Confirm your password"
                placeholderTextColor="#8a8d6a"
                value={formData.confirm_password}
                onChangeText={(value) => handleChange('confirm_password', value)}
                secureTextEntry={! showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.showButtonText}>
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.confirm_password && (
              <Text style={styles.errorText}>{errors.confirm_password}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.signupButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ?  (
              <ActivityIndicator color="#d9e3d0" />
            ) : (
              <Text style={styles.signupButtonText}>CREATE ACCOUNT</Text>
            )}
          </TouchableOpacity>

          <View style={styles. loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles. loginLink}>Log In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:  '#6b6e44',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo:  {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginBottom: 8,
  },
  subtitle:  {
    fontSize: 16,
    color: '#b8c4a8',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
  },
  errorBanner: {
    backgroundColor: '#c0392b',
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
    marginBottom: 16,
  },
  label:  {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor:  'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 14,
    color: '#d9e3d0',
    fontSize:  16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor:  '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  hint:  {
    color: '#8a8d6a',
    fontSize: 11,
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  passwordContainer: {
    flexDirection:  'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    backgroundColor:  'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 14,
    color: '#d9e3d0',
    fontSize:  16,
    borderWidth:  1,
    borderColor:  'transparent',
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
  signupButton: {
    backgroundColor: '#4d4d12',
    padding: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity:  0.7,
  },
  signupButtonText: {
    color: '#d9e3d0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#b8c4a8',
    fontSize:  14,
  },
  loginLink: {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: 'bold',
  },
});