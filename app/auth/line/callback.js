import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import api from '../../../lib/api';

// ถอด payload จาก JWT (id/username/role) — payload เป็น ASCII ล้วน ใช้ atob ได้
function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

// หน้าปลายทางของ deep link ที่ server เด้งกลับมาหลัง LINE login (native/APK)
//   myproject://auth/line/callback?token=...&isNewUser=...&full_name=...&email=...&username=...
// จัดการ token ที่นี่ที่เดียว แล้ว router.replace ไปหน้าเหมาะสม (กันหน้า Unmatched Route ค้าง)
export default function LineCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    (async () => {
      const token = params.token ? String(params.token) : '';
      const error = params.error ? String(params.error) : '';
      const isNewUser = String(params.isNewUser) === '1';
      const full_name = params.full_name ? String(params.full_name) : '';
      const email = params.email ? String(params.email) : '';
      const username = params.username ? String(params.username) : '';

      if (error || !token) {
        if (error) {
          showMessage({
            message: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',
            description: error,
            type: 'danger', icon: 'danger', floating: true,
          });
        }
        router.replace('/login');
        return;
      }

      // ผู้ใช้ใหม่ → ไปหน้าสมัครเพื่อกรอกเบอร์/รหัสผ่าน + เลือกประเภทผู้เช่า (ยังไม่เก็บ token)
      if (isNewUser) {
        // prefill ชื่อจริงจาก LINE (ถ้ามี) แต่ไม่เอา line_xxx มาใส่ · username ให้ผู้ใช้ตั้งเอง
        const realName = full_name && !full_name.startsWith('line_') ? full_name : '';
        router.replace({
          pathname: '/socialsetup',
          params: {
            pendingToken: token,
            lockedFullName: realName,
            lockedEmail: email,
          },
        });
        return;
      }

      // ผู้ใช้เดิม → เก็บ token + ดึงโปรไฟล์เต็ม → เข้าระบบ
      try {
        await AsyncStorage.setItem('token', token);
        const payload = decodeJwt(token) || {};
        const profileRes = await api.get('/current-user');
        const pd = profileRes.data.data;
        const userProfile = {
          id: payload.id,
          username: payload.username || username,
          name: pd.full_name || payload.username,
          full_name: pd.full_name,
          email: pd.email,
          phone_number: pd.phone_number,
          role: payload.role,
          isLoggedIn: true,
        };
        await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
        showMessage({
          message: 'สำเร็จ',
          description: 'เข้าสู่ระบบเรียบร้อยแล้ว',
          type: 'success', icon: 'success', floating: true,
        });
      } catch (e) {
        // ถ้าดึงโปรไฟล์ไม่ได้ ยังถือว่ามี token แล้ว → ไปหน้าแรก
      }
      router.replace('/');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
      <ActivityIndicator size="large" color="#0194F3" />
    </View>
  );
}
