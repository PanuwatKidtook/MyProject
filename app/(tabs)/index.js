import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router'; // [💡 เพิ่ม useFocusEffect]
import React, { useCallback, useState } from 'react'; // [💡 เพิ่ม useCallback]
import {
  Dimensions,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text, TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter(); 
  const [lang, setLang] = useState('TH');
  const [user, setUser] = useState(null);

  // [💡 ปรับปรุง: ใช้ useFocusEffect เพื่อให้ตรวจสอบสถานะ user ทุกครั้งที่หน้าจอนี้ถูกดึงกลับมาแสดง]
  useFocusEffect(
    useCallback(() => {
      const checkUserStatus = async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          if (userData) {
            setUser(JSON.parse(userData));
          } else {
            setUser(null);
          }
        } catch (e) {
          console.log('Error loading user data');
        }
      };
      checkUserStatus();
    }, [])
  );

  const text = {
    TH: {
      subtitle: 'หอพักจังหวัดเลย', title: 'Around Loei', login: 'เข้าสู่ระบบ', register: 'สมัครสมาชิก',
      status: '● ว่างพร้อมอยู่', price: '฿500-3,500', unit: ' /เดือน', slogan: 'หอพักสบาย ใกล้ มรภ.เลย',
      desc: 'สัมผัสการใช้ชีวิตที่เหนือระดับกับ "Around Loei" หอพักราย-รายเดือน เดินทางสะดวก ใกล้ มรภ.เลย และแหล่งของกินครบครัน',
      bookingList: 'รายการจองห้องของคุณ', line: 'Line Official', fb: 'Facebook Fanpage', call: 'โทรสอบถามห้องว่าง',
      amenTitle: 'สิ่งอำนวยความสะดวก',
      bookButton: 'จองห้องพักตอนนี้',
      logout: 'ออกจากระบบ'
    },
    EN: {
      subtitle: 'LEOI RESIDENCE', title: 'Around Loei', login: 'Login', register: 'Register',
      status: '● Available', price: '฿500-3,500', unit: ' /month', slogan: 'Cozy Living in Loei City',
      desc: 'Experience superior living at "Around Loei". New, clean, and convenient location near Loei Rajabhat University.',
      bookingList: 'My Bookings', line: 'Line Official', fb: 'Facebook Fanpage', call: 'Call for Inquiry',
      amenTitle: 'Premium Amenities',
      bookButton: 'Book a Room Now',
      logout: 'Logout'
    }
  };

  const t = text[lang];

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userProfile');
    setUser(null);
  };

  const openContact = (type, value) => {
    let url = '';
    if (type === 'tel') url = `tel:${value}`;
    if (type === 'line') url = `https://line.me/ti/p/~${value}`;
    if (type === 'fb') url = `https://facebook.com/${value}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0194F3' }}>
      <StatusBar barStyle="light-content" />
      
      {/* --- Top Navbar --- */}
      <View style={{ 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#0178C7' 
      }}>
        <View>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>{t.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 'bold' }}>{t.subtitle}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {user ? (
            // ✅ แสดงโปรไฟล์พร้อมขอบเขียวออร่าทันทีเมื่อ Login แล้ว
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleLogout} style={{ marginRight: 12 }}>
                 <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 'bold' }}>{t.logout}</Text>
              </TouchableOpacity>
              
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{user.name}</Text>
              </View>

              <View style={{ 
                width: 42, 
                height: 42, 
                borderRadius: 21, 
                borderWidth: 2, 
                borderColor: '#00E676', // ขอบสีเขียวออร่า
                justifyContent: 'center', 
                alignItems: 'center',
                backgroundColor: 'white',
                shadowColor: "#00E676",
                shadowOpacity: 0.6,
                shadowRadius: 8,
                elevation: 5
              }}>
                <Image 
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
                  style={{ width: '100%', height: '100%', borderRadius: 21 }}
                />
              </View>
            </View>
          ) : (
            // แสดงปุ่ม Login/Register ปกติ
            <>
              <TouchableOpacity 
                onPress={() => router.push('/login')} 
                style={{ marginRight: 12 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t.login}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/register')} 
                style={{ 
                  marginRight: 15, 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  paddingHorizontal: 10, 
                  paddingVertical: 5, 
                  borderRadius: 8 
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t.register}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
            onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')} 
            style={{ 
              borderWidth: 1, 
              borderColor: 'rgba(255,255,255,0.4)', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 6, 
              marginLeft: 5 
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ backgroundColor: '#F8F9FA' }}>
        
        {/* --- Image Section --- */}
        <View style={{ height: 320 }}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=800' }} 
            style={{ width: width, height: 320, resizeMode: 'cover' }} 
          />
          <View style={{ 
            position: 'absolute', top: 20, right: 20, backgroundColor: '#00C853', 
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25, elevation: 5 
          }}>
            <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>{t.status}</Text>
          </View>
        </View>

        {/* --- Content Card --- */}
        <View style={{ 
          marginTop: -40, backgroundColor: 'white', borderTopLeftRadius: 40, 
          borderTopRightRadius: 40, padding: 25, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 
        }}>
          
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/reservation')}
            style={{
              backgroundColor: '#0194F3',
              padding: 20,
              borderRadius: 25,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: "#0194F3",
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 8,
            }}
          >
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: 10,
              borderRadius: 15
            }}>
              <FontAwesome5 name="door-open" size={20} color="white" />
            </View>
            <Text style={{
              flex: 1,
              marginLeft: 15,
              fontWeight: '900',
              fontSize: 18,
              color: 'white',
              letterSpacing: 0.5
            }}>{t.bookButton}</Text>
            <Ionicons name="chevron-forward-circle" size={28} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/reservationlist')}
            style={{ 
              backgroundColor: '#FFF0E6', padding: 18, borderRadius: 20, marginBottom: 25, 
              flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FFDAB9'
            }}
          >
            <View style={{ backgroundColor: '#FF5E1F', padding: 8, borderRadius: 10 }}>
              <Ionicons name="calendar" size={20} color="white" />
            </View>
            <Text style={{ flex: 1, marginLeft: 15, fontWeight: 'bold', fontSize: 16, color: '#FF5E1F' }}>{t.bookingList}</Text>
            <Ionicons name="chevron-forward" size={20} color="#FF5E1F" />
          </TouchableOpacity>
          
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#0194F3' }}>{t.price}<Text style={{ fontSize: 18, color: '#999', fontWeight: 'normal' }}>{t.unit}</Text></Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 5 }}>{t.slogan}</Text>
          </View>

          <Text style={{ fontSize: 15, color: '#666', lineHeight: 24, marginBottom: 25 }}>{t.desc}</Text>

          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 }}>{t.amenTitle}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
            {[
              { icon: 'wifi', label: lang === 'TH' ? 'WiFi' : 'WiFi' },
              { icon: 'snow', label: lang === 'TH' ? 'แอร์' : 'Air' },
              { icon: 'videocam', label: lang === 'TH' ? 'CCTV' : 'CCTV' },
              { icon: 'car', label: lang === 'TH' ? 'ที่จอดรถ' : 'Parking' }
            ].map((item, i) => (
              <View key={i} style={{ width: '23%', alignItems: 'center', backgroundColor: '#F0F8FF', paddingVertical: 12, borderRadius: 15 }}>
                <Ionicons name={item.icon} size={22} color="#0194F3" />
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0194F3', marginTop: 5 }}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 1, backgroundColor: '#EEE', marginBottom: 25 }} />

          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 }}>ช่องทางการติดต่อ</Text>
          
          <TouchableOpacity 
            onPress={() => openContact('line', 'aroundloei')}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#06C755', padding: 18, borderRadius: 18, marginBottom: 12 }}
          >
            <FontAwesome5 name="line" size={24} color="white" style={{ width: 35 }} />
            <Text style={{ flex: 1, color: 'white', fontSize: 16, fontWeight: 'bold' }}>{t.line}</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => openContact('fb', 'aroundloei')}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1877F2', padding: 18, borderRadius: 18, marginBottom: 12 }}
          >
            <FontAwesome5 name="facebook" size={24} color="white" style={{ width: 35 }} />
            <Text style={{ flex: 1, color: 'white', fontSize: 16, fontWeight: 'bold' }}>{t.fb}</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => openContact('tel', '0812345678')}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF5E1F', padding: 18, borderRadius: 18, marginBottom: 12 }}
          >
            <Ionicons name="call" size={24} color="white" style={{ width: 35 }} />
            <Text style={{ flex: 1, color: 'white', fontSize: 16, fontWeight: 'bold' }}>{t.call}</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>

        </View>
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}