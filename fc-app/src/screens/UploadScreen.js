import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { uploadAPI } from '../services/api';

const PARALLEL_UPLOADS = 3;
const MAX_RETRIES = 2;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getMimeTypeFromName = (filename = '') => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
};

export default function UploadScreen() {
  const { token } = useAuth();
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library'); return; }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
        allowsEditing: false,
      });
      console.log('Picker result:', JSON.stringify(result).substring(0, 200));
      if (!result.canceled && result.assets) {
        setSelectedImages([...selectedImages, ...result.assets]);
      }
    } catch (e) {
      console.log('Picker error:', e);
      // Fallback: single select if multi doesn't work
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 1,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets) {
        setSelectedImages([...selectedImages, ...result.assets]);
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow camera access'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
    if (!result.canceled && result.assets) setSelectedImages([...selectedImages, ...result.assets]);
  };

  const uploadOneWithRetry = async (asset) => {
    const filename = asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
    const mimeType = (asset.mimeType && asset.mimeType.startsWith('image/'))
      ? asset.mimeType
      : getMimeTypeFromName(filename);

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        await uploadAPI.uploadImage(token, asset.uri, filename, mimeType);
        return { ok: true, asset };
      } catch (error) {
        lastError = error;
        const retryable = !error.status || error.status === 0 || error.status >= 500;
        if (!retryable || attempt > MAX_RETRIES) break;
        await delay(300 * attempt);
      }
    }

    return {
      ok: false,
      asset,
      error: lastError?.message || 'Upload failed',
      filename
    };
  };

  const uploadAll = async () => {
    if (selectedImages.length === 0) return;
    setUploading(true);
    let ok = 0;
    const failed = [];
    setProgress({ current: 0, total: selectedImages.length });

    for (let i = 0; i < selectedImages.length; i += PARALLEL_UPLOADS) {
      const chunk = selectedImages.slice(i, i + PARALLEL_UPLOADS);
      const results = await Promise.all(chunk.map(uploadOneWithRetry));

      results.forEach((result) => {
        if (result.ok) {
          ok++;
        } else {
          failed.push(result);
        }
      });

      setProgress((prev) => ({ ...prev, current: Math.min(prev.current + chunk.length, prev.total) }));
    }

    setUploading(false);
    setSelectedImages(failed.map(item => item.asset));

    if (failed.length === 0) {
      Alert.alert('Upload Complete! 🎉', `${ok} photo(s) uploaded.`);
      return;
    }

    const failCount = failed.length;
    const sampleNames = failed.slice(0, 3).map(f => f.filename).join(', ');
    const details = sampleNames
      ? `Failed: ${sampleNames}${failCount > 3 ? '...' : ''}`
      : 'Some photos failed to upload.';

    Alert.alert(
      'Upload Finished With Some Failures',
      `${ok} uploaded, ${failCount} failed. Failed photos are still selected so you can retry.\n\n${details}`
    );
  };

  return (
    <View style={s.container}>
      <View style={s.pickRow}>
        <TouchableOpacity style={s.pickBtn} onPress={pickImages}>
          <Text style={s.pickIcon}>🖼</Text><Text style={s.pickText}>Choose Photos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.pickBtn, s.camBtn]} onPress={takePhoto}>
          <Text style={s.pickIcon}>📷</Text><Text style={s.pickText}>Take Photo</Text>
        </TouchableOpacity>
      </View>

      {selectedImages.length > 0 && (
        <>
          <Text style={s.count}>{selectedImages.length} photo(s) selected</Text>
          <ScrollView style={s.scroll} contentContainerStyle={s.previewGrid}>
            {selectedImages.map((img, i) => (
              <View key={i} style={s.previewCard}>
                <Image source={{ uri: img.uri }} style={s.previewImg} />
                <TouchableOpacity style={s.removeBtn} onPress={() => setSelectedImages(selectedImages.filter((_, j) => j !== i))}>
                  <Text style={s.removeTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[s.uploadBtn, uploading && s.off]} onPress={uploadAll} disabled={uploading}>
            {uploading ? (
              <View style={s.row}><ActivityIndicator color="#fff" size="small" /><Text style={s.uploadTxt}> Uploading {progress.current}/{progress.total}...</Text></View>
            ) : <Text style={s.uploadTxt}>⬆ Upload {selectedImages.length} Photo(s)</Text>}
          </TouchableOpacity>
        </>
      )}

      {selectedImages.length === 0 && (
        <View style={s.empty}><Text style={s.emptyIcon}>☁️</Text><Text style={s.emptyText}>Select photos to upload to your cloud</Text></View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  pickRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pickBtn: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, paddingVertical: 20, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3e' },
  camBtn: { borderColor: '#6c5ce7' },
  pickIcon: { fontSize: 28, marginBottom: 6 },
  pickText: { color: '#aaa', fontSize: 13, fontWeight: '500' },
  count: { color: '#6c5ce7', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  scroll: { flex: 1 },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewCard: { width: 100, height: 100, borderRadius: 8, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  removeTxt: { color: '#fff', fontSize: 12 },
  uploadBtn: { backgroundColor: '#6c5ce7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  off: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  uploadTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 14 },
});
