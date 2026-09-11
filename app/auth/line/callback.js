import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [successVisible, setSuccessVisible] = useState(false);

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
      } catch (e) {
        // ถ้าดึงโปรไฟล์ไม่ได้ ยังถือว่ามี token แล้ว → โชว์หน้าสำเร็จได้
      }
      // เข้าสู่ระบบสำเร็จ → โชว์หน้า "เข้าสู่ระบบสำเร็จ" + ปุ่มตกลงเพื่อไปหน้าแรก
      setSuccessVisible(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // หน้า "เข้าสู่ระบบสำเร็จ" — ไอคอนเช็ค + ปุ่มตกลงเพื่อไปหน้าแรก
  if (successVisible) {
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
          </View>
          <Text style={styles.title}>เข้าสู่ระบบสำเร็จ</Text>
          <Text style={styles.sub}>ยินดีต้อนรับกลับมา! กดตกลงเพื่อไปยังหน้าแรก</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
            <Text style={styles.btnText}>ตกลง</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
      <ActivityIndicator size="large" color="#0194F3" />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#EEF3F8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  iconWrap: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  sub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 22 },
  btn: {
    backgroundColor: '#0178C7',
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: 'white', fontSize: 16, fontWeight: '900' },
});
