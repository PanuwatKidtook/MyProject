import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions // 👈 ดึง hook ตรวจสอบขนาดหน้าจอแบบ Real-time
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter(); 
  const [lang, setLang] = useState('TH');
  const [user, setUser] = useState(null);
  
  // 🔄 State ควบคุมการ เปิด/ปิด Toggle Menu บนหน้าจอเล็ก
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 📐 ตรวจจับความกว้างหน้าจอเพื่อเปลี่ยนการแสดงผล (<= 650px)
  const { width } = useWindowDimensions();
  const isMobile = width <= 650;

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -8,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

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
      status: '● ว่างพร้อมอยู่', price: '฿500-5,xxx', unit: ' วัน/เดือน', slogan: 'หอพักสบาย ใกล้ มรภ.เลย',
      desc: 'สัมผัสการใช้ชีวิตที่เหนือระดับกับ "Around Loei" หอพักราย-รายเดือน เดินทางสะดวก ใกล้ มรภ.เลย และแหล่งของกินครบครัน',
      bookingList: 'ประวัติการจองห้องของคุณ', 
      repair: 'แจ้งซ่อมและแจ้งปัญหา',
      line: 'Line Official', fb: 'Facebook Fanpage', call: 'โทรสอบถามห้องว่าง',
      amenTitle: 'สิ่งอำนวยความสะดวก',
      bookButton: 'จองห้องพักตอนนี้',
      logout: 'ออกจากระบบ',
      gallery: 'แกลเลอรี่',
      blog: 'บทความ',       
      about: 'เกี่ยวกับเรา',    
      welcome: 'Welcome to Around Loei', 
      bookNow: 'จองเลย'      
    },
    EN: {
      subtitle: 'LEOI RESIDENCE', title: 'Around Loei', login: 'Login', register: 'Register',
      status: '● Available', price: '฿500-5,xxx', unit: ' days/month', slogan: 'Cozy Living in Loei City',
      desc: 'Experience superior living at "Around Loei". New, clean, and convenient location near Loei Rajabhat University.',
      bookingList: 'My Bookings', 
      repair: 'Maintenance Request',
      line: 'Line Official', fb: 'Facebook Fanpage', call: 'Call for Inquiry',
      amenTitle: 'Premium Amenities',
      bookButton: 'Book a Room Now',
      logout: 'Logout',
      gallery: 'Gallery',
      blog: 'Blog',          
      about: 'About Us',     
      welcome: 'Welcome to Around Loei',
      bookNow: 'Book Now'
    }
  };

  const t = text[lang];

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userProfile');
    setUser(null);
    setIsMenuOpen(false);
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
        paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#0178C7',
        position: 'relative', zIndex: 100
      }}>
        <View>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>{t.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 'bold' }}>{t.subtitle}</Text>
        </View>

        {/* ตรวจสอบขนาดจอในการแสดงผลปุ่มเมนู */}
        {!isMobile ? (
          // 🖥️ Desktop Mode (> 650px): แสดงเมนูแนวนอนปกติ
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/blog')} style={{ marginRight: 14 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t.blog}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/about')} style={{ marginRight: 14 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t.about}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/gallery')} style={{ marginRight: 14 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t.gallery}</Text>
            </TouchableOpacity>

            {user ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={handleLogout} style={{ marginRight: 12 }}>
                   <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 'bold' }}>{t.logout}</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{user.name}</Text>
                </View>
                <View style={{ 
                  width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#00E676', 
                  justifyContent: 'center', alignItems: 'center', backgroundColor: 'white'
                }}>
                  <Image 
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
                    style={{ width: '100%', height: '100%', borderRadius: 21 }}
                  />
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity onPress={() => router.push('/login')} style={{ marginRight: 12 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t.login}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => router.push('/register')} 
                  style={{ marginRight: 15, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t.register}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity 
              onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')} 
              style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 5 }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // 📱 Mobile Mode (<= 650px): แสดงปุ่ม Hamburger Menu ลอยขวาแทน
          <TouchableOpacity onPress={() => setIsMenuOpen(!isMenuOpen)} style={{ padding: 5 }}>
            <Ionicons name={isMenuOpen ? "close" : "menu"} size={28} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* 📥 เมนูดรอปดาวน์แบบ Toggle (จะแสดงเมื่อหน้าจอเล็กกว่า 650px และสั่งเปิดไว้) */}
      {isMobile && isMenuOpen && (
        <View style={{
          backgroundColor: '#0164A6',
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          zIndex: 99,
          paddingHorizontal: 20,
          paddingBottom: 15,
          borderBottomWidth: 2,
          borderBottomColor: '#014E82',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 5,
          elevation: 5
        }}>
          <TouchableOpacity onPress={() => { router.push('/blog'); setIsMenuOpen(false); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{t.blog}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { router.push('/about'); setIsMenuOpen(false); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{t.about}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { router.push('/gallery'); setIsMenuOpen(false); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{t.gallery}</Text>
          </TouchableOpacity>

          {/* แนบเมนู Login / Profile เข้ามาในชุดหน้าต่างโมบายล์ดรอปดาวน์ */}
          {user ? (
            <View style={{ paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: 'white' }} />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{user.name}</Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={{ paddingVertical: 12, backgroundColor: 'rgba(255,0,0,0.2)', borderRadius: 8, alignItems: 'center', marginTop: 5 }}>
                <Text style={{ color: '#FFCDD2', fontWeight: 'bold', fontSize: 14 }}>{t.logout}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 15 }}>
              <TouchableOpacity onPress={() => { router.push('/login'); setIsMenuOpen(false); }} style={{ flex: 1, marginRight: 8, paddingVertical: 10, borderWidth: 1, borderColor: 'white', borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>{t.login}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { router.push('/register'); setIsMenuOpen(false); }} style={{ flex: 1, marginLeft: 8, paddingVertical: 10, backgroundColor: 'white', borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: '#0164A6', fontWeight: 'bold' }}>{t.register}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ปุ่มเปลี่ยนภาษาแบบเต็มบรรทัด */}
          <TouchableOpacity 
            onPress={() => { setLang(lang === 'TH' ? 'EN' : 'TH'); setIsMenuOpen(false); }}
            style={{ marginTop: 15, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>🌐 Change Language ({lang === 'TH' ? 'EN' : 'TH'})</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ backgroundColor: '#F8F9FA' }}>
        
        {/* --- Image Section --- */}
        <View style={{ height: 380, width: '100%', position: 'relative', overflow: 'hidden' }}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=800' }} 
            style={{ width: '100%', height: '100%', position: 'absolute', resizeMode: 'cover' }} 
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />

          <View style={{ position: 'absolute', top: 20, right: 20, backgroundColor: '#00C853', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25, zIndex: 10 }}>
            <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>{t.status}</Text>
          </View>

          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
            <Animated.View style={{ transform: [{ translateY }], alignItems: 'center' }}>
              <Text style={{ 
                color: 'white', fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 20,
                textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 8 
              }}>
                {t.welcome}
              </Text>
            </Animated.View>
      
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/reservation')}
              style={{
                borderWidth: 2,
                borderColor: 'white',
                paddingHorizontal: 32,
                paddingVertical: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 5,
                elevation: 5
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>
                {t.bookNow}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- Content Card --- */}
        <View style={{ marginTop: -40, backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25 }}>
          
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/reservation')}
            style={{
              backgroundColor: '#0194F3', padding: 20, borderRadius: 25, marginBottom: 20,
              flexDirection: 'row', alignItems: 'center'
            }}
          >
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 15 }}>
              <FontAwesome5 name="door-open" size={20} color="white" />
            </View>
            <Text style={{ flex: 1, marginLeft: 15, fontWeight: '900', fontSize: 18, color: 'white', letterSpacing: 0.5 }}>{t.bookButton}</Text>
            <Ionicons name="chevron-forward-circle" size={28} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/reservationlist')}
            style={{ backgroundColor: '#FFF0E6', padding: 18, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FFDAB9' }}
          >
            <View style={{ backgroundColor: '#FF5E1F', padding: 8, borderRadius: 10 }}>
              <Ionicons name="calendar" size={20} color="white" />
            </View>
            <Text style={{ flex: 1, marginLeft: 15, fontWeight: 'bold', fontSize: 16, color: '#FF5E1F' }}>{t.bookingList}</Text>
            <Ionicons name="chevron-forward" size={20} color="#FF5E1F" />
          </TouchableOpacity>

          {user && (
            <TouchableOpacity 
              onPress={() => router.push('/maintenance')} 
              style={{ backgroundColor: '#F0F4FF', padding: 18, borderRadius: 20, marginBottom: 25, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D9FF' }}
            >
              <View style={{ backgroundColor: '#3F51B5', padding: 8, borderRadius: 10 }}>
                <MaterialCommunityIcons name="tools" size={20} color="white" />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#3F51B5' }}>{t.repair}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#3F51B5" />
            </TouchableOpacity>
          )}
          
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#0194F3' }}>{t.price}<Text style={{ fontSize: 18, color: '#999', fontWeight: 'normal' }}>{t.unit}</Text></Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 5 }}>{t.slogan}</Text>
          </View>

          <Text style={{ fontSize: 15, color: '#666', lineHeight: 24, marginBottom: 25 }}>{t.desc}</Text>

          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 }}>{t.amenTitle}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
            {[
              { icon: 'wifi', label: 'WiFi' },
              { icon: 'snow', label: lang === 'TH' ? 'แอร์' : 'Air' },
              { icon: 'videocam', label: 'CCTV' },
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
          
          <TouchableOpacity onPress={() => openContact('line', 'aroundloei')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#06C755', padding: 18, borderRadius: 18, marginBottom: 12 }}>
            <FontAwesome5 name="line" size={24} color="white" style={{ width: 35 }} />
            <Text style={{ flex: 1, color: 'white', fontSize: 16, fontWeight: 'bold' }}>{t.line}</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => openContact('fb', 'aroundloei')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1877F2', padding: 18, borderRadius: 18, marginBottom: 12 }}>
            <FontAwesome5 name="facebook" size={24} color="white" style={{ width: 35 }} />
            <Text style={{ flex: 1, color: 'white', fontSize: 16, fontWeight: 'bold' }}>{t.fb}</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => openContact('tel', '0812345678')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF5E1F', padding: 18, borderRadius: 18, marginBottom: 12 }}>
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