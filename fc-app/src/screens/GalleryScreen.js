import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  RefreshControl, Modal, Dimensions, Animated, StatusBar, Share, SectionList,
  PanResponder, BackHandler
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { galleryAPI, SERVER_URL } from '../services/api';

const { width, height } = Dimensions.get('window');
const PHOTO_SIZE = (width - 40) / 3;

const getDistance = (touches) => {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

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

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const dismissScale = useRef(new Animated.Value(1)).current;
  const dismissOpacity = useRef(new Animated.Value(1)).current;

  // Gesture tracking refs
  const scaleRef = useRef(1);
  const baseScaleRef = useRef(1);
  const initialPinchDist = useRef(0);
  const isPinching = useRef(false);
  const lastTap = useRef(0);

  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  // Back button closes viewer
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewerVisible) { dismissViewer(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [viewerVisible]);

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
    if (idx >= 0) {
      setViewerIndex(idx);
      setShowControls(true);
      fadeAnim.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      scale.setValue(1);
      dismissScale.setValue(1);
      dismissOpacity.setValue(1);
      scaleRef.current = 1;
      baseScaleRef.current = 1;
      isPinching.current = false;
      setViewerVisible(true);
    }
  };

  const resetTransforms = () => {
    translateX.setValue(0);
    translateY.setValue(0);
    scale.setValue(1);
    scaleRef.current = 1;
    baseScaleRef.current = 1;
  };

  const goNext = () => {
    if (viewerIndex < photos.length - 1) {
      resetTransforms();
      setViewerIndex(viewerIndex + 1);
    } else {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 40 }).start();
    }
  };

  const goPrev = () => {
    if (viewerIndex > 0) {
      resetTransforms();
      setViewerIndex(viewerIndex - 1);
    } else {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 40 }).start();
    }
  };

  const dismissViewer = () => {
    Animated.parallel([
      Animated.timing(dismissScale, { toValue: 0.5, duration: 250, useNativeDriver: true }),
      Animated.timing(dismissOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setViewerVisible(false);
      dismissScale.setValue(1);
      dismissOpacity.setValue(1);
      resetTransforms();
    });
  };

  const toggleControls = () => {
    const next = !showControls;
    setShowControls(next);
    Animated.timing(fadeAnim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };

  const handleDelete = () => {
    const photo = photos[viewerIndex];
    Alert.alert('Delete Photo', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await galleryAPI.deletePhoto(token, photo.filename);
          const next = photos.filter((_, i) => i !== viewerIndex);
          setPhotos(next);
          if (next.length === 0) { setViewerVisible(false); }
          else if (viewerIndex >= next.length) setViewerIndex(next.length - 1);
        } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleShare = async () => {
    try { await Share.share({ message: photos[viewerIndex]?.filename }); } catch (e) {}
  };

  // ====== PanResponder — handles tap, swipe, pinch, dismiss ======
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8,

    onPanResponderGrant: (evt) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length === 2) {
        isPinching.current = true;
        initialPinchDist.current = getDistance(touches);
        baseScaleRef.current = scaleRef.current;
      } else {
        isPinching.current = false;
      }
      // Double tap detection
      const now = Date.now();
      if (now - lastTap.current < 300 && touches.length === 1) {
        // Double tap: toggle zoom
        if (scaleRef.current > 1) {
          scaleRef.current = 1;
          baseScaleRef.current = 1;
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 40 }).start();
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        } else {
          scaleRef.current = 2.5;
          baseScaleRef.current = 2.5;
          Animated.spring(scale, { toValue: 2.5, useNativeDriver: true, tension: 40 }).start();
        }
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
    },

    onPanResponderMove: (evt, gs) => {
      const touches = evt.nativeEvent.touches;

      if (touches.length === 2 || isPinching.current) {
        if (touches.length === 2) {
          isPinching.current = true;
          const dist = getDistance(touches);
          if (initialPinchDist.current > 0) {
            const newScale = Math.max(1, Math.min(5, baseScaleRef.current * (dist / initialPinchDist.current)));
            scaleRef.current = newScale;
            scale.setValue(newScale);
          }
        }
        return;
      }

      // Single finger — swipe or drag
      if (scaleRef.current > 1) {
        // When zoomed, pan around
        translateX.setValue(gs.dx);
        translateY.setValue(gs.dy);
      } else {
        // At normal scale: horizontal = swipe photos, vertical = dismiss
        if (Math.abs(gs.dx) > Math.abs(gs.dy)) {
          translateX.setValue(gs.dx);
        } else {
          translateY.setValue(gs.dy);
          // Shrink as user drags down
          const progress = Math.min(Math.abs(gs.dy) / 300, 1);
          dismissScale.setValue(1 - progress * 0.4);
          dismissOpacity.setValue(1 - progress * 0.5);
        }
      }
    },

    onPanResponderRelease: (evt, gs) => {
      if (isPinching.current) {
        isPinching.current = false;
        baseScaleRef.current = scaleRef.current;
        if (scaleRef.current <= 1.1) {
          scaleRef.current = 1;
          baseScaleRef.current = 1;
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        }
        return;
      }

      if (scaleRef.current > 1) {
        // Zoomed in — just stop
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        return;
      }

      // Normal scale gestures
      const { dx, dy, vx, vy } = gs;

      if (dy > 120 || vy > 0.5) {
        // Swipe down → dismiss
        dismissViewer();
        return;
      }

      if (dx < -80 || vx < -0.3) {
        // Swipe left → next
        Animated.timing(translateX, { toValue: -width, duration: 200, useNativeDriver: true }).start(() => {
          translateX.setValue(0);
          goNext();
        });
        return;
      }

      if (dx > 80 || vx > 0.3) {
        // Swipe right → prev
        Animated.timing(translateX, { toValue: width, duration: 200, useNativeDriver: true }).start(() => {
          translateX.setValue(0);
          goPrev();
        });
        return;
      }

      // Tap (no significant movement)
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        toggleControls();
      }

      // Spring back
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      Animated.spring(dismissScale, { toValue: 1, useNativeDriver: true }).start();
      Animated.spring(dismissOpacity, { toValue: 1, useNativeDriver: true }).start();
    },
  })).current;

  // ====== Rendering ======
  const sections = groupByDate(photos);
  const currentPhoto = photos[viewerIndex];

  const renderRow = ({ item: row }) => (
    <View style={s.row}>
      {row.map(photo => (
        <TouchableOpacity key={photo.filename} style={s.photoCard} onPress={() => openViewer(photo.filename)} activeOpacity={0.85}>
          <Image source={{ uri: getImageUrl(photo) }} style={s.photoImage} resizeMode="cover" />
        </TouchableOpacity>
      ))}
      {row.length < 3 && Array(3 - row.length).fill(0).map((_, i) => <View key={`e${i}`} style={s.photoCard} />)}
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
          <Text style={s.emptyText}>Upload your first photo!</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderRow}
          renderSectionHeader={({ section }) => (
            <View style={s.dateHeader}>
              <Text style={s.dateText}>{section.title}</Text>
              <Text style={s.dateCount}>{section.count} photos</Text>
            </View>
          )}
          keyExtractor={(_, i) => `row-${i}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPhotos(); }} tintColor="#6c5ce7" />}
        />
      )}

      {/* =============== VIEWER =============== */}
      <Modal visible={viewerVisible} transparent animationType="none" statusBarTranslucent onRequestClose={dismissViewer}>
        <Animated.View style={[s.viewer, { opacity: dismissOpacity }]}>
          <StatusBar hidden />

          <Animated.View
            style={[s.imgWrap, {
              transform: [
                { translateX },
                { translateY },
                { scale: Animated.multiply(scale, dismissScale) },
              ],
            }]}
            {...panResponder.panHandlers}
          >
            {currentPhoto && (
              <Image source={{ uri: getImageUrl(currentPhoto) }} style={s.viewerImg} resizeMode="contain" />
            )}
          </Animated.View>

          {/* Top bar */}
          <Animated.View style={[s.topBar, { opacity: fadeAnim }]} pointerEvents={showControls ? 'auto' : 'none'}>
            <TouchableOpacity onPress={dismissViewer} style={s.topBtn}>
              <Text style={s.topBtnTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={s.topCounter}>{viewerIndex + 1} / {photos.length}</Text>
            <View style={{ width: 40 }} />
          </Animated.View>

          {/* Bottom bar */}
          <Animated.View style={[s.bottomBar, { opacity: fadeAnim }]} pointerEvents={showControls ? 'auto' : 'none'}>
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
        </Animated.View>
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
  photoImage: { width: '100%', height: '100%' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },

  // Viewer
  viewer: { flex: 1, backgroundColor: '#000' },
  imgWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width, height },

  // Top
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  topBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBtnTxt: { color: '#fff', fontSize: 28, fontWeight: '300' },
  topCounter: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Bottom
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 10, paddingBottom: 28, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  bottomDate: { color: '#ccc', fontSize: 12, marginBottom: 14 },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-around', width: '65%' },
  aBtn: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  aIcon: { fontSize: 20, color: '#fff', marginBottom: 3 },
  aLabel: { color: '#aaa', fontSize: 10 },
});
