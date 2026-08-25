import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// ปิด popup ของ OAuth แล้วส่งผลลัพธ์กลับหน้าหลัก (จำเป็นสำหรับ LINE login บนเว็บ
// เพราะหน้า /auth/line/callback ที่ LINE เด้งกลับมาจะโหลดแอปใหม่ในหน้าต่าง popup)
WebBrowser.maybeCompleteAuthSession();

// ฝัง PWA meta/link ฝั่งเว็บ (โหมด output:single ไม่ใช้ +html.js)
// ทำให้ "เพิ่มไปยังหน้าจอโฮม" บน iPhone/Android ได้ไอคอน+ชื่อ+เปิดเต็มจอ
function useInjectPwaTags() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const ensure = (selector: string, create: () => HTMLElement) => {
      if (!document.head.querySelector(selector)) document.head.appendChild(create());
    };
    const meta = (name: string, content: string) => {
      const el = document.createElement('meta');
      el.setAttribute('name', name);
      el.setAttribute('content', content);
      return el;
    };
    const link = (rel: string, href: string) => {
      const el = document.createElement('link');
      el.setAttribute('rel', rel);
      el.setAttribute('href', href);
      return el;
    };
    document.title = 'Around Loei';
    ensure('link[rel="manifest"]', () => link('manifest', '/manifest.json'));
    ensure('link[rel="apple-touch-icon"]', () => link('apple-touch-icon', '/apple-touch-icon.png'));
    ensure('meta[name="theme-color"]', () => meta('theme-color', '#0194F3'));
    ensure('meta[name="apple-mobile-web-app-capable"]', () => meta('apple-mobile-web-app-capable', 'yes'));
    ensure('meta[name="mobile-web-app-capable"]', () => meta('mobile-web-app-capable', 'yes'));
    ensure('meta[name="apple-mobile-web-app-status-bar-style"]', () =>
      meta('apple-mobile-web-app-status-bar-style', 'black-translucent'));
    ensure('meta[name="apple-mobile-web-app-title"]', () => meta('apple-mobile-web-app-title', 'Around Loei'));
    ensure('meta[name="application-name"]', () => meta('application-name', 'Around Loei'));
  }, []);
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useInjectPwaTags();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* สั่ง screenOptions={{ headerShown: false }} ที่ Stack หลักตรงนี้เพื่อซ่อนแถบทั้งหมด */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}