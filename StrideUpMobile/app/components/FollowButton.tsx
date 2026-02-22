import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { followService } from '../services/followService';

type FollowStatus = 'self' | 'following' | 'requested' | 'not_following';

interface FollowButtonProps {
  username: string;
  initialStatus: FollowStatus;
  onStatusChange?: (newStatus: FollowStatus) => void;
  size?: 'small' | 'medium' | 'large';
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  username,
  initialStatus,
  onStatusChange,
  size = 'medium',
}) => {
  const [status, setStatus] = useState<FollowStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  // Does'nt render anything for the user's own profile
  if (status === 'self') {
    return null;
  }

  const handlePress = async () => {
    if (loading) return;

    setLoading(true);

    try {
      if (status === 'following' || status === 'requested') {
        // Unfollow or cancel request
        const confirmMessage = status === 'following'
          ? `Unfollow @${username}?`
          : `Cancel follow request to @${username}?`;

        Alert.alert(
          'Confirm',
          confirmMessage,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            {
              text: 'Confirm',
              style: 'destructive',
              onPress: async () => {
                try {
                  const response = await followService.unfollowUser(username);
                  setStatus(response.status);
                  onStatusChange?.(response.status);
                } catch (error) {
                  Alert.alert('Error', 'Failed to unfollow user');
                } finally {
                  setLoading(false);
                }
              },
            },
          ]
        );
        return;
      }

      // Follow or send request
      const response = await followService.followUser(username);
      setStatus(response.status);
      onStatusChange?.(response.status);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Something went wrong';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size]];

    switch (status) {
      case 'following':
        return [...baseStyle, styles.followingButton];
      case 'requested':
        return [...baseStyle, styles.requestedButton];
      default:
        return [...baseStyle, styles.followButton];
    }
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text, styles[`${size}Text`]];

    switch (status) {
      case 'following':
      case 'requested':
        return [...baseStyle, styles.followingText];
      default:
        return [...baseStyle, styles.followText];
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'following':
        return 'Following';
      case 'requested':
        return 'Requested';
      default:
        return 'Follow';
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={status === 'not_following' ? '#fff' : '#333'}
        />
      ) : (
        <Text style={getTextStyle()}>{getButtonText()}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Size variants
  small: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
  },
  medium: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 100,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 120,
  },
  // Button states
  followButton: {
    backgroundColor: '#FC4C02',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  requestedButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  // Text styles
  text: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 12,
  },
  mediumText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 16,
  },
  followText: {
    color: '#fff',
  },
  followingText: {
    color: '#333',
  },
});

export default FollowButton;