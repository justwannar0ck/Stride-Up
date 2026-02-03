import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CommunityScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.pageHeader}>
        <Ionicons name="people-outline" size={20} color="#d9e3d0" />
        <Text style={styles.pageTitle}>Social</Text>
      </View>

      {/* Sample Post */}
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#8a8d6a" />
          </View>
          <View style={styles.postUserInfo}>
            <Text style={styles.username}>shidharth_kharga</Text>
            <Text style={styles.postDate}>December 18 2025, Nagarkot</Text>
          </View>
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>Following</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.postText}>The views were crazy ! !</Text>
        
        <View style={styles.postImages}>
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image" size={48} color="#8a8d6a" />
            <Text style={styles.imagePlaceholderText}>Activity Photo</Text>
          </View>
          <View style={styles. mapPlaceholder}>
            <Ionicons name="map" size={32} color="#8a8d6a" />
            <Text style={styles.mapPlaceholderText}>Route Map</Text>
          </View>
        </View>
        
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart-outline" size={24} color="#d9e3d0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#d9e3d0" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recommended Users */}
      <Text style={styles.sectionTitle}>Users recommended for you</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recommendedScroll}>
        {['shraajan_giri', 'armiks_barki', 'sujan_paudel']. map((user, index) => (
          <View key={index} style={styles. recommendedUser}>
            <View style={styles.recommendedAvatar}>
              <Ionicons name="person" size={32} color="#8a8d6a" />
            </View>
            <Text style={styles.recommendedName}>{user}</Text>
            <TouchableOpacity style={styles.followSmallButton}>
              <Text style={styles.followSmallText}>Follow</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      
      <Text style={styles. comingSoon}>Full social features coming in Sprint 4</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:  1,
    backgroundColor: '#5c5f3d',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9e3d0',
    marginLeft: 10,
  },
  postCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar:  {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postUserInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d9e3d0',
  },
  postDate: {
    fontSize: 11,
    color: '#8a8d6a',
    marginTop: 2,
  },
  followButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 15,
  },
  followButtonText: {
    fontSize: 12,
    color: '#d9e3d0',
    fontWeight:  '500',
  },
  postText: {
    fontSize:  14,
    color: '#d9e3d0',
    marginBottom: 12,
  },
  postImages: {
    flexDirection: 'row',
    marginBottom: 12,
    height: 180,
  },
  imagePlaceholder: {
    flex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems:  'center',
  },
  imagePlaceholderText:  {
    fontSize: 12,
    color: '#8a8d6a',
    marginTop: 8,
  },
  mapPlaceholder: {
    flex:  1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 10,
    color: '#8a8d6a',
    marginTop: 4,
  },
  postActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
  },
  sectionTitle: {
    fontSize:  16,
    fontWeight: '600',
    color: '#d9e3d0',
    marginBottom: 12,
  },
  recommendedScroll: {
    marginBottom: 20,
  },
  recommendedUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginRight: 12,
    width: 110,
  },
  recommendedAvatar: {
    width:  56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendedName: {
    fontSize: 11,
    color: '#d9e3d0',
    marginBottom: 8,
    textAlign: 'center',
  },
  followSmallButton:  {
    backgroundColor: '#4a4d2e',
    paddingHorizontal: 16,
    paddingVertical:  6,
    borderRadius:  12,
  },
  followSmallText: {
    fontSize:  11,
    color: '#d9e3d0',
    fontWeight: '500',
  },
  comingSoon: {
    fontSize: 12,
    color: '#8a8d6a',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});