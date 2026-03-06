// ============================================
// Gallery Screen — View uploaded photos
// ============================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { galleryAPI, SERVER_URL } from '../services/api';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3; // 3 columns with gaps

export default function GalleryScreen() {
  const { token, user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Refresh gallery when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [])
  );

  const loadPhotos = async () => {
    try {
      const data = await galleryAPI.getMyPhotos(token);
      setPhotos(data.files || []);
      setStorage(data.storage);
    } catch (error) {
      console.log('Gallery error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = (photo) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo from the cloud?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await galleryAPI.deletePhoto(token, photo.filename);
              setSelectedPhoto(null);
              loadPhotos(); // Refresh the list
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const getImageUrl = (photo) => {
    return `${SERVER_URL}/files/${user.username}/${photo.filename}`;
  };

  const renderPhoto = ({ item }) => (
    <TouchableOpacity
      style={styles.photoCard}
      onPress={() => setSelectedPhoto(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{
          uri: getImageUrl(item),
          headers: { Authorization: `Bearer ${token}` },
        }}
        style={styles.photoImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Storage Bar */}
      {storage && (
        <View style={styles.storageBar}>
          <View style={styles.storageInfo}>
            <Text style={styles.storageText}>
              {storage.used} / {storage.quota} used
            </Text>
            <Text style={styles.photoCount}>{photos.length} photos</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.min(storage.usagePercent, 100)}%` }]}
            />
          </View>
        </View>
      )}

      {/* Photo Grid */}
      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptyText}>Upload your first photo using the + tab below!</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.filename}
          numColumns={3}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadPhotos(); }}
              tintColor="#6c5ce7"
            />
          }
        />
      )}

      {/* Full-screen photo viewer */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {selectedPhoto && (
            <>
              <Image
                source={{
                  uri: getImageUrl(selectedPhoto),
                  headers: { Authorization: `Bearer ${token}` },
                }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              <View style={styles.modalInfo}>
                <Text style={styles.modalFilename}>{selectedPhoto.filename}</Text>
                <Text style={styles.modalSize}>{selectedPhoto.size}</Text>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(selectedPhoto)}
                >
                  <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  storageBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  storageText: {
    color: '#aaa',
    fontSize: 13,
  },
  photoCount: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#6c5ce7',
    borderRadius: 2,
  },
  grid: {
    padding: 12,
  },
  photoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 20,
  },
  fullImage: {
    width: width,
    height: width,
  },
  modalInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  modalFilename: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  modalSize: {
    color: '#888',
    fontSize: 12,
    marginBottom: 16,
  },
  deleteBtn: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
