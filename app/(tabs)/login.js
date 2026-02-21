import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView, StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const text = {
    TH: {
      welcome: 'ยินดีต้อนรับ', email: 'อีเมล', pass: 'รหัสผ่าน', forgot: 'ลืมรหัสผ่าน?', 
      login: 'เข้าสู่ระบบ', noAcc: 'ยังไม่มีบัญชี? ', reg: 'สมัครสมาชิกใหม่', back: 'กลับสู่หน้าหลัก',
      error: 'กรุณากรอกข้อมูลให้ครบถ้วน', fail: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    },
    EN: {
      welcome: 'Welcome Back', email: 'Email', pass: 'Password', forgot: 'Forgot Password?', 
      login: 'Login', noAcc: "Don't have an account? ", reg: 'Register Now', back: 'Back to Home',
      error: 'Please fill in all fields', fail: 'Invalid email or password'
    }
  };

  const t = text[lang];

  // ฟังก์ชันเชื่อมต่อ API สำหรับ Login
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", t.error);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('https://projeccty3-server.onrender.com/api/login', {
        email: email,
        password: password
      });

      if (response.status === 200) {
        // ✅ บันทึกข้อมูลลงเครื่องเพื่อให้หน้า Index นำไปแสดงผลโปรไฟล์ทันที
        const userProfile = {
          name: response.data.name || email.split('@')[0], 
          isLoggedIn: true
        };
        
        await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));

        // ✅ เข้าสู่ระบบสำเร็จ เด้งกลับหน้าหลัก
        router.replace('/'); 
      }
    } catch (error) {
      const msg = error.response?.data?.message || t.fail;
      Alert.alert("Login Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label, icon, placeholder, value, onChangeText, secure = false) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 8, marginLeft: 5 }}>{label}</Text>
      <View style={{ 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', 
        borderRadius: 18, paddingHorizontal: 15, height: 60, borderWidth: 1, borderColor: '#E1E9F0'
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
          {renderInput(t.email, "mail", "example@email.com", email, setEmail)}
          {renderInput(t.pass, "lock", "••••••••", password, setPassword, true)}
          
          <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: -5 }}>
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
    </SafeAreaView>
  );
}