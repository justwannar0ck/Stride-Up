import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  challengeService,
  ChallengeType,
  ContributionScope,
  ActivityType,
} from './services/challengeService';

// ─── Config ──────────────────────��───────────────────────────────────────────

const CHALLENGE_TYPES: {
  value: ChallengeType;
  label: string;
  icon: string;
  unit: string;
}[] = [
  { value: 'distance', label: 'Distance', icon: 'map-outline', unit: 'km' },
  { value: 'duration', label: 'Duration', icon: 'time-outline', unit: 'hours' },
  { value: 'count', label: 'Activity Count', icon: 'list-outline', unit: 'activities' },
  { value: 'elevation', label: 'Elevation', icon: 'trending-up-outline', unit: 'meters' },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'run', label: 'Run', icon: 'walk-outline' },
  { value: 'walk', label: 'Walk', icon: 'footsteps-outline' },
  { value: 'cycle', label: 'Cycle', icon: 'bicycle-outline' },
  { value: 'hike', label: 'Hike', icon: 'trail-sign-outline' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChallengeCreateScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('distance');
  const [scope, setScope] = useState<ContributionScope>('collective');
  const [selectedActivities, setSelectedActivities] = useState<ActivityType[]>(['run']);
  const [targetValue, setTargetValue] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTypeConfig = CHALLENGE_TYPES.find((t) => t.value === challengeType)!;

  const toggleActivity = (type: ActivityType) => {
    setSelectedActivities((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const onStartDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (date) setStartDate(date);
  };

  const onEndDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (date) setEndDate(date);
  };

  const formatDateDisplay = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a challenge title.');
      return;
    }
    if (!targetValue || parseFloat(targetValue) <= 0) {
      Alert.alert('Error', 'Please enter a valid target value.');
      return;
    }
    if (startDate >= endDate) {
      Alert.alert('Error', 'End date must be after start date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await challengeService.createChallenge(parseInt(communityId!), {
        title: title.trim(),
        description: description.trim(),
        challenge_type: challengeType,
        contribution_scope: scope,
        activity_types: selectedActivities,
        target_value: parseFloat(targetValue),
        target_unit: selectedTypeConfig.unit,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      Alert.alert('Created!', 'Your challenge is live.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail ||
          (typeof error.response?.data === 'object'
            ? JSON.stringify(error.response.data)
            : 'Failed to create challenge')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4a4d2e" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Challenge</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Title & Description ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. February Distance Dash"
            placeholderTextColor="#8a8d6a"
            maxLength={200}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this challenge about?"
            placeholderTextColor="#8a8d6a"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={1000}
          />
        </View>

        {/* ── Challenge Type ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>Challenge Type</Text>
          </View>
          <View style={styles.typeGrid}>
            {CHALLENGE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.typeCard, challengeType === type.value && styles.typeCardActive]}
                onPress={() => setChallengeType(type.value)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={22}
                  color={challengeType === type.value ? '#4a4d2e' : '#d9e3d0'}
                />
                <Text
                  style={[styles.typeLabel, challengeType === type.value && styles.typeLabelActive]}
                >
                  {type.label}
                </Text>
                <Text
                  style={[styles.typeUnit, challengeType === type.value && styles.typeUnitActive]}
                >
                  ({type.unit})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Scope ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>Goal Type</Text>
          </View>
          <View style={styles.scopeRow}>
            {([
              {
                value: 'collective' as ContributionScope,
                label: 'Collective',
                desc: 'Everyone contributes to one shared goal',
                icon: 'people',
              },
              {
                value: 'individual' as ContributionScope,
                label: 'Individual',
                desc: 'Each member has their own target',
                icon: 'person',
              },
            ]).map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.scopeCard, scope === s.value && styles.scopeCardActive]}
                onPress={() => setScope(s.value)}
              >
                <Ionicons
                  name={s.icon as any}
                  size={20}
                  color={scope === s.value ? '#4a4d2e' : '#d9e3d0'}
                />
                <Text
                  style={[styles.scopeLabel, scope === s.value && styles.scopeLabelActive]}
                >
                  {s.label}
                </Text>
                <Text
                  style={[styles.scopeDesc, scope === s.value && styles.scopeDescActive]}
                >
                  {s.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Target ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flag-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>Target</Text>
          </View>
          <View style={styles.targetRow}>
            <TextInput
              style={[styles.input, styles.targetInput]}
              value={targetValue}
              onChangeText={setTargetValue}
              placeholder="e.g. 500"
              placeholderTextColor="#8a8d6a"
              keyboardType="numeric"
            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitText}>{selectedTypeConfig.unit}</Text>
            </View>
          </View>
          <Text style={styles.helperText}>
            {scope === 'collective'
              ? 'Total goal for the entire community combined.'
              : 'Each member needs to hit this target individually.'}
          </Text>
        </View>

        {/* ── Activity Types ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="fitness-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>Qualifying Activities</Text>
          </View>
          <View style={styles.activityGrid}>
            {ACTIVITY_TYPES.map((a) => {
              const isSelected = selectedActivities.includes(a.value);
              return (
                <TouchableOpacity
                  key={a.value}
                  style={[styles.activityChip, isSelected && styles.activityChipActive]}
                  onPress={() => toggleActivity(a.value)}
                >
                  <Ionicons
                    name={a.icon as any}
                    size={18}
                    color={isSelected ? '#4a4d2e' : '#d9e3d0'}
                  />
                  <Text
                    style={[
                      styles.activityChipText,
                      isSelected && styles.activityChipTextActive,
                    ]}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Dates ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={18} color="#d9e3d0" />
            <Text style={styles.sectionTitle}>Duration</Text>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="calendar" size={16} color="#8a8d6a" />
                <Text style={styles.dateText}>{formatDateDisplay(startDate)}</Text>
              </TouchableOpacity>
            </View>

            <Ionicons
              name="arrow-forward"
              size={18}
              color="#8a8d6a"
              style={{ marginTop: 28 }}
            />

            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="calendar" size={16} color="#8a8d6a" />
                <Text style={styles.dateText}>{formatDateDisplay(endDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onStartDateChange}
              minimumDate={new Date()}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onEndDateChange}
              minimumDate={startDate}
            />
          )}
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#4a4d2e" size="small" />
          ) : (
            <>
              <Ionicons name="trophy-outline" size={20} color="#4a4d2e" />
              <Text style={styles.submitButtonText}>Create Challenge</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5c5f3d' },

  // Header — matches account.tsx pattern
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
  backButton: { padding: 4, width: 32 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
    textAlign: 'center',
    flex: 1,
  },
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
    marginBottom: 14,
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
  textArea: { height: 80 },
  helperText: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 8,
    lineHeight: 16,
  },

  // Type cards
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '47%' as any,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeCardActive: {
    backgroundColor: '#d9e3d0',
    borderColor: '#d9e3d0',
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d9e3d0',
    marginTop: 6,
  },
  typeLabelActive: { color: '#4a4d2e' },
  typeUnit: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 2,
  },
  typeUnitActive: { color: '#5c5f3d' },

  // Scope
  scopeRow: { gap: 10 },
  scopeCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  scopeCardActive: {
    backgroundColor: '#d9e3d0',
    borderColor: '#d9e3d0',
  },
  scopeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9e3d0',
    marginLeft: 10,
    flex: 1,
  },
  scopeLabelActive: { color: '#4a4d2e' },
  scopeDesc: {
    fontSize: 12,
    color: '#8a8d6a',
    width: '100%',
    marginTop: 6,
    marginLeft: 30,
  },
  scopeDescActive: { color: '#5c5f3d' },

  // Target
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  targetInput: { flex: 1 },
  unitBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9e3d0',
  },

  // Activity chips
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  activityChipActive: {
    backgroundColor: '#d9e3d0',
    borderColor: '#d9e3d0',
  },
  activityChipText: {
    fontSize: 13,
    color: '#d9e3d0',
    marginLeft: 6,
    fontWeight: '500',
  },
  activityChipTextActive: { color: '#4a4d2e' },

  // Dates
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateField: { flex: 1 },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b8c4a8',
    marginBottom: 6,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#d9e3d0',
    marginLeft: 8,
  },

  // Submit
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9e3d0',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a4d2e',
    marginLeft: 8,
  },
});