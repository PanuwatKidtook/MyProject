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
import api from '../../lib/api';


export default function ProfileEditScreen() {
  const router = useRouter();


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');


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


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0178C7" />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0178C7" />


      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แก้ไขโปรไฟล์</Text>
        <View style={{ width: 36 }} />
      </View>


      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarBox}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={42} color="#0194F3" />
            </View>
            <Text style={styles.avatarName}>{form.name || 'Your Profile'}</Text>
          </View>


          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ข้อมูลทั่วไป</Text>


            <Text style={styles.label}>ชื่อ-นามสกุล</Text>
            <TextInput
              value={form.name}
              onChangeText={(text) => handleChange('name', text)}
              placeholder="กรอกชื่อ-นามสกุล"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />


            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              value={form.phone}
              onChangeText={(text) => handleChange('phone', text)}
              placeholder="กรอกเบอร์โทรศัพท์"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={form.email}
              onChangeText={(text) => handleChange('email', text)}
              placeholder="กรอกอีเมล"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>


          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>บัญชีที่เชื่อม</Text>

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

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, saving && { opacity: 0.7 }]}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>บันทึกข้อมูล</Text>
            )}
          </TouchableOpacity>
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#0178C7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
  avatarBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    marginBottom: 10,
  },
  avatarName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0194F3',
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  readOnlyInput: {
    color: '#0F172A',
    opacity: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  saveButton: {
    marginTop: 18,
    backgroundColor: '#0194F3',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
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