import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import FlashMessage, { showMessage } from 'react-native-flash-message';
import api from '../../lib/api';

const { width, height } = Dimensions.get('window');

// endpoint ยืนยันอีเมลด้วย OTP หลังสมัคร (backend สร้างบัญชีแบบยังไม่ยืนยัน + ส่ง OTP ตอน /register)
const API_BASE_URL = 'https://projeccty3-server.onrender.com/api';
// ยืนยัน "การสมัคร" โดยเฉพาะ (ตั้งค่า email_verified_at) — คนละชุดกับ reset-password (/auth/verify-otp)
const API_RESEND_REG_OTP = `${API_BASE_URL}/auth/resend-registration-otp`;
const API_VERIFY_REG = `${API_BASE_URL}/auth/verify-registration`;

export default function RegisterScreen() {
  const router = useRouter();
  // รับค่าที่ถูกล็อกมาจากการล็อกอินด้วยอีเมล หรือ LINE (ถ้ามี)
  const { lockedEmail, lockedUsername, lockedPassword, lockedFullName, source, pendingToken } = useLocalSearchParams();

  // แยก 2 กรณี:
  //  - email flow  : ล็อก username + email + password (ผู้ใช้กรอกเองตอนล็อกอินอีเมล) → สมัครบัญชีใหม่ปกติ
  //  - social flow : LINE / Google — member ถูกสร้างตอน exchange แล้ว (role Daily ชั่วคราว)
  //    หน้านี้แค่ "เติมโปรไฟล์" ผ่าน /auth/social/complete: ล็อก ชื่อ-นามสกุล + email + username
  //    ที่ได้จาก provider แต่ให้กรอกเบอร์โทร/รหัสผ่าน และเลือกประเภทผู้เช่า (รายวัน/รายเดือน) เอง
  //    *สำคัญ*: google ต้องเดินเส้นนี้ ไม่ใช่ /register เดิม ไม่งั้นจะสร้างบัญชีซ้ำ (ชนอีเมล) แล้ว
  //    member ตัวจริงค้างเป็น Daily ตลอด
  const isSocialFlow = source === 'line' || source === 'google';
  const isEmailLocked = !isSocialFlow && !!lockedUsername;

  // ธงล็อกรายช่อง
  //  - social: ชื่อ-นามสกุล prefill จาก provider แต่ "แก้ได้" · username ต้องตั้งเอง (4–20 ตัว) ไม่ล็อก
  //  - email flow: ล็อก username ที่ generate จากอีเมล
  const lockFullName = false;
  const lockUsername = isEmailLocked && !!lockedUsername;
  const lockEmail = (isEmailLocked || isSocialFlow) && !!lockedEmail;
  const lockPassword = isEmailLocked; // social ให้ตั้งรหัสผ่านเอง

  const [lang, setLang] = useState('TH');
  const [loading, setLoading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  // ขั้นยืนยันอีเมลด้วย OTP หลังสมัครสำเร็จ (เฉพาะสมัครปกติ — social ไม่ต้องยืนยันเพราะอีเมลมาจาก provider แล้ว)
  const [otpVisible, setOtpVisible] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const otpTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, []);

  const startOtpTimer = () => {
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    setOtpCountdown(60);
    otpTimerRef.current = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(otpTimerRef.current);
          otpTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // เพิ่ม State สำหรับจัดการ Modal และการตรวจสอบการเลื่อนดูเงื่อนไข
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const [full_name, setFullName] = useState(lockedFullName || '');
  const [username, setUsername] = useState(lockedUsername || '');
  const [password, setPassword] = useState(lockedPassword || '');
  const [phone_number, setPhoneNumber] = useState('');
  const [email, setEmail] = useState(lockedEmail || '');
  const [user_role, setUserRole] = useState('Daily_Tenant');

  const [errors, setErrors] = useState({
    full_name: false,
    username: false,
    password: false,
    phone_number: false
  });

  const text = {
    TH: {
      header: 'สร้างบัญชีใหม่', start: 'เริ่มต้นใช้งาน', sub: 'สมัครสมาชิกเพื่อจองหอพัก Around Loei ได้ง่ายขึ้น',
      name: 'ชื่อ-นามสกุล', namePlace: 'กรุณากรอกชื่อจริง', email: 'ชื่อผู้ใช้งาน (Username)', pass: 'รหัสผ่าน',
      phone: 'เบอร์โทรศัพท์', phonePlace: 'กรุณากรอกเบอร์โทรศัพท์',
      emailLabel: 'อีเมล', emailPlace: 'กรุณากรอกอีเมล',
      roleLabel: 'ประเภทผู้เช่า', roleHint: 'เลือกไว้ล่วงหน้า เพื่อไม่ต้องเลือกซ้ำตอนจองห้องพัก',
      roleDaily: 'รายวัน', roleMonthly: 'รายเดือน',
      terms: 'โปรดอ่านและทำความเข้าใจ', condition: ' เงื่อนไขการใช้งาน ', privacy: ' นโยบายความเป็นส่วนตัว ',
      btn: 'ยืนยันสมัครสมาชิก', haveAcc: 'มีบัญชีอยู่แล้ว? ', login: 'เข้าสู่ระบบ',
      errorFill: 'กรุณากรอกข้อมูลให้ครบถ้วน', success: 'สมัครสมาชิกสำเร็จ!', fail: 'เกิดข้อผิดพลาดในการสมัคร',
      termsTitle: 'เงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว',
      termsIntro: 'กรุณาอ่านรายละเอียดต่อไปนี้ให้ครบก่อนกดยืนยัน',
      termsItems: [
        '1. ข้อมูลที่ลงทะเบียนต้องเป็นข้อมูลจริง ถูกต้อง และเป็นปัจจุบัน หากตรวจพบข้อมูลเท็จระบบมีสิทธิ์ระงับการใช้งานทันที',
        '2. ข้อมูลส่วนบุคคล เช่น เบอร์โทรศัพท์ และข้อมูลการจอง จะถูกใช้เพื่อการประสานงานระหว่างผู้เช่าและผู้ดูแลหอพักเท่านั้น',
        '3. ผู้ใช้งาน 1 ท่าน สามารถลงทะเบียนใช้งานได้เพียง 1 บัญชีผู้ใช้เท่านั้น ห้ามมิให้ใช้ข้อมูลผู้อื่นมาแอบอ้าง',
        '4. การจองห้องพักผ่านระบบจะเสร็จสมบูรณ์ต่อเมื่อผู้จองได้แนบหลักฐานการชำระเงินเงินมัดจำ/เงินจอง และได้รับการยืนยันจากระบบ',
        '5. หากผู้จองไม่ชำระเงินภายในระยะเวลาที่กำหนด ระบบจะยกเลิกการจองห้องพักนั้นโดยอัตโนมัติเพื่อให้สิทธิ์แก่ผู้ใช้รายอื่น',
        '6. อัตราค่าเช่า ค่าประกัน และค่าธรรมเนียมต่าง ๆ เป็นไปตามที่ระบุในรายละเอียดของแต่ละหอพัก ผู้ใช้งานควรตรวจสอบให้ถี่ถ้วนก่อนยืนยัน',
        '7. ระบบทำหน้าที่เป็นสื่อกลางและอำนวยความสะดวกในการจองเท่านั้น การทำสัญญาเช่าจริงจะกระทำ ณ หอพักตามกฎระเบียบของสถานที่นั้น ๆ',
        '8. ระบบมีมาตรการรักษาความปลอดภัยของข้อมูลตามมาตรฐาน และจะไม่นำข้อมูลของผู้ใช้ไปเผยแพร่แก่บุคคลภายนอกโดยไม่ได้รับอนุญาต',
        '9. ห้ามผู้ใช้งานกระทำการใด ๆ ที่เป็นการโจมตี คัดลอก ดัดแปลง หรือก่อให้เกิดความเสียหายต่อระบบซอฟต์แวร์และฐานข้อมูล',
        '10. การกดปุ่มยืนยันถือว่าผู้ใช้งานยอมรับ ผูกพัน และยินยอมปฏิบัติตามข้อกำหนด เงื่อนไข และนโยบายความเป็นส่วนตัวทั้งหมดนี้'
      ],
      cancelText: 'ยกเลิก',
      confirmText: 'ยืนยัน',
      scrollHint: 'เลื่อนลงมาด้านล่างสุดก่อนจึงจะกดยืนยันได้',
      modalTitle: 'การยืนยันเงื่อนไข',
    },
    EN: {
      header: 'Create Account', start: 'Get Started', sub: 'Sign up to book Around Loei more easily',
      name: 'Full Name', namePlace: 'Enter your full name', email: 'Username', pass: 'Password',
      phone: 'Phone Number', phonePlace: 'Enter your phone number',
      emailLabel: 'Email', emailPlace: 'Enter your email',
      roleLabel: 'Tenant Type', roleHint: 'Choose ahead so you won\'t need to pick again when booking',
      roleDaily: 'Daily', roleMonthly: 'Monthly',
      terms: 'Please read and understand', condition: ' Terms of Service ', privacy: ' Privacy Policy ',
      btn: 'Confirm Registration', haveAcc: 'Already have an account? ', login: 'Login',
      errorFill: 'Please fill in all fields', success: 'Registration Successful!', fail: 'Registration Failed',
      termsTitle: 'Terms of Service and Privacy Policy',
      termsIntro: 'Please read all details before confirming',
      termsItems: [
        '1. All registered information must be accurate, truthful, and up-to-date. False data will result in immediate suspension.',
        '2. Personal data, including phone numbers and booking details, will be used solely for coordination between tenants and owners.',
        '3. Each user is permitted to create only one account. Impersonating or using other people’s identity is strictly prohibited.',
        '4. Room bookings are only considered complete once the user uploads valid proof of deposit and receives system confirmation.',
        '5. Failure to complete the deposit payment within the specified time limit will result in automatic booking cancellation.',
        '6. Rental rates, security deposits, and other fees are subject to the specific terms listed for each dormitory.',
        '7. This application serves as an online coordinator; the official lease agreement must be signed physical at the dormitory.',
        '8. User data will be securely stored in accordance with our privacy policy and will never be shared without consent.',
        '9. Users must not attempt to hack, copy, modify, or cause any disruption to the application system and its database.',
        '10. Clicking confirm indicates that you have fully read, understood, and agreed to abide by all the listed terms and policies.'
      ],
      cancelText: 'Cancel',
      confirmText: 'Confirm',
      scrollHint: 'Please scroll to the bottom before confirming.',
      modalTitle: 'Terms Confirmation',
    }
  };

  const t = text[lang];

  // ฟังก์ชันคำนวณระยะการ Scroll (ปรับเพิ่ม Offset สระภาษาไทย เพื่อให้กดยืนยันได้แน่นอน)
  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }) => {
    const paddingToBottom = 60;
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  const openTermsModal = () => {
    setTermsVisible(true);
    setTermsAccepted(false);
    setTermsScrolledToBottom(false);
    setTermsError(false);
  };

  const handleRegister = async () => {
    const newErrors = {
      full_name: !full_name.trim(),
      username: !username.trim(),
      password: !password.trim(),
      phone_number: !phone_number.trim(),
    };

    setErrors(newErrors);

    if (newErrors.full_name || newErrors.username || newErrors.password || newErrors.phone_number) {
      return;
    }

    // ตรวจสอบสถานะการยอมรับเงื่อนไขเงื่อนไขก่อนดำเนินการส่ง API
    if (!termsAccepted) {
      setTermsError(true);
      showMessage({
        message: lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
        description: lang === 'TH' ? 'กรุณายอมรับเงื่อนไขการใช้งานก่อนสมัคร' : 'Please accept the terms before registering',
        type: "danger",
        icon: "danger",
        floating: true,
      });
      return;
    }

    setLoading(true);
    try {
      if (isSocialFlow) {
        // ตรวจรูปแบบให้ตรงกับ backend ก่อนส่ง (username 4–20 [a-zA-Z0-9._], เบอร์ไทย 0+9-10 หลัก)
        if (!/^[a-zA-Z0-9._]{4,20}$/.test(username.trim())) {
          setErrors(prev => ({ ...prev, username: true }));
          Alert.alert(
            lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
            lang === 'TH'
              ? 'ชื่อผู้ใช้ต้องยาว 4–20 ตัว ใช้ตัวอักษรอังกฤษ ตัวเลข จุด หรือขีดล่างเท่านั้น'
              : 'Username must be 4–20 chars (letters, numbers, . or _).'
          );
          setLoading(false);
          return;
        }
        if (!/^0\d{8,9}$/.test(phone_number.replace(/[\s-]/g, ''))) {
          setErrors(prev => ({ ...prev, phone_number: true }));
          Alert.alert(
            lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
            lang === 'TH' ? 'กรุณากรอกเบอร์โทรให้ถูกต้อง (เช่น 08x-xxx-xxxx)' : 'Please enter a valid phone number.'
          );
          setLoading(false);
          return;
        }

        // ผู้ใช้ social ใหม่ยัง "ไม่ถูกสร้าง" ใน DB (deferCreate) — server ออก pendingToken มาให้
        // เพิ่งกดยืนยันตอนนี้ → ส่ง pendingToken เฉพาะ request นี้ (ไม่เก็บลงเครื่อง)
        // server จะสร้าง member จริงแล้วคืน token จริงกลับมา ค่อยเก็บอันนั้น
        // ถ้าผู้ใช้กดย้อนกลับก่อนยืนยัน → ไม่มี member/ไม่มี token ค้างในเครื่องเลย
        const res = await api.post(
          '/auth/social/complete',
          { username: username.trim(), full_name, phone_number, password, user_role },
          pendingToken ? { headers: { Authorization: `Bearer ${pendingToken}` } } : undefined
        );

        const { token, payload } = res.data;
        if (token) await AsyncStorage.setItem('token', token);

        const userProfile = {
          id: payload.id,
          username: payload.username,
          name: full_name || payload.username,
          full_name,
          email,
          phone_number,
          role: payload.role,
          isLoggedIn: true,
        };
        await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

        setSuccessVisible(true);
        return;
      }

      const response = await axios.post('https://projeccty3-server.onrender.com/api/register', {
        username: username,
        password: password,
        full_name: full_name,
        phone_number: phone_number,
        email: email,
        user_role: user_role,
      });

      if (response.status === 200 || response.status === 201) {
        // backend สร้างบัญชีแบบยังไม่ยืนยัน + ส่ง OTP ไปอีเมลแล้ว
        // → เปิดหน้ายืนยัน OTP ก่อน ยังไม่ถือว่าสมัครเสร็จจนกว่าจะยืนยันอีเมลสำเร็จ
        setOtp('');
        setOtpError('');
        setOtpVisible(true);
        startOtpTimer();
      }
    } catch (error) {
      if (!error.response) {
        const noServerMsg = lang === 'TH'
          ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ เซิร์ฟเวอร์อาจกำลังเริ่มทำงาน (ใช้เวลาสักครู่) กรุณาลองใหม่อีกครั้ง'
          : 'Cannot connect to the server. It may be waking up — please wait a moment and try again.';

        Alert.alert(lang === 'TH' ? 'ข้อผิดพลาด' : 'Error', noServerMsg);
      } else {
        const serverMessage = error.response.data?.message;
        let displayErrorMsg = t.fail;
        // ตรวจเคส "บัญชีซ้ำ" ให้ครอบคลุมข้อความจาก backend (already/exist/ซ้ำ/ถูกใช้แล้ว)
        const isDuplicate = serverMessage && (
          serverMessage.includes('already') || serverMessage.includes('exist') ||
          serverMessage.includes('ซ้ำ') || serverMessage.includes('ถูกใช้')
        );

        if (isDuplicate) {
          displayErrorMsg = lang === 'TH'
            ? 'อีเมลหรือชื่อผู้ใช้นี้ถูกสมัครไปแล้ว หากเป็นบัญชีของคุณ กรุณาไปที่หน้า "เข้าสู่ระบบ"'
            : 'This email or username is already registered. If it is your account, please go to the Login page.';
        } else if (serverMessage) {
          displayErrorMsg = serverMessage;
        }

        // ใช้ Alert (popup กลางจอ) เพื่อให้ผู้ใช้เห็นชัดเจน ไม่พลาดเหมือนแถบ flash ที่หายไว
        Alert.alert(lang === 'TH' ? 'ข้อผิดพลาด' : 'Error', displayErrorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError('');
    if (otp.trim().length < 6) {
      setOtpError(lang === 'TH' ? 'กรุณากรอกรหัส OTP 6 หลัก' : 'Please enter the 6-digit OTP');
      return;
    }
    if (otpCountdown === 0) {
      setOtpError(lang === 'TH' ? 'รหัส OTP หมดเวลาแล้ว กรุณาขอรหัสใหม่' : 'OTP expired. Please request a new one.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await axios.post(API_VERIFY_REG, {
        email: email.trim(),
        otp: otp.trim(),
      });

      if (!res.data?.success) {
        setOtpError(res.data?.message || (lang === 'TH' ? 'รหัส OTP ไม่ถูกต้อง' : 'Invalid OTP'));
        return;
      }

      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      otpTimerRef.current = null;
      setOtpVisible(false);
      setSuccessVisible(true);
    } catch (error) {
      setOtpError(
        error.response?.data?.message ||
        (lang === 'TH' ? 'ไม่สามารถยืนยันรหัส OTP ได้' : 'Could not verify the OTP.')
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0 || resending) return;
    setOtpError('');
    setResending(true);
    try {
      const res = await axios.post(API_RESEND_REG_OTP, {
        email: email.trim(),
      });
      if (!res.data?.success) {
        setOtpError(res.data?.message || (lang === 'TH' ? 'ส่งรหัส OTP ใหม่ไม่สำเร็จ' : 'Failed to resend OTP.'));
        return;
      }
      setOtp('');
      startOtpTimer();
    } catch (error) {
      setOtpError(
        error.response?.data?.message ||
        (lang === 'TH' ? 'ส่งรหัส OTP ใหม่ไม่สำเร็จ' : 'Failed to resend OTP.')
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" />
      
      <View style={{ 
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, 
        paddingVertical: 15, backgroundColor: 'white', justifyContent: 'space-between'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ 
              width: 45, height: 45, borderRadius: 15, 
              backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' 
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#0194F3" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 15, color: '#333' }}>
            {t.header}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')} 
          style={{ 
            borderWidth: 1, borderColor: '#0194F3', paddingHorizontal: 12, 
            paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F8FF'
          }}
        >
          <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 12 }}>
            {lang === 'TH' ? 'EN' : 'TH'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 25 }}>
          
          <View style={{ marginBottom: 30 }}>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#0194F3' }}>{t.start}</Text>
            <Text style={{ fontSize: 16, color: '#777', marginTop: 5 }}>{t.sub}</Text>
          </View>

          <View>
            <InputBox
              label={t.name}
              icon="user"
              placeholder={t.namePlace}
              locked={lockFullName}
              value={full_name}
              error={errors.full_name}
              onChangeText={(text) => {
                setFullName(text);
                if (text) setErrors(prev => ({ ...prev, full_name: false }));
              }}
            />

            <InputBox
              label={t.email}
              icon="mail"
              placeholder="Username"
              autoCapitalize="none"
              locked={lockUsername}
              value={username}
              error={errors.username}
              onChangeText={(text) => {
                setUsername(text);
                if (text) setErrors(prev => ({ ...prev, username: false }));
              }}
            />

            <InputBox 
              label={t.phone} 
              icon="phone" 
              placeholder={t.phonePlace} 
              keyboardType="phone-pad"
              value={phone_number}
              error={errors.phone_number}
              onChangeText={(text) => {
                setPhoneNumber(text);
                if (text) setErrors(prev => ({ ...prev, phone_number: false }));
              }}
            />

            <InputBox
              label={t.emailLabel}
              icon="mail"
              placeholder={t.emailPlace}
              keyboardType="email-address"
              autoCapitalize="none"
              locked={lockEmail}
              value={email}
              onChangeText={setEmail}
            />

            <InputBox
              label={t.pass}
              icon="lock"
              placeholder="••••••••"
              secureTextEntry={!lockPassword}
              locked={lockPassword}
              value={password}
              error={errors.password}
              onChangeText={(text) => {
                setPassword(text);
                if (text) setErrors(prev => ({ ...prev, password: false }));
              }}
            />

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 8, marginLeft: 5 }}>
                {t.roleLabel}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setUserRole('Daily_Tenant')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: user_role === 'Daily_Tenant' ? '#0194F3' : 'white',
                    borderRadius: 18,
                    height: 56,
                    borderWidth: 1.5,
                    borderColor: user_role === 'Daily_Tenant' ? '#0194F3' : '#E1E9F0',
                  }}
                >
                  <Ionicons name="sunny-outline" size={18} color={user_role === 'Daily_Tenant' ? 'white' : '#0194F3'} style={{ marginRight: 8 }} />
                  <Text style={{ fontWeight: 'bold', fontSize: 15, color: user_role === 'Daily_Tenant' ? 'white' : '#444' }}>
                    {t.roleDaily}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setUserRole('Monthly_Tenant')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: user_role === 'Monthly_Tenant' ? '#0194F3' : 'white',
                    borderRadius: 18,
                    height: 56,
                    borderWidth: 1.5,
                    borderColor: user_role === 'Monthly_Tenant' ? '#0194F3' : '#E1E9F0',
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color={user_role === 'Monthly_Tenant' ? 'white' : '#0194F3'} style={{ marginRight: 8 }} />
                  <Text style={{ fontWeight: 'bold', fontSize: 15, color: user_role === 'Monthly_Tenant' ? 'white' : '#444' }}>
                    {t.roleMonthly}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 8, marginLeft: 5 }}>{t.roleHint}</Text>
            </View>
          </View>

          {/* ส่วนเงื่อนไขและ Checkbox ที่เพิ่มเข้ามาใหม่ */}
          <View style={{ marginBottom: 25 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openTermsModal}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 10
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: termsError ? '#FF3B30' : '#B5B5B5',
                  backgroundColor: termsAccepted ? '#0194F3' : 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8
                }}
              >
                {termsAccepted ? (
                  <Ionicons name="checkmark" size={14} color="white" />
                ) : null}
              </View>

              <Text style={{ fontSize: 13, color: termsError ? '#FF3B30' : '#999', textAlign: 'center', lineHeight: 20 }}>
                {t.terms}
                <Text style={{ color: '#0194F3', fontWeight: 'bold' }}>{t.condition}</Text> 
                {lang === 'TH' ? 'และ' : 'and'}
                <Text style={{ color: '#0194F3', fontWeight: 'bold' }}>{t.privacy}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={{ 
              backgroundColor: '#0194F3', paddingVertical: 18, borderRadius: 20, 
              alignItems: 'center', elevation: 8, marginBottom: 20,
              shadowColor: "#0194F3", shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3, shadowRadius: 10,
              opacity: loading ? 0.7 : 1
            }}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{t.btn}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/login')}
            style={{ alignItems: 'center', marginBottom: 40 }}
          >
            <Text style={{ color: '#777', fontSize: 15 }}>
              {t.haveAcc}<Text style={{ color: '#0194F3', fontWeight: 'bold' }}>{t.login}</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal เงื่อนไขการใช้งาน 10 ข้อ */}
      <Modal
        visible={termsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTermsVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end'
        }}>
          <View style={{
            height: height * 0.72,
            backgroundColor: 'white',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: 'hidden'
          }}>
            <View style={{
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#ECECEC',
              alignItems: 'center'
            }}>
              <View style={{
                width: 42,
                height: 5,
                borderRadius: 999,
                backgroundColor: '#D9D9D9',
                marginBottom: 10
              }} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#222' }}>
                {t.modalTitle}
              </Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 }}
              onScroll={({ nativeEvent }) => {
                if (isCloseToBottom(nativeEvent)) {
                  setTermsScrolledToBottom(true);
                }
              }}
              scrollEventThrottle={16}
            >
              <Text style={{ fontSize: 14, color: '#444', lineHeight: 22, marginBottom: 12 }}>
                {t.termsIntro}
              </Text>

              {t.termsItems.map((item, index) => (
                <Text
                  key={index}
                  style={{ fontSize: 14, color: '#444', lineHeight: 23, marginBottom: 14 }}
                >
                  {item}
                </Text>
              ))}

              {!termsScrolledToBottom && (
                <Text style={{ fontSize: 12, color: '#FF3B30', marginTop: 6, textAlign: 'center' }}>
                  {t.scrollHint}
                </Text>
              )}
            </ScrollView>

            <View style={{
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 18,
              paddingBottom: 18,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: '#ECECEC',
              backgroundColor: 'white'
            }}>
              <TouchableOpacity
                onPress={() => setTermsVisible(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#E6E6E6',
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#444', fontWeight: 'bold' }}>
                  {t.cancelText}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={!termsScrolledToBottom}
                onPress={() => {
                  setTermsAccepted(true);
                  setTermsVisible(false);
                  setTermsError(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: termsScrolledToBottom ? '#0194F3' : '#BFDDF5',
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>
                  {t.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal ยืนยันอีเมลด้วย OTP หลังสมัคร */}
      <Modal
        visible={otpVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!verifyingOtp) setOtpVisible(false); }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 25
        }}>
          <View style={{ width: '100%', backgroundColor: 'white', borderRadius: 22, padding: 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 18 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 20, backgroundColor: '#F0F8FF',
                justifyContent: 'center', alignItems: 'center', marginBottom: 12
              }}>
                <Feather name="mail" size={28} color="#0194F3" />
              </View>
              <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#222' }}>
                {lang === 'TH' ? 'ยืนยันอีเมลของคุณ' : 'Verify your email'}
              </Text>
              <Text style={{ fontSize: 14, color: '#777', marginTop: 6, textAlign: 'center' }}>
                {lang === 'TH'
                  ? `เราได้ส่งรหัส OTP 6 หลักไปที่\n${email}`
                  : `We sent a 6-digit OTP to\n${email}`}
              </Text>
            </View>

            <View style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
              borderRadius: 16, paddingHorizontal: 15, height: 58, borderWidth: 1,
              borderColor: otpError ? '#FF3B30' : '#E1E9F0', marginBottom: 10
            }}>
              <Feather name="lock" size={20} color={otpError ? '#FF3B30' : '#0194F3'} style={{ marginRight: 12 }} />
              <TextInput
                style={{ flex: 1, fontSize: 18, letterSpacing: 6, color: '#333' }}
                placeholder={lang === 'TH' ? 'รหัส OTP 6 หลัก' : '6-digit OTP'}
                placeholderTextColor="#B0BCC7"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(text) => {
                  setOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
                  if (otpError) setOtpError('');
                }}
                autoFocus
              />
            </View>

            {otpError ? (
              <Text style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10, marginLeft: 4 }}>
                {otpError}
              </Text>
            ) : null}

            <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 16 }}>
              {otpCountdown > 0
                ? (lang === 'TH' ? `รหัสจะหมดเวลาใน ${otpCountdown} วินาที` : `Code expires in ${otpCountdown}s`)
                : (lang === 'TH' ? 'รหัสหมดเวลาแล้ว' : 'Code expired')}
            </Text>

            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={verifyingOtp}
              style={{
                backgroundColor: '#0194F3', paddingVertical: 15, borderRadius: 16,
                alignItems: 'center', marginBottom: 12, opacity: verifyingOtp ? 0.7 : 1
              }}
            >
              {verifyingOtp ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                  {lang === 'TH' ? 'ยืนยัน OTP' : 'Verify OTP'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={otpCountdown > 0 || resending}
              style={{ alignItems: 'center', paddingVertical: 6, opacity: (otpCountdown > 0 || resending) ? 0.5 : 1 }}
            >
              <Text style={{ color: '#0178C7', fontWeight: 'bold', fontSize: 14 }}>
                {resending
                  ? (lang === 'TH' ? 'กำลังส่ง...' : 'Sending...')
                  : otpCountdown > 0
                    ? (lang === 'TH' ? `ส่งรหัสใหม่ได้ใน ${otpCountdown} วินาที` : `Resend in ${otpCountdown}s`)
                    : (lang === 'TH' ? 'ส่งรหัส OTP ใหม่' : 'Resend OTP')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            width: width * 0.8,
            backgroundColor: 'white',
            borderRadius: 18,
            padding: 24,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#222' }}>
              {lang === 'TH' ? 'สมัครสมาชิกสำเร็จ' : 'Registration Successful'}
            </Text>
            <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 22 }}>
              {lang === 'TH' ? 'คุณสมัครสมาชิกเรียบร้อยแล้ว' : 'You have successfully registered.'}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setSuccessVisible(false);
                // social (LINE/Google): ล็อกอินอยู่แล้ว → เข้าแอปเลย · สมัครปกติ → กลับไปหน้าเข้าสู่ระบบ
                router.replace(isSocialFlow ? '/' : '/login');
              }}
              style={{
                backgroundColor: '#0194F3',
                paddingVertical: 12,
                paddingHorizontal: 34,
                borderRadius: 12
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlashMessage position="top" statusBarHeight={StatusBar.currentHeight} />
    </SafeAreaView>
  );
}

const InputBox = ({ label, icon, error, locked, ...props }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ fontSize: 14, fontWeight: 'bold', color: error ? '#FF3B30' : '#444', marginBottom: 8, marginLeft: 5 }}>
      {label}
    </Text>
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: locked ? '#F0F1F3' : 'white',
      borderRadius: 18,
      paddingHorizontal: 15,
      height: 60,
      borderWidth: error ? 1.5 : 1,
      borderColor: error ? '#FF3B30' : '#E1E9F0',
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.02,
      shadowRadius: 5
    }}>
      <Feather name={icon} size={20} color={error ? '#FF3B30' : '#0194F3'} style={{ marginRight: 12 }} />
      <TextInput
        style={{ flex: 1, fontSize: 16, color: locked ? '#8A94A0' : '#333' }}
        placeholderTextColor="#B0BCC7"
        editable={!locked}
        {...props}
      />
      {locked ? <Feather name="lock" size={16} color="#B0BCC7" /> : null}
    </View>
  </View>
);