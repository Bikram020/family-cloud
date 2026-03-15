import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, Modal, Dimensions, SectionList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { galleryAPI, SERVER_URL } from '../services/api';

const { width, height } = Dimensions.get('window');
const GRID_COLUMNS = 4;
const GRID_GAP = 2;
const GRID_PADDING = 12;
const PHOTO_SIZE = (width - (GRID_PADDING * 2) - (GRID_GAP * (GRID_COLUMNS - 1))) / GRID_COLUMNS;

const getDateLabel = (uploadedAt) => {
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return 'Unknown Date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  const includeYear = target.getFullYear() !== today.getFullYear();
  return target.toLocaleDateString('en-GB', includeYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' });
};

const getDateKey = (uploadedAt) => {
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return 'unknown-date';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function GalleryScreen() {
  const { token, user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const flatListRef = useRef(null);

  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  const loadPhotos = async () => {
    try {
      const data = await galleryAPI.getMyPhotos(token);
      const sortedFiles = [...(data.files || [])].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      setPhotos(sortedFiles);
      setStorage(data.storage);
    } catch (error) {
      Alert.alert('Gallery Error', error.message || 'Could not load photos');
    } finally { setLoading(false); setRefreshing(false); }
  };

  const photoSections = useMemo(() => {
    const grouped = [];

    photos.forEach((photo, viewerPhotoIndex) => {
      const key = getDateKey(photo.uploadedAt);
      const title = getDateLabel(photo.uploadedAt);
      const prevGroup = grouped[grouped.length - 1];

      if (!prevGroup || prevGroup.key !== key) {
        grouped.push({ key, title, photos: [] });
      }

      grouped[grouped.length - 1].photos.push({ ...photo, viewerPhotoIndex });
    });

    return grouped.map((group, sectionIndex) => {
      const rows = [];
      for (let i = 0; i < group.photos.length; i += GRID_COLUMNS) {
        rows.push(group.photos.slice(i, i + GRID_COLUMNS));
      }

      return {
        key: group.key,
        title: group.title,
        isFirst: sectionIndex === 0,
        data: rows
      };
    });
  }, [photos]);

  const openViewer = (index) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleDelete = () => {
    const photo = photos[viewerIndex];
    const deleteIndex = viewerIndex;
    Alert.alert('Delete Photo', 'Delete this photo from the cloud?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await galleryAPI.deletePhoto(token, photo.filename);
            setPhotos((prev) => {
              const updated = prev.filter((item) => item.filename !== photo.filename);

              if (updated.length === 0) {
                setViewerVisible(false);
                setViewerIndex(0);
                return updated;
              }

              const nextIndex = Math.min(deleteIndex, updated.length - 1);
              setViewerIndex(nextIndex);
              requestAnimationFrame(() => {
                flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
              });

              return updated;
            });

            // Refresh stats in background while keeping viewer state smooth.
            loadPhotos();
          } catch (error) { Alert.alert('Error', error.message); }
        }
      },
    ]);
  };

  const getImageUrl = (photo) => `${SERVER_URL}/files/${user.username}/${photo.filename}?token=${token}`;
  const getThumbUrl = (photo) => photo.thumbnailUrl
    ? `${SERVER_URL}${photo.thumbnailUrl}?token=${token}`
    : getImageUrl(photo);

  const renderPhotoRow = ({ item: row }) => (
    <View style={s.photoRow}>
      {row.map((photo, idx) => (
        <TouchableOpacity
          key={photo.filename}
          style={[s.photoCard, idx < row.length - 1 && s.photoCardGap]}
          onPress={() => openViewer(photo.viewerPhotoIndex)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: getThumbUrl(photo) }} style={s.photoImage} resizeMode="cover" />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderViewerItem = ({ item }) => (
    <View style={s.viewerSlide}>
      <Image source={{ uri: getImageUrl(item) }} style={s.fullImg} resizeMode="contain" />
    </View>
  );

  const onViewerScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setViewerIndex(idx);
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
        <SectionList
          sections={photoSections}
          renderItem={renderPhotoRow}
          keyExtractor={(row, rowIndex) => `${row[0]?.filename || 'row'}-${rowIndex}`}
          renderSectionHeader={({ section }) => (
            <Text style={[s.sectionTitle, !section.isFirst && s.sectionTitleSpaced]}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPhotos(); }} tintColor="#6c5ce7" />}
        />
      )}

      {/* Full-screen swipeable photo viewer */}
      <Modal visible={viewerVisible} transparent animationType="fade">
        <View style={s.modal}>
          <TouchableOpacity style={s.closeBtn} onPress={() => setViewerVisible(false)}><Text style={s.closeTxt}>✕</Text></TouchableOpacity>

          <FlatList
            ref={flatListRef}
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

          {/* Photo info + delete */}
          <View style={s.modalInfo}>
            <Text style={s.counter}>{viewerIndex + 1} / {photos.length}</Text>
            <Text style={s.modalFile}>{photos[viewerIndex]?.filename}</Text>
            <TouchableOpacity style={s.delBtn} onPress={handleDelete}><Text style={s.delTxt}>🗑 Delete</Text></TouchableOpacity>
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
  grid: { paddingHorizontal: GRID_PADDING, paddingTop: 10, paddingBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 10 },
  sectionTitleSpaced: { marginTop: 18 },
  photoRow: { flexDirection: 'row', marginBottom: GRID_GAP },
  photoCard: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 2, overflow: 'hidden', backgroundColor: '#1a1a2e' },
  photoCardGap: { marginRight: GRID_GAP },
  photoImage: { width: '100%', height: '100%' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
  modal: { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 20 },
  viewerSlide: { width: width, flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImg: { width: width, height: height * 0.7 },
  modalInfo: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  counter: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalFile: { color: '#aaa', fontSize: 11, marginBottom: 14 },
  delBtn: { backgroundColor: '#e74c3c', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  delTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
