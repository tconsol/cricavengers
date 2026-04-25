import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions,
  Modal, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';

const WIDTH = Dimensions.get('window').width * 0.78;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { icon: 'home-outline',      label: 'Home',        route: '/(tabs)' },
  { icon: 'baseball-outline',  label: 'Matches',     route: '/(tabs)/matches' },
  { icon: 'trophy-outline',    label: 'Tournaments', route: '/(tabs)/tournaments' },
  { icon: 'people-outline',    label: 'Teams',       route: '/(tabs)/teams' },
  { icon: 'bar-chart-outline', label: 'Stats',       route: '/(tabs)/leaderboard' },
  { icon: 'person-outline',    label: 'Profile',     route: '/(tabs)/profile' },
] as const;

const ACTION_ITEMS = [
  { icon: 'baseball-outline',       label: 'Start A Match',   route: '/match/create',      color: '#1E3A5F' },
  { icon: 'trophy-outline',         label: 'Add Tournament',  route: '/tournament/create', color: '#7C3AED' },
  { icon: 'people-circle-outline',  label: 'Create Team',     route: '/team/create',       color: '#059669' },
] as const;

export default function DrawerMenu({ isOpen, onClose }: Props) {
  const { user, logout } = useAuthStore();
  const slideX = useRef(new Animated.Value(-WIDTH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX, { toValue: -WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [isOpen]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 240);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => {
      Alert.alert('Sign Out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive', onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]);
    }, 300);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdrop }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Drawer Panel */}
      <Animated.View
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: WIDTH,
          backgroundColor: '#fff',
          transform: [{ translateX: slideX }],
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
        }}
      >
        {/* User Header */}
        <View style={{
          backgroundColor: '#1E3A5F',
          paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20,
        }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: '#F59E0B',
            alignItems: 'center', justifyContent: 'center', marginBottom: 10,
          }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff' }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
            {user?.name}
          </Text>
          <Text style={{ color: '#93C5FD', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={{
            marginTop: 8, alignSelf: 'flex-start',
            backgroundColor: 'rgba(255,255,255,0.15)',
            paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
              {user?.role || 'Player'}
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Navigation Section */}
          <View style={{ paddingHorizontal: 12, paddingTop: 14 }}>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: '#9CA3AF',
              paddingHorizontal: 8, paddingBottom: 6, letterSpacing: 1,
            }}>
              NAVIGATION
            </Text>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => navigate(item.route)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingHorizontal: 12, paddingVertical: 13, borderRadius: 12,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: '#EFF6FF',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={item.icon as any} size={18} color="#1E3A5F" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 20, marginVertical: 8 }} />

          {/* Quick Actions Section */}
          <View style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: '#9CA3AF',
              paddingHorizontal: 8, paddingBottom: 6, letterSpacing: 1,
            }}>
              QUICK ACTIONS
            </Text>
            {ACTION_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => navigate(item.route)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: item.color + '10',
                  marginBottom: 4,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: item.color + '20',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: item.color }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 20, marginVertical: 8 }} />

          {/* Sign Out */}
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 14,
              paddingHorizontal: 20, paddingVertical: 14,
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: '#FEE2E2',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
