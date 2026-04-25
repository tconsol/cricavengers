import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, TextInput as RNTextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@store/authStore';

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

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

  const fieldStyle = (field: string) =>
    `border rounded-xl px-4 py-3 text-base text-gray-900 ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
    }`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: '#1E3A5F' }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#fff' }}>Create Account</Text>
          <Text style={{ color: '#bfdbfe', marginTop: 4 }}>Start scoring matches today</Text>
        </View>

        <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 32 }}>
          {/* Full Name */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4 }}>Full Name</Text>
            <TextInput
              className={fieldStyle('name')}
              placeholder="Virat Kohli"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
            {errors.name ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 2 }}>{errors.name}</Text> : null}
          </View>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4 }}>Email</Text>
            <TextInput
              ref={emailRef}
              className={fieldStyle('email')}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
            {errors.email ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 2 }}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4 }}>Password</Text>
            <TextInput
              ref={passwordRef}
              className={fieldStyle('password')}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
            />
            {errors.password ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 2 }}>{errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4 }}>Confirm Password</Text>
            <TextInput
              ref={confirmRef}
              className={fieldStyle('confirm')}
              placeholder="••••••••"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            {errors.confirm ? <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 2 }}>{errors.confirm}</Text> : null}
          </View>

          <TouchableOpacity
            style={{
              borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8,
              backgroundColor: loading ? '#6B7280' : '#1E3A5F',
            }}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 17 }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
            <Text style={{ color: '#6B7280' }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: '#1E3A5F', fontWeight: 'bold' }}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
