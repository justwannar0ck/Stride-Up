import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  TextInput,
  Modal,
} from 'react-native';
import MapView, { Marker, Circle, MapPressEvent } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { 
  privacyService, 
  PrivacyZone, 
  PrivacySettings 
} from './services/privacyService';
import * as Location from 'expo-location';

export default function PrivacySettingsScreen() {
  const router = useRouter();
  
  // State
  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Add zone modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(200);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [zonesData, settingsData] = await Promise.all([
        privacyService.getPrivacyZones(),
        privacyService.getPrivacySettings(),
      ]);
      setZones(zonesData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load privacy data:', error);
      Alert.alert('Error', 'Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (
    key: keyof PrivacySettings, 
    value: boolean | number | string
  ) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      await privacyService.updatePrivacySettings({ [key]: value });
    } catch (error) {
      console.error('Failed to update setting:', error);
      // Revert on error
      setSettings(settings);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    setSelectedLocation(event.nativeEvent.coordinate);
  };

  const handleAddZone = async () => {
    if (!selectedLocation || !newZoneName.trim()) {
      Alert.alert('Error', 'Please select a location and enter a name');
      return;
    }

    try {
      setSaving(true);
      const newZone = await privacyService.createPrivacyZone({
        name: newZoneName.trim(),
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        radius: newZoneRadius,
      });
      
      setZones([...zones, newZone]);
      setShowAddModal(false);
      setNewZoneName('');
      setNewZoneRadius(200);
      setSelectedLocation(null);
      
      Alert.alert('Success', `Privacy zone "${newZone.name}" created`);
    } catch (error: any) {
      console.error('Failed to create zone:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.detail || 'Failed to create privacy zone'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = (zone: PrivacyZone) => {
    Alert.alert(
      'Delete Privacy Zone',
      `Are you sure you want to delete "${zone.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await privacyService.deletePrivacyZone(zone.id);
              setZones(zones.filter(z => z.id !== zone.id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete privacy zone');
            }
          },
        },
      ]
    );
  };

  const toggleZoneActive = async (zone: PrivacyZone) => {
    try {
      const updatedZone = await privacyService.updatePrivacyZone(zone.id, {
        is_active: !zone.is_active,
      });
      setZones(zones.map(z => z.id === zone.id ? updatedZone : z));
    } catch (error) {
      Alert.alert('Error', 'Failed to update privacy zone');
    }
  };

  const renderZoneItem = ({ item }: { item: PrivacyZone }) => (
    <View style={styles.zoneItem}>
      <TouchableOpacity 
        style={styles.zoneInfo}
        onPress={() => toggleZoneActive(item)}
      >
        <View style={[
          styles.zoneIcon,
          !item.is_active && styles.zoneIconInactive
        ]}>
          <Ionicons 
            name="location" 
            size={24} 
            color={item.is_active ? "#4a4d2e" : "#8a8d6a"} 
          />
        </View>
        <View style={styles.zoneText}>
          <Text style={[
            styles.zoneName,
            !item.is_active && styles.zoneNameInactive
          ]}>
            {item.name}
          </Text>
          <Text style={styles.zoneRadius}>
            {item.radius}m radius • {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteZone(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d9e3d0" />
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <FlatList
        style={styles.content}
        ListHeaderComponent={
          <>
            {/* Default Settings Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Default Activity Settings</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Hide Start & End</Text>
                  <Text style={styles.settingDescription}>
                    Mask the first and last portions of your route
                  </Text>
                </View>
                <Switch
                  value={settings?.default_hide_start_end ?? false}
                  onValueChange={(value) => 
                    handleSettingChange('default_hide_start_end', value)
                  }
                  trackColor={{ false: '#3a3d2a', true: '#8a8d6a' }}
                  thumbColor={settings?.default_hide_start_end ? '#d9e3d0' : '#666'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Privacy Radius</Text>
                  <Text style={styles.settingDescription}>
                    {settings?.default_privacy_radius ?? 200}m around start/end points
                  </Text>
                </View>
                <View style={styles.radiusSelector}>
                  {[100, 200, 500].map((radius) => (
                    <TouchableOpacity
                      key={radius}
                      style={[
                        styles.radiusOption,
                        settings?.default_privacy_radius === radius && 
                          styles.radiusOptionActive
                      ]}
                      onPress={() => 
                        handleSettingChange('default_privacy_radius', radius)
                      }
                    >
                      <Text style={[
                        styles.radiusOptionText,
                        settings?.default_privacy_radius === radius && 
                          styles.radiusOptionTextActive
                      ]}>
                        {radius}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Privacy Zones Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Privacy Zones</Text>
                  <Text style={styles.sectionDescription}>
                    Routes passing through these areas will be hidden
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Ionicons name="add" size={24} color="#d9e3d0" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        data={zones}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderZoneItem}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shield-outline" size={48} color="#8a8d6a" />
            <Text style={styles.emptyText}>No privacy zones set</Text>
            <Text style={styles.emptySubtext}>
              Add zones around places like home or work
            </Text>
          </View>
        }
      />

      {/* Add Zone Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={28} color="#d9e3d0" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Privacy Zone</Text>
            <TouchableOpacity 
              onPress={handleAddZone}
              disabled={saving || !selectedLocation || !newZoneName.trim()}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#d9e3d0" />
              ) : (
                <Text style={[
                  styles.saveButtonText,
                  (!selectedLocation || !newZoneName.trim()) && 
                    styles.saveButtonDisabled
                ]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Zone Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Home, Work, Gym"
              placeholderTextColor="#8a8d6a"
              value={newZoneName}
              onChangeText={setNewZoneName}
            />

            <Text style={styles.inputLabel}>Radius</Text>
            <View style={styles.radiusSelector}>
              {[100, 200, 300, 500].map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={[
                    styles.radiusOption,
                    newZoneRadius === radius && styles.radiusOptionActive
                  ]}
                  onPress={() => setNewZoneRadius(radius)}
                >
                  <Text style={[
                    styles.radiusOptionText,
                    newZoneRadius === radius && styles.radiusOptionTextActive
                  ]}>
                    {radius}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>
              Tap the map to select location
            </Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: currentLocation?.latitude ?? 27.7172,
                  longitude: currentLocation?.longitude ?? 85.324,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
                onPress={handleMapPress}
              >
                {selectedLocation && (
                  <>
                    <Marker coordinate={selectedLocation} />
                    <Circle
                      center={selectedLocation}
                      radius={newZoneRadius}
                      fillColor="rgba(90, 93, 62, 0.3)"
                      strokeColor="#5a5d3e"
                      strokeWidth={2}
                    />
                  </>
                )}
                {currentLocation && !selectedLocation && (
                  <Marker
                    coordinate={currentLocation}
                    pinColor="#8a8d6a"
                    title="Your Location"
                  />
                )}
              </MapView>
            </View>

            {selectedLocation && (
              <TouchableOpacity
                style={styles.useCurrentButton}
                onPress={() => currentLocation && setSelectedLocation(currentLocation)}
              >
                <Ionicons name="locate" size={20} color="#d9e3d0" />
                <Text style={styles.useCurrentText}>Use Current Location</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5c5f3d',
  },
  headerContainer: {
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight,
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
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#4a4d2e',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#8a8d6a',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3d2a',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    color: '#d9e3d0',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#8a8d6a',
  },
  radiusSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#3a3d2a',
  },
  radiusOptionActive: {
    backgroundColor: '#8a8d6a',
  },
  radiusOptionText: {
    fontSize: 13,
    color: '#8a8d6a',
  },
  radiusOptionTextActive: {
    color: '#1a1d0a',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#5c5f3d',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a4d2e',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
  },
  zoneInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d9e3d0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  zoneIconInactive: {
    backgroundColor: '#3a3d2a',
  },
  zoneText: {
    flex: 1,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#d9e3d0',
  },
  zoneNameInactive: {
    color: '#8a8d6a',
  },
  zoneRadius: {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#d9e3d0',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#8a8d6a',
    marginTop: 4,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#5c5f3d',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4a4d2e',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  saveButtonDisabled: {
    color: '#8a8d6a',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#d9e3d0',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#4a4d2e',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#d9e3d0',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  map: {
    flex: 1,
  },
  useCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a4d2e',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  useCurrentText: {
    color: '#d9e3d0',
    fontSize: 14,
    fontWeight: '500',
  },
});