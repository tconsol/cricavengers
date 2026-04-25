import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@store/authStore';

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
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
      className="flex-1 bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="items-center pt-20 pb-10 px-6">
          <Text className="text-5xl font-bold text-accent mb-2">🏏</Text>
          <Text className="text-3xl font-bold text-white">CricAvengers</Text>
          <Text className="text-base text-blue-200 mt-1">Ball-by-ball cricket scoring</Text>
        </View>

        {/* Card */}
        <View className="mx-4 bg-white rounded-3xl px-6 py-8 shadow-lg">
          <Text className="text-2xl font-bold text-primary-900 mb-6">Welcome Back</Text>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-1">Email</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-base text-gray-900 ${
                errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {errors.email ? <Text className="text-red-500 text-xs mt-1">{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-600 mb-1">Password</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-base text-gray-900 ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            {errors.password ? <Text className="text-red-500 text-xs mt-1">{errors.password}</Text> : null}
          </View>

          {/* Login Button */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${loading ? 'bg-primary-300' : 'bg-primary'}`}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-lg">
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Register Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-primary font-bold">Create one</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
