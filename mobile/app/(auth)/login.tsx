import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F2444' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0F2444" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={{ alignItems: 'center', paddingTop: 80, paddingBottom: 52, paddingHorizontal: 24 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: 'rgba(245,158,11,0.15)',
            borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 44 }}>🏏</Text>
          </View>
          <Text style={{ fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>
            CricAvengers
          </Text>
          <Text style={{ color: '#93C5FD', marginTop: 6, fontSize: 15 }}>
            Ball-by-ball cricket scoring
          </Text>
        </View>

        {/* Form */}
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 28 }}>
            Welcome back
          </Text>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>
              EMAIL ADDRESS
            </Text>
            <View style={{
              borderRadius: 14, borderWidth: 1.5,
              borderColor: errors.email ? '#FCA5A5' : 'rgba(255,255,255,0.15)',
              backgroundColor: errors.email ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
              paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
            }}>
              <Ionicons name="mail-outline" size={18} color={errors.email ? '#FCA5A5' : '#93C5FD'} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 }}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>
            {errors.email ? (
              <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>{errors.email}</Text>
            ) : null}
          </View>

          {/* Password */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>
              PASSWORD
            </Text>
            <View style={{
              borderRadius: 14, borderWidth: 1.5,
              borderColor: errors.password ? '#FCA5A5' : 'rgba(255,255,255,0.15)',
              backgroundColor: errors.password ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
              paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
            }}>
              <Ionicons name="lock-closed-outline" size={18} color={errors.password ? '#FCA5A5' : '#93C5FD'} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 }}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={{ paddingLeft: 8, paddingVertical: 14 }}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>{errors.password}</Text>
            ) : null}
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={{
              borderRadius: 16, paddingVertical: 16,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B',
              flexDirection: 'row', gap: 8,
            }}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>Signing in...</Text>
            ) : (
              <>
                <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14 }}>Create one</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
