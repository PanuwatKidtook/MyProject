import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// ปิด popup ของ OAuth แล้วส่งผลลัพธ์กลับหน้าหลัก (จำเป็นสำหรับ LINE login บนเว็บ
// เพราะหน้า /auth/line/callback ที่ LINE เด้งกลับมาจะโหลดแอปใหม่ในหน้าต่าง popup)
WebBrowser.maybeCompleteAuthSession();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

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