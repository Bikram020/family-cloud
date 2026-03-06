import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!mobile || !password) { Alert.alert('Error', 'Please enter mobile number and password'); return; }
    setLoading(true);
    try { await login(mobile, password); }
    catch (error) {
      if (error.data?.status === 'pending') Alert.alert('Pending Approval', 'Your account is waiting for admin approval.');
      else Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.content}>
        <Text style={s.logo}>☁️</Text>
        <Text style={s.title}>Family Cloud</Text>
        <Text style={s.subtitle}>Your private photo cloud</Text>
        <View style={s.form}>
          <TextInput style={s.input} placeholder="Mobile Number" placeholderTextColor="#888" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} maxLength={10} />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
          <TouchableOpacity style={[s.btn, loading && s.btnOff]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Log In</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={s.link}>Don't have an account? <Text style={s.linkBold}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 40 },
  form: { width: '100%', marginBottom: 24 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  btn: { backgroundColor: '#6c5ce7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnOff: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  link: { color: '#888', fontSize: 14 },
  linkBold: { color: '#6c5ce7', fontWeight: '600' },
});
