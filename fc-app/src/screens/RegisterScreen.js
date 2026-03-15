import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !mobile || !username || !password) { Alert.alert('Error', 'All fields are required'); return; }
    if (mobile.replace(/\D/g, '').length !== 10) { Alert.alert('Error', 'Mobile number must be 10 digits'); return; }
    if (password.length < 4) { Alert.alert('Error', 'Password must be at least 4 characters'); return; }
    setLoading(true);
    try {
      await register(mobile, username, name, password);
      Alert.alert('Registration Successful! 🎉', 'Your account is pending admin approval.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) { Alert.alert('Registration Failed', error.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Create Account</Text>
        <Text style={s.subtitle}>Join your family cloud</Text>
        <View style={s.form}>
          <Text style={s.label}>Full Name</Text>
          <TextInput style={s.input} placeholder="e.g. Mom" placeholderTextColor="#666" value={name} onChangeText={setName} />
          <Text style={s.label}>Mobile Number</Text>
          <TextInput style={s.input} placeholder="10-digit number" placeholderTextColor="#666" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} maxLength={10} />
          <Text style={s.label}>Username</Text>
          <TextInput style={s.input} placeholder="e.g. mom_photos" placeholderTextColor="#666" autoCapitalize="none" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} />
          <Text style={s.hint}>3-20 characters, letters, numbers, underscores</Text>
          <Text style={s.label}>Password</Text>
          <View style={s.passwordWrap}>
            <TextInput
              style={s.inputWithToggle}
              placeholder="Minimum 4 characters"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.btn, loading && s.btnOff]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Register</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.link}>Already have an account? <Text style={s.linkBold}>Log In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 32 },
  form: { width: '100%', marginBottom: 24 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#fff', marginBottom: 6, borderWidth: 1, borderColor: '#2a2a3e' },
  passwordWrap: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 16, marginBottom: 6, borderWidth: 1, borderColor: '#2a2a3e', flexDirection: 'row', alignItems: 'center' },
  inputWithToggle: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#fff' },
  toggleText: { color: '#6c5ce7', fontSize: 13, fontWeight: '600' },
  hint: { color: '#555', fontSize: 12, marginLeft: 4, marginBottom: 16 },
  btn: { backgroundColor: '#6c5ce7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  btnOff: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  link: { color: '#888', fontSize: 14, textAlign: 'center' },
  linkBold: { color: '#6c5ce7', fontWeight: '600' },
});
