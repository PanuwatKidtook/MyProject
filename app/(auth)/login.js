import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import { openLineAuthNative, startGoogleLogin, startLineLogin } from '../../lib/socialAuth';
import SuccessCheck from '../../components/SuccessCheck';

const { width } = Dimensions.get('window');

// รูปตึก Around Loei ฝั่งขวา (แต่งด้วย overlay/filter ให้ดูหรูกว่าต้นฉบับ)
// หมายเหตุ: แทนไฟล์นี้ด้วยรูปตึกจริง (ชื่อเดิม hero-around-loei.png) ได้เลย
const HERO_IMG = require('../../assets/images/hero-around-loei.jpg');
const StyleSheet_absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

// web: react-native-web ไม่ map resizeMode="cover" เป็น object-fit ให้เมื่อกำหนด width/height เอง
// จึงฉีด CSS ตรง ๆ ให้รูป hero ครอบเต็มแบบไม่ยืดผิดสัดส่วน
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('hero-fit-style')) {
  const s = document.createElement('style');
  s.id = 'hero-fit-style';
  s.textContent = 'img[src*="hero-around-loei"]{object-fit:cover !important;object-position:center !important;}';
  document.head.appendChild(s);
}

// ถอด payload จาก JWT (id/username/role) — payload เป็น ASCII ล้วน ใช้ atob ได้
function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [remember, setRemember] = useState(false);

  // ขนาดหน้าจอแบบ reactive — จอกว้าง = split 2 คอลัมน์, จอแคบ = การ์ดซ้อนกลางบนรูปตึก
  const [screen, setScreen] = useState(Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreen(window));
    return () => sub?.remove?.();
  }, []);
  const isWide = screen.width >= 900;

  // ฟอนต์ serif ให้ฟีล boutique/luxury (แบบหัวข้อ Serenique)
  const serifFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
  // ความสูงแบนเนอร์รูปบนมือถือ — ปรับตามจอให้พอดี ไม่ crop จนเพี้ยน
  const bannerH = Math.max(230, Math.min(340, Math.round(screen.height * 0.34)));

  // สำหรับล็อกอินด้วย Email — หน้าต่างกรอกอีเมล/รหัสผ่าน + สถานะกำลังโหลด
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailStep, setEmailStep] = useState('email'); // 'email' | 'password'
  const [emailInput, setEmailInput] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [error, setError] = useState({
    username: false,
    password: false,
  });

  // ref สำหรับกด Enter แล้วเลื่อนจากช่องชื่อผู้ใช้ไปช่องรหัสผ่าน
  const passwordRef = useRef(null);

  // ยืนยันอีเมลด้วย OTP กรณีบัญชียังไม่ยืนยัน (login ตอบ 403 needVerification)
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [verifyStep, setVerifyStep] = useState('email'); // 'email' | 'otp'
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyOtp, setVerifyOtp] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyCountdown, setVerifyCountdown] = useState(0);
  const verifyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
    };
  }, []);

  const startVerifyTimer = () => {
    if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
    setVerifyCountdown(60);
    verifyTimerRef.current = setInterval(() => {
      setVerifyCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(verifyTimerRef.current);
          verifyTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const text = {
    TH: {
      welcome: 'ยินดีต้อนรับ', email: 'ชื่อผู้ใช้งาน (Username)', pass: 'รหัสผ่าน', forgot: 'ลืมรหัสผ่าน?',
      login: 'เข้าสู่ระบบ', noAcc: 'ยังไม่มีบัญชี? ', reg: 'สมัครสมาชิกใหม่', back: 'กลับสู่หน้าหลัก',
      error: 'กรุณากรอกข้อมูลให้ครบถ้วน', fail: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
      or: 'หรือเข้าสู่ระบบด้วย', loginEmail: 'เข้าสู่ระบบด้วย Google', loginLine: 'เข้าสู่ระบบด้วย LINE',
      remember: 'จำรหัสผ่าน', emailLabel: 'อีเมล (Email)', emailPh: 'you@example.com',
      emailTitle: 'เข้าสู่ระบบด้วยอีเมล', emailDesc: 'กรอกอีเมลของคุณเพื่อดำเนินการต่อ',
      emailInvalid: 'กรุณากรอกอีเมลให้ถูกต้อง', wait: 'กรุณารอสักครู่...',
      cancel: 'ยกเลิก', next: 'ถัดไป',
      pwWelcome: 'ยินดีต้อนรับ', pwPlaceholder: 'กรอกรหัสผ่าน', pwShow: 'แสดงรหัสผ่าน',
      pwEmpty: 'กรุณากรอกรหัสผ่าน'
    },
    EN: {
      welcome: 'Welcome Back', email: 'Username', pass: 'Password', forgot: 'Forgot Password?',
      login: 'Login', noAcc: "Don't have an account? ", reg: 'Register Now', back: 'Back to Home',
      error: 'Please fill in all fields', fail: 'Invalid username or password',
      or: 'Or connect with', loginEmail: 'Sign in with Google', loginLine: 'Sign in with LINE',
      remember: 'Remember password', emailLabel: 'Email', emailPh: 'you@example.com',
      emailTitle: 'Sign in with Email', emailDesc: 'Enter your email to continue',
      emailInvalid: 'Please enter a valid email', wait: 'Please wait...',
      cancel: 'Cancel', next: 'Next',
      pwWelcome: 'Welcome', pwPlaceholder: 'Enter your password', pwShow: 'Show password',
      pwEmpty: 'Please enter your password'
    }
  };

  const t = text[lang];

  // โหลดข้อมูลที่จำไว้ตอนเปิดหน้า (ถ้าเคยติ๊ก "จำรหัสผ่าน")
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('savedCredentials');
        if (saved) {
          const cred = JSON.parse(saved);
          setUsername(cred.username || '');
          setPassword(cred.password || '');
          setRemember(true);
        }
      } catch (e) {
        // เพิกเฉยหากอ่านค่าไม่ได้
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setError({ username: !username, password: !password });
      showMessage({
        message: lang === 'TH' ? 'แจ้งเตือน' : 'Warning',
        description: t.error,
        type: 'danger', icon: 'danger', floating: true,
      });
      return;
    }

    setError({ username: false, password: false });
    setLoading(true);

    try {
      // 1. เรียก login — ได้ token + payload (id, username, role)
      // ส่งค่าที่กรอก (username หรือ email) ไปในฟิลด์ username ให้ backend ตรวจสอบ
      const loginRes = await api.post('/login', { username, password });
      const { token, payload } = loginRes.data;

      // 2. บันทึก token ไว้ใช้กับทุก request หลังจากนี้
      await AsyncStorage.setItem('token', token);

      // 2.1 จำรหัสผ่านไว้ถ้าผู้ใช้ติ๊กไว้ ไม่งั้นลบทิ้ง
      if (remember) {
        await AsyncStorage.setItem('savedCredentials', JSON.stringify({ username, password }));
      } else {
        await AsyncStorage.removeItem('savedCredentials');
      }

      // 3. เรียก current-user เพื่อดึง full_name, email, phone_number
      const profileRes = await api.get('/current-user');
      const profileData = profileRes.data.data;

      // 4. บันทึก userProfile สำหรับแสดงผลใน UI
      const userProfile = {
        id: payload.id,
        username: payload.username,
        name: profileData.full_name || payload.username,
        full_name: profileData.full_name,
        email: profileData.email,
        phone_number: profileData.phone_number,
        role: payload.role,
        isLoggedIn: true,
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

      showMessage({
        message: lang === 'TH' ? 'สำเร็จ' : 'Success',
        description: lang === 'TH' ? 'เข้าสู่ระบบเรียบร้อยแล้ว' : 'Login Successful',
        type: 'success', icon: 'success', floating: true,
      });
      setSuccessVisible(true);

    } catch (err) {
      if (!err.response) {
        showMessage({
          message: lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
          description: lang === 'TH'
            ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้'
            : 'Cannot connect to the server.',
          type: 'danger', icon: 'danger', floating: true,
        });
      } else if (err.response.status === 403 && err.response.data?.needVerification) {
        // บัญชียังไม่ยืนยันอีเมล → เปิดหน้ายืนยัน OTP (กรอกอีเมล → รับ OTP → ยืนยัน → ล็อกอินซ้ำอัตโนมัติ)
        setVerifyError('');
        setVerifyOtp('');
        // ถ้าผู้ใช้กรอกอีเมลในช่องชื่อผู้ใช้อยู่แล้ว เติมให้เลย
        setVerifyEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim()) ? username.trim() : '');
        setVerifyStep('email');
        setVerifyVisible(true);
      } else {
        showMessage({
          message: lang === 'TH' ? 'เข้าสู่ระบบล้มเหลว' : 'Login Failed',
          description: err.response?.data?.message || t.fail,
          type: 'danger', icon: 'danger', floating: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // ส่ง OTP ไปยังอีเมลเพื่อยืนยันบัญชี
  const handleVerifySendOtp = async () => {
    const emailTrimmed = verifyEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setVerifyError(lang === 'TH' ? 'กรุณากรอกอีเมลให้ถูกต้อง' : 'Please enter a valid email');
      return;
    }
    setVerifyError('');
    setVerifyLoading(true);
    try {
      // endpoint ยืนยัน "การสมัคร" (ตั้งค่า email_verified_at) — ไม่ใช่ชุด reset-password
      const res = await api.post('/auth/resend-registration-otp', { email: emailTrimmed });
      if (!res.data?.success) {
        setVerifyError(res.data?.message || (lang === 'TH' ? 'ส่งรหัส OTP ไม่สำเร็จ' : 'Failed to send OTP.'));
        return;
      }
      setVerifyStep('otp');
      startVerifyTimer();
    } catch (err) {
      setVerifyError(
        err.response?.data?.message ||
        (lang === 'TH' ? 'ไม่พบข้อมูลผู้ใช้ หรือส่งรหัส OTP ไม่สำเร็จ' : 'User not found or failed to send OTP.')
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  // ยืนยัน OTP → สำเร็จแล้วปิดหน้าต่างและล็อกอินซ้ำอัตโนมัติ
  const handleVerifyConfirmOtp = async () => {
    if (verifyOtp.trim().length < 6) {
      setVerifyError(lang === 'TH' ? 'กรุณากรอกรหัส OTP 6 หลัก' : 'Please enter the 6-digit OTP');
      return;
    }
    if (verifyCountdown === 0) {
      setVerifyError(lang === 'TH' ? 'รหัส OTP หมดเวลาแล้ว กรุณาขอรหัสใหม่' : 'OTP expired. Please request a new one.');
      return;
    }
    setVerifyError('');
    setVerifyLoading(true);
    try {
      // ยืนยันการสมัคร → backend ตั้ง email_verified_at ให้ (ต้องใช้ endpoint นี้ ไม่ใช่ /auth/verify-otp)
      const res = await api.post('/auth/verify-registration', {
        email: verifyEmail.trim(),
        otp: verifyOtp.trim(),
      });
      if (!res.data?.success) {
        setVerifyError(res.data?.message || (lang === 'TH' ? 'รหัส OTP ไม่ถูกต้อง' : 'Invalid OTP'));
        return;
      }
      if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
      verifyTimerRef.current = null;
      setVerifyVisible(false);
      // ยืนยันอีเมลแล้ว → ล็อกอินซ้ำด้วย username/password ที่กรอกไว้
      handleLogin();
    } catch (err) {
      setVerifyError(
        err.response?.data?.message ||
        (lang === 'TH' ? 'ไม่สามารถยืนยันรหัส OTP ได้' : 'Could not verify the OTP.')
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const openEmailModal = () => {
    setEmailStep('email');
    setEmailInput('');
    setEmailPassword('');
    setShowEmailPassword(false);
    setEmailLoading(false);
    setEmailModalVisible(true);
  };

  // ขั้นที่ 1: ตรวจอีเมล -> ไปหน้าจอกรอกรหัสผ่าน (การ์ดกลางจอ)
  const handleEmailNext = () => {
    const emailTrimmed = emailInput.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
    if (!emailValid) {
      showMessage({
        message: lang === 'TH' ? 'แจ้งเตือน' : 'Warning',
        description: t.emailInvalid,
        type: 'danger', icon: 'danger', floating: true,
      });
      return;
    }
    setEmailStep('password');
  };

  // ขั้นที่ 2: กรอกรหัสผ่าน -> หมุนรอสักครู่ -> ไปหน้าสมัคร โดยล็อก username/password
  const handleEmailPasswordNext = () => {
    if (!emailPassword) {
      showMessage({
        message: lang === 'TH' ? 'แจ้งเตือน' : 'Warning',
        description: t.pwEmpty,
        type: 'danger', icon: 'danger', floating: true,
      });
      return;
    }

    const emailTrimmed = emailInput.trim();
    setEmailLoading(true);
    setTimeout(() => {
      const generatedUsername = emailTrimmed.split('@')[0];

      setEmailLoading(false);
      setEmailModalVisible(false);

      router.push({
        pathname: '/register',
        params: {
          lockedEmail: emailTrimmed,
          lockedUsername: generatedUsername,
          lockedPassword: emailPassword,
        },
      });
    }, 1500);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // 1. เปิดหน้า Google -> รอ id_token กลับมา (OIDC implicit flow, ไม่ต้องใช้ secret)
      const { idToken } = await startGoogleLogin();

      // 2. ส่ง id_token ให้ backend ตรวจ (endpoint public, ไม่ต้องแลก code/secret)
      const exchangeRes = await api.post('/auth/social', {
        provider: 'google',
        token: idToken,
      });
      const { token, payload, isNewUser } = exchangeRes.data;

      // 3. ผู้ใช้ใหม่ → ยังไม่เก็บอะไรลงเครื่องเลย (รวมถึง token) จนกว่าจะกดยืนยันที่หน้าสมัคร
      //    ส่ง token ไปกับพารามิเตอร์ (pendingToken) เพื่อใช้ตอนกดยืนยัน — ถ้าเขากดกลับก่อนยืนยัน
      //    จะไม่มี token/เซสชัน หรือข้อมูลใด ๆ ค้างในเครื่อง
      //    ใช้โปรไฟล์ที่ backend ส่งมากับ exchange โดยตรง ไม่เรียก /current-user
      if (isNewUser) {
        const gProfile = exchangeRes.data.profile || {};
        // prefill ชื่อจริงจาก Google (ถ้ามี) แต่ไม่เอา google_xxx มาใส่ · username ให้ผู้ใช้ตั้งเอง
        const gName = gProfile.full_name && !gProfile.full_name.startsWith('google_') ? gProfile.full_name : '';
        router.push({
          pathname: '/socialsetup',
          params: {
            pendingToken: token,
            lockedFullName: gName,
            lockedEmail: gProfile.email || '',
          },
        });
        return;
      }

      // 4. ผู้ใช้เดิม → เก็บ token ไว้ใช้กับทุก request หลังจากนี้
      await AsyncStorage.setItem('token', token);

      // 5. ผู้ใช้เดิม → ดึงโปรไฟล์เต็ม (ชื่อ/อีเมล) แล้วเข้าสู่ระบบได้เลย
      const profileRes = await api.get('/current-user');
      const profileData = profileRes.data.data;

      const userProfile = {
        id: payload.id,
        username: payload.username,
        name: profileData.full_name || payload.username,
        full_name: profileData.full_name,
        email: profileData.email,
        phone_number: profileData.phone_number,
        role: payload.role,
        isLoggedIn: true,
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

      showMessage({
        message: lang === 'TH' ? 'สำเร็จ' : 'Success',
        description: lang === 'TH' ? 'เข้าสู่ระบบเรียบร้อยแล้ว' : 'Login Successful',
        type: 'success', icon: 'success', floating: true,
      });
      setSuccessVisible(true);
    } catch (err) {
      // ผู้ใช้กดยกเลิกเอง — ไม่ต้องเด้ง error
      if (err.code === 'cancelled') return;

      if (!err.response) {
        showMessage({
          message: lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
          description: err.message || (lang === 'TH'
            ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้'
            : 'Cannot connect to the server.'),
          type: 'danger', icon: 'danger', floating: true,
        });
      } else {
        showMessage({
          message: lang === 'TH' ? 'เข้าสู่ระบบล้มเหลว' : 'Login Failed',
          description: err.response?.data?.message
            || (lang === 'TH' ? 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ' : 'Google login failed.'),
          type: 'danger', icon: 'danger', floating: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLineLogin = async () => {
    setLoading(true);
    try {
      // native (APK): เปิด LINE แล้วให้ server เด้ง deep link ไปที่ route /auth/line/callback
      //   ซึ่งจะจัดการ token + นำทางเอง (ไม่ประมวลผลที่นี่ กันทำซ้ำ + กันหน้า Unmatched Route)
      if (Platform.OS !== 'web') {
        await openLineAuthNative();
        return;
      }

      // web: ได้ code → แลกเองที่ backend
      const lineRes = await startLineLogin();
      const exchangeRes = await api.post('/auth/line/exchange', {
        code: lineRes.code,
        redirect_uri: lineRes.redirectUri,
      });
      const token = exchangeRes.data.token;
      const isNewUser = exchangeRes.data.isNewUser;
      const lineUsername = exchangeRes.data.payload?.username || '';
      const profileHeadRes = await api.get('/current-user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lineFullName = profileHeadRes.data.data?.full_name || '';
      const lineEmail = profileHeadRes.data.data?.email || '';

      // ผู้ใช้ใหม่ → แวะหน้าสมัครก่อน (กรอกเบอร์/รหัสผ่าน) — ยังไม่เก็บ token ส่งไปกับ pendingToken
      if (isNewUser) {
        router.push({
          pathname: '/register',
          params: {
            source: 'line',
            pendingToken: token,
            lockedFullName: lineFullName || lineUsername || '',
            lockedEmail: lineEmail || '',
            lockedUsername: lineUsername || '',
          },
        });
        return;
      }

      // ผู้ใช้เดิม → เก็บ token + ดึงโปรไฟล์เต็ม → เข้าระบบ
      await AsyncStorage.setItem('token', token);
      const payload = decodeJwt(token) || {};
      const profileRes = await api.get('/current-user');
      const profileData = profileRes.data.data;

      const userProfile = {
        id: payload.id,
        username: payload.username || lineUsername,
        name: profileData.full_name || payload.username,
        full_name: profileData.full_name,
        email: profileData.email,
        phone_number: profileData.phone_number,
        role: payload.role,
        isLoggedIn: true,
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

      showMessage({
        message: lang === 'TH' ? 'สำเร็จ' : 'Success',
        description: lang === 'TH' ? 'เข้าสู่ระบบเรียบร้อยแล้ว' : 'Login Successful',
        type: 'success', icon: 'success', floating: true,
      });
      setSuccessVisible(true);
    } catch (err) {
      // ผู้ใช้กดยกเลิกเอง — ไม่ต้องเด้ง error
      if (err.code === 'cancelled') return;

      if (!err.response) {
        showMessage({
          message: lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
          description: err.message || (lang === 'TH'
            ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้'
            : 'Cannot connect to the server.'),
          type: 'danger', icon: 'danger', floating: true,
        });
      } else {
        showMessage({
          message: lang === 'TH' ? 'เข้าสู่ระบบล้มเหลว' : 'Login Failed',
          description: err.response?.data?.message
            || (lang === 'TH' ? 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ' : 'LINE login failed.'),
          type: 'danger', icon: 'danger', floating: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label, icon, placeholder, value, onChangeText, secure = false, keyboardType = 'default', inputProps = {}) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 8, marginLeft: 5 }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
        borderRadius: 18, paddingHorizontal: 15, height: 60, borderWidth: 1,
        borderColor: error[secure ? 'password' : 'username'] ? '#FF3B30' : '#E1E9F0'
      }}>
        <Feather name={icon} size={20} color="#0194F3" style={{ marginRight: 12 }} />
        <TextInput
          style={{ flex: 1, fontSize: 16 }}
          placeholder={placeholder}
          placeholderTextColor="#B0BCC7"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          {...inputProps}
        />
      </View>
    </View>
  );

  // ป้ายตำแหน่ง (กระจกฝ้า)
  const locationBadge = (
    <View style={{
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.32)',
      borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6, marginBottom: 14,
      ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {}),
    }}>
      <Ionicons name="location-sharp" size={14} color="#8FD3FF" style={{ marginRight: 6 }} />
      <Text style={{ color: '#EAF6FF', fontSize: 12.5, fontWeight: '600' }}>
        {lang === 'TH' ? 'อ.เมือง จ.เลย' : 'Mueang, Loei'}
      </Text>
    </View>
  );

  // กล่องข้อความโปรโมท (การ์ดกระจกฝ้าโปร่ง แบบ Serenique)
  const promoBox = (compact) => (
    <View style={{
      backgroundColor: 'rgba(10,22,38,0.42)', borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1,
      borderRadius: 22, padding: compact ? 18 : 26, maxWidth: 460,
      ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } : {}),
    }}>
      {locationBadge}
      <Text style={{
        color: 'rgba(255,255,255,0.82)', fontFamily: serifFont, fontStyle: 'italic',
        fontSize: compact ? 18 : 26, letterSpacing: 1,
        textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8,
      }}>
        Welcome To
      </Text>
      <Text style={{
        color: 'white', fontFamily: serifFont, fontSize: compact ? 32 : 48, fontWeight: '700',
        lineHeight: compact ? 40 : 56, letterSpacing: 0.5, marginTop: 2,
        textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14,
      }}>
        Around Loei
      </Text>
      {/* เส้นคั่นทองบางๆ ให้ดูหรู */}
      <View style={{ width: 54, height: 3, borderRadius: 3, backgroundColor: '#D9B25F', marginTop: compact ? 12 : 16, marginBottom: compact ? 10 : 14 }} />
      <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: compact ? 13 : 15.5, lineHeight: compact ? 20 : 24 }}>
        {lang === 'TH'
          ? 'ที่พักสไตล์โมเดิร์นใจกลางเมืองเลย สะดวก สงบ พร้อมต้อนรับทุกการเดินทางของคุณ'
          : 'Modern stays in the heart of Loei — comfortable, calm, and ready to welcome every journey.'}
      </Text>
    </View>
  );

  // ไล่เฉดทับรูป (ใช้ซ้ำทั้งเดสก์ท็อป/มือถือ)
  const heroOverlay = (
    <>
      <LinearGradient
        colors={['rgba(6,20,36,0.30)', 'rgba(6,20,36,0.20)', 'rgba(4,14,26,0.72)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet_absoluteFill}
      />
      <View style={{ ...StyleSheet_absoluteFill, backgroundColor: 'rgba(1,90,160,0.08)' }} />
    </>
  );

  // ===== ปุ่มสลับภาษา (ลอยมุมขวาบน) =====
  const langButton = (
    <TouchableOpacity
      onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')}
      style={{
        borderWidth: 1, borderColor: 'rgba(1,148,243,0.5)', paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.85)',
        ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
      }}
    >
      <Text style={{ color: '#0178C7', fontWeight: 'bold', fontSize: 12 }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
    </TouchableOpacity>
  );

  // ===== การ์ดฟอร์มกระจกฝ้า =====
  const formCard = (
    <View style={{
      width: '100%', maxWidth: 460, alignSelf: 'center',
      backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.97)',
      borderRadius: 30, paddingVertical: 34, paddingHorizontal: isWide ? 38 : 26,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)',
      shadowColor: '#0A2540', shadowOpacity: 0.22, shadowRadius: 34, shadowOffset: { width: 0, height: 20 }, elevation: 14,
      ...(Platform.OS === 'web' ? { backdropFilter: 'blur(26px) saturate(140%)', WebkitBackdropFilter: 'blur(26px) saturate(140%)' } : {}),
    }}>
      <View style={{ alignItems: 'center', marginBottom: 26 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 22, backgroundColor: '#0194F3',
          justifyContent: 'center', alignItems: 'center',
          elevation: 10, shadowColor: '#0194F3', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }
        }}>
          <Ionicons name="business" size={36} color="white" />
        </View>
        <Text style={{ fontSize: 30, fontFamily: serifFont, fontWeight: '700', color: '#14304C', marginTop: 14, letterSpacing: 0.3 }}>Around Loei</Text>
        <Text style={{ fontSize: 15, color: '#6B7B8C', marginTop: 4 }}>{t.welcome}</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
          {renderInput(t.email, 'user', 'Username', username, setUsername, false, 'default', {
            returnKeyType: 'next',
            onSubmitEditing: () => passwordRef.current?.focus(),
            blurOnSubmit: false,
          })}
          {renderInput(t.pass, 'lock', '••••••••', password, setPassword, true, 'default', {
            ref: passwordRef,
            returnKeyType: 'go',
            onSubmitEditing: () => { if (!loading) handleLogin(); },
          })}

          <View style={{ alignItems: 'flex-end', marginTop: -5 }}>
            <TouchableOpacity onPress={() => router.push('/editregister')}>
              <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 14 }}>{t.forgot}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRemember(!remember)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: remember ? '#0194F3' : '#B0BCC7',
                backgroundColor: remember ? '#0194F3' : 'transparent',
                justifyContent: 'center', alignItems: 'center', marginRight: 8
              }}>
                {remember && <Feather name="check" size={15} color="white" />}
              </View>
              <Text style={{ color: '#444', fontSize: 14 }}>{t.remember}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#0194F3', paddingVertical: 18, borderRadius: 20,
            alignItems: 'center', elevation: 5, marginBottom: 20,
            opacity: loading ? 0.7 : 1
          }}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{t.login}</Text>
          )}
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginVertical: 15 }}>
          <Text style={{ color: '#999', fontSize: 14 }}>{t.or}</Text>
        </View>

        <View style={{ gap: 12, marginBottom: 20 }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#F8F9FA', paddingVertical: 15, borderRadius: 20,
              borderWidth: 1, borderColor: '#E1E9F0'
            }}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" style={{ marginRight: 10 }} />
            <Text style={{ color: '#444', fontSize: 16, fontWeight: 'bold' }}>{t.loginEmail}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#06C755', paddingVertical: 15, borderRadius: 20,
              opacity: loading ? 0.6 : 1
            }}
            onPress={handleLineLogin}
            disabled={loading}
          >
            <Ionicons name="chatbubble" size={20} color="white" style={{ marginRight: 10 }} />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>{t.loginLine}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
          <Text style={{ color: '#777', fontSize: 15 }}>{t.noAcc}</Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 15 }}>{t.reg}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={{ marginTop: 26, alignItems: 'center' }}
        >
          <Text style={{ color: '#9AAAB8', fontSize: 13 }}>{t.back}</Text>
        </TouchableOpacity>
      </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1F33' }}>
      <StatusBar barStyle={isWide ? 'dark-content' : 'light-content'} />

      {isWide ? (
        // ===== จอกว้าง: รูปตึกเต็มจอ + การ์ดกระจกลอยซ้าย + กล่องข้อความขวาล่าง =====
        <View style={{ flex: 1, backgroundColor: '#0B1F33', overflow: 'hidden' }}>
          <Image source={HERO_IMG} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', ...(Platform.OS === 'web' ? { objectFit: 'cover' } : {}) }} />
          {heroOverlay}
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 56 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ width: '100%', maxWidth: 470 }}>
              {formCard}
            </View>
          </ScrollView>
          {/* กล่องข้อความโปรโมทมุมขวาล่าง */}
          <View style={{ position: 'absolute', right: 48, bottom: 44, maxWidth: 460 }}>
            {promoBox(false)}
          </View>
        </View>
      ) : (
        // ===== มือถือ: แบนเนอร์รูปด้านบน (ขนาดพอดีจอ) + การ์ดฟอร์มด้านล่าง =====
        <ScrollView
          style={{ flex: 1, backgroundColor: '#EEF3F8' }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', height: bannerH, backgroundColor: '#0B1F33', overflow: 'hidden' }}>
            <Image source={HERO_IMG} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', ...(Platform.OS === 'web' ? { objectFit: 'cover' } : {}) }} />
            {heroOverlay}
            <View style={{ flex: 1, justifyContent: 'flex-end', padding: 20 }}>
              {promoBox(true)}
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, marginTop: -34 }}>
            {formCard}
          </View>
        </ScrollView>
      )}

      {/* ปุ่มสลับภาษา ลอยมุมขวาบน */}
      <View style={{ position: 'absolute', top: Platform.OS === 'web' ? 18 : 44, right: 20, zIndex: 20 }}>
        {langButton}
      </View>

      {/* หน้าต่างกรอกอีเมลสำหรับล็อกอินด้วย Email */}
      <Modal
        visible={emailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!emailLoading) setEmailModalVisible(false); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 25 }}>
          <View style={{ width: '100%', backgroundColor: 'white', borderRadius: 22, padding: 24 }}>
            {emailLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator size="large" color="#0194F3" />
                <Text style={{ fontSize: 16, color: '#444', marginTop: 16 }}>{t.wait}</Text>
              </View>
            ) : emailStep === 'email' ? (
              <>
                <View style={{ alignItems: 'center', marginBottom: 18 }}>
                  <View style={{
                    width: 60, height: 60, borderRadius: 20, backgroundColor: '#F0F8FF',
                    justifyContent: 'center', alignItems: 'center', marginBottom: 12
                  }}>
                    <Feather name="mail" size={28} color="#0194F3" />
                  </View>
                  <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#222' }}>{t.emailTitle}</Text>
                  <Text style={{ fontSize: 14, color: '#777', marginTop: 6, textAlign: 'center' }}>{t.emailDesc}</Text>
                </View>

                <View style={{
                  flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
                  borderRadius: 16, paddingHorizontal: 15, height: 58, borderWidth: 1, borderColor: '#E1E9F0',
                  marginBottom: 18
                }}>
                  <Feather name="mail" size={20} color="#0194F3" style={{ marginRight: 12 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 16 }}
                    placeholder={t.emailPh}
                    placeholderTextColor="#B0BCC7"
                    value={emailInput}
                    onChangeText={setEmailInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setEmailModalVisible(false)}
                    style={{ flex: 1, backgroundColor: '#E6E6E6', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#444', fontWeight: 'bold', fontSize: 15 }}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleEmailNext}
                    style={{ flex: 1, backgroundColor: '#0194F3', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{t.next}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* การ์ดกรอกรหัสผ่าน วางกลางจอ (สไตล์แอป Around Loei) */}
                <View style={{ alignItems: 'flex-start', marginBottom: 18 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 15, backgroundColor: '#0194F3',
                    justifyContent: 'center', alignItems: 'center', marginBottom: 16
                  }}>
                    <Ionicons name="business" size={24} color="white" />
                  </View>
                  <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#222' }}>{t.pwWelcome}</Text>

                  <View style={{
                    flexDirection: 'row', alignItems: 'center', marginTop: 14,
                    borderWidth: 1, borderColor: '#E1E9F0', borderRadius: 999,
                    paddingVertical: 6, paddingHorizontal: 12
                  }}>
                    <Feather name="user" size={16} color="#5F6368" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 14, color: '#3C4043' }} numberOfLines={1}>{emailInput.trim()}</Text>
                  </View>
                </View>

                <View style={{
                  backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E1E9F0',
                  paddingHorizontal: 14, height: 58, flexDirection: 'row', alignItems: 'center'
                }}>
                  <TextInput
                    style={{ flex: 1, fontSize: 16 }}
                    placeholder={t.pwPlaceholder}
                    placeholderTextColor="#B0BCC7"
                    value={emailPassword}
                    onChangeText={setEmailPassword}
                    secureTextEntry={!showEmailPassword}
                    autoCapitalize="none"
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  onPress={() => setShowEmailPassword(!showEmailPassword)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}
                >
                  <View style={{
                    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                    borderColor: showEmailPassword ? '#0194F3' : '#B0BCC7',
                    backgroundColor: showEmailPassword ? '#0194F3' : 'transparent',
                    justifyContent: 'center', alignItems: 'center', marginRight: 10
                  }}>
                    {showEmailPassword && <Feather name="check" size={13} color="white" />}
                  </View>
                  <Text style={{ color: '#3C4043', fontSize: 14 }}>{t.pwShow}</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26 }}>
                  <TouchableOpacity onPress={() => { setEmailModalVisible(false); router.push('/editregister'); }}>
                    <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 14 }}>{t.forgot}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleEmailPasswordNext}
                    style={{ backgroundColor: '#0194F3', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 999 }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{t.next}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* หน้าต่างยืนยันอีเมลด้วย OTP (บัญชียังไม่ยืนยัน) */}
      <Modal
        visible={verifyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!verifyLoading) setVerifyVisible(false); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 25 }}>
          <View style={{ width: '100%', backgroundColor: 'white', borderRadius: 22, padding: 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 18 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 20, backgroundColor: '#F0F8FF',
                justifyContent: 'center', alignItems: 'center', marginBottom: 12
              }}>
                <Feather name={verifyStep === 'email' ? 'mail' : 'lock'} size={28} color="#0194F3" />
              </View>
              <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#222' }}>
                {lang === 'TH' ? 'ยืนยันอีเมลก่อนเข้าสู่ระบบ' : 'Verify your email to continue'}
              </Text>
              <Text style={{ fontSize: 14, color: '#777', marginTop: 6, textAlign: 'center' }}>
                {verifyStep === 'email'
                  ? (lang === 'TH'
                      ? 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรอกอีเมลเพื่อรับรหัส OTP'
                      : 'This account is not verified. Enter your email to get an OTP.')
                  : (lang === 'TH'
                      ? `เราได้ส่งรหัส OTP 6 หลักไปที่\n${verifyEmail}`
                      : `We sent a 6-digit OTP to\n${verifyEmail}`)}
              </Text>
            </View>

            {verifyStep === 'email' ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
                borderRadius: 16, paddingHorizontal: 15, height: 58, borderWidth: 1,
                borderColor: verifyError ? '#FF3B30' : '#E1E9F0', marginBottom: 10
              }}>
                <Feather name="mail" size={20} color={verifyError ? '#FF3B30' : '#0194F3'} style={{ marginRight: 12 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 16 }}
                  placeholder="you@example.com"
                  placeholderTextColor="#B0BCC7"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={verifyEmail}
                  onChangeText={(text) => { setVerifyEmail(text); if (verifyError) setVerifyError(''); }}
                  autoFocus
                />
              </View>
            ) : (
              <View style={{
                flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
                borderRadius: 16, paddingHorizontal: 15, height: 58, borderWidth: 1,
                borderColor: verifyError ? '#FF3B30' : '#E1E9F0', marginBottom: 10
              }}>
                <Feather name="lock" size={20} color={verifyError ? '#FF3B30' : '#0194F3'} style={{ marginRight: 12 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 18, letterSpacing: 6 }}
                  placeholder={lang === 'TH' ? 'รหัส OTP 6 หลัก' : '6-digit OTP'}
                  placeholderTextColor="#B0BCC7"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={verifyOtp}
                  onChangeText={(text) => { setVerifyOtp(text.replace(/[^0-9]/g, '').slice(0, 6)); if (verifyError) setVerifyError(''); }}
                  autoFocus
                />
              </View>
            )}

            {verifyError ? (
              <Text style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10, marginLeft: 4 }}>{verifyError}</Text>
            ) : null}

            {verifyStep === 'otp' ? (
              <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 14 }}>
                {verifyCountdown > 0
                  ? (lang === 'TH' ? `รหัสจะหมดเวลาใน ${verifyCountdown} วินาที` : `Code expires in ${verifyCountdown}s`)
                  : (lang === 'TH' ? 'รหัสหมดเวลาแล้ว' : 'Code expired')}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={verifyStep === 'email' ? handleVerifySendOtp : handleVerifyConfirmOtp}
              disabled={verifyLoading}
              style={{
                backgroundColor: '#0194F3', paddingVertical: 15, borderRadius: 16,
                alignItems: 'center', marginBottom: 12, opacity: verifyLoading ? 0.7 : 1
              }}
            >
              {verifyLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                  {verifyStep === 'email'
                    ? (lang === 'TH' ? 'ส่งรหัส OTP' : 'Send OTP')
                    : (lang === 'TH' ? 'ยืนยัน OTP' : 'Verify OTP')}
                </Text>
              )}
            </TouchableOpacity>

            {verifyStep === 'otp' ? (
              <TouchableOpacity
                onPress={handleVerifySendOtp}
                disabled={verifyCountdown > 0 || verifyLoading}
                style={{ alignItems: 'center', paddingVertical: 4, marginBottom: 4, opacity: (verifyCountdown > 0 || verifyLoading) ? 0.5 : 1 }}
              >
                <Text style={{ color: '#0178C7', fontWeight: 'bold', fontSize: 14 }}>
                  {verifyCountdown > 0
                    ? (lang === 'TH' ? `ส่งรหัสใหม่ได้ใน ${verifyCountdown} วินาที` : `Resend in ${verifyCountdown}s`)
                    : (lang === 'TH' ? 'ส่งรหัส OTP ใหม่' : 'Resend OTP')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => { if (!verifyLoading) setVerifyVisible(false); }}
              style={{ alignItems: 'center', paddingVertical: 6 }}
            >
              <Text style={{ color: '#999', fontSize: 14 }}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: width * 0.8, backgroundColor: 'white', borderRadius: 18, padding: 24, alignItems: 'center' }}>
            <View style={{ marginBottom: 12 }}>
              <SuccessCheck size={96} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#222' }}>
              {lang === 'TH' ? 'เข้าสู่ระบบสำเร็จ' : 'Login Successful'}
            </Text>
            <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 22 }}>
              {lang === 'TH' ? 'คุณเข้าสู่ระบบเรียบร้อยแล้ว' : 'You have successfully logged in.'}
            </Text>
            <TouchableOpacity
              onPress={() => { setSuccessVisible(false); router.replace('/'); }}
              style={{ backgroundColor: '#0194F3', paddingVertical: 12, paddingHorizontal: 34, borderRadius: 12 }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlashMessage position="top" statusBarHeight={StatusBar.currentHeight} />
    </SafeAreaView>
  );
}
