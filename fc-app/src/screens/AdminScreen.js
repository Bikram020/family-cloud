import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  RefreshControl, TextInput, Modal, Image, Dimensions, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { adminAPI, SERVER_URL } from '../services/api';

const { width, height } = Dimensions.get('window');
const PHOTO_SIZE = (width - 56) / 3;

export default function AdminScreen() {
  const { token } = useAuth();
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotaInputs, setQuotaInputs] = useState({});

  // Detail view state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFiles, setUserFiles] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [quotaModal, setQuotaModal] = useState(false);
  const [newQuota, setNewQuota] = useState('');
  const viewerRef = useRef(null);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const [pending, users] = await Promise.all([adminAPI.getPendingUsers(token), adminAPI.getUsers(token)]);
      setPendingUsers(pending.users || []);
      setAllUsers(users);
    } catch (error) { console.log('Admin error:', error.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const openUserDetail = async (user) => {
    setSelectedUser(user);
    setView('detail');
    setDetailLoading(true);
    try {
      const data = await adminAPI.getUserFiles(token, user.username);
      setUserFiles(data.files || []);
    } catch (e) { Alert.alert('Error', e.message); setUserFiles([]); }
    finally { setDetailLoading(false); }
  };

  const handleApprove = (username) => {
    const quota = quotaInputs[username] || '5000';
    Alert.alert('Approve User', `Approve @${username} with ${quota} MB?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => { try { await adminAPI.approveUser(token, username, Number(quota)); loadData(); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  };

  const handleReject = (username) => {
    Alert.alert('Reject User', `Reject @${username}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => { try { await adminAPI.rejectUser(token, username); loadData(); } catch (e) { Alert.alert('Error', e.message); } } },
    ]);
  };

  const handleDeleteUser = (username) => {
    Alert.alert('Delete User', `Delete @${username} and ALL their data?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await adminAPI.deleteUser(token, username); setView('list'); loadData(); }
          catch (e) { Alert.alert('Error', e.message); }
        }
      },
    ]);
  };

  const handleDeleteFile = (filename) => {
    Alert.alert('Delete Photo', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await adminAPI.deleteUserFile(token, selectedUser.username, filename);
            setViewerVisible(false);
            openUserDetail(selectedUser);
            loadData();
          } catch (e) { Alert.alert('Error', e.message); }
        }
      },
    ]);
  };

  const handleSetQuota = async () => {
    if (!newQuota || Number(newQuota) <= 0) return;
    try {
      await adminAPI.setQuota(token, selectedUser.username, Number(newQuota));
      setQuotaModal(false);
      loadData();
      openUserDetail({ ...selectedUser, quota: Number(newQuota) });
      Alert.alert('Success', `Quota updated to ${newQuota} MB`);
    } catch (e) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6c5ce7" /></View>;

  // ============================================
  // USER DETAIL VIEW
  // ============================================
  if (view === 'detail' && selectedUser) {
    const pct = selectedUser.quota > 0 ? ((selectedUser.usedStorage / selectedUser.quota) * 100).toFixed(1) : 0;
    const getImageUrl = (file) => `${SERVER_URL}/files/${selectedUser.username}/${file.filename}?token=${token}`;
    const openViewer = (index) => {
      setViewerIndex(index);
      setViewerVisible(true);
    };

    const onViewerScroll = (e) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      setViewerIndex(idx);
    };

    const currentPhoto = userFiles[viewerIndex];

    return (
      <View style={s.container}>
        <TouchableOpacity style={s.backBtn} onPress={() => { setView('list'); loadData(); }}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* User info card */}
          <View style={s.detailCard}>
            <View style={s.detailHeader}>
              <View style={s.avatar}><Text style={s.avatarText}>{selectedUser.name?.[0]?.toUpperCase() || '?'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.detailName}>{selectedUser.name || selectedUser.username}</Text>
                <Text style={s.detailSub}>@{selectedUser.username}</Text>
              </View>
            </View>

            {/* Storage bar */}
            <View style={s.storageSection}>
              <View style={s.storageRow}>
                <Text style={s.storageLabel}>Storage</Text>
                <Text style={s.storagePct}>{pct}%</Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(pct, 100)}%` }]} /></View>
              <Text style={s.storageDetail}>{selectedUser.usedStorage} MB used of {selectedUser.quota} MB</Text>
            </View>

            {/* Actions */}
            <View style={s.actionRow}>
              <TouchableOpacity style={s.editBtn} onPress={() => { setNewQuota(String(selectedUser.quota)); setQuotaModal(true); }}>
                <Text style={s.editTxt}>📊 Edit Quota</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteUserBtn} onPress={() => handleDeleteUser(selectedUser.username)}>
                <Text style={s.deleteUserTxt}>🗑 Delete User</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Photos */}
          <Text style={s.section}>Photos ({userFiles.length})</Text>
          {detailLoading ? <ActivityIndicator color="#6c5ce7" /> : (
            userFiles.length === 0 ? (
              <View style={s.emptyCard}><Text style={s.emptyText}>No photos uploaded yet</Text></View>
            ) : (
              <View style={s.photoGrid}>
                {userFiles.map((file, index) => (
                  <TouchableOpacity key={file.filename} style={s.photoCard} onPress={() => openViewer(index)}>
                    <Image source={{ uri: getImageUrl(file) }} style={s.photoImg} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}
        </ScrollView>

        {/* Full-screen photo modal */}
        <Modal visible={viewerVisible} transparent animationType="fade">
          <View style={s.modal}>
            <TouchableOpacity style={s.closeBtn} onPress={() => setViewerVisible(false)}><Text style={s.closeTxt}>✕</Text></TouchableOpacity>

            <FlatList
              ref={viewerRef}
              data={userFiles}
              keyExtractor={(item) => item.filename}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              onMomentumScrollEnd={onViewerScroll}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              renderItem={({ item }) => (
                <View style={s.viewerSlide}>
                  <Image source={{ uri: getImageUrl(item) }} style={s.fullImg} resizeMode="contain" />
                </View>
              )}
            />

            <View style={s.modalInfo}>
              <Text style={s.counter}>{viewerIndex + 1} / {userFiles.length}</Text>
              <Text style={s.modalFile}>{currentPhoto?.filename}</Text>
              <Text style={s.modalSize}>{currentPhoto?.size}</Text>
              {!!currentPhoto && (
                <TouchableOpacity style={s.delPhotoBtn} onPress={() => handleDeleteFile(currentPhoto.filename)}>
                  <Text style={s.delPhotoTxt}>🗑 Delete This Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

        {/* Edit quota modal */}
        <Modal visible={quotaModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.quotaCard}>
              <Text style={s.quotaTitle}>Edit Quota — @{selectedUser.username}</Text>
              <Text style={s.quotaLabel}>Current: {selectedUser.quota} MB | Used: {selectedUser.usedStorage} MB</Text>
              <TextInput style={s.quotaInput} placeholder="New quota (MB)" placeholderTextColor="#666" keyboardType="numeric"
                value={newQuota} onChangeText={setNewQuota} />
              <View style={s.quotaBtns}>
                <TouchableOpacity style={s.quotaCancel} onPress={() => setQuotaModal(false)}><Text style={s.quotaCancelTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={s.quotaSave} onPress={handleSetQuota}><Text style={s.quotaSaveTxt}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ============================================
  // USER LIST VIEW (default)
  // ============================================
  return (
    <View style={s.container}>
      <FlatList data={[1]} keyExtractor={() => 'admin'} renderItem={() => (
        <>
          {/* Storage pool overview */}
          {allUsers && (
            <View style={s.poolCard}>
              <Text style={s.poolTitle}>Storage Pool</Text>
              <View style={s.poolRow}>
                <View style={s.poolItem}>
                  <Text style={s.poolValue}>{(allUsers.totalStoragePool / 1000).toFixed(0)} GB</Text>
                  <Text style={s.poolLabel}>Total</Text>
                </View>
                <View style={s.poolItem}>
                  <Text style={[s.poolValue, { color: '#6c5ce7' }]}>{(allUsers.totalAllocated / 1000).toFixed(1)} GB</Text>
                  <Text style={s.poolLabel}>Allocated</Text>
                </View>
                <View style={s.poolItem}>
                  <Text style={[s.poolValue, { color: '#27ae60' }]}>{(allUsers.unallocated / 1000).toFixed(1)} GB</Text>
                  <Text style={s.poolLabel}>Unallocated</Text>
                </View>
                <View style={s.poolItem}>
                  <Text style={[s.poolValue, { color: '#e74c3c' }]}>{(allUsers.totalUsed / 1000).toFixed(2)} GB</Text>
                  <Text style={s.poolLabel}>Used</Text>
                </View>
              </View>
            </View>
          )}

          {/* Pending approvals */}
          <Text style={s.section}>Pending Approvals ({pendingUsers.length})</Text>
          {pendingUsers.length === 0 ? (
            <View style={s.emptyCard}><Text style={s.emptyText}>No pending requests ✓</Text></View>
          ) : pendingUsers.map((u) => (
            <View key={u.username} style={s.pendingCard}>
              <Text style={s.pendingName}>{u.name}</Text>
              <Text style={s.pendingDetail}>@{u.username} · {u.mobile}</Text>
              <TextInput style={s.approveInput} placeholder="Quota (MB)" placeholderTextColor="#666" keyboardType="numeric"
                value={quotaInputs[u.username] || '5000'} onChangeText={(t) => setQuotaInputs({ ...quotaInputs, [u.username]: t })} />
              <View style={s.pendingActions}>
                <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(u.username)}><Text style={s.approveTxt}>✓ Approve</Text></TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(u.username)}><Text style={s.rejectTxt}>✕ Reject</Text></TouchableOpacity>
              </View>
            </View>
          ))}

          {/* All users — tap to view detail */}
          <Text style={[s.section, { marginTop: 20 }]}>Family Members ({allUsers?.totalUsers || 0})</Text>
          {allUsers?.users?.map((u) => (
            <TouchableOpacity key={u.username} style={s.userCard} onPress={() => openUserDetail(u)} activeOpacity={0.7}>
              <View style={s.userRow}>
                <View style={s.userAvatar}><Text style={s.userAvatarTxt}>{u.name?.[0]?.toUpperCase() || '?'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u.name || u.username}</Text>
                  <Text style={s.userSub}>@{u.username} · {u.status}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.userQuota}>{u.usedStorage} / {u.quota} MB</Text>
                  <Text style={s.userPct}>{u.usagePercent}%</Text>
                </View>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(u.usagePercent, 100)}%` }]} /></View>
            </TouchableOpacity>
          ))}
        </>
      )} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#6c5ce7" />
      } />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  section: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 10, marginTop: 4 },

  // Storage pool
  poolCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#2a2a3e' },
  poolTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  poolRow: { flexDirection: 'row', justifyContent: 'space-around' },
  poolItem: { alignItems: 'center' },
  poolValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  poolLabel: { color: '#888', fontSize: 11, marginTop: 2 },

  // Pending
  emptyCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 8 },
  emptyText: { color: '#888', fontSize: 14 },
  pendingCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f39c12' },
  pendingName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pendingDetail: { color: '#888', fontSize: 12, marginTop: 2, marginBottom: 8 },
  approveInput: { backgroundColor: '#0f0f1a', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  pendingActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { flex: 1, backgroundColor: '#27ae60', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  approveTxt: { color: '#fff', fontWeight: '600' },
  rejectBtn: { flex: 1, backgroundColor: '#e74c3c20', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c40' },
  rejectTxt: { color: '#e74c3c', fontWeight: '600' },

  // User list card
  userCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6c5ce7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  userSub: { color: '#888', fontSize: 12, marginTop: 1 },
  userQuota: { color: '#aaa', fontSize: 12 },
  userPct: { color: '#6c5ce7', fontSize: 14, fontWeight: '700', marginTop: 2 },
  track: { height: 4, backgroundColor: '#0f0f1a', borderRadius: 2 },
  fill: { height: 4, backgroundColor: '#6c5ce7', borderRadius: 2 },

  // Detail view
  backBtn: { paddingVertical: 8, marginBottom: 8 },
  backTxt: { color: '#6c5ce7', fontSize: 16, fontWeight: '600' },
  detailCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, marginBottom: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#6c5ce7', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  detailName: { color: '#fff', fontSize: 20, fontWeight: '600' },
  detailSub: { color: '#888', fontSize: 14, marginTop: 2 },
  storageSection: { marginBottom: 14 },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  storageLabel: { color: '#aaa', fontSize: 13 },
  storagePct: { color: '#6c5ce7', fontSize: 14, fontWeight: '700' },
  storageDetail: { color: '#888', fontSize: 12, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, backgroundColor: '#6c5ce720', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#6c5ce740' },
  editTxt: { color: '#6c5ce7', fontWeight: '600', fontSize: 13 },
  deleteUserBtn: { flex: 1, backgroundColor: '#e74c3c15', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c30' },
  deleteUserTxt: { color: '#e74c3c', fontWeight: '600', fontSize: 13 },

  // Photo grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  photoCard: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a1a2e' },
  photoImg: { width: '100%', height: '100%' },

  // Photo modal
  modal: { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 20 },
  viewerSlide: { width: width, flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImg: { width: width, height: height * 0.7 },
  modalInfo: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  counter: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalFile: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  modalSize: { color: '#888', fontSize: 12, marginBottom: 16 },
  delPhotoBtn: { backgroundColor: '#e74c3c', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  delPhotoTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Quota modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  quotaCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 20 },
  quotaTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  quotaLabel: { color: '#888', fontSize: 13, marginBottom: 16 },
  quotaInput: { backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a3e', marginBottom: 16 },
  quotaBtns: { flexDirection: 'row', gap: 10 },
  quotaCancel: { flex: 1, backgroundColor: '#2a2a3e', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  quotaCancelTxt: { color: '#aaa', fontWeight: '600' },
  quotaSave: { flex: 1, backgroundColor: '#6c5ce7', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  quotaSaveTxt: { color: '#fff', fontWeight: '600' },
});
