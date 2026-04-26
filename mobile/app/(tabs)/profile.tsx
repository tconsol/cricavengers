import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import DrawerMenu from '@components/ui/DrawerMenu';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Hamburger */}
      <View style={{ position: 'absolute', top: 52, left: 16, zIndex: 10 }}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}
        >
          <Ionicons name="menu" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View className="items-center px-4 py-8">
        <View className="w-20 h-20 bg-accent rounded-full items-center justify-center mb-3">
          <Text className="text-3xl font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase()}
          </Text>
        </View>
        <Text className="text-white text-2xl font-bold">{user?.name}</Text>
        <Text className="text-blue-200">{user?.email}</Text>
        <View className="mt-2 bg-white/20 px-3 py-1 rounded-full">
          <Text className="text-white text-xs font-semibold capitalize">{user?.role}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 bg-surface rounded-t-3xl" showsVerticalScrollIndicator={false}>
        {/* Career Stats */}
        {user?._id && (
          <View className="mx-4 mt-6">
            <TouchableOpacity
              className="flex-row items-center bg-primary rounded-2xl px-4 py-4 shadow-sm"
              onPress={() => router.push(`/player/${user._id}` as any)}
            >
              <Ionicons name="stats-chart" size={22} color="#fff" />
              <Text className="flex-1 ml-3 font-bold text-white text-base">Career Stats</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Items */}
        <View className="mx-4 mt-4 mb-8">
          {[
            { icon: 'person-outline', label: 'Edit Profile', onPress: () => {} },
            { icon: 'shield-outline', label: 'Change Password', onPress: () => {} },
            { icon: 'notifications-outline', label: 'Notifications', onPress: () => {} },
            { icon: 'information-circle-outline', label: 'About', onPress: () => {} },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              className="flex-row items-center bg-white rounded-2xl px-4 py-4 mb-2 shadow-sm"
              onPress={item.onPress}
            >
              <Ionicons name={item.icon as any} size={22} color="#1E3A5F" />
              <Text className="flex-1 ml-3 font-semibold text-gray-700">{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            className="flex-row items-center bg-red-50 rounded-2xl px-4 py-4 mt-2 border border-red-100"
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text className="flex-1 ml-3 font-semibold text-red-500">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
