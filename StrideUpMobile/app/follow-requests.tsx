import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { followService, FollowRequest } from './services/followService';

export default function FollowRequestsScreen() {
  const router = useRouter();

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const fetchRequests = useCallback(async () => {
    try {
      const response = await followService.getFollowRequests();
      setRequests(response.results);
    } catch (err) {
      Alert.alert('Error', 'Failed to load follow requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleAccept = async (request: FollowRequest) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));

    try {
      await followService.acceptFollowRequest(request.id);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      Alert.alert('Error', 'Failed to accept request');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const handleReject = async (request: FollowRequest) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));

    try {
      await followService.rejectFollowRequest(request.id);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      Alert.alert('Error', 'Failed to reject request');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const handleAcceptAll = async () => {
    if (requests.length === 0) return;

    Alert.alert(
      'Accept All',
      `Accept all ${requests.length} follow requests?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept All',
          onPress: async () => {
            try {
              await followService.acceptAllFollowRequests();
              setRequests([]);
            } catch (err) {
              Alert.alert('Error', 'Failed to accept requests');
            }
          },
        },
      ]
    );
  };

  const navigateToProfile = (username: string) => {
    router.push(`/user/${username}`);
  };

  const renderItem = ({ item }: { item: FollowRequest }) => {
    const isProcessing = processingIds.has(item.id);

    return (
      <View style={styles.requestItem}>
        <TouchableOpacity
          style={styles.userSection}
          onPress={() => navigateToProfile(item.user.username)}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#8a8d6a" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.fullName} numberOfLines={1}>
              {item.user.full_name || item.user.username}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{item.user.username}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#d9e3d0" />
          ) : (
            <>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAccept(item)}
              >
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleReject(item)}
              >
                <Ionicons name="close" size={20} color="#d9e3d0" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
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
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Follow Requests</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#d9e3d0" />
        </View>
      ) : (
        <>
          {requests.length > 1 && (
            <TouchableOpacity 
              style={styles.acceptAllButton} 
              onPress={handleAcceptAll}
            >
              <Text style={styles.acceptAllText}>
                Accept All ({requests.length})
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={requests}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.list}
            contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.listContent}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                tintColor="#d9e3d0"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#8a8d6a" />
                <Text style={styles.emptyTitle}>No Follow Requests</Text>
                <Text style={styles.emptyText}>
                  When someone requests to follow you, it will appear here.
                </Text>
              </View>
            }
          />
        </>
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
  },
  placeholder: {
    width: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  acceptAllButton: {
    backgroundColor: 'rgba(217, 227, 208, 0.2)',
    margin: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217, 227, 208, 0.3)',
  },
  acceptAllText: {
    color: '#d9e3d0',
    fontWeight: '600',
    fontSize: 15,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  username: {
    fontSize: 14,
    color: '#8a8d6a',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: 'rgba(217, 227, 208, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptText: {
    color: '#d9e3d0',
    fontWeight: '600',
    fontSize: 14,
  },
  rejectButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8a8d6a',
    marginTop: 8,
    textAlign: 'center',
  },
});