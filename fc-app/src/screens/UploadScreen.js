import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { uploadAPI } from '../services/api';

export default function UploadScreen() {
  const { token } = useAuth();
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 20,
    });
    if (!result.canceled && result.assets) setSelectedImages(result.assets);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow camera access'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets) setSelectedImages([...selectedImages, ...result.assets]);
  };

  const uploadAll = async () => {
    if (selectedImages.length === 0) return;
    setUploading(true);
    let ok = 0, fail = 0;
    setProgress({ current: 0, total: selectedImages.length });
    for (let i = 0; i < selectedImages.length; i++) {
      setProgress({ current: i + 1, total: selectedImages.length });
      try {
        const fn = selectedImages[i].uri.split('/').pop() || `photo_${Date.now()}.jpg`;
        await uploadAPI.uploadImage(token, selectedImages[i].uri, fn);
        ok++;
      } catch (e) { fail++; }
    }
    setUploading(false); setSelectedImages([]);
    Alert.alert(fail === 0 ? 'Upload Complete! 🎉' : 'Upload Done', `${ok} uploaded${fail > 0 ? `, ${fail} failed` : ''}.`);
  };

  return (
    <View style={s.container}>
      <View style={s.pickRow}>
        <TouchableOpacity style={s.pickBtn} onPress={pickImages}>
          <Text style={s.pickIcon}>🖼</Text><Text style={s.pickText}>Choose from Gallery</Text>
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
