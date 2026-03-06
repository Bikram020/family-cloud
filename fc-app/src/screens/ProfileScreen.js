import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const usedMB = user?.usedStorage || 0;
  const quotaMB = user?.quota || 0;
  const pct = quotaMB > 0 ? ((usedMB / quotaMB) * 100).toFixed(1) : 0;

  return (
    <View style={s.container}>
      <View style={s.profileCard}>
        <View style={s.avatar}><Text style={s.avatarText}>{user?.name?.[0]?.toUpperCase() || '?'}</Text></View>
        <Text style={s.name}>{user?.name || 'User'}</Text>
        <Text style={s.username}>@{user?.username}</Text>
        {isAdmin && <View style={s.badge}><Text style={s.badgeText}>👑 Admin</Text></View>}
      </View>
      <View style={s.cards}>
        <View style={s.card}><Text style={s.cardLabel}>MOBILE</Text><Text style={s.cardValue}>{user?.mobile}</Text></View>
        <View style={s.card}>
          <Text style={s.cardLabel}>STORAGE USED</Text><Text style={s.cardValue}>{usedMB} MB</Text>
          <View style={s.track}><View style={[s.fill, { width: `${Math.min(pct, 100)}%` }]} /></View>
          <Text style={s.cardDetail}>{pct}% of {quotaMB} MB</Text>
        </View>
        <View style={s.card}><Text style={s.cardLabel}>STATUS</Text><Text style={[s.cardValue, { color: '#27ae60' }]}>Active ✓</Text></View>
      </View>
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}><Text style={s.logoutText}>Logout</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  profileCard: { alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#1a1a2e', marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#6c5ce7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 4 },
  username: { fontSize: 14, color: '#888', marginBottom: 8 },
  badge: { backgroundColor: '#6c5ce720', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#6c5ce7', fontSize: 12, fontWeight: '600' },
  cards: { gap: 12, marginBottom: 24 },
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16 },
  cardLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cardValue: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardDetail: { color: '#888', fontSize: 12, marginTop: 4 },
  track: { height: 4, backgroundColor: '#0f0f1a', borderRadius: 2, marginTop: 8 },
  fill: { height: 4, backgroundColor: '#6c5ce7', borderRadius: 2 },
  logoutBtn: { backgroundColor: '#e74c3c20', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e74c3c40' },
  logoutText: { color: '#e74c3c', fontSize: 16, fontWeight: '600' },
});
