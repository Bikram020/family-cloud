// ============================================
// Upload Screen — Select and upload photos
// ============================================

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { uploadAPI } from '../services/api';

export default function UploadScreen({ navigation }) {
  const { token } = useAuth();
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 20,
    });

    if (!result.canceled && result.assets) {
      setSelectedImages(result.assets);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setSelectedImages([...selectedImages, ...result.assets]);
    }
  };

  const uploadAll = async () => {
    if (selectedImages.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    setUploadProgress({ current: 0, total: selectedImages.length });

    for (let i = 0; i < selectedImages.length; i++) {
      const image = selectedImages[i];
      setUploadProgress({ current: i + 1, total: selectedImages.length });

      try {
        const filename = image.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
        await uploadAPI.uploadImage(token, image.uri, filename);
        successCount++;
      } catch (error) {
        failCount++;
        console.log('Upload error:', error.message);
      }
    }

    setUploading(false);
    setSelectedImages([]);
    setUploadProgress({ current: 0, total: 0 });

    if (failCount === 0) {
      Alert.alert('Upload Complete! 🎉', `${successCount} photo(s) uploaded successfully.`);
    } else {
      Alert.alert('Upload Done', `${successCount} uploaded, ${failCount} failed.`);
    }
  };

  const removeImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {/* Pick Buttons */}
      <View style={styles.pickSection}>
        <TouchableOpacity style={styles.pickBtn} onPress={pickImages}>
          <Text style={styles.pickIcon}>🖼</Text>
          <Text style={styles.pickText}>Choose from Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.pickBtn, styles.cameraBtn]} onPress={takePhoto}>
          <Text style={styles.pickIcon}>📷</Text>
          <Text style={styles.pickText}>Take Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Images Preview */}
      {selectedImages.length > 0 && (
        <>
          <Text style={styles.selectedCount}>
            {selectedImages.length} photo(s) selected
          </Text>

          <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewGrid}>
            {selectedImages.map((image, index) => (
              <View key={index} style={styles.previewCard}>
                <Image source={{ uri: image.uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeImage(index)}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* Upload Button */}
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && styles.btnDisabled]}
            onPress={uploadAll}
            disabled={uploading}
          >
            {uploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.uploadBtnText}>
                  {' '}Uploading {uploadProgress.current}/{uploadProgress.total}...
                </Text>
              </View>
            ) : (
              <Text style={styles.uploadBtnText}>
                ⬆ Upload {selectedImages.length} Photo(s)
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {selectedImages.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>☁️</Text>
          <Text style={styles.emptyText}>Select photos to upload to your cloud</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 16,
  },
  pickSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pickBtn: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  cameraBtn: {
    borderColor: '#6c5ce7',
  },
  pickIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  pickText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '500',
  },
  selectedCount: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewScroll: {
    flex: 1,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewCard: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 12,
  },
  uploadBtn: {
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
});
