import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal, Dimensions,
  Animated, StatusBar, SectionList, BackHandler
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { galleryAPI, SERVER_URL } from '../services/api';

const { width, height } = Dimensions.get('window');
const PHOTO_SIZE = (width - 40) / 3;

const groupByDate = (photos) => {
  const groups = {};
  photos.forEach(p => {
    const d = p.uploadedAt ? new Date(p.uploadedAt) : new Date();
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  return Object.entries(groups).map(([title, data]) => {
    const rows = [];
    for (let i = 0; i < data.length; i += 3) rows.push(data.slice(i, i + 3));
    return { title, count: data.length, data: rows };
  });
};

export default function GalleryScreen() {
  const { token, user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  useFocusEffect(useCallback(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewerVisible) { closeViewer(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [viewerVisible]));

  const loadPhotos = async () => {
    try {
      const data = await galleryAPI.getMyPhotos(token);
      setPhotos(data.files || []);
      setStorage(data.storage);
    } catch (error) {
      Alert.alert('Gallery Error', error.message || 'Could not load photos');
    } finally { setLoading(false); setRefreshing(false); }
  };

  const getImageUrl = (photo) => `${SERVER_URL}/files/${user.username}/${photo.filename}?token=${token}`;

  // Download image to a temp file and return its local URI
  const downloadToTemp = async (photo) => {
    const ext = photo.filename.split('.').pop() || 'jpg';
    const localUri = FileSystem.cacheDirectory + `fc_${Date.now()}.${ext}`;
    const result = await FileSystem.downloadAsync(getImageUrl(photo), localUri);
    if (!result || !result.uri) throw new Error('Download failed');
    return result.uri;
  };

  // ====== Viewer ======
  const openViewer = (filename) => {
    const idx = photos.findIndex(p => p.filename === filename);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setControlsVisible(true);
      setIsZoomed(false);
      fadeAnim.setValue(1);
      zoomAnim.setValue(1);
      setViewerVisible(true);
    }
  };

  const closeViewer = () => {
    setViewerVisible(false);
    setIsZoomed(false);
    zoomAnim.setValue(1);
  };

  const toggleControls = () => {
    const next = !controlsVisible;
    setControlsVisible(next);
    Animated.timing(fadeAnim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap — smooth zoom toggle
      const toZoom = !isZoomed;
      setIsZoomed(toZoom);
      Animated.spring(zoomAnim, {
        toValue: toZoom ? 3 : 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current !== 0) {
          toggleControls();
          lastTap.current = 0;
        }
      }, 320);
    }
  };

  const onViewableChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
      // Reset zoom when switching photos
      setIsZoomed(false);
      zoomAnim.setValue(1);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ====== Actions ======
  const handleDelete = () => {
    const photo = photos[currentIndex];
    Alert.alert('Delete Photo', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await galleryAPI.deletePhoto(token, photo.filename);
          const next = photos.filter((_, i) => i !== currentIndex);
          setPhotos(next);
          if (next.length === 0) closeViewer();
          else if (currentIndex >= next.length) setCurrentIndex(next.length - 1);
        } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleShare = async () => {
    const photo = photos[currentIndex];
    if (!photo) return;
    try {
      setActionLoading(true);
      const localUri = await downloadToTemp(photo);
      await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', dialogTitle: 'Share Photo' });
    } catch (e) {
      console.log('Share error:', e);
      Alert.alert('Share Error', e.message || 'Could not share this photo');
    } finally { setActionLoading(false); }
  };

  const handleDownload = async () => {
    const photo = photos[currentIndex];
    if (!photo) return;
    try {
      setActionLoading(true);
      const localUri = await downloadToTemp(photo);
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });

      // Try to use saved folder first
      const SecureStore = require('expo-secure-store');
      let dirUri = await SecureStore.getItemAsync('fc_save_folder');

      const saveToDir = async (uri) => {
        const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(uri, photo.filename, 'image/jpeg');
        await FileSystem.writeAsStringAsync(newFileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        Alert.alert('Saved!', 'Photo saved to your download folder');
      };

      if (dirUri) {
        try {
          await saveToDir(dirUri);
          return;
        } catch (e) {
          // Saved folder no longer valid, ask again
          console.log('Saved folder expired, asking again');
        }
      }

      // No saved folder or it expired — ask user to pick
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) { setActionLoading(false); return; }

      // Save this folder for future downloads
      await SecureStore.setItemAsync('fc_save_folder', permissions.directoryUri);
      await saveToDir(permissions.directoryUri);
    } catch (e) {
      console.log('Save error:', e);
      Alert.alert('Save Error', e.message || 'Could not save this photo');
    } finally { setActionLoading(false); }
  };

  // ====== Rendering ======
  const sections = groupByDate(photos);
  const currentPhoto = photos[currentIndex];

  const renderGridRow = ({ item: row }) => (
    <View style={s.row}>
      {row.map(photo => (
        <TouchableOpacity key={photo.filename} style={s.photoCard} onPress={() => openViewer(photo.filename)} activeOpacity={0.85}>
          <Image source={{ uri: getImageUrl(photo) }} style={s.photoImage} resizeMode="cover" />
        </TouchableOpacity>
      ))}
      {row.length < 3 && Array(3 - row.length).fill(0).map((_, i) => <View key={`e${i}`} style={s.emptyCard} />)}
    </View>
  );

  const renderViewerImage = ({ item }) => (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={s.slide}>
        <Animated.Image
          source={{ uri: getImageUrl(item) }}
          style={[s.slideImg, { transform: [{ scale: zoomAnim }] }]}
          resizeMode="contain"
        />
      </View>
    </TouchableWithoutFeedback>
  );

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6c5ce7" /></View>;

  return (
    <View style={s.container}>
      {storage && (
        <View style={s.storageBar}>
          <View style={s.storageRow}>
            <Text style={s.storageText}>{storage.used} / {storage.quota} used</Text>
            <Text style={s.photoCountText}>{photos.length} photos</Text>
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${Math.min(storage.usagePercent || 0, 100)}%` }]} /></View>
        </View>
      )}

      {photos.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📸</Text>
          <Text style={s.emptyTitle}>No photos yet</Text>
          <Text style={s.emptyText}>Upload your first photo!</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderGridRow}
          renderSectionHeader={({ section }) => (
            <View style={s.dateHeader}>
              <Text style={s.dateText}>{section.title}</Text>
              <Text style={s.dateCount}>{section.count} photos</Text>
            </View>
          )}
          keyExtractor={(_, i) => `r${i}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.grid}
          removeClippedSubviews={true}
          maxToRenderPerBatch={6}
          windowSize={5}
          initialNumToRender={4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPhotos(); }} tintColor="#6c5ce7" />}
        />
      )}

      {/* ======== VIEWER ======== */}
      <Modal visible={viewerVisible} animationType="slide" statusBarTranslucent onRequestClose={closeViewer}>
        <View style={s.viewer}>
          <StatusBar hidden />

          <FlatList
            data={photos}
            renderItem={renderViewerImage}
            keyExtractor={item => item.filename}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={currentIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onViewableItemsChanged={onViewableChanged}
            viewabilityConfig={viewabilityConfig}
            removeClippedSubviews
          />

          {/* Loading overlay for share/download */}
          {actionLoading && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="large" color="#6c5ce7" />
              <Text style={s.loadingText}>Processing...</Text>
            </View>
          )}

          {/* Top bar */}
          <Animated.View style={[s.topBar, { opacity: fadeAnim }]} pointerEvents={controlsVisible ? 'auto' : 'none'}>
            <TouchableOpacity onPress={closeViewer} style={s.topBtn}>
              <Text style={s.topBtnTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={s.topCounter}>{currentIndex + 1} / {photos.length}</Text>
            <View style={{ width: 40 }} />
          </Animated.View>

          {/* Bottom bar */}
          <Animated.View style={[s.bottomBar, { opacity: fadeAnim }]} pointerEvents={controlsVisible ? 'auto' : 'none'}>
            <Text style={s.bottomDate}>
              {currentPhoto?.uploadedAt
                ? new Date(currentPhoto.uploadedAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                : ''}
            </Text>
            <View style={s.bottomActions}>
              <TouchableOpacity style={s.aBtn} onPress={handleDownload}>
                <Text style={s.aIcon}>⬇</Text>
                <Text style={s.aLabel}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.aBtn} onPress={handleShare}>
                <Text style={s.aIcon}>⤴</Text>
                <Text style={s.aLabel}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.aBtn} onPress={handleDelete}>
                <Text style={s.aIcon}>🗑</Text>
                <Text style={s.aLabel}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
  photoCountText: { color: '#6c5ce7', fontSize: 13, fontWeight: '600' },
  track: { height: 4, backgroundColor: '#1a1a2e', borderRadius: 2 },
  fill: { height: 4, backgroundColor: '#6c5ce7', borderRadius: 2 },

  grid: { paddingHorizontal: 10, paddingBottom: 20 },
  row: { flexDirection: 'row' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, marginTop: 6 },
  dateText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dateCount: { color: '#888', fontSize: 12 },
  photoCard: { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: 3, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1a1a2e' },
  emptyCard: { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: 3 },
  photoImage: { width: '100%', height: '100%' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },

  // Viewer
  viewer: { flex: 1, backgroundColor: '#000' },
  slide: { width, height, justifyContent: 'center', alignItems: 'center' },
  slideImg: { width, height: height * 0.8 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  topBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBtnTxt: { color: '#fff', fontSize: 28, fontWeight: '300' },
  topCounter: { color: '#fff', fontSize: 14, fontWeight: '600' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 10, paddingBottom: 28, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  bottomDate: { color: '#ccc', fontSize: 12, marginBottom: 14 },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-around', width: '65%' },
  aBtn: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 16 },
  aIcon: { fontSize: 20, color: '#fff', marginBottom: 3 },
  aLabel: { color: '#aaa', fontSize: 10 },
});
