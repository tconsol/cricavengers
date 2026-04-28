import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert,
  Modal, TextInput, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@store/authStore';
import { api } from '@services/api';
import DrawerMenu from '@components/ui/DrawerMenu';

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, updateUser } = useAuthStore();
  const [name, setName]   = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', { name: name.trim(), phone: phone.trim() }) as any;
      updateUser(res.data.user);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6 }}>FULL NAME</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 }}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />

          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6 }}>PHONE (optional)</Text>
          <TextInput
            style={{ borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 24 }}
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 9876543210"
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showCur, setShowCur]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [saving, setSaving]     = useState(false);

  const reset = () => { setCurrent(''); setNewPass(''); setConfirm(''); };

  const save = async () => {
    if (!current) { Alert.alert('Error', 'Enter your current password'); return; }
    if (newPass.length < 8) { Alert.alert('Error', 'New password must be at least 8 characters'); return; }
    if (newPass !== confirm) { Alert.alert('Error', 'Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.put('/auth/change-password', { currentPassword: current, newPassword: newPass }) as any;
      Alert.alert('Success', 'Password changed successfully');
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Change Password</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6 }}>CURRENT PASSWORD</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 16 }}>
            <TextInput style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }} value={current} onChangeText={setCurrent} secureTextEntry={!showCur} placeholder="••••••••" />
            <TouchableOpacity onPress={() => setShowCur(v => !v)} style={{ paddingRight: 12 }}>
              <Ionicons name={showCur ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6 }}>NEW PASSWORD</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 16 }}>
            <TextInput style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }} value={newPass} onChangeText={setNewPass} secureTextEntry={!showNew} placeholder="Min 8 characters" />
            <TouchableOpacity onPress={() => setShowNew(v => !v)} style={{ paddingRight: 12 }}>
              <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6 }}>CONFIRM NEW PASSWORD</Text>
          <TextInput style={{ ...inputStyle, marginBottom: 24 }} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repeat new password" />

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuthStore();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editVisible, setEditVisible]   = useState(false);
  const [passVisible, setPassVisible]   = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const form = new FormData();
    form.append('avatar', {
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || 'avatar.jpg',
    } as any);

    setUploadingAvatar(true);
    try {
      const res = await api.upload('/auth/avatar', form) as any;
      updateUser({ avatar: res.data.user.avatar });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const menuItems = [
    { icon: 'person-outline',           label: 'Edit Profile',      onPress: () => setEditVisible(true) },
    { icon: 'shield-outline',           label: 'Change Password',   onPress: () => setPassVisible(true) },
    { icon: 'people-outline',           label: 'My Teams',          onPress: () => router.push('/(tabs)/teams?mine=true' as any) },
    { icon: 'notifications-outline',    label: 'Notifications',     onPress: () => {} },
    { icon: 'information-circle-outline', label: 'About',           onPress: () => {} },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F2444' }} edges={['top']}>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
      <ChangePasswordModal visible={passVisible} onClose={() => setPassVisible(false)} />

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
      <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28 }}>
        <TouchableOpacity onPress={handleAvatarPress} style={{ position: 'relative', marginBottom: 12 }} activeOpacity={0.8}>
          {user?.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#F59E0B' }}
            />
          ) : (
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}>
              <Text style={{ fontSize: 34, fontWeight: '900', color: '#fff' }}>
                {user?.name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1E3A5F', borderRadius: 12, padding: 4, borderWidth: 2, borderColor: '#fff' }}>
            {uploadingAvatar
              ? <ActivityIndicator size="small" color="#F59E0B" style={{ width: 16, height: 16 }} />
              : <Ionicons name="camera" size={14} color="#F59E0B" />
            }
          </View>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{user?.name}</Text>
        <Text style={{ color: '#93C5FD', marginTop: 2, fontSize: 14 }}>{user?.email}</Text>
        <View style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{user?.role}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} showsVerticalScrollIndicator={false}>
        {/* Career Stats */}
        {user?._id && (
          <View style={{ marginHorizontal: 16, marginTop: 20 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F2444', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 }}
              onPress={() => router.push(`/player/${user._id}` as any)}
            >
              <Ionicons name="stats-chart" size={22} color="#F59E0B" />
              <Text style={{ flex: 1, marginLeft: 12, fontWeight: '800', color: '#fff', fontSize: 15 }}>Career Stats</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Items */}
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 32 }}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' }}
              onPress={item.onPress}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={item.icon as any} size={20} color="#1E3A5F" />
              </View>
              <Text style={{ flex: 1, fontWeight: '600', color: '#111827', fontSize: 15 }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, marginTop: 8, borderWidth: 1, borderColor: '#FEE2E2' }}
            onPress={handleLogout}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <Text style={{ flex: 1, fontWeight: '600', color: '#EF4444', fontSize: 15 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
