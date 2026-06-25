import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const [error, setError] = useState({
    username: false,
    password: false,
  });

  const text = {
    TH: {
      welcome: 'ยินดีต้อนรับ', email: 'ชื่อผู้ใช้งาน (Username)', pass: 'รหัสผ่าน', forgot: 'ลืมรหัสผ่าน?',
      login: 'เข้าสู่ระบบ', noAcc: 'ยังไม่มีบัญชี? ', reg: 'สมัครสมาชิกใหม่', back: 'กลับสู่หน้าหลัก',
      error: 'กรุณากรอกข้อมูลให้ครบถ้วน', fail: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
      or: 'หรือเข้าสู่ระบบด้วย', loginEmail: 'เข้าสู่ระบบด้วย Email', loginLine: 'เข้าสู่ระบบด้วย LINE'
    },
    EN: {
      welcome: 'Welcome Back', email: 'Username', pass: 'Password', forgot: 'Forgot Password?',
      login: 'Login', noAcc: "Don't have an account? ", reg: 'Register Now', back: 'Back to Home',
      error: 'Please fill in all fields', fail: 'Invalid username or password',
      or: 'Or connect with', loginEmail: 'Sign in with Email', loginLine: 'Sign in with LINE'
    }
  };

  const t = text[lang];

  const handleLogin = async () => {
    if (!username || !password) {
      setError({
        username: !username,
        password: !password,
      });

      showMessage({
        message: lang === 'TH' ? 'แจ้งเตือน' : 'Warning',
        description: t.error,
        type: "danger",
        icon: "danger",
        floating: true,
      });
      return;
    }

    setError({
      username: false,
      password: false,
    });

    setLoading(true);
    try {
      const response = await axios.post('https://projeccty3-server.onrender.com/api/login', {
        username: username,
        password: password
      });

      if (response.status === 200) {
        const userProfile = {
          name: response.data.name || username,
          isLoggedIn: true
        };

        await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

        showMessage({
          message: lang === 'TH' ? 'สำเร็จ' : 'Success',
          description: lang === 'TH' ? 'เข้าสู่ระบบเรียบร้อยแล้ว' : 'Login Successful',
          type: "success",
          icon: "success",
          floating: true,
        });

        setSuccessVisible(true);
      }
    } catch (error) {
      if (!error.response) {
        const noServerMsg = lang === 'TH'
          ? 'เข้าสู่ระบบล้มเหลว ไม่สามารถเชื่อมต่อเซิฟเวอร์ได้ในขณะนี้'
          : 'Login failed. Cannot connect to the server.';

        showMessage({
          message: lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
          description: noServerMsg,
          type: "danger",
          icon: "danger",
          floating: true,
        });
      } else {
        const msg = error.response?.data?.message || t.fail;

        showMessage({
          message: lang === 'TH' ? 'เข้าสู่ระบบล้มเหลว' : 'Login Failed',
          description: msg,
          type: "danger",
          icon: "danger",
          floating: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAlternativeLogin = (type) => {
    showMessage({
      message: lang === 'TH' ? 'ระบบกำลังพัฒนา' : 'Coming Soon',
      description: lang === 'TH' ? `กำลังเชื่อมต่อกับระบบ ${type}` : `Connecting to ${type}...`,
      type: "info",
      icon: "info",
      floating: true,
    });
  };

  const renderInput = (label, icon, placeholder, value, onChangeText, secure = false) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 8, marginLeft: 5 }}>{label}</Text>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderRadius: 18,
        paddingHorizontal: 15,
        height: 60,
        borderWidth: 1,
        borderColor: error[icon === 'mail' ? 'username' : 'password'] ? '#FF3B30' : '#E1E9F0'
      }}>
        <Feather name={icon} size={20} color="#0194F3" style={{ marginRight: 12 }} />
        <TextInput
          style={{ flex: 1, fontSize: 16 }}
          placeholder={placeholder}
          placeholderTextColor="#B0BCC7"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          autoCapitalize="none"
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

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 25, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 25,
            backgroundColor: '#0194F3', justifyContent: 'center', alignItems: 'center',
            elevation: 10, shadowColor: '#0194F3', shadowOpacity: 0.3, shadowRadius: 10
          }}>
            <Ionicons name="business" size={40} color="white" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 20 }}>Around Loei</Text>
          <Text style={{ fontSize: 16, color: '#777', marginTop: 5 }}>{t.welcome}</Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          {renderInput(t.email, "mail", "Username", username, setUsername)}
          {renderInput(t.pass, "lock", "••••••••", password, setPassword, true)}

          <TouchableOpacity
            style={{ alignSelf: 'flex-end', marginTop: -5 }}
            onPress={() => router.push('/editregister')}
          >
            <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 14 }}>{t.forgot}</Text>
          </TouchableOpacity>
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
            onPress={() => handleAlternativeLogin('Email')}
          >
            <Feather name="mail" size={20} color="#0194F3" style={{ marginRight: 10 }} />
            <Text style={{ color: '#444', fontSize: 16, fontWeight: 'bold' }}>{t.loginEmail}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#06C755', paddingVertical: 15, borderRadius: 20
            }}
            onPress={() => handleAlternativeLogin('LINE')}
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
              {lang === 'TH' ? 'เข้าสู่ระบบสำเร็จ' : 'Login Successful'}
            </Text>
            <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 22 }}>
              {lang === 'TH' ? 'คุณเข้าสู่ระบบเรียบร้อยแล้ว' : 'You have successfully logged in.'}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setSuccessVisible(false);
                router.replace('/');
              }}
              style={{
                backgroundColor: '#0194F3',
                paddingVertical: 12,
                paddingHorizontal: 34,
                borderRadius: 12
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                {lang === 'TH' ? 'OK' : 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlashMessage position="top" statusBarHeight={StatusBar.currentHeight} />
    </SafeAreaView>
  );
}