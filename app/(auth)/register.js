import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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

// ฟอนต์ serif ให้เข้าชุดกับหน้า login / หน้าหลัก
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

// รูปตึกใช้เป็นแผงซ้าย/บน (เหมือนหน้า login)
const HERO_IMG = require('../../assets/images/hero-around-loei.jpg');
const heroImgStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('reg-hero-fit')) {
  const s = document.createElement('style');
  s.id = 'reg-hero-fit';
  // จอกว้าง = cover (เต็มพื้นหลัง) · มือถือ = contain (เห็นตึกทั้งหลัง พอดีกรอบ)
  s.textContent =
    '#regHeroBg img{object-fit:cover !important;object-position:center !important;}' +
    '#regHeroBand img{object-fit:contain !important;object-position:center !important;}';
  document.head.appendChild(s);
}

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

  // จอกว้าง = split รูปซ้าย/ฟอร์มขวา · จอแคบ = รูปบน/ฟอร์มล่าง
  const [screen, setScreen] = useState(Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreen(window));
    return () => sub?.remove?.();
  }, []);
  const isWide = screen.width >= 900;

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

  // ยืนยันรหัสผ่าน + ปุ่มแสดง/ซ่อน (ตามดีไซน์ใหม่)
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      phone_number: false,
    };

    setErrors(newErrors);

    if (newErrors.full_name || newErrors.username || newErrors.password) {
      return;
    }

    // อีเมลบังคับ (ตรงกับ backend)
    if (!email.trim()) {
      Alert.alert(lang === 'TH' ? 'ข้อผิดพลาด' : 'Error', lang === 'TH' ? 'กรุณากรอกอีเมล' : 'Please enter your email');
      return;
    }
    // รหัสผ่านอย่างน้อย 6 ตัว + ต้องยืนยันให้ตรงกัน
    if (password.length < 6) {
      Alert.alert(lang === 'TH' ? 'ข้อผิดพลาด' : 'Error', lang === 'TH' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(lang === 'TH' ? 'ข้อผิดพลาด' : 'Error', lang === 'TH' ? 'รหัสผ่านไม่ตรงกัน' : 'Passwords do not match');
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1F33' }}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: '#0B1F33' }}>
          {/* รูปตึกเต็มพื้นหลัง + ไล่เฉด (ซ้ายเข้ม → ขวาสว่าง ให้เห็นภาพผ่านกระจกฝ้า) */}
          {isWide && (
            <>
              <Image nativeID="regHeroBg" source={HERO_IMG} resizeMode="cover" style={heroImgStyle} />
              <LinearGradient
                colors={['rgba(4,12,26,0.78)', 'rgba(6,18,38,0.5)', 'rgba(12,28,50,0.28)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            </>
          )}

          {/* ปุ่มย้อนกลับ (ซ้ายบน) + สลับภาษา (ขวาบนสุด — ลอยเหนือทุกอย่าง ไม่โดนทับ) */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: 'absolute', top: Platform.OS === 'web' ? 16 : 44, left: 16, zIndex: 30, width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
          >
            <Ionicons name="arrow-back" size={21} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')}
            style={{ position: 'absolute', top: Platform.OS === 'web' ? 16 : 44, right: 16, zIndex: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.30)' }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, flexDirection: isWide ? 'row' : 'column' }}>
            {/* แบรนด์ (จอกว้าง=โปร่งทับรูป · มือถือ=แบนเนอร์รูปตึกเต็มพอดีกรอบ) */}
            <View style={isWide ? { flex: 1 } : { height: 290, overflow: 'hidden' }}>
              {!isWide && (
                <>
                  <Image nativeID="regHeroBand" source={HERO_IMG} resizeMode="contain" style={heroImgStyle} />
                  <LinearGradient
                    colors={['rgba(4,12,26,0.10)', 'rgba(4,12,26,0.26)', 'rgba(6,18,38,0.60)']}
                    start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                </>
              )}
              <View style={{ flex: 1, justifyContent: 'space-between', padding: isWide ? 40 : 22, paddingTop: isWide ? 74 : 70, paddingBottom: isWide ? 46 : 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="business" size={19} color="white" />
                  <Text style={{ color: 'white', fontWeight: '800', letterSpacing: 2, marginLeft: 8, fontSize: 13 }}>AROUND LOEI</Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: SERIF, fontStyle: 'italic', fontSize: isWide ? 22 : 16, letterSpacing: 0.5 }}>
                    {lang === 'TH' ? 'เริ่มต้น' : "Let's start a"}
                  </Text>
                  <Text style={{ color: 'white', fontFamily: SERIF, fontSize: isWide ? 42 : 26, fontWeight: '700', lineHeight: isWide ? 50 : 32, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 }}>
                    {lang === 'TH' ? 'การเดินทางครั้งใหม่' : 'new journey'}
                  </Text>
                  <View style={{ width: 56, height: 3, borderRadius: 3, backgroundColor: '#D9B25F', marginTop: 12 }} />
                </View>
              </View>
            </View>

            {/* ===== แผงฟอร์มกระจกฝ้า (เบลอ + มุมโค้งน้อย) ===== */}
            <View style={isWide
              ? { flex: 1.05, backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.97)', marginLeft: -20, borderTopLeftRadius: 18, borderBottomLeftRadius: 18, overflow: 'hidden', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px) saturate(150%)', WebkitBackdropFilter: 'blur(18px) saturate(150%)' } : {}) }
              : { flex: 1, backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.97)', marginTop: -18, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}) }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: isWide ? 'center' : 'flex-start', paddingHorizontal: isWide ? 52 : 24, paddingTop: isWide ? 40 : 30, paddingBottom: 40 }}
            >
              <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
              <Text style={{ fontSize: 26, fontFamily: SERIF, fontWeight: '700', color: '#16324F' }}>{t.start}</Text>
              <Text style={{ fontSize: 14, color: '#6B7B8C', marginTop: 4, marginBottom: 22 }}>{t.sub}</Text>

          <View>
            <FormField
              label={t.email}
              required
              placeholder={lang === 'TH' ? 'ไม่แสดงในระบบ' : 'Used for login'}
              autoCapitalize="none"
              locked={lockUsername}
              value={username}
              error={errors.username}
              onChangeText={(text) => { setUsername(text); if (text) setErrors(prev => ({ ...prev, username: false })); }}
            />

            <FormField
              label={t.name}
              required
              placeholder={t.namePlace}
              locked={lockFullName}
              value={full_name}
              error={errors.full_name}
              onChangeText={(text) => { setFullName(text); if (text) setErrors(prev => ({ ...prev, full_name: false })); }}
            />

            <FormField
              label={t.emailLabel}
              required
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              locked={lockEmail}
              value={email}
              onChangeText={setEmail}
            />

            <FormField
              label={t.phone}
              placeholder={t.phonePlace}
              keyboardType="phone-pad"
              value={phone_number}
              onChangeText={setPhoneNumber}
            />

            <FormField
              label={t.pass}
              required
              placeholder={lang === 'TH' ? 'อย่างน้อย 6 ตัวอักษร' : 'At least 6 characters'}
              secureTextEntry={!showPw}
              locked={lockPassword}
              value={password}
              error={errors.password}
              onChangeText={(text) => { setPassword(text); if (text) setErrors(prev => ({ ...prev, password: false })); }}
              rightAccessory={!lockPassword ? (
                <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color="#8A94A0" />
                </TouchableOpacity>
              ) : null}
            />

            <FormField
              label={lang === 'TH' ? 'ยืนยันรหัสผ่าน' : 'Confirm Password'}
              required
              placeholder={lang === 'TH' ? 'กรอกรหัสผ่านอีกครั้ง' : 'Re-enter your password'}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              rightAccessory={(
                <TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showConfirm ? 'eye-off' : 'eye'} size={18} color="#8A94A0" />
                </TouchableOpacity>
              )}
            />

            {/* ประเภทสมาชิก (บังคับเลือก — ตรงกับ backend) */}
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                {lang === 'TH' ? 'ประเภทสมาชิก' : 'Member Type'} <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { value: 'Daily_Tenant', label: lang === 'TH' ? 'ผู้เช่ารายวัน' : 'Daily Tenant', desc: lang === 'TH' ? 'จองห้องพักแบบรายวัน' : 'Book by day' },
                  { value: 'Monthly_Tenant', label: lang === 'TH' ? 'ผู้เช่ารายเดือน' : 'Monthly Tenant', desc: lang === 'TH' ? 'เช่าอยู่ประจำแบบรายเดือน' : 'Stay monthly' },
                ].map((r) => {
                  const active = user_role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      activeOpacity={0.85}
                      onPress={() => setUserRole(r.value)}
                      style={{
                        flex: 1,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: active ? '#0194F3' : '#CBD5E1',
                        backgroundColor: active ? 'rgba(1,148,243,0.08)' : '#F8FAFC',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: active ? '#0178C7' : '#334155' }}>{r.label}</Text>
                      <Text style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{r.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#13294B', paddingVertical: 16, borderRadius: 16,
              alignItems: 'center', elevation: 8, marginTop: 22, marginBottom: 14,
              shadowColor: "#13294B", shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35, shadowRadius: 12,
              opacity: loading ? 0.7 : 1
            }}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: 'white', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 }}>{lang === 'TH' ? 'สมัครสมาชิก' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/login')}
            style={{ alignItems: 'center', marginTop: 4 }}
          >
            <Text style={{ color: '#777', fontSize: 15 }}>
              {t.haveAcc}<Text style={{ color: '#C79A3E', fontWeight: 'bold' }}>{t.login}</Text>
            </Text>
          </TouchableOpacity>

              </View>
            </ScrollView>
          </View>
          </View>
        </View>
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
              onPress={async () => {
                setSuccessVisible(false);
                // สมัครเสร็จทุกกรณี → ให้ผู้ใช้ไปเข้าสู่ระบบเองที่หน้าล็อกอิน (เคลียร์ session ที่ค้างจาก social)
                await AsyncStorage.removeItem('token');
                await AsyncStorage.removeItem('userProfile');
                router.replace('/login');
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

// ช่องกรอกแบบเรียบ (ตามดีไซน์เว็บ): label + * + กล่องมีขอบ ไม่มีไอคอนซ้าย, รองรับปุ่มขวา (ตาแสดง/ซ่อน)
const FormField = ({ label, required, error, locked, rightAccessory, ...props }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 13, fontWeight: '700', color: error ? '#EF4444' : '#334155', marginBottom: 6 }}>
      {label} {required ? <Text style={{ color: '#EF4444' }}>*</Text> : null}
    </Text>
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: locked ? '#F0F1F3' : '#F8FAFC',
      borderWidth: 1.5, borderColor: error ? '#EF4444' : '#CBD5E1',
      borderRadius: 14, paddingHorizontal: 14, height: 52,
    }}>
      <TextInput
        style={{ flex: 1, fontSize: 15, color: locked ? '#8A94A0' : '#0F172A' }}
        placeholderTextColor="#9AA6B2"
        editable={!locked}
        {...props}
      />
      {rightAccessory}
      {locked ? <Feather name="lock" size={15} color="#B0BCC7" style={{ marginLeft: 8 }} /> : null}
    </View>
  </View>
);

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