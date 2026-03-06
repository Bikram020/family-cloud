// ============================================
// Admin Screen — Approve/reject users, manage
// ============================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl, TextInput
} from 'react-native';
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [pending, users] = await Promise.all([
        adminAPI.getPendingUsers(token),
        adminAPI.getUsers(token),
      ]);
      setPendingUsers(pending.users || []);
      setAllUsers(users);
    } catch (error) {
      console.log('Admin load error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = (username) => {
    const quota = quotaInputs[username] || '20000';
    Alert.alert(
      'Approve User',
      `Approve @${username} with ${quota} MB quota?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await adminAPI.approveUser(token, username, Number(quota));
              loadData();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleReject = (username) => {
    Alert.alert('Reject User', `Are you sure you want to reject @${username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.rejectUser(token, username);
            loadData();
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[1]} // single item to enable scrolling everything together
        renderItem={() => (
          <>
            {/* Pending Users Section */}
            <Text style={styles.sectionTitle}>
              Pending Approvals ({pendingUsers.length})
            </Text>

            {pendingUsers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No pending requests ✓</Text>
              </View>
            ) : (
              pendingUsers.map((user) => (
                <View key={user.username} style={styles.pendingCard}>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingName}>{user.name}</Text>
                    <Text style={styles.pendingDetail}>@{user.username} · {user.mobile}</Text>
                  </View>

                  <TextInput
                    style={styles.quotaInput}
                    placeholder="Quota (MB)"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={quotaInputs[user.username] || '20000'}
                    onChangeText={(text) =>
                      setQuotaInputs({ ...quotaInputs, [user.username]: text })
                    }
                  />

                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(user.username)}
                    >
                      <Text style={styles.approveBtnText}>✓ Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleReject(user.username)}
                    >
                      <Text style={styles.rejectBtnText}>✕ Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* All Users Section */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              All Members ({allUsers?.totalUsers || 0})
            </Text>

            {allUsers?.users?.map((user) => (
              <View key={user.username} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <Text style={styles.userName}>
                    {user.username} {user.role === 'admin' ? '👑' : ''}
                  </Text>
                  <Text style={styles.userPercent}>{user.usagePercent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(user.usagePercent, 100)}%` }]} />
                </View>
                <Text style={styles.userStorage}>
                  {user.usedStorage} / {user.quota} MB
                </Text>
              </View>
            ))}

            {/* Stats */}
            {allUsers && (
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>System Storage</Text>
                <Text style={styles.statsValue}>{allUsers.totalUsed}</Text>
                <Text style={styles.statsDetail}>
                  of {allUsers.totalQuotaAssigned} allocated
                </Text>
              </View>
            )}
          </>
        )}
        keyExtractor={() => 'admin'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor="#6c5ce7"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#27ae60',
    fontSize: 14,
  },
  pendingCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  pendingInfo: {
    marginBottom: 10,
  },
  pendingName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingDetail: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  quotaInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#e74c3c20',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c40',
  },
  rejectBtnText: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  userPercent: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#0f0f1a',
    borderRadius: 2,
    marginBottom: 6,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#6c5ce7',
    borderRadius: 2,
  },
  userStorage: {
    color: '#888',
    fontSize: 12,
  },
  statsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  statsTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statsValue: {
    color: '#6c5ce7',
    fontSize: 24,
    fontWeight: '700',
  },
  statsDetail: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});
