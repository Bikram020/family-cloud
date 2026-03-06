// ============================================
// Profile Screen — User info, storage, logout
// ============================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const usedMB = user?.usedStorage || 0;
  const quotaMB = user?.quota || 0;
  const percentage = quotaMB > 0 ? ((usedMB / quotaMB) * 100).toFixed(1) : 0;

  return (
    <View style={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        {isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>👑 Admin</Text>
          </View>
        )}
      </View>

      {/* Info Cards */}
      <View style={styles.infoSection}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Mobile</Text>
          <Text style={styles.infoValue}>{user?.mobile}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Storage Used</Text>
          <Text style={styles.infoValue}>{usedMB} MB</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(percentage, 100)}%` }]} />
          </View>
          <Text style={styles.infoDetail}>{percentage}% of {quotaMB} MB</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Account Status</Text>
          <Text style={[styles.infoValue, { color: '#27ae60' }]}>Active ✓</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 16,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  adminBadge: {
    backgroundColor: '#6c5ce720',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
  },
  infoSection: {
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  infoLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoDetail: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#0f0f1a',
    borderRadius: 2,
    marginTop: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#6c5ce7',
    borderRadius: 2,
  },
  logoutBtn: {
    backgroundColor: '#e74c3c20',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c40',
  },
  logoutText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
});
