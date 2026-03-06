import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';

export default function AdminScreen() {
  const { token } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotaInputs, setQuotaInputs] = useState({});

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const [pending, users] = await Promise.all([adminAPI.getPendingUsers(token), adminAPI.getUsers(token)]);
      setPendingUsers(pending.users || []);
      setAllUsers(users);
    } catch (error) { console.log('Admin error:', error.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const handleApprove = (username) => {
    const quota = quotaInputs[username] || '20000';
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

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6c5ce7" /></View>;

  return (
    <View style={s.container}>
      <FlatList data={[1]} renderItem={() => (
        <>
          <Text style={s.section}>Pending Approvals ({pendingUsers.length})</Text>
          {pendingUsers.length === 0 ? (
            <View style={s.emptyCard}><Text style={s.emptyText}>No pending requests ✓</Text></View>
          ) : pendingUsers.map((u) => (
            <View key={u.username} style={s.pendingCard}>
              <Text style={s.pendingName}>{u.name}</Text>
              <Text style={s.pendingDetail}>@{u.username} · {u.mobile}</Text>
              <TextInput style={s.quotaInput} placeholder="Quota (MB)" placeholderTextColor="#666" keyboardType="numeric"
                value={quotaInputs[u.username] || '20000'} onChangeText={(t) => setQuotaInputs({ ...quotaInputs, [u.username]: t })} />
              <View style={s.actions}>
                <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(u.username)}><Text style={s.approveTxt}>✓ Approve</Text></TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(u.username)}><Text style={s.rejectTxt}>✕ Reject</Text></TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={[s.section, { marginTop: 24 }]}>All Members ({allUsers?.totalUsers || 0})</Text>
          {allUsers?.users?.map((u) => (
            <View key={u.username} style={s.userCard}>
              <View style={s.userRow}><Text style={s.userName}>{u.username} {u.role === 'admin' ? '👑' : ''}</Text><Text style={s.userPct}>{u.usagePercent}%</Text></View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(u.usagePercent, 100)}%` }]} /></View>
              <Text style={s.userStorage}>{u.usedStorage} / {u.quota} MB</Text>
            </View>
          ))}

          {allUsers && (
            <View style={s.statsCard}>
              <Text style={s.statsLabel}>SYSTEM STORAGE</Text>
              <Text style={s.statsValue}>{allUsers.totalUsed}</Text>
              <Text style={s.statsDetail}>of {allUsers.totalQuotaAssigned} allocated</Text>
            </View>
          )}
        </>
      )} keyExtractor={() => 'admin'} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#6c5ce7" />
      } />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  section: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  emptyCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { color: '#27ae60', fontSize: 14 },
  pendingCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#f39c12' },
  pendingName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pendingDetail: { color: '#888', fontSize: 13, marginTop: 2, marginBottom: 10 },
  quotaInput: { backgroundColor: '#0f0f1a', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a3e' },
  actions: { flexDirection: 'row', gap: 8 },
  approveBtn: { flex: 1, backgroundColor: '#27ae60', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  approveTxt: { color: '#fff', fontWeight: '600' },
  rejectBtn: { flex: 1, backgroundColor: '#e74c3c20', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c40' },
  rejectTxt: { color: '#e74c3c', fontWeight: '600' },
  userCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 8 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  userName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  userPct: { color: '#6c5ce7', fontSize: 14, fontWeight: '600' },
  track: { height: 4, backgroundColor: '#0f0f1a', borderRadius: 2, marginBottom: 6 },
  fill: { height: 4, backgroundColor: '#6c5ce7', borderRadius: 2 },
  userStorage: { color: '#888', fontSize: 12 },
  statsCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 20, alignItems: 'center' },
  statsLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statsValue: { color: '#6c5ce7', fontSize: 24, fontWeight: '700' },
  statsDetail: { color: '#888', fontSize: 12, marginTop: 2 },
});
