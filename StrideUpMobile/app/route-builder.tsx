import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { challengeService, RouteWaypoint, GeocodedPlace } from './services/challengeService';
import { setPendingWaypoints } from './route-store';

const WAYPOINT_COLORS: Record<string, string> = {
  start: '#2ecc71',
  checkpoint: '#f1c40f',
  end: '#e74c3c',
};

const WAYPOINT_ICONS: Record<string, string> = {
  start: 'flag',
  checkpoint: 'location',
  end: 'checkmark-circle',
};

export default function RouteBuilderScreen() {
  const router = useRouter();
  const { communityId, existingWaypoints } = useLocalSearchParams<{
    communityId: string;
    existingWaypoints?: string;
  }>();
  const mapRef = useRef<MapView>(null);

  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [addMode, setAddMode] = useState<'tap' | 'search' | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedPlace[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (existingWaypoints) {
      try {
        const parsed = JSON.parse(existingWaypoints);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWaypoints(parsed);
          if (parsed[0] && mapRef.current) {
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                latitude: parsed[0].latitude,
                longitude: parsed[0].longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              });
            }, 500);
          }
        }
      } catch (e) {
        console.error('Failed to parse existing waypoints:', e);
      }
    }
  }, [existingWaypoints]);

  // Helpers
  const getWaypointType = (index: number, total: number): RouteWaypoint['waypoint_type'] => {
    if (index === 0) return 'start';
    if (index === total - 1 && total > 1) return 'end';
    return 'checkpoint';
  };

  const recomputeTypes = (wps: RouteWaypoint[]): RouteWaypoint[] => {
    return wps.map((wp, i) => ({
      ...wp,
      order: i,
      waypoint_type: getWaypointType(i, wps.length),
    }));
  };

  const handleMapPress = useCallback(
    (e: any) => {
      if (addMode !== 'tap') return;

      const { latitude, longitude } = e.nativeEvent.coordinate;
      const newWp: RouteWaypoint = {
        order: waypoints.length,
        waypoint_type: 'checkpoint',
        latitude,
        longitude,
        name: '',
        radius_meters: 50,
      };

      const updated = recomputeTypes([...waypoints, newWp]);
      setWaypoints(updated);
    },
    [addMode, waypoints]
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await challengeService.geocode(searchQuery);
      setSearchResults(results);
    } catch (err) {
      Alert.alert('Error', 'Failed to search for location.');
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (place: GeocodedPlace) => {
    const newWp: RouteWaypoint = {
      order: waypoints.length,
      waypoint_type: 'checkpoint',
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name.split(',')[0],
      radius_meters: 50,
    };

    const updated = recomputeTypes([...waypoints, newWp]);
    setWaypoints(updated);
    setSearchResults([]);
    setSearchQuery('');
    setAddMode(null);

    mapRef.current?.animateToRegion({
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const removeWaypoint = (index: number) => {
    const updated = [...waypoints];
    updated.splice(index, 1);
    setWaypoints(recomputeTypes(updated));
  };

  const handleMarkerDragEnd = (index: number, e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const updated = [...waypoints];
    updated[index] = { ...updated[index], latitude, longitude };
    setWaypoints(updated);
  };

  const editWaypointName = (index: number, newName: string) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], name: newName };
    setWaypoints(updated);
  };

  // Saving
  // Stores waypoints in the shared module-level store, then simply goes back.
  // challenge-create picks them up via useFocusEffect.
  const handleSave = () => {
    if (waypoints.length < 2) {
      Alert.alert('Not enough points', 'You need at least a Start and an End point.');
      return;
    }

    setPendingWaypoints(waypoints);
    router.back();
  };

  const polyCoords = waypoints.map((wp) => ({
    latitude: wp.latitude,
    longitude: wp.longitude,
  }));

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#d9e3d0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Build Route</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveBtn}>Done ({waypoints.length})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, addMode === 'tap' && styles.modeBtnActive]}
          onPress={() => setAddMode(addMode === 'tap' ? null : 'tap')}
        >
          <Ionicons name="finger-print-outline" size={18} color="#d9e3d0" />
          <Text style={styles.modeBtnText}>
            {addMode === 'tap' ? 'Tap map to place…' : 'Tap to place'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, addMode === 'search' && styles.modeBtnActive]}
          onPress={() => setAddMode(addMode === 'search' ? null : 'search')}
        >
          <Ionicons name="search-outline" size={18} color="#d9e3d0" />
          <Text style={styles.modeBtnText}>Search place</Text>
        </TouchableOpacity>
      </View>

      {addMode === 'search' && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a place..."
            placeholderTextColor="#8a8d6a"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            {searching ? (
              <ActivityIndicator size="small" color="#4a4d2e" />
            ) : (
              <Ionicons name="search" size={20} color="#4a4d2e" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          <FlatList
            data={searchResults}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => selectSearchResult(item)}
              >
                <Ionicons name="location-outline" size={16} color="#d9e3d0" />
                <Text style={styles.searchResultText} numberOfLines={2}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 27.7172,
            longitude: 85.324,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onPress={handleMapPress}
        >
          {polyCoords.length > 1 && (
            <Polyline
              coordinates={polyCoords}
              strokeColor="#d9e3d0"
              strokeWidth={3}
              lineDashPattern={[10, 6]}
            />
          )}

          {waypoints.map((wp, index) => (
            <Marker
              key={index}
              coordinate={{ latitude: wp.latitude, longitude: wp.longitude }}
              draggable
              onDragEnd={(e) => handleMarkerDragEnd(index, e)}
              title={wp.name || wp.waypoint_type}
              description={`#${index + 1} — Drag to adjust`}
            >
              <View
                style={[
                  styles.waypointMarker,
                  { backgroundColor: WAYPOINT_COLORS[wp.waypoint_type] },
                ]}
              >
                <Ionicons
                  name={WAYPOINT_ICONS[wp.waypoint_type] as any}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.waypointMarkerText}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      </View>

      <View style={styles.waypointList}>
        <Text style={styles.waypointListTitle}>
          Waypoints ({waypoints.length})
        </Text>
        <ScrollView style={{ maxHeight: 180 }}>
          {waypoints.map((wp, index) => (
            <View key={index} style={styles.waypointRow}>
              <View
                style={[
                  styles.waypointDot,
                  { backgroundColor: WAYPOINT_COLORS[wp.waypoint_type] },
                ]}
              />
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.waypointNameInput}
                  value={wp.name}
                  onChangeText={(text) => editWaypointName(index, text)}
                  placeholder={`${wp.waypoint_type} #${index + 1} name`}
                  placeholderTextColor="#8a8d6a"
                />
                <Text style={styles.waypointCoords}>
                  {wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeWaypoint(index)}>
                <Ionicons name="close-circle" size={22} color="#e74c3c" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5c5f3d' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 50,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#d9e3d0' },
  saveBtn: { color: '#2ecc71', fontWeight: '700', fontSize: 15 },
  modeRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)', gap: 6,
  },
  modeBtnActive: { backgroundColor: 'rgba(46,204,113,0.3)', borderWidth: 1, borderColor: '#2ecc71' },
  modeBtnText: { color: '#d9e3d0', fontSize: 13, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8,
  },
  searchInput: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: '#d9e3d0', fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#d9e3d0', borderRadius: 10, paddingHorizontal: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  searchResults: {
    marginHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10, maxHeight: 150, marginBottom: 8,
  },
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchResultText: { color: '#d9e3d0', fontSize: 13, flex: 1 },
  mapContainer: { flex: 1, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  waypointMarker: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 12, gap: 3,
  },
  waypointMarkerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  waypointList: {
    padding: 16, backgroundColor: 'rgba(0,0,0,0.2)', borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  waypointListTitle: { color: '#d9e3d0', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  waypointRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10,
  },
  waypointDot: { width: 10, height: 10, borderRadius: 5 },
  waypointNameInput: {
    color: '#d9e3d0', fontSize: 14, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 2,
  },
  waypointCoords: { color: '#8a8d6a', fontSize: 11, marginTop: 2 },
});