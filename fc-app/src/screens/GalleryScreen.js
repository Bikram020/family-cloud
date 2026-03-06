import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { galleryAPI, SERVER_URL } from '../services/api';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

export default function GalleryScreen() {
  const { token, user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  const loadPhotos = async () => {
    try {
      console.log('Loading gallery for:', user?.username);
      const data = await galleryAPI.getMyPhotos(token);
      console.log('Gallery response:', JSON.stringify(data));
      setPhotos(data.files || []);
      setStorage(data.storage);
    } catch (error) {
      console.log('Gallery error:', error.message, error.status);
      Alert.alert('Gallery Error', error.message || 'Could not load photos');
    } finally { setLoading(false); setRefreshing(false); }
  };

  const handleDelete = (photo) => {
    Alert.alert('Delete Photo', 'Delete this photo from the cloud?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await galleryAPI.deletePhoto(token, photo.filename); setSelectedPhoto(null); loadPhotos(); }
          catch (error) { Alert.alert('Error', error.message); }
        }
      },
    ]);
  };

  const getImageUrl = (photo) => `${SERVER_URL}/files/${user.username}/${photo.filename}?token=${token}`;

  const renderPhoto = ({ item }) => (
    <TouchableOpacity style={s.photoCard} onPress={() => setSelectedPhoto(item)} activeOpacity={0.8}>
      <Image
        source={{ uri: getImageUrl(item) }}
        style={s.photoImage}
        resizeMode="cover"
        onError={(e) => console.log('Image load error:', e.nativeEvent.error, getImageUrl(item))}
      />
    </TouchableOpacity>
  );

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6c5ce7" /></View>;

  return (
    <View style={s.container}>
      {storage && (
        <View style={s.storageBar}>
          <View style={s.storageRow}>
            <Text style={s.storageText}>{storage.used} / {storage.quota} used</Text>
            <Text style={s.photoCount}>{photos.length} photos</Text>
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${Math.min(storage.usagePercent || 0, 100)}%` }]} /></View>
        </View>
      )}
      {photos.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📸</Text>
          <Text style={s.emptyTitle}>No photos yet</Text>
          <Text style={s.emptyText}>Upload your first photo using the Upload tab!</Text>
        </View>
      ) : (
        <FlatList data={photos} renderItem={renderPhoto} keyExtractor={(item) => item.filename} numColumns={3} contentContainerStyle={s.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPhotos(); }} tintColor="#6c5ce7" />} />
      )}
      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={s.modal}>
          <TouchableOpacity style={s.closeBtn} onPress={() => setSelectedPhoto(null)}><Text style={s.closeTxt}>✕</Text></TouchableOpacity>
          {selectedPhoto && (
            <>
              <Image source={{ uri: getImageUrl(selectedPhoto) }} style={s.fullImg} resizeMode="contain" />
              <View style={s.modalInfo}>
                <Text style={s.modalFile}>{selectedPhoto.filename}</Text>
                <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(selectedPhoto)}><Text style={s.delTxt}>🗑 Delete</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  storageBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  storageText: { color: '#aaa', fontSize: 13 },
  photoCount: { color: '#6c5ce7', fontSize: 13, fontWeight: '600' },
  track: { height: 4, backgroundColor: '#1a1a2e', borderRadius: 2 },
  fill: { height: 4, backgroundColor: '#6c5ce7', borderRadius: 2 },
  grid: { padding: 12 },
  photoCard: { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: 4, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a1a2e' },
  photoImage: { width: '100%', height: '100%' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 20 },
  fullImg: { width: width, height: width },
  modalInfo: { alignItems: 'center', marginTop: 20 },
  modalFile: { color: '#aaa', fontSize: 12, marginBottom: 16 },
  delBtn: { backgroundColor: '#e74c3c', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  delTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
