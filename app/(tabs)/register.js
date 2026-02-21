import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView, StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const text = {
    TH: {
      header: 'สร้างบัญชีใหม่', start: 'เริ่มต้นใช้งาน', sub: 'สมัครสมาชิกเพื่อจองหอพัก Around Loei ได้ง่ายขึ้น',
      name: 'ชื่อ-นามสกุล', namePlace: 'กรุณากรอกชื่อจริง', email: 'อีเมล', pass: 'รหัสผ่าน',
      terms: 'การกดปุ่มยืนยัน แสดงว่าคุณยอมรับ', condition: ' เงื่อนไขการใช้งาน ', privacy: ' นโยบายความเป็นส่วนตัว ',
      btn: 'ยืนยันสมัครสมาชิก', haveAcc: 'มีบัญชีอยู่แล้ว? ', login: 'เข้าสู่ระบบ',
      errorFill: 'กรุณากรอกข้อมูลให้ครบถ้วน', success: 'สมัครสมาชิกสำเร็จ!', fail: 'เกิดข้อผิดพลาดในการสมัคร'
    },
    EN: {
      header: 'Create Account', start: 'Get Started', sub: 'Sign up to book Around Loei more easily',
      name: 'Full Name', namePlace: 'Enter your full name', email: 'Email', pass: 'Password',
      terms: 'By clicking confirm, you agree to our', condition: ' Terms of Service ', privacy: ' Privacy Policy ',
      btn: 'Confirm Registration', haveAcc: 'Already have an account? ', login: 'Login',
      errorFill: 'Please fill in all fields', success: 'Registration Successful!', fail: 'Registration Failed'
    }
  };

  const t = text[lang];

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", t.errorFill);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('https://projeccty3-server.onrender.com/api/register', {
        name: name,
        email: email,
        password: password
      });

      if (response.status === 200 || response.status === 201) {
        // [💡 แสดงแจ้งเตือนสำเร็จ]
        Alert.alert("Success", t.success);
        
        // [💡 ปรับให้เด้งไปหน้า Login หลังจากสมัครสำเร็จตาม Workflow ใหม่]
        router.replace('/login'); 
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || t.fail;
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
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
              value={name}
              onChangeText={(text) => setName(text)}
            />

            <InputBox 
              label={t.email} 
              icon="mail" 
              placeholder="example@email.com" 
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => setEmail(text)}
            />

            <InputBox 
              label={t.pass} 
              icon="lock" 
              placeholder="••••••••" 
              secureTextEntry={true}
              value={password}
              onChangeText={(text) => setPassword(text)}
            />
          </View>

          <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 25, lineHeight: 20 }}>
            {t.terms}
            <Text style={{ color: '#0194F3', fontWeight: 'bold' }}>{t.condition}</Text> 
            {lang === 'TH' ? 'และ' : 'and'}
            <Text style={{ color: '#0194F3', fontWeight: 'bold' }}>{t.privacy}</Text>
          </Text>

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
    </SafeAreaView>
  );
}

const InputBox = ({ label, icon, ...props }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 8, marginLeft: 5 }}>
      {label}
    </Text>
    <View style={{ 
      flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', 
      borderRadius: 18, paddingHorizontal: 15, height: 60, borderWidth: 1, 
      borderColor: '#E1E9F0', elevation: 2, shadowColor: '#000', 
      shadowOpacity: 0.02, shadowRadius: 5
    }}>
      <Feather name={icon} size={20} color="#0194F3" style={{ marginRight: 12 }} />
      <TextInput 
        style={{ flex: 1, fontSize: 16, color: '#333' }}
        placeholderTextColor="#B0BCC7"
        {...props}
      />
    </View>
  </View>
);