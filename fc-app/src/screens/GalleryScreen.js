import React, { useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal, Dimensions, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { galleryAPI, SERVER_URL } from '../services/api';

const { width, height } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

export default function GalleryScreen() {
  const { token, user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  const loadPhotos = async () => {
    try {
      const data = await galleryAPI.getMyPhotos(token);
      setPhotos(data.files || []);
      setStorage(data.storage);
    } catch (error) {
      Alert.alert('Gallery Error', error.message || 'Could not load photos');
    } finally { setLoading(false); setRefreshing(false); }
  };

  const openViewer = (index) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleDelete = () => {
    const photo = photos[viewerIndex];
    Alert.alert('Delete Photo', 'Delete this photo from the cloud?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await galleryAPI.deletePhoto(token, photo.filename);
          const newPhotos = photos.filter((_, i) => i !== viewerIndex);
          setPhotos(newPhotos);
          if (newPhotos.length === 0) setViewerVisible(false);
          else if (viewerIndex >= newPhotos.length) setViewerIndex(newPhotos.length - 1);
        } catch (error) { Alert.alert('Error', error.message); }
      }},
    ]);
  };

  const getImageUrl = (photo) => `${SERVER_URL}/files/${user.username}/${photo.filename}?token=${token}`;

  const renderPhoto = ({ item, index }) => (
    <TouchableOpacity style={s.photoCard} onPress={() => openViewer(index)} activeOpacity={0.8}>
      <Image source={{ uri: getImageUrl(item) }} style={s.photoImage} resizeMode="cover" />
    </TouchableOpacity>
  );

  // Each slide is a zoomable ScrollView wrapping the image
  const renderViewerItem = ({ item }) => (
    <View style={s.viewerSlide}>
      <ScrollView
        style={s.zoomContainer}
        contentContainerStyle={s.zoomContent}
        maximumZoomScale={5}
        minimumZoomScale={1}
        bouncesZoom={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        centerContent={true}
      >
        <Image source={{ uri: getImageUrl(item) }} style={s.fullImg} resizeMode="contain" />
      </ScrollView>
    </View>
  );

  const onViewerScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== viewerIndex && idx >= 0 && idx < photos.length) {
      setViewerIndex(idx);
    }
  };

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

      {/* Full-screen swipeable + zoomable photo viewer */}
      <Modal visible={viewerVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modal}>
          {/* Top bar — counter + close */}
          <View style={s.topBar}>
            <Text style={s.counter}>{viewerIndex + 1} / {photos.length}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={() => setViewerVisible(false)}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Swipeable image area */}
          <FlatList
            data={photos}
            renderItem={renderViewerItem}
            keyExtractor={(item) => item.filename}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onViewerScroll}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          />

          {/* Bottom bar — filename + delete */}
          <View style={s.bottomBar}>
            <Text style={s.modalFile} numberOfLines={1}>{photos[viewerIndex]?.filename}</Text>
            <Text style={s.modalSize}>{photos[viewerIndex]?.size}</Text>
            <TouchableOpacity style={s.delBtn} onPress={handleDelete}>
              <Text style={s.delTxt}>🗑 Delete</Text>
            </TouchableOpacity>
          </View>
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

  // Full-screen viewer
  modal: { flex: 1, backgroundColor: '#000' },

  // Top bar with counter and close
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 10, zIndex: 10 },
  counter: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 18 },

  // Zoomable image slide
  viewerSlide: { width: width, flex: 1 },
  zoomContainer: { flex: 1 },
  zoomContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImg: { width: width, height: height * 0.65 },

  // Bottom bar with filename and delete
  bottomBar: { alignItems: 'center', paddingBottom: 40, paddingTop: 10 },
  modalFile: { color: '#aaa', fontSize: 11, marginBottom: 2, paddingHorizontal: 20 },
  modalSize: { color: '#666', fontSize: 10, marginBottom: 12 },
  delBtn: { backgroundColor: '#e74c3c', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  delTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
