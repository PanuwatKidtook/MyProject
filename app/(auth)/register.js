import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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

const { width, height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [loading, setLoading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  
  // เพิ่ม State สำหรับจัดการ Modal และการตรวจสอบการเลื่อนดูเงื่อนไข
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const [full_name, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone_number, setPhoneNumber] = useState('');
  const [user_role, setUserRole] = useState('user');

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
      const response = await axios.post('https://projeccty3-server.onrender.com/api/register', {
        username: username,
        password: password,
        full_name: full_name,
        phone_number: phone_number,
        user_role: "Daily_Tenant",
      });

      if (response.status === 200 || response.status === 201) {
        setSuccessVisible(true);
      }
    } catch (error) {
      if (!error.response) {
        const noServerMsg = lang === 'TH' 
          ? 'สมัครล้มเหลว ไม่สามารถเชื่อมต่อเซิฟเวอร์ได้ในขณะนี้' 
          : 'Registration failed. Cannot connect to the server.';
        
        showMessage({
          message: lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
          description: noServerMsg,
          type: "danger",
          icon: "danger",
          floating: true,
        });
      } else {
        const serverMessage = error.response.data?.message;
        let displayErrorMsg = t.fail;

        if (serverMessage) {
          if (serverMessage.includes('already') || serverMessage.includes('ซ้ำ') || serverMessage.includes('exist')) {
            displayErrorMsg = lang === 'TH' ? 'ชื่อผู้ใช้หรือบัญชีอีเมลนี้ซ้ำในระบบ' : 'This account or email already exists.';
          } else {
            displayErrorMsg = serverMessage;
          }
        }
        
        showMessage({
          message: lang === 'TH' ? 'ข้อผิดพลาด' : 'Error',
          description: displayErrorMsg,
          type: "danger",
          icon: "danger",
          floating: true,
        });
      }
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
              label={t.pass} 
              icon="lock" 
              placeholder="••••••••" 
              secureTextEntry={true}
              value={password}
              error={errors.password}
              onChangeText={(text) => {
                setPassword(text);
                if (text) setErrors(prev => ({ ...prev, password: false }));
              }}
            />
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

const InputBox = ({ label, icon, error, ...props }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ fontSize: 14, fontWeight: 'bold', color: error ? '#FF3B30' : '#444', marginBottom: 8, marginLeft: 5 }}>
      {label}
    </Text>
    <View style={{ 
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white', 
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
        style={{ flex: 1, fontSize: 16, color: '#333' }}
        placeholderTextColor="#B0BCC7"
        {...props}
      />
    </View>
  </View>
);