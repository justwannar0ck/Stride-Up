import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  communityService,
  CommunityDetail,
  CommunityMember,
  CommunityRole,
} from './services/communityService';

const ROLE_OPTIONS: { value: CommunityRole; label: string; color: string }[] = [
  { value: 'owner', label: 'Owner', color: '#f1c40f' },
  { value: 'admin', label: 'Admin', color: '#e67e22' },
  { value: 'moderator', label: 'Moderator', color: '#3498db' },
  { value: 'member', label: 'Member', color: '#8a8d6a' },
];

export default function CommunitySettingsScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [pendingRequests, setPendingRequests] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('public');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Shows which member's role picker is open
  const [rolePickerFor, setRolePickerFor] = useState<number | null>(null);

  const isOwner = community?.my_role === 'owner';

  const fetchData = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoading(true);
      const id = parseInt(communityId);
      const [communityData, membersData, pendingData] = await Promise.all([
        communityService.getCommunity(id),
        communityService.getMembers(id),
        communityService.getPendingRequests(id).catch(() => []),
      ]);
      setCommunity(communityData);
      setMembers(membersData);
      setPendingRequests(pendingData);

      // Populates edit form
      setEditName(communityData.name);
      setEditDescription(communityData.description || '');
      setEditVisibility(communityData.visibility);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      Alert.alert('Error', 'Failed to load community settings');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Edit Info

  const handleSaveInfo = async () => {
    if (!community || !editName.trim()) return;
    setIsSaving(true);
    try {
      await communityService.updateCommunity(community.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        visibility: editVisibility,
      });
      Alert.alert('Saved', 'Community settings updated.');
      setHasChanges(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Pending Requests

  const handleApprove = async (membership: CommunityMember) => {
    if (!community) return;
    try {
      await communityService.approveRequest(community.id, membership.id);
      Alert.alert('Approved', `${membership.user.username} is now a member.`);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleReject = async (membership: CommunityMember) => {
    if (!community) return;
    Alert.alert(
      'Reject Request',
      `Reject ${membership.user.username}'s join request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.rejectRequest(community.id, membership.id);
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to reject');
            }
          },
        },
      ]
    );
  };

  // Role Management

  const handleRoleChange = async (membership: CommunityMember, newRole: CommunityRole) => {
    if (!community) return;

    // Prevents changing own role
    if (membership.user.id === community.created_by?.id && newRole !== 'owner') {
      Alert.alert('Error', 'Cannot change the owner\'s role.');
      setRolePickerFor(null);
      return;
    }

    try {
      await communityService.updateMemberRole(community.id, membership.id, newRole);
      Alert.alert('Updated', `${membership.user.username} is now ${newRole}.`);
      setRolePickerFor(null);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update role');
    }
  };

  // Delete Community

  const handleDelete = () => {
    if (!community) return;
    Alert.alert(
      'Delete Community',
      `Are you sure you want to permanently delete "${community.name}"?\n\nThis will remove all members, data, and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await communityService.deleteCommunity(community.id);
              Alert.alert('Deleted', result.detail, [
                {
                  text: 'OK',
                  onPress: () => {
                    // Goes back twice: settings → detail → community list
                    router.back();
                    setTimeout(() => router.back(), 300);
                  },
                },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.detail || 'Failed to delete community'
              );
            }
          },
        },
      ]
    );
  };

  // Render

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#d9e3d0' }}>Community not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>Community Info</Text>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={(text) => {
              setEditName(text);
              setHasChanges(true);
            }}
            placeholder="Community name"
            placeholderTextColor="#8a8d6a"
            maxLength={100}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editDescription}
            onChangeText={(text) => {
              setEditDescription(text);
              setHasChanges(true);
            }}
            placeholder="What's this community about?"
            placeholderTextColor="#8a8d6a"
            multiline
            numberOfLines={4}
            maxLength={1000}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.visibilityRow}>
            {(['public', 'private'] as const).map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.visibilityOption, editVisibility === v && styles.visibilityActive]}
                onPress={() => {
                  setEditVisibility(v);
                  setHasChanges(true);
                }}
              >
                <Ionicons
                  name={v === 'public' ? 'earth' : 'lock-closed'}
                  size={16}
                  color={editVisibility === v ? '#4a4d2e' : '#d9e3d0'}
                />
                <Text
                  style={[
                    styles.visibilityText,
                    editVisibility === v && styles.visibilityTextActive,
                  ]}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {hasChanges && (
            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
              onPress={handleSaveInfo}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#4a4d2e" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#4a4d2e" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-add-outline" size={18} color="#f1c40f" />
              <Text style={styles.sectionTitle}>
                Pending Requests ({pendingRequests.length})
              </Text>
            </View>

            {pendingRequests.map((req) => (
              <View key={req.id} style={styles.pendingRow}>
                <View style={styles.memberAvatar}>
                  <Ionicons name="person" size={18} color="#8a8d6a" />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {req.user.full_name || req.user.username}
                  </Text>
                  <Text style={styles.memberUsername}>@{req.user.username}</Text>
                </View>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => handleApprove(req)}
                >
                  <Ionicons name="checkmark" size={18} color="#2ecc71" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleReject(req)}
                >
                  <Ionicons name="close" size={18} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          </View>

          {members.map((membership) => {
            const isCurrentUserOwner = isOwner;
            const isSelf =
              community.created_by?.id === membership.user.id &&
              membership.role === 'owner';

            return (
              <View key={membership.id} style={styles.memberManageRow}>
                <View style={styles.memberAvatar}>
                  <Ionicons name="person" size={18} color="#8a8d6a" />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {membership.user.full_name || membership.user.username}
                  </Text>
                  <Text style={styles.memberUsername}>@{membership.user.username}</Text>
                </View>

                {isCurrentUserOwner && !isSelf ? (
                  <TouchableOpacity
                    style={[
                      styles.roleBadge,
                      {
                        borderColor:
                          ROLE_OPTIONS.find((r) => r.value === membership.role)?.color ||
                          '#8a8d6a',
                      },
                    ]}
                    onPress={() =>
                      setRolePickerFor(
                        rolePickerFor === membership.id ? null : membership.id
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        {
                          color:
                            ROLE_OPTIONS.find((r) => r.value === membership.role)?.color ||
                            '#8a8d6a',
                        },
                      ]}
                    >
                      {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color="#8a8d6a" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        borderColor:
                          ROLE_OPTIONS.find((r) => r.value === membership.role)?.color ||
                          '#8a8d6a',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        {
                          color:
                            ROLE_OPTIONS.find((r) => r.value === membership.role)?.color ||
                            '#8a8d6a',
                        },
                      ]}
                    >
                      {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
                    </Text>
                  </View>
                )}

                {rolePickerFor === membership.id && (
                  <View style={styles.roleDropdown}>
                    {ROLE_OPTIONS.filter((r) => r.value !== 'owner').map((roleOpt) => (
                      <TouchableOpacity
                        key={roleOpt.value}
                        style={[
                          styles.roleDropdownItem,
                          membership.role === roleOpt.value && styles.roleDropdownItemActive,
                        ]}
                        onPress={() => handleRoleChange(membership, roleOpt.value)}
                      >
                        <View
                          style={[styles.roleColorDot, { backgroundColor: roleOpt.color }]}
                        />
                        <Text style={styles.roleDropdownText}>{roleOpt.label}</Text>
                        {membership.role === roleOpt.value && (
                          <Ionicons name="checkmark" size={16} color="#d9e3d0" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {isOwner && (
          <View style={styles.dangerSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={18} color="#e74c3c" />
              <Text style={[styles.sectionTitle, { color: '#e74c3c' }]}>Danger Zone</Text>
            </View>
            <Text style={styles.dangerDescription}>
              Deleting this community is permanent. All members will be removed and all
              associated data will be lost.
            </Text>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#e74c3c" />
              <Text style={styles.deleteButtonText}>Delete Community</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5c5f3d' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#d9e3d0' },
  placeholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Sections
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 8,
  },

  // Form
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b8c4a8',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#d9e3d0',
    fontSize: 14,
  },
  textArea: { height: 90 },
  visibilityRow: { flexDirection: 'row', gap: 10 },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  visibilityActive: { backgroundColor: '#d9e3d0' },
  visibilityText: { color: '#d9e3d0', marginLeft: 6, fontSize: 13 },
  visibilityTextActive: { color: '#4a4d2e', fontWeight: '600' },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d9e3d0',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a4d2e',
    marginLeft: 6,
  },

  // Pending Requests
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },

  // Members
  memberManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    flexWrap: 'wrap',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: { flex: 1, marginLeft: 10 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#d9e3d0' },
  memberUsername: { fontSize: 12, color: '#8a8d6a' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '500' },

  // Role Dropdown
  roleDropdown: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 6,
    marginTop: 8,
  },
  roleDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  roleDropdownItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  roleColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  roleDropdownText: {
    flex: 1,
    fontSize: 14,
    color: '#d9e3d0',
  },

  // Danger Zone
  dangerSection: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  dangerDescription: {
    fontSize: 13,
    color: '#b8c4a8',
    lineHeight: 18,
    marginBottom: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.4)',
    borderRadius: 12,
    padding: 14,
  },
  deleteButtonText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});