import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
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
import { startGoogleLogin, startLineLogin } from '../../lib/socialAuth';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [remember, setRemember] = useState(false);

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
      // 1. เปิดหน้า Google -> รอ redirect กลับพร้อม code
      const { code, redirectUri } = await startGoogleLogin();

      // 2. แลก code เป็น JWT ที่ backend (endpoint public)
      const exchangeRes = await api.post('/auth/google/exchange', {
        code,
        redirect_uri: redirectUri,
      });
      const { token, payload, isNewUser } = exchangeRes.data;

      // 3. เก็บ token ไว้ใช้กับทุก request หลังจากนี้
      //    ผู้ใช้ใหม่: token เป็น "pending" — ยังไม่มี member ใน backend จนกว่าจะกดยืนยันหน้าสมัคร
      await AsyncStorage.setItem('token', token);

      // 4. ผู้ใช้ใหม่ → ยังไม่ถูกบันทึก แวะหน้าสมัครก่อน เพื่อเลือกประเภทผู้เช่า/ตั้งรหัสผ่าน
      //    ใช้โปรไฟล์ที่ backend ส่งมากับ exchange โดยตรง ไม่เรียก /current-user (member ยังไม่ถูกสร้าง)
      if (isNewUser) {
        const gProfile = exchangeRes.data.profile || {};
        router.push({
          pathname: '/register',
          params: {
            source: 'google',
            lockedFullName: gProfile.full_name || payload.username || '',
            lockedEmail: gProfile.email || '',
            lockedUsername: payload.username || '',
          },
        });
        return;
      }

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
      // 1. เปิดหน้า LINE -> รอ redirect กลับ deep link พร้อม code
      const { code, redirectUri } = await startLineLogin();

      // 2. แลก code เป็น JWT ที่ backend (endpoint public)
      const exchangeRes = await api.post('/auth/line/exchange', {
        code,
        redirect_uri: redirectUri,
      });
      const { token, payload, isNewUser } = exchangeRes.data;

      // 3. เก็บ token ไว้ใช้กับทุก request หลังจากนี้
      await AsyncStorage.setItem('token', token);

      // 4. ดึงโปรไฟล์เต็ม (ชื่อ/อีเมล ที่ได้จาก LINE)
      const profileRes = await api.get('/current-user');
      const profileData = profileRes.data.data;

      // 5. ผู้ใช้ใหม่ที่เพิ่งสมัครผ่าน LINE → แวะหน้าสมัครก่อน เพื่อกรอกเบอร์โทร/รหัสผ่าน
      //    และเลือกประเภทผู้เช่า (รายวัน/รายเดือน) เอง — ไม่ถูกล็อกเป็นรายวันอัตโนมัติ
      //    ล็อกช่องที่ได้จาก LINE ไว้: ชื่อ-นามสกุล, อีเมล, Username (token ถูกเก็บแล้วใช้ยืนยันตอนเติมโปรไฟล์)
      if (isNewUser) {
        router.push({
          pathname: '/register',
          params: {
            source: 'line',
            lockedFullName: profileData.full_name || payload.username || '',
            lockedEmail: profileData.email || '',
            lockedUsername: payload.username || '',
          },
        });
        return;
      }

      // 6. ผู้ใช้เดิม (เคยเติมโปรไฟล์แล้ว) → เข้าสู่ระบบได้เลย
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 10 }}>
        <TouchableOpacity
          onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')}
          style={{ borderWidth: 1, borderColor: '#0194F3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F8FF' }}
        >
          <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 12 }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 25, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 25, backgroundColor: '#0194F3',
            justifyContent: 'center', alignItems: 'center',
            elevation: 10, shadowColor: '#0194F3', shadowOpacity: 0.3, shadowRadius: 10
          }}>
            <Ionicons name="business" size={40} color="white" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 20 }}>Around Loei</Text>
          <Text style={{ fontSize: 16, color: '#777', marginTop: 5 }}>{t.welcome}</Text>
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
          style={{ marginTop: 30, alignItems: 'center' }}
        >
          <Text style={{ color: '#BBB', fontSize: 13 }}>{t.back}</Text>
        </TouchableOpacity>
      </ScrollView>

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

      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: width * 0.8, backgroundColor: 'white', borderRadius: 18, padding: 24, alignItems: 'center' }}>
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
