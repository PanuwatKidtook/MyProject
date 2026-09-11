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
  const [errorMsg, setErrorMsg] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const timerRef = useRef(null);

  // อีเมลปลายทางแบบปิดบังบางส่วน (หลังบ้านดึงจาก DB แล้วส่งกลับมาให้แสดง)
  const [maskedEmail, setMaskedEmail] = useState('');

  const [form, setForm] = useState({
    identifier: '', // อีเมลหรือชื่อผู้ใช้ (ใช้ขอ OTP)
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  // refs สำหรับช่อง OTP 6 กล่อง (เลื่อนช่องอัตโนมัติ)
  const otpRefs = useRef([]);

  const handleOtpDigit = (index, value) => {
    if (errorMsg) setErrorMsg('');
    const digits = value.replace(/[^0-9]/g, '');

    setForm(prev => {
      const arr = (prev.otp || '').padEnd(6, ' ').split('');
      if (digits.length > 1) {
        // กรณีวางรหัส (paste) หลายตัวพร้อมกัน
        const pasted = digits.slice(0, 6).split('');
        for (let i = 0; i < 6; i++) arr[i] = pasted[i] || ' ';
        const next = Math.min(pasted.length, 5);
        otpRefs.current[next]?.focus();
      } else {
        arr[index] = digits || ' ';
        if (digits) otpRefs.current[index + 1]?.focus();
      }
      return { ...prev, otp: arr.join('').replace(/ /g, '') };
    });
  };

  const handleOtpKeyPress = (index, e) => {
    if (e.nativeEvent.key === 'Backspace') {
      setForm(prev => {
        const arr = (prev.otp || '').padEnd(6, ' ').split('');
        if (!arr[index] || arr[index] === ' ') {
          // ช่องว่างอยู่แล้ว → ถอยไปช่องก่อนหน้า
          if (index > 0) {
            arr[index - 1] = ' ';
            otpRefs.current[index - 1]?.focus();
          }
        } else {
          arr[index] = ' ';
        }
        return { ...prev, otp: arr.join('').replace(/ /g, '') };
      });
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleChange = (field, value) => {
    if (errorMsg) setErrorMsg('');
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
    setErrorMsg('');
    if (!form.identifier.trim()) {
      setErrorMsg('กรุณากรอกอีเมลหรือชื่อผู้ใช้');
      return;
    }

    try {
      setSendingOtp(true);

      // ส่งอีเมลหรือชื่อผู้ใช้ — หลังบ้านจะหาบัญชีแล้วส่ง OTP ไปที่อีเมลที่ผูกไว้เอง
      const res = await axios.post(API_SEND_OTP, {
        identifier: form.identifier.trim(),
      });

      if (!res.data?.success) {
        setErrorMsg(res.data?.message || 'ไม่สามารถส่งรหัส OTP ได้');
        return;
      }

      // เก็บอีเมลปิดบังที่หลังบ้านส่งกลับมา เพื่อแสดงว่าส่งไปที่ไหน
      setMaskedEmail(res.data?.email || '');
      startTimer();
      setStep(2);
    } catch (error) {
      console.log('Send OTP error:', error);
      setErrorMsg(error.response?.data?.message || 'ไม่พบข้อมูลผู้ใช้ หรือส่งรหัส OTP ไม่สำเร็จ');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg('');
    if (!form.otp.trim()) {
      setErrorMsg('กรุณากรอกรหัส OTP');
      return;
    }

    if (countdown === 0) {
      setErrorMsg('รหัส OTP หมดเวลาแล้ว กรุณาขอรหัสใหม่');
      return;
    }

    try {
      setVerifyingOtp(true);

      const res = await axios.post(API_VERIFY_OTP, {
        identifier: form.identifier.trim(),
        otp: form.otp.trim(),
      });

      if (!res.data?.success) {
        setErrorMsg(res.data?.message || 'กรุณากรอกรหัส OTP ให้ถูกต้อง');
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      await AsyncStorage.setItem('editRegisterVerified', 'true');
      setStep(3);
    } catch (error) {
      console.log('Verify OTP error:', error);
      setErrorMsg(error.response?.data?.message || 'ไม่สามารถตรวจสอบ OTP ได้');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSavePassword = async () => {
    setErrorMsg('');
    if (!form.newPassword.trim() || !form.confirmPassword.trim()) {
      setErrorMsg('กรุณากรอกรหัสผ่านให้ครบ');
      return;
    }

    if (form.newPassword.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    try {
      setSavingPassword(true);

      const res = await axios.post(API_RESET_PASSWORD, {
        identifier: form.identifier.trim(),
        newPassword: form.newPassword,
      });

      if (!res.data?.success) {
        setErrorMsg(res.data?.message || 'ไม่สามารถบันทึกรหัสผ่านได้');
        return;
      }

      await AsyncStorage.removeItem('editRegisterOtp');
      await AsyncStorage.removeItem('editRegisterVerified');

      // แจ้งเตือนสำเร็จ แล้วเด้งไปหน้าล็อกอินทันที (รองรับทั้งเว็บและมือถือ)
      if (Platform.OS === 'web') {
        window.alert('เปลี่ยนรหัสผ่านสำเร็จ');
        router.replace('/login');
      } else {
        Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านสำเร็จ', [
          { text: 'ตกลง', onPress: () => router.replace('/login') }
        ]);
        // เผื่อผู้ใช้ไม่กดปุ่ม ก็เด้งให้อัตโนมัติ
        router.replace('/login');
      }
    } catch (error) {
      console.log('Save password error:', error);
      setErrorMsg(error.response?.data?.message || 'ไม่สามารถบันทึกรหัสผ่านได้');
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

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {step === 1 && (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <Ionicons name="mail-outline" size={26} color="#0194F3" />
              </View>
              <Text style={styles.sectionTitle}>กรอกข้อมูลเพื่อรับ OTP</Text>

              <Text style={styles.subText}>
                กรอกอีเมลหรือชื่อผู้ใช้ของคุณ ระบบจะส่งรหัส OTP ไปที่อีเมลที่ผูกกับบัญชีนี้
              </Text>

              <Text style={styles.label}>อีเมล หรือ ชื่อผู้ใช้</Text>
              <TextInput
                value={form.identifier}
                onChangeText={(text) => handleChange('identifier', text)}
                placeholder="กรอกอีเมลหรือชื่อ user"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                style={styles.input}
                autoCapitalize="none"
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
              <View style={styles.cardIcon}>
                <Ionicons name="shield-checkmark-outline" size={26} color="#0194F3" />
              </View>
              <Text style={styles.sectionTitle}>กรอกรหัส OTP</Text>
              {maskedEmail ? (
                <Text style={styles.subText}>ส่งรหัส OTP ไปที่ {maskedEmail} แล้ว</Text>
              ) : null}
              <View style={styles.countdownPill}>
                <Ionicons name="time-outline" size={15} color={countdown > 0 ? '#0178C7' : '#DC2626'} />
                <Text style={[styles.countdownText, countdown === 0 && { color: '#DC2626' }]}>
                  {countdown > 0 ? `รหัสจะหมดเวลาใน ${countdown} วินาที` : 'รหัสหมดเวลาแล้ว'}
                </Text>
              </View>

              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const digit = (form.otp || '')[i] || '';
                  return (
                    <TextInput
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      value={digit}
                      onChangeText={(text) => handleOtpDigit(i, text)}
                      onKeyPress={(e) => handleOtpKeyPress(i, e)}
                      keyboardType="number-pad"
                      maxLength={6}
                      selectTextOnFocus
                      style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    />
                  );
                })}
              </View>

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
              <View style={styles.cardIcon}>
                <Ionicons name="lock-closed-outline" size={26} color="#0194F3" />
              </View>
              <Text style={styles.sectionTitle}>เปลี่ยนรหัสผ่านใหม่</Text>

              <Text style={styles.label}>รหัสผ่านใหม่</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  value={form.newPassword}
                  onChangeText={(text) => handleChange('newPassword', text)}
                  placeholder="กรอกรหัสผ่านใหม่"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showNewPassword}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(prev => !prev)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>ยืนยันรหัสผ่านใหม่</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  value={form.confirmPassword}
                  onChangeText={(text) => handleChange('confirmPassword', text)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(prev => !prev)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye' : 'eye-off'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              {form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword ? (
                <Text style={styles.mismatchText}>กรุณาพิมพ์ตัวเลขให้ตรงกัน</Text>
              ) : null}

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
  content: { padding: 20, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  stepBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, marginTop: 4 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#CBD5E1' },
  stepDotActive: {
    backgroundColor: '#0194F3',
    transform: [{ scale: 1.25 }],
    shadowColor: '#0194F3',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  stepLine: { width: 35, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 8 },
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
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  subText: { fontSize: 13, color: '#64748B', marginBottom: 14, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 4,
  },
  otpBox: {
    width: 46,
    height: 58,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  otpBoxFilled: {
    borderColor: '#0194F3',
    backgroundColor: '#EFF8FF',
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  countdownText: { fontSize: 12.5, fontWeight: '700', color: '#0178C7', marginLeft: 6 },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mismatchText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  actionButton: {
    marginTop: 20,
    backgroundColor: '#0194F3',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0194F3',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionButtonText: { color: 'white', fontSize: 16, fontWeight: '900' },
  resendButton: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  resendText: { color: '#0178C7', fontWeight: '700', fontSize: 13 },
});