import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { communityService } from './services/communityService';

const ACTIVITY_OPTIONS = ['run', 'walk', 'cycle', 'hike'];

export default function CommunityCreateScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleActivityType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a community name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const community = await communityService.createCommunity({
        name: name.trim(),
        description: description.trim(),
        visibility,
        activity_types: selectedTypes,
      });
      Alert.alert('Created!', `"${community.name}" is ready.`, [
        {
          text: 'Open',
          onPress: () => {
            router.back();
            // Only navigates to details if we get an id back
            if (community.id) {
              setTimeout(() => {
                router.push({
                  pathname: '/community-detail',
                  params: { communityId: community.id.toString() },
                });
              }, 300);
            }
        },
        },
      ]);
    } catch (error: any) {
      console.error('Create failed:', error);
      Alert.alert('Error', error.response?.data?.name?.[0] || 'Failed to create community');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Community</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Community Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Kathmandu Trail Runners"
          placeholderTextColor="#8a8d6a"
          maxLength={100}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this community about?"
          placeholderTextColor="#8a8d6a"
          multiline
          numberOfLines={4}
          maxLength={1000}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Visibility</Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[styles.option, visibility === 'public' && styles.optionActive]}
            onPress={() => setVisibility('public')}
          >
            <Ionicons name="earth" size={20} color={visibility === 'public' ? '#4a4d2e' : '#d9e3d0'} />
            <Text style={[styles.optionText, visibility === 'public' && styles.optionTextActive]}>
              Public
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, visibility === 'private' && styles.optionActive]}
            onPress={() => setVisibility('private')}
          >
            <Ionicons name="lock-closed" size={20} color={visibility === 'private' ? '#4a4d2e' : '#d9e3d0'} />
            <Text style={[styles.optionText, visibility === 'private' && styles.optionTextActive]}>
              Private
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          {visibility === 'public'
            ? 'Anyone can find and join this community.'
            : 'Users must request to join. Admins approve.'}
        </Text>

        <Text style={styles.label}>Activity Focus (optional)</Text>
        <View style={styles.optionsRow}>
          {ACTIVITY_OPTIONS.map((type) => {
            const active = selectedTypes.includes(type);
            return (
              <TouchableOpacity
                key={type}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleActivityType(type)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.createBtn, isSubmitting && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#4a4d2e" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#4a4d2e" />
              <Text style={styles.createBtnText}>Create Community</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5c5f3d' },
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 30) + 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#d9e3d0' },
  placeholder: { width: 32 },
  content: { padding: 16, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: '600', color: '#d9e3d0', marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#d9e3d0', fontSize: 14,
  },
  textArea: { height: 100 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  optionActive: { backgroundColor: '#d9e3d0', borderColor: '#d9e3d0' },
  optionText: { color: '#d9e3d0', marginLeft: 6, fontSize: 14 },
  optionTextActive: { color: '#4a4d2e', fontWeight: '600' },
  hint: { fontSize: 12, color: '#8a8d6a', marginTop: 6 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 16, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#d9e3d0' },
  chipText: { fontSize: 13, color: '#d9e3d0' },
  chipTextActive: { color: '#4a4d2e', fontWeight: '600' },
  createBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#d9e3d0', paddingVertical: 14, borderRadius: 16, marginTop: 32,
  },
  createBtnText: { fontSize: 16, fontWeight: '600', color: '#4a4d2e', marginLeft: 8 },
});