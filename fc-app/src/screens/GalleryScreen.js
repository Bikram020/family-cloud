import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal, Dimensions,
  ScrollView, Animated, StatusBar, Share, SectionList
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { galleryAPI, SERVER_URL } from '../services/api';

const { width, height } = Dimensions.get('window');
const PHOTO_SIZE = (width - 40) / 3;

// Group photos by date into sections
const groupByDate = (photos) => {
  const groups = {};
  photos.forEach(p => {
    const d = p.uploadedAt ? new Date(p.uploadedAt) : new Date();
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  return Object.entries(groups).map(([title, data]) => {
    // Chunk into rows of 3
    const rows = [];
    for (let i = 0; i < data.length; i += 3) {
      rows.push(data.slice(i, i + 3));
    }
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
  const [viewerIndex, setViewerIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

  const getImageUrl = (photo) => `${SERVER_URL}/files/${user.username}/${photo.filename}?token=${token}`;

  const openViewer = (filename) => {
    const idx = photos.findIndex(p => p.filename === filename);
    if (idx >= 0) { setViewerIndex(idx); setControlsVisible(true); fadeAnim.setValue(1); setViewerVisible(true); }
  };

  const toggleControls = () => {
    const show = !controlsVisible;
    setControlsVisible(show);
    Animated.timing(fadeAnim, { toValue: show ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };

  const goNext = () => { if (viewerIndex < photos.length - 1) setViewerIndex(viewerIndex + 1); };
  const goPrev = () => { if (viewerIndex > 0) setViewerIndex(viewerIndex - 1); };

  const handleDelete = () => {
    const photo = photos[viewerIndex];
    Alert.alert('Delete Photo', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await galleryAPI.deletePhoto(token, photo.filename);
          const next = photos.filter((_, i) => i !== viewerIndex);
          setPhotos(next);
          if (next.length === 0) setViewerVisible(false);
          else if (viewerIndex >= next.length) setViewerIndex(next.length - 1);
        } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleShare = async () => {
    try { await Share.share({ message: photos[viewerIndex]?.filename }); } catch (e) {}
  };

  const sections = groupByDate(photos);
  const currentPhoto = photos[viewerIndex];

  // Render a row of 3 photos
  const renderRow = ({ item: row }) => (
    <View style={s.row}>
      {row.map(photo => (
        <TouchableOpacity key={photo.filename} style={s.photoCard} onPress={() => openViewer(photo.filename)} activeOpacity={0.85}>
          <Image source={{ uri: getImageUrl(photo) }} style={s.photoImage} resizeMode="cover" />
        </TouchableOpacity>
      ))}
      {/* Fill empty slots so layout doesn't stretch */}
      {row.length < 3 && Array(3 - row.length).fill(0).map((_, i) => <View key={`empty-${i}`} style={s.photoCard} />)}
    </View>
  );

  const renderSectionHeader = ({ section }) => (
    <View style={s.dateHeader}>
      <Text style={s.dateText}>{section.title}</Text>
      <Text style={s.dateCount}>{section.count} photos</Text>
    </View>
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
          <Text style={s.emptyText}>Upload your first photo using the Upload tab!</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item, i) => `row-${i}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPhotos(); }} tintColor="#6c5ce7" />}
        />
      )}

      {/* ==================== Samsung-style Viewer ==================== */}
      <Modal visible={viewerVisible} animationType="fade" statusBarTranslucent>
        <View style={s.viewer}>
          <StatusBar hidden />

          {/* Zoomable image — standalone ScrollView (zoom works) */}
          <ScrollView
            key={`zoom-${viewerIndex}`}
            style={s.zoomScroll}
            contentContainerStyle={s.zoomContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={toggleControls}>
              <Image
                source={{ uri: currentPhoto ? getImageUrl(currentPhoto) : '' }}
                style={s.viewerImg}
                resizeMode="contain"
              />
            </TouchableWithoutFeedback>
          </ScrollView>

          {/* Invisible edge zones for swipe prev/next */}
          <TouchableOpacity style={s.swipeL} onPress={goPrev} activeOpacity={1} />
          <TouchableOpacity style={s.swipeR} onPress={goNext} activeOpacity={1} />

          {/* Top bar (fades) */}
          <Animated.View style={[s.topBar, { opacity: fadeAnim }]} pointerEvents={controlsVisible ? 'auto' : 'none'}>
            <TouchableOpacity onPress={() => setViewerVisible(false)} style={s.topBtn}>
              <Text style={s.topBtnTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={s.topCounter}>{viewerIndex + 1} / {photos.length}</Text>
            <View style={{ width: 40 }} />
          </Animated.View>

          {/* Bottom bar — Samsung style (fades) */}
          <Animated.View style={[s.bottomBar, { opacity: fadeAnim }]} pointerEvents={controlsVisible ? 'auto' : 'none'}>
            <Text style={s.bottomDate}>
              {currentPhoto?.uploadedAt ? new Date(currentPhoto.uploadedAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
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

  // Storage bar
  storageBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  storageText: { color: '#aaa', fontSize: 13 },
  photoCountText: { color: '#6c5ce7', fontSize: 13, fontWeight: '600' },
  track: { height: 4, backgroundColor: '#1a1a2e', borderRadius: 2 },
  fill: { height: 4, backgroundColor: '#6c5ce7', borderRadius: 2 },

  // Grid
  grid: { paddingHorizontal: 10, paddingBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'flex-start' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, marginTop: 6 },
  dateText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dateCount: { color: '#888', fontSize: 12 },
  photoCard: { width: PHOTO_SIZE, height: PHOTO_SIZE, margin: 3, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1a1a2e' },
  photoImage: { width: '100%', height: '100%' },

  // Empty
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },

  // ===== Viewer =====
  viewer: { flex: 1, backgroundColor: '#000' },
  zoomScroll: { flex: 1 },
  zoomContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width, height },

  // Edge swipe zones
  swipeL: { position: 'absolute', left: 0, top: 70, bottom: 90, width: 44, zIndex: 5 },
  swipeR: { position: 'absolute', right: 0, top: 70, bottom: 90, width: 44, zIndex: 5 },

  // Top bar
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  topBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBtnTxt: { color: '#fff', fontSize: 28, fontWeight: '300' },
  topCounter: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Bottom bar — Samsung style
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 10, paddingBottom: 28, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  bottomDate: { color: '#ccc', fontSize: 12, marginBottom: 14 },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-around', width: '65%' },
  aBtn: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  aIcon: { fontSize: 20, color: '#fff', marginBottom: 3 },
  aLabel: { color: '#aaa', fontSize: 10 },
});
