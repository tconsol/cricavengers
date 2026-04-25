import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@store/authStore';

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const [form, setForm]       = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (form.password.length < 8) e.password = 'Password must be 8+ characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim().toLowerCase(), form.password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, field, ...props }: any) => (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-gray-600 mb-1">{label}</Text>
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base text-gray-900 ${
          errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
        }`}
        value={form[field as keyof typeof form]}
        onChangeText={(v) => set(field, v)}
        {...props}
      />
      {errors[field] ? <Text className="text-red-500 text-xs mt-1">{errors[field]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="items-center pt-16 pb-8 px-6">
          <Text className="text-3xl font-bold text-white">Create Account</Text>
          <Text className="text-blue-200 mt-1">Start scoring matches today</Text>
        </View>

        <View className="mx-4 bg-white rounded-3xl px-6 py-8">
          <Field label="Full Name" field="name" placeholder="Virat Kohli" autoCapitalize="words" />
          <Field label="Email" field="email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" field="password" placeholder="••••••••" secureTextEntry />
          <Field label="Confirm Password" field="confirm" placeholder="••••••••" secureTextEntry />

          <TouchableOpacity
            className={`rounded-xl py-4 items-center mt-2 ${loading ? 'bg-primary-300' : 'bg-primary'}`}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text className="text-white font-bold text-lg">
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary font-bold">Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
