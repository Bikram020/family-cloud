import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal, Dimensions,
  Animated, StatusBar, Share, SectionList, BackHandler
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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

  // Viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const viewerRef = useRef(null);
  const lastTap = useRef(0);

  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  // Back button handler
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

  // ====== Viewer controls ======
  const openViewer = (filename) => {
    const idx = photos.findIndex(p => p.filename === filename);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setControlsVisible(true);
      setZoomed(false);
      fadeAnim.setValue(1);
      setViewerVisible(true);
    }
  };

  const closeViewer = () => {
    setViewerVisible(false);
    setZoomed(false);
  };

  const toggleControls = () => {
    const next = !controlsVisible;
    setControlsVisible(next);
    Animated.timing(fadeAnim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setZoomed(!zoomed);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      // Single tap after delay
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
      setZoomed(false); // Reset zoom when changing photo
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

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
    try { await Share.share({ message: photos[currentIndex]?.filename }); } catch (e) {}
  };

  // ====== Gallery grid rendering ======
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

  // ====== Viewer image slide ======
  const renderViewerImage = ({ item }) => (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={s.slide}>
        <Image
          source={{ uri: getImageUrl(item) }}
          style={[s.slideImg, zoomed && s.slideImgZoomed]}
          resizeMode={zoomed ? 'cover' : 'contain'}
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

      {/* ======== VIEWER MODAL ======== */}
      <Modal visible={viewerVisible} animationType="slide" statusBarTranslucent onRequestClose={closeViewer}>
        <View style={s.viewer}>
          <StatusBar hidden />

          {/* Horizontal swipeable image list */}
          <FlatList
            ref={viewerRef}
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
            removeClippedSubviews={true}
          />

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
              <TouchableOpacity style={s.aBtn} onPress={handleShare}>
                <Text style={s.aIcon}>⤴</Text>
                <Text style={s.aLabel}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.aBtn}>
                <Text style={s.aIcon}>✎</Text>
                <Text style={s.aLabel}>Edit</Text>
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
  slideImg: { width, height: height * 0.75 },
  slideImgZoomed: { width, height },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  topBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBtnTxt: { color: '#fff', fontSize: 28, fontWeight: '300' },
  topCounter: { color: '#fff', fontSize: 14, fontWeight: '600' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 10, paddingBottom: 28, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  bottomDate: { color: '#ccc', fontSize: 12, marginBottom: 14 },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-around', width: '65%' },
  aBtn: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  aIcon: { fontSize: 20, color: '#fff', marginBottom: 3 },
  aLabel: { color: '#aaa', fontSize: 10 },
});
