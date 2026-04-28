import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@store/authStore';

const { width, height } = Dimensions.get('window');
const SPLASH_MIN_MS = 1800; // show animated splash for at least this long

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const opacity = useRef(new Animated.Value(0)).current;
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // Fade in the splash image
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      // Fade out before navigating
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, SPLASH_MIN_MS);

    return () => clearTimeout(timer);
  }, []);

  // Still waiting for either auth check or minimum splash duration
  if (!splashDone || isLoading) {
    return (
      <Animated.View style={{ flex: 1, opacity }}>
        <Image
          source={require('../assets/splash.png')}
          style={{ width, height }}
          resizeMode="cover"
        />
      </Animated.View>
    );
  }

  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
