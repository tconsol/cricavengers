import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  StatusBar, TextInput as RNTextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailRef    = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef  = useRef<RNTextInput>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email required';
    if (password.length < 8) e.password = 'Password must be 8+ characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputContainer = (field: string) => ({
    borderRadius: 14, borderWidth: 1.5,
    borderColor: errors[field] ? '#FCA5A5' : 'rgba(255,255,255,0.15)',
    backgroundColor: errors[field] ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16, flexDirection: 'row' as const, alignItems: 'center' as const,
  });

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
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 36, paddingHorizontal: 24 }}>
          <Image
            source={require('../../assets/icon.png')}
            style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 16 }}
            resizeMode="cover"
          />
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>Create Account</Text>
          <Text style={{ color: '#93C5FD', marginTop: 4, fontSize: 14 }}>
            Start scoring matches today
          </Text>
        </View>

        {/* Form */}
        <View style={{ paddingHorizontal: 24 }}>

          {/* Full Name */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>
              FULL NAME
            </Text>
            <View style={inputContainer('name')}>
              <Ionicons name="person-outline" size={18} color={errors.name ? '#FCA5A5' : '#93C5FD'} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 }}
                placeholder="Virat Kohli"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            {errors.name ? <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>{errors.name}</Text> : null}
          </View>

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>
              EMAIL ADDRESS
            </Text>
            <View style={inputContainer('email')}>
              <Ionicons name="mail-outline" size={18} color={errors.email ? '#FCA5A5' : '#93C5FD'} style={{ marginRight: 10 }} />
              <TextInput
                ref={emailRef}
                style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 }}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            {errors.email ? <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>
              PASSWORD
            </Text>
            <View style={inputContainer('password')}>
              <Ionicons name="lock-closed-outline" size={18} color={errors.password ? '#FCA5A5' : '#93C5FD'} style={{ marginRight: 10 }} />
              <TextInput
                ref={passwordRef}
                style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 }}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={{ paddingLeft: 8, paddingVertical: 14 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>{errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>
              CONFIRM PASSWORD
            </Text>
            <View style={inputContainer('confirm')}>
              <Ionicons name="shield-checkmark-outline" size={18} color={errors.confirm ? '#FCA5A5' : '#93C5FD'} style={{ marginRight: 10 }} />
              <TextInput
                ref={confirmRef}
                style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 }}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={{ paddingLeft: 8, paddingVertical: 14 }}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {errors.confirm ? <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 4 }}>{errors.confirm}</Text> : null}
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={{
              borderRadius: 16, paddingVertical: 16,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B',
              flexDirection: 'row', gap: 8,
            }}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>Creating account...</Text>
            ) : (
              <>
                <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>Create Account</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </>
            )}
          </TouchableOpacity>

          {/* Sign in link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14 }}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
