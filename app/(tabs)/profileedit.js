import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';


export default function ProfileEditScreen() {
  const router = useRouter();


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusField, setFocusField] = useState('');


  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
  });

  // บัญชี social ที่เชื่อมไว้ (provider ที่เชื่อมแล้ว เช่น ['google'])
  const [linkedProviders, setLinkedProviders] = useState([]);


  useEffect(() => {
    loadProfile();
    loadSocialAccounts();
  }, []);

  const loadSocialAccounts = async () => {
    try {
      const res = await api.get('/my-social-accounts');
      const providers = (res.data?.data || []).map((a) => a.provider);
      setLinkedProviders(providers);
    } catch (e) {
      // ถ้าโหลดไม่ได้ ปล่อยว่างไว้ (แสดงเป็นยังไม่เชื่อม)
    }
  };


  const loadProfile = async () => {
    try {
      // ดึงข้อมูลล่าสุดจาก server — ไม่ใช้แค่ AsyncStorage ที่อาจเก่า
      const response = await api.get('/current-user');
      const data = response.data.data;
      setForm({
        name: data.full_name || '',
        phone: data.phone_number || '',
        email: data.email || '',
      });
    } catch (error) {
      // ถ้า API ล้มเหลว fallback จาก AsyncStorage
      try {
        const userData = await AsyncStorage.getItem('userProfile');
        if (userData) {
          const user = JSON.parse(userData);
          setForm({
            name: user.full_name || user.name || '',
            phone: user.phone_number || '',
            email: user.email || '',
          });
        }
      } catch (e) {
        Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
      }
    } finally {
      setLoading(false);
    }
  };


  const handleChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLink = (provider) => {
    // การเชื่อมบัญชีเพิ่มต้องผ่าน OAuth flow เต็ม (โฟกัสหลักคือแสดงสถานะที่เชื่อมแล้ว)
    Alert.alert(
      'เชื่อมบัญชี',
      `ขณะนี้ยังเชื่อมบัญชี ${provider === 'google' ? 'Google' : 'LINE'} เพิ่มจากในแอปไม่ได้ กรุณาเข้าสู่ระบบด้วยบัญชีนั้นโดยตรง`
    );
  };


  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg('');

      // 1. บันทึกไปยัง backend
      await api.put('/profile', {
        full_name: form.name,
        email: form.email,
        phone_number: form.phone,
      });

      // 2. อัปเดต AsyncStorage ให้ตรงกัน
      const userData = await AsyncStorage.getItem('userProfile');
      const oldUser = userData ? JSON.parse(userData) : {};
      await AsyncStorage.setItem('userProfile', JSON.stringify({
        ...oldUser,
        name: form.name,
        full_name: form.name,
        email: form.email,
        phone_number: form.phone,
      }));

      // ใช้ Modal กลางจอแทน Alert (Alert.alert ไม่แสดงผลบน React Native Web)
      setSuccessVisible(true);
    } catch (error) {
      const msg = error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const initial = (form.name || 'U').trim().charAt(0).toUpperCase();


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#014E86" />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#014E86" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ===== Hero header ไล่เฉดสี ===== */}
          <LinearGradient
            colors={['#0A6FC2', '#0154A0', '#023E7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={22} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>แก้ไขโปรไฟล์</Text>
              <View style={{ width: 40 }} />
            </View>
          </LinearGradient>

          <View style={styles.body}>
            {/* ===== Avatar ลอยทับ header ===== */}
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={['#38BDF8', '#0178C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              </LinearGradient>
              <Text style={styles.avatarName}>{form.name || 'Your Profile'}</Text>
              {!!form.email && <Text style={styles.avatarEmail}>{form.email}</Text>}
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* ===== ข้อมูลทั่วไป ===== */}
            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>ข้อมูลทั่วไป</Text>
              </View>

              <Text style={styles.label}>ชื่อ - นามสกุล</Text>
              <View style={[styles.inputWrap, focusField === 'name' && styles.inputWrapFocus]}>
                <Ionicons name="person-outline" size={18} color="#0178C7" style={styles.inputIcon} />
                <TextInput
                  value={form.name}
                  onChangeText={(text) => handleChange('name', text)}
                  onFocus={() => setFocusField('name')}
                  onBlur={() => setFocusField('')}
                  placeholder="กรอกชื่อ-นามสกุล"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>เบอร์โทรศัพท์</Text>
              <View style={[styles.inputWrap, focusField === 'phone' && styles.inputWrapFocus]}>
                <Ionicons name="call-outline" size={18} color="#0178C7" style={styles.inputIcon} />
                <TextInput
                  value={form.phone}
                  onChangeText={(text) => handleChange('phone', text)}
                  onFocus={() => setFocusField('phone')}
                  onBlur={() => setFocusField('')}
                  placeholder="กรอกเบอร์โทรศัพท์"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>อีเมล</Text>
              <View style={[styles.inputWrap, focusField === 'email' && styles.inputWrapFocus]}>
                <Ionicons name="mail-outline" size={18} color="#0178C7" style={styles.inputIcon} />
                <TextInput
                  value={form.email}
                  onChangeText={(text) => handleChange('email', text)}
                  onFocus={() => setFocusField('email')}
                  onBlur={() => setFocusField('')}
                  placeholder="กรอกอีเมล"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>
            </View>

            {/* ===== บัญชีที่เชื่อม ===== */}
            <View style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>บัญชีที่เชื่อม</Text>
              </View>

              {/* Google */}
              <View style={styles.linkRow}>
                <View style={[styles.providerIcon, { backgroundColor: '#EA4335' }]}>
                  <Ionicons name="logo-google" size={20} color="white" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.providerName}>Google</Text>
                  {linkedProviders.includes('google') && !!form.email && (
                    <Text style={styles.providerSub} numberOfLines={1}>{form.email}</Text>
                  )}
                </View>
                {linkedProviders.includes('google') ? (
                  <View style={styles.linkedBadge}>
                    <Ionicons name="checkmark" size={14} color="#16A34A" />
                    <Text style={styles.linkedBadgeText}>เชื่อมแล้ว</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.linkButton} onPress={() => handleLink('google')}>
                    <Text style={styles.linkButtonText}>เชื่อม</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.divider} />

              {/* LINE */}
              <View style={[styles.linkRow, { marginBottom: 0 }]}>
                <View style={[styles.providerIcon, { backgroundColor: '#06C755' }]}>
                  <Ionicons name="chatbubble" size={18} color="white" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.providerName}>LINE</Text>
                </View>
                {linkedProviders.includes('line') ? (
                  <View style={styles.linkedBadge}>
                    <Ionicons name="checkmark" size={14} color="#16A34A" />
                    <Text style={styles.linkedBadgeText}>เชื่อมแล้ว</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.linkButton} onPress={() => handleLink('line')}>
                    <Text style={styles.linkButtonText}>เชื่อม</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ===== ปุ่มบันทึก ===== */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              style={[styles.saveShadow, saving && { opacity: 0.7 }]}
            >
              <LinearGradient
                colors={['#0A8DEE', '#0178C7', '#025FA3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.saveButtonText}>บันทึกข้อมูล</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>อัปเดตข้อมูลแล้ว</Text>
            <Text style={styles.successSub}>บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว</Text>

            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setSuccessVisible(false);
                router.back();
              }}
            >
              <Text style={styles.successButtonText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF3F8',
  },
  scroll: {
    paddingBottom: 40,
  },
  hero: {
    paddingTop: Platform.OS === 'web' ? 18 : 8,
    paddingBottom: 70,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  body: {
    paddingHorizontal: 20,
    marginTop: -52,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 22,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    shadowColor: '#0154A0',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  avatarInner: {
    flex: 1,
    width: '100%',
    borderRadius: 48,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '900',
    color: '#0178C7',
  },
  avatarName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 12,
  },
  avatarEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#0178C7',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    marginTop: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#F7FAFD',
    paddingHorizontal: 14,
  },
  inputWrapFocus: {
    borderColor: '#0178C7',
    backgroundColor: '#F0F8FF',
    shadowColor: '#0178C7',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF2F7',
    marginVertical: 14,
  },
  providerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  providerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  linkedBadgeText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 4,
  },
  linkButton: {
    borderWidth: 1.5,
    borderColor: '#0194F3',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
  },
  linkButtonText: {
    color: '#0194F3',
    fontSize: 13,
    fontWeight: '800',
  },
  saveShadow: {
    marginTop: 22,
    borderRadius: 18,
    shadowColor: '#0178C7',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 18,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { flex: 1, color: '#DC2626', fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
  },
  successIcon: { marginBottom: 10 },
  successTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  successSub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 22 },
  successButton: {
    backgroundColor: '#0194F3',
    paddingVertical: 13,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
  },
  successButtonText: { color: 'white', fontSize: 16, fontWeight: '900' },
});
