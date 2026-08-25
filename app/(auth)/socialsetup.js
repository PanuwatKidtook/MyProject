import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FlashMessage, { showMessage } from 'react-native-flash-message';
import api from '../../lib/api';

// หน้า "ตั้งค่าบัญชี" สำหรับผู้ใช้ใหม่จาก Google/LINE (deferCreate — ยังไม่ถูกสร้างจนกดยืนยัน)
// ส่ง pendingToken เฉพาะ request นี้ (ไม่เก็บลงเครื่องจนได้ token จริง)
export default function SocialSetupScreen() {
  const router = useRouter();
  const { pendingToken, lockedFullName, lockedEmail } = useLocalSearchParams();

  const [userRole, setUserRole] = useState('Daily_Tenant');
  const [firstName, setFirstName] = useState(lockedFullName ? String(lockedFullName) : '');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const flash = (description, type = 'danger') =>
    showMessage({ message: type === 'danger' ? 'ข้อผิดพลาด' : 'สำเร็จ', description, type, icon: type, floating: true });

  const handleSubmit = async () => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cleanPhone = phone.replace(/[\s-]/g, '');

    const newErrors = {
      firstName: !firstName.trim(),
      phone: !/^0\d{8,9}$/.test(cleanPhone),
      username: !/^[a-zA-Z0-9._]{4,20}$/.test(username.trim()),
      password: password.length < 6,
    };
    setErrors(newErrors);

    if (newErrors.firstName) return flash('กรุณากรอกชื่อ');
    if (newErrors.phone) return flash('กรุณากรอกเบอร์โทรให้ถูกต้อง (เช่น 08x-xxx-xxxx)');
    if (newErrors.username) return flash('ชื่อผู้ใช้ต้องยาว 4–20 ตัว ใช้ตัวอักษรอังกฤษ ตัวเลข จุด หรือขีดล่างเท่านั้น');
    if (newErrors.password) return flash('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

    setLoading(true);
    try {
      const res = await api.post(
        '/auth/social/complete',
        {
          username: username.trim(),
          full_name: fullName,
          phone_number: cleanPhone,
          password,
          user_role: userRole,
        },
        pendingToken ? { headers: { Authorization: `Bearer ${pendingToken}` } } : undefined
      );

      const { token, payload } = res.data;
      if (token) await AsyncStorage.setItem('token', token);

      await AsyncStorage.setItem('userProfile', JSON.stringify({
        id: payload?.id,
        username: payload?.username || username.trim(),
        name: fullName,
        full_name: fullName,
        email: lockedEmail ? String(lockedEmail) : '',
        phone_number: cleanPhone,
        role: payload?.role || userRole,
        isLoggedIn: true,
      }));

      flash('สมัครสมาชิกเรียบร้อย', 'success');
      router.replace('/');
    } catch (err) {
      flash(err.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const RoleButton = ({ role, title, sub, icon }) => {
    const active = userRole === role;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setUserRole(role)}
        style={[styles.roleBtn, active && styles.roleBtnActive]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons name={icon} size={16} color={active ? 'white' : '#0194F3'} style={{ marginRight: 6 }} />
          <Text style={[styles.roleTitle, active && { color: 'white' }]}>{title}</Text>
        </View>
        <Text style={[styles.roleSub, active && { color: 'rgba(255,255,255,0.9)' }]}>{sub}</Text>
      </TouchableOpacity>
    );
  };

  const Field = ({ label, required, error, children }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#EF4444' }}>*</Text>}
      </Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0178C7" />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header สีน้ำเงิน + โลโก้ */}
        <View style={styles.headerBg}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={34} color="white" />
          </View>
          <Text style={styles.brand}>Around Loei</Text>
          <Text style={styles.brandSub}>ตั้งค่าบัญชี</Text>
        </View>

        {/* การ์ดกรอกข้อมูล */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>กรอกข้อมูลสมาชิก</Text>
          <Text style={styles.cardSub}>อีกขั้นเดียว! กรอกข้อมูลให้ครบทุกช่องเพื่อสมัครสมาชิกให้เสร็จสมบูรณ์</Text>

          <Field label="ประเภทสมาชิก" required>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <RoleButton role="Daily_Tenant" title="ผู้เช่ารายวัน" sub="จองห้องพักแบบรายวัน" icon="sunny-outline" />
              <RoleButton role="Monthly_Tenant" title="ผู้เช่ารายเดือน" sub="เข้าอยู่ประจำแบบรายเดือน" icon="calendar-outline" />
            </View>
          </Field>

          <Field label="ชื่อ" required>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="ชื่อ"
              placeholderTextColor="#94A3B8"
              style={[styles.input, errors.firstName && styles.inputError]}
            />
          </Field>

          <Field label="นามสกุล">
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="นามสกุล"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
          </Field>

          <Field label="เบอร์โทรศัพท์" required>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="08x-xxx-xxxx"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              style={[styles.input, errors.phone && styles.inputError]}
            />
          </Field>

          <Field label="ชื่อผู้ใช้ (username) — ใช้เข้าสู่ระบบ" required>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="ตั้งชื่อผู้ใช้ 4–20 ตัว"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              style={[styles.input, errors.username && styles.inputError]}
            />
          </Field>

          <Field label="ตั้งรหัสผ่าน" required>
            <View style={[styles.input, styles.pwWrap, errors.password && styles.inputError]}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={{ flex: 1, fontSize: 14, color: '#0F172A', padding: 0 }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </Field>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>สมัครสมาชิก</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FlashMessage position="top" statusBarHeight={StatusBar.currentHeight} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0178C7' },
  headerBg: {
    backgroundColor: '#0178C7',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 44,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brand: { color: 'white', fontSize: 22, fontWeight: '900' },
  brandSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 22,
    paddingTop: 24,
    minHeight: 600,
  },
  cardTitle: { fontSize: 19, fontWeight: '900', color: '#0F172A' },
  cardSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 18, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  inputError: { borderColor: '#EF4444' },
  pwWrap: { flexDirection: 'row', alignItems: 'center' },
  roleBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'white',
  },
  roleBtnActive: { backgroundColor: '#0194F3', borderColor: '#0194F3' },
  roleTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  roleSub: { fontSize: 11, color: '#94A3B8' },
  submitBtn: {
    backgroundColor: '#0194F3',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  submitText: { color: 'white', fontSize: 16, fontWeight: '900' },
});
