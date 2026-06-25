import React, { useEffect, useRef, useState } from 'react';
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
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = 'https://projeccty3-server.onrender.com/api';
const API_SEND_OTP = `${API_BASE_URL}/auth/send-otp`;
const API_VERIFY_OTP = `${API_BASE_URL}/auth/verify-otp`;
const API_RESET_PASSWORD = `${API_BASE_URL}/auth/reset-password`;

export default function EditRegisterScreen() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef(null);

  const [form, setForm] = useState({
    username: '',
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!form.username.trim() || !form.email.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ user และ email ให้ครบ');
      return;
    }

    try {
      setSendingOtp(true);

      const res = await axios.post(API_SEND_OTP, {
        username: form.username.trim(),
        email: form.email.trim(),
      });

      if (!res.data?.success) {
        Alert.alert('ส่งรหัส OTP ล้มเหลว', res.data?.message || 'ไม่สามารถส่ง OTP ได้');
        return;
      }

      startTimer();
      setStep(2);
      Alert.alert('ส่งรหัส OTP แล้ว', res.data?.message || 'กรุณาตรวจสอบอีเมลของคุณ');
    } catch (error) {
      console.log('Send OTP error:', error);
      Alert.alert('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถส่งรหัส OTP ได้');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!form.otp.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัส OTP');
      return;
    }

    if (countdown === 0) {
      Alert.alert('หมดเวลา', 'รหัส OTP หมดเวลาแล้ว กรุณาขอรหัสใหม่');
      return;
    }

    try {
      setVerifyingOtp(true);

      const res = await axios.post(API_VERIFY_OTP, {
        username: form.username.trim(),
        email: form.email.trim(),
        otp: form.otp.trim(),
      });

      if (!res.data?.success) {
        Alert.alert('OTP ไม่ถูกต้อง', res.data?.message || 'กรุณากรอกรหัส OTP ให้ถูกต้อง');
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      await AsyncStorage.setItem('editRegisterVerified', 'true');
      setStep(3);
    } catch (error) {
      console.log('Verify OTP error:', error);
      Alert.alert('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถตรวจสอบ OTP ได้');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSavePassword = async () => {
    if (!form.newPassword.trim() || !form.confirmPassword.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัสผ่านให้ครบ');
      return;
    }

    if (form.newPassword.length < 6) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    try {
      setSavingPassword(true);

      const res = await axios.post(API_RESET_PASSWORD, {
        username: form.username.trim(),
        email: form.email.trim(),
        newPassword: form.newPassword,
      });

      if (!res.data?.success) {
        Alert.alert('เกิดข้อผิดพลาด', res.data?.message || 'ไม่สามารถบันทึกรหัสผ่านได้');
        return;
      }

      await AsyncStorage.removeItem('editRegisterOtp');
      await AsyncStorage.removeItem('editRegisterVerified');

      Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', [
        { text: 'ตกลง', onPress: () => router.replace('/login') }
      ]);
    } catch (error) {
      console.log('Save password error:', error);
      Alert.alert('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกรหัสผ่านได้');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setForm(prev => ({ ...prev, otp: '' }));
    await handleSendOtp();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0178C7" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แก้ไขข้อมูลผู้ใช้</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.stepBox}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
          </View>

          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>กรอกข้อมูลเพื่อรับ OTP</Text>

              <Text style={styles.label}>User Name</Text>
              <TextInput
                value={form.username}
                onChangeText={(text) => handleChange('username', text)}
                placeholder="กรอกชื่อ user"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                autoCapitalize="none"
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

              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={sendingOtp}
                style={[styles.actionButton, sendingOtp && { opacity: 0.7 }]}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.actionButtonText}>ส่งรหัส OTP ไปที่อีเมล</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>กรอกรหัส OTP</Text>
              <Text style={styles.subText}>รหัสจะหมดเวลาใน {countdown} วินาที</Text>

              <TextInput
                value={form.otp}
                onChangeText={(text) => handleChange('otp', text.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="กรอกรหัส OTP 6 หลัก"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />

              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={verifyingOtp}
                style={[styles.actionButton, verifyingOtp && { opacity: 0.7 }]}
              >
                {verifyingOtp ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.actionButtonText}>ยืนยัน OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={countdown > 0}
                style={[styles.resendButton, countdown > 0 && { opacity: 0.5 }]}
              >
                <Text style={styles.resendText}>
                  {countdown > 0 ? `ส่งใหม่ได้ใน ${countdown} วินาที` : 'ส่งรหัส OTP ใหม่'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>เปลี่ยนรหัสผ่านใหม่</Text>

              <Text style={styles.label}>รหัสผ่านใหม่</Text>
              <TextInput
                value={form.newPassword}
                onChangeText={(text) => handleChange('newPassword', text)}
                placeholder="กรอกรหัสผ่านใหม่"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={styles.input}
              />

              <Text style={styles.label}>ยืนยันรหัสผ่านใหม่</Text>
              <TextInput
                value={form.confirmPassword}
                onChangeText={(text) => handleChange('confirmPassword', text)}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={styles.input}
              />

              <TouchableOpacity
                onPress={handleSavePassword}
                disabled={savingPassword}
                style={[styles.actionButton, savingPassword && { opacity: 0.7 }]}
              >
                {savingPassword ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.actionButtonText}>ยืนยัน</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
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
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 40 },
  stepBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#CBD5E1' },
  stepDotActive: { backgroundColor: '#0194F3' },
  stepLine: { width: 35, height: 2, backgroundColor: '#CBD5E1', marginHorizontal: 8 },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0194F3', marginBottom: 8 },
  subText: { fontSize: 13, color: '#64748B', marginBottom: 14, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 10 },
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
  actionButton: {
    marginTop: 18,
    backgroundColor: '#0194F3',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  actionButtonText: { color: 'white', fontSize: 16, fontWeight: '900' },
  resendButton: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  resendText: { color: '#0178C7', fontWeight: '700', fontSize: 13 },
});