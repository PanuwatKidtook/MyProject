import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import api from '../../lib/api';

// ฟอนต์ serif หรู + สีทอง accent ให้เข้าชุดกับหน้า login
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
const GOLD = '#D9B25F';
// รูปตึกจริง (ใช้ร่วมกับหน้า login) — ครอบเต็มแบบไม่ยืดบนเว็บ
const HERO_IMG = require('../../assets/images/hero-around-loei.jpg');
// รูปสไลด์หน้าหลัก (รูปตึกเดิม + ห้องพัก/วิว) — ครอบเต็มไม่ยืดบนเว็บ
const HERO_SLIDES = [
  HERO_IMG,
  require('../../assets/images/hero-slide-1.jpg'),
  require('../../assets/images/hero-slide-2.jpg'),
  require('../../assets/images/hero-slide-3.jpg'),
  require('../../assets/images/hero-slide-4.jpg'),
];
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('home-hero-fit')) {
  const s = document.createElement('style');
  s.id = 'home-hero-fit';
  s.textContent = 'img[src*="hero-around-loei"],img[src*="hero-slide"]{object-fit:cover !important;object-position:center !important;}';
  document.head.appendChild(s);
}

export default function HomeScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [pressedMenuItem, setPressedMenuItem] = useState(null);

  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState('check');

  // ห้องที่แอดมินยืนยันให้แล้ว (ดึงสดจาก /checkbooking ทุกครั้งที่กลับมาหน้านี้
  // เพราะ userProfile ใน AsyncStorage ไม่มีเลขห้อง และไม่ถูกรีเฟรชหลังแอดมินยืนยัน)
  const [confirmedRoom, setConfirmedRoom] = useState(null);

  const { width } = useWindowDimensions();
  const windowWidth = width;
  const isMobile = width <= 768;

  const [currentSlide, setCurrentSlide] = useState(0);
  // รูปตึกเดิม + รูปห้อง/วิว → สไลด์ได้ (เลื่อนเอง + อัตโนมัติ)
  const images = HERO_SLIDES;
  const slideCount = images.length;
  const hasSlider = slideCount > 1;

  // คารูเซลแบบ translateX ลื่น ๆ (รูปเก่าไถออกซ้าย รูปใหม่เลื่อนเข้ามาจากขวา วนไม่สะดุด)
  const slideX = useRef(new Animated.Value(0)).current; // px, 0 = สไลด์แรก
  const animatingRef = useRef(false);

  // ปรับตำแหน่งเมื่อความกว้างจอเปลี่ยน (กันภาพเยื้อง)
  useEffect(() => {
    slideX.setValue(-currentSlide * windowWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth]);

  const animateTo = (toIndex, cb) => {
    Animated.timing(slideX, {
      toValue: -toIndex * windowWidth,
      duration: 750,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web', // เว็บใช้ JS driver — callback ทำงานชัวร์ ไม่ค้าง
    }).start(() => { if (cb) cb(); });
  };

  const goNext = () => {
    if (animatingRef.current || !hasSlider) return;
    animatingRef.current = true;
    const next = currentSlide + 1; // อาจเท่ากับ slideCount = โคลนของรูปแรก (ต่อท้ายไว้)
    animateTo(next, () => {
      animatingRef.current = false;
      if (next >= slideCount) { slideX.setValue(0); setCurrentSlide(0); } // ถึงโคลน → รีเซ็ตแนบเนียน
      else setCurrentSlide(next);
    });
  };

  const goPrev = () => {
    if (animatingRef.current || !hasSlider) return;
    animatingRef.current = true;
    if (currentSlide === 0) {
      // กระโดดไปหลังโคลนแล้วสไลด์กลับ (รูปใหม่เลื่อนเข้าจากซ้าย)
      slideX.setValue(-slideCount * windowWidth);
      animateTo(slideCount - 1, () => { animatingRef.current = false; setCurrentSlide(slideCount - 1); });
    } else {
      const prev = currentSlide - 1;
      animateTo(prev, () => { animatingRef.current = false; setCurrentSlide(prev); });
    }
  };

  // เลื่อนอัตโนมัติทุก 4 วิ
  useEffect(() => {
    if (!hasSlider) return;
    const timer = setInterval(goNext, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide, windowWidth]);

  const handlePrevSlide = goPrev;
  const handleNextSlide = goNext;

  // เอฟเฟกต์เข้าแบบ fade + เลื่อนขึ้นลื่น ๆ ครั้งเดียวตอนเปิดหน้า (ไม่กระตุกวนช้า)
  const heroAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 650,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);
  const heroTranslate = heroAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  // กระพริบลื่น ๆ ปานกลาง (glow/pulse) วนต่อเนื่องที่หัวข้อ
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, []);
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

  const isCancelledStatus = (status) => {
    const s = normalizeStatus(status);
    return s === 'ยกเลิก' || s === 'cancelled' || s === 'canceled';
  };

  // "ยืนยันการจอง" ไม่ถือเป็นสถานะรอ — ความหมายคือระบบยืนยันห้องให้แล้ว จึงควรขึ้นการ์ดห้องที่หน้าแรกได้เลย
  const isPendingStatus = (status) => {
    const s = normalizeStatus(status);
    return s === 'รอชำระมัดจำ' || s === 'รอดำเนินการ';
  };

  // หาห้องที่ "ยืนยันแล้ว" จริง ๆ (ไม่ใช่รอชำระ/ยกเลิก) จากรายการจองล่าสุดของผู้ใช้
  const fetchConfirmedRoom = useCallback(async () => {
    try {
      const response = await api.post('/checkbooking', {});
      const bookings = response.data?.success && Array.isArray(response.data.data) ? response.data.data : [];
      const confirmed = bookings.find(
        (item) => !isCancelledStatus(item.bookingStatus) && !isPendingStatus(item.bookingStatus)
      );
      setConfirmedRoom(confirmed || null);
    } catch (e) {
      setConfirmedRoom(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const checkUserStatus = async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          if (userData) {
            setUser(JSON.parse(userData));
            fetchConfirmedRoom();
          } else {
            setUser(null);
            setConfirmedRoom(null);
          }
        } catch (e) {
          console.log('Error loading user data');
        }
      };
      checkUserStatus();
    }, [fetchConfirmedRoom])
  );

  const text = {
    TH: {
      subtitle: 'หอพักจังหวัดเลย',
      title: 'Around Loei',
      login: 'เข้าสู่ระบบ',
      register: 'สมัครสมาชิก',
      status: '● ว่างพร้อมอยู่',
      price: '฿500-5,xxx',
      unit: ' วัน/เดือน',
      slogan: 'หอพักสบาย ใกล้ มรภ.เลย',
      desc: 'สัมผัสการใช้ชีวิตที่เหนือระดับกับ "Around Loei" หอพักราย-รายเดือน เดินทางสะดวก ใกล้ มรภ.เลย และแหล่งของกินครบครัน',
      bookingList: 'ประวัติการจองห้องพัก',
      repair: 'แจ้งซ่อมและแจ้งปัญหา',
      line: 'Line Official',
      fb: 'Facebook Fanpage',
      call: 'โทรสอบถามห้องว่าง',
      amenTitle: 'สิ่งอำนวยความสะดวก',
      bookButton: 'จองห้องพัก',
      bookingActiveButton: 'จองห้องพัก',
      logout: 'ออกจากระบบ',
      editProfile: 'แก้ไขโปรไฟล์ผู้ใช้',
      gallery: 'แกลเลอรี่',
      about: 'เกี่ยวกับเรา',
      welcome: 'Welcome to Around Loei',
      bookNow: 'จองเลย',
      modalTitleCheck: 'จองห้องพัก',
      modalTitleBook: 'เริ่มการจองห้องพัก',
      modalSubtitleCheck: 'เลือกประเภทห้องพักที่คุณต้องการเปิดดูข้อมูลครับ',
      modalSubtitleBook: 'เลือกประเภทห้องพักที่คุณต้องการทำรายการจองครับ',
      dailyChoice: 'ห้องพักรายวัน',
      monthlyChoice: 'ห้องพักรายเดือน',
      roleDailyBadge: 'รายวัน',
      roleMonthlyBadge: 'รายเดือน'
    },
    EN: {
      subtitle: 'LEOI RESIDENCE',
      title: 'Around Loei',
      login: 'Login',
      register: 'Register',
      status: '● Available',
      price: '฿500-5,xxx',
      unit: ' days/month',
      slogan: 'Cozy Living in Loei City',
      desc: 'Experience superior living at "Around Loei". New, clean, and convenient location near Loei Rajabhat University.',
      bookingList: 'My Bookings',
      repair: 'Maintenance Request',
      line: 'Line Official',
      fb: 'Facebook Fanpage',
      call: 'Call for Inquiry',
      amenTitle: 'Premium Amenities',
      bookButton: 'Check Available Rooms',
      bookingActiveButton: 'Book a Room',
      logout: 'Logout',
      editProfile: 'Edit Profile',
      gallery: 'Gallery',
      about: 'About Us',
      welcome: 'Welcome to Around Loei',
      bookNow: 'Book Now',
      modalTitleCheck: 'Start Booking Room',
      modalTitleBook: 'Start Booking Room',
      modalSubtitleCheck: 'Select the room type you would like to view.',
      modalSubtitleBook: 'Select the room type you want to reserve.',
      dailyChoice: 'Daily Room',
      monthlyChoice: 'Monthly Room',
      roleDailyBadge: 'Daily',
      roleMonthlyBadge: 'Monthly'
    }
  };

  const t = text[lang];

  // เลขห้อง + ประเภทห้อง: ใช้ข้อมูลจากการจองที่แอดมินยืนยันแล้วก่อน (สดใหม่เสมอ)
  // แล้วค่อย fallback ไปที่ userProfile เผื่อไม่มีการเชื่อมต่อ
  const roomNumber = confirmedRoom?.roomNumber || user?.roomNo || null;
  const rentType = confirmedRoom?.rentType
    || (user?.role === 'Monthly_Tenant' ? 'monthly' : user?.role === 'Daily_Tenant' ? 'daily' : null);
  // เปิดเผยเลขห้องเฉพาะเมื่อพนักงานเช็คอินที่เคาน์เตอร์แล้ว (สถานะ 'กำลังเข้าพัก') — ก่อนหน้านั้น "รอยืนยัน"
  const isRoomRevealed = normalizeStatus(confirmedRoom?.bookingStatus) === 'กำลังเข้าพัก';

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'userProfile']);
    setUser(null);
    setConfirmedRoom(null);
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
    setPressedMenuItem(null);
  };

  const openContact = (type, value) => {
    let url = '';
    if (type === 'tel') url = `tel:${value}`;
    if (type === 'line') url = `https://line.me/ti/p/~${value}`;
    if (type === 'fb') url = `https://facebook.com/${value}`;
    Linking.openURL(url);
  };

  const openBookingModal = (actionType) => {
    setCurrentAction(actionType);
    setBookingModalVisible(true);
  };

  // จอง (book) ของ user ที่มีโรลรายวัน/รายเดือนอยู่แล้ว — ตรวจโรลแล้วพาเข้าหน้าจองตามโรลทันที ไม่ต้องเลือกเอง
  const handleBookNow = (actionType) => {
    if (actionType === 'book' && user && (user.role === 'Daily_Tenant' || user.role === 'Monthly_Tenant')) {
      router.push({
        pathname: user.role === 'Daily_Tenant' ? '/(daily)/reservation' : '/(monthly)/reservation',
        params: { mode: actionType }
      });
      return;
    }
    openBookingModal(actionType);
  };

  const handleSelectBookingType = (roomType) => {
    setBookingModalVisible(false);

    if (roomType === 'daily') {
      router.push({
        pathname: '/(daily)/reservation',
        params: { mode: currentAction }
      });
    } else if (roomType === 'monthly') {
      router.push({
        pathname: '/(monthly)/reservation',
        params: { mode: currentAction }
      });
    }
  };

  const menuItemStyle = (key) => ({
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: pressedMenuItem === key ? 'rgba(255,255,255,0.16)' : 'transparent',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0194F3' }}>
      <StatusBar barStyle="light-content" />

      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#0178C7',
        position: 'relative', zIndex: 100, width: '100%'
      }}>
        <View style={{ flexShrink: 1, marginRight: 15 }}>
          <Text numberOfLines={1} style={{ color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
            {t.title}
          </Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 'bold' }}>
            {t.subtitle}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
          {user ? (
            <>
              <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                <Text numberOfLines={1} style={{ color: 'white', fontSize: 13, fontWeight: '800', maxWidth: 110 }}>
                  {user.name || user.username}
                </Text>
                {(user.role === 'Daily_Tenant' || user.role === 'Monthly_Tenant') && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 2 }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>
                      {user.role === 'Daily_Tenant' ? t.roleDailyBadge : t.roleMonthlyBadge}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
              onPress={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                borderWidth: 2,
                borderColor: '#00E676',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'white',
                marginRight: 10
              }}
            >
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                style={{ width: '100%', height: '100%', borderRadius: 21 }}
              />
            </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity onPress={() => setIsMenuOpen(!isMenuOpen)} style={{ padding: 5 }}>
            <Ionicons name={isMenuOpen ? "close" : "menu"} size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {isMenuOpen && (
        <>
          <Pressable
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 98
            }}
            onPress={() => {
              setIsMenuOpen(false);
              setPressedMenuItem(null);
            }}
          />
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
            borderBottomColor: '#014E82'
          }}>
            {user ? (
              <View style={{ paddingTop: 10 }}>
                <TouchableOpacity
                  onPress={() => { setPressedMenuItem('profileedit'); router.push('/profileedit'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                  onPressIn={() => setPressedMenuItem('profileedit')}
                  onPressOut={() => setPressedMenuItem(null)}
                  style={menuItemStyle('profileedit')}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>👤 {t.editProfile}</Text>
                </TouchableOpacity>

                {user.role !== 'Daily_Tenant' && (
                  <TouchableOpacity
                    onPress={() => { setPressedMenuItem('repair'); router.push('/repair'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                    onPressIn={() => setPressedMenuItem('repair')}
                    onPressOut={() => setPressedMenuItem(null)}
                    style={menuItemStyle('repair')}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>🛠️ {t.repair}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => { setPressedMenuItem('about'); router.push('/about'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                  onPressIn={() => setPressedMenuItem('about')}
                  onPressOut={() => setPressedMenuItem(null)}
                  style={menuItemStyle('about')}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>ℹ️ {t.about}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setPressedMenuItem('gallery'); router.push('/gallery'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                  onPressIn={() => setPressedMenuItem('gallery')}
                  onPressOut={() => setPressedMenuItem(null)}
                  style={menuItemStyle('gallery')}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>🖼️ {t.gallery}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setPressedMenuItem('logout'); handleLogout(); }}
                  onPressIn={() => setPressedMenuItem('logout')}
                  onPressOut={() => setPressedMenuItem(null)}
                  style={{
                    paddingVertical: 12,
                    backgroundColor: pressedMenuItem === 'logout' ? 'rgba(255,255,255,0.16)' : 'rgba(255,0,0,0.2)',
                    borderRadius: 8,
                    alignItems: 'center',
                    marginTop: 15
                  }}
                >
                  <Text style={{ color: '#FFCDD2', fontWeight: 'bold', fontSize: 14 }}>{t.logout}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  onPress={() => { setPressedMenuItem('about'); router.push('/about'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                  onPressIn={() => setPressedMenuItem('about')}
                  onPressOut={() => setPressedMenuItem(null)}
                  style={menuItemStyle('about')}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>ℹ️ {t.about}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setPressedMenuItem('gallery'); router.push('/gallery'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                  onPressIn={() => setPressedMenuItem('gallery')}
                  onPressOut={() => setPressedMenuItem(null)}
                  style={menuItemStyle('gallery')}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>🖼️ {t.gallery}</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10, paddingTop: 15 }}>
                  <TouchableOpacity
                    onPress={() => { setPressedMenuItem('login'); router.push('/login'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                    onPressIn={() => setPressedMenuItem('login')}
                    onPressOut={() => setPressedMenuItem(null)}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      borderWidth: 1,
                      borderColor: 'white',
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: pressedMenuItem === 'login' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>{t.login}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => { setPressedMenuItem('register'); router.push('/register'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                    onPressIn={() => setPressedMenuItem('register')}
                    onPressOut={() => setPressedMenuItem(null)}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      backgroundColor: pressedMenuItem === 'register' ? 'rgba(255,255,255,0.75)' : 'white',
                      borderRadius: 10,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: '#0164A6', fontWeight: 'bold', fontSize: 14 }}>{t.register}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => { setLang(lang === 'TH' ? 'EN' : 'TH'); setIsMenuOpen(false); setPressedMenuItem(null); }}
              style={{ marginTop: 15, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>🌐 Change Language ({lang === 'TH' ? 'EN' : 'TH'})</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ backgroundColor: '#F8F9FA' }}>
        <View style={{ height: isMobile ? 320 : 420, width: '100%', position: 'relative', overflow: 'hidden' }}>
          <Animated.View
            style={{
              flexDirection: 'row', height: '100%', width: windowWidth * (slideCount + 1),
              transform: [{ translateX: slideX }],
            }}
            pointerEvents="none"
          >
            {/* ต่อรูปแรกไว้ท้ายสุด เพื่อวนลูปไปข้างหน้าแบบไม่สะดุด */}
            {[...images, images[0]].map((imgUrl, index) => (
              <View key={index} style={{ width: windowWidth, height: '100%' }}>
                <Image source={typeof imgUrl === 'string' ? { uri: imgUrl } : imgUrl} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              </View>
            ))}
          </Animated.View>

          {/* ไล่เฉดทับรูปให้ดูพรีเมียมและอ่านง่าย */}
          <LinearGradient
            colors={['rgba(4,14,26,0.35)', 'rgba(4,14,26,0.15)', 'rgba(4,14,26,0.78)']}
            locations={[0, 0.45, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none"
          />

          {hasSlider && (
            <>
              <TouchableOpacity onPress={handlePrevSlide} style={{ position: 'absolute', left: 15, top: '50%', marginTop: -20, backgroundColor: 'rgba(0,0,0,0.4)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNextSlide} style={{ position: 'absolute', right: 15, top: '50%', marginTop: -20, backgroundColor: 'rgba(0,0,0,0.4)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                <Ionicons name="chevron-forward" size={24} color="white" />
              </TouchableOpacity>

              <View style={{ position: 'absolute', bottom: 55, flexDirection: 'row', width: '100%', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                {images.map((_, index) => (
                  <View key={index} style={{ width: currentSlide === index ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: currentSlide === index ? '#FFFFFF' : 'rgba(255,255,255,0.6)', marginHorizontal: 4 }} />
                ))}
              </View>
            </>
          )}

          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 20, pointerEvents: 'box-none' }}>
            <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroTranslate }], alignItems: 'center' }}>
              <Animated.View style={{ alignItems: 'center', opacity: pulseOpacity, transform: [{ scale: pulseScale }] }}>
                <Text style={{
                  color: '#FFFFFF', fontFamily: SERIF, fontStyle: 'italic', fontWeight: '600',
                  fontSize: isMobile ? 28 : 34, letterSpacing: 2.5, marginBottom: 2,
                  textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12,
                }}>
                  Welcome to
                </Text>
                <Text style={{
                  color: 'white', fontFamily: SERIF, fontSize: isMobile ? 46 : 62, fontWeight: '700',
                  textAlign: 'center', letterSpacing: 0.5, lineHeight: isMobile ? 56 : 74,
                  textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 18,
                  ...(Platform.OS === 'web' ? { textShadow: '0 2px 10px rgba(0,0,0,0.55), 0 0 26px rgba(217,178,95,0.45)' } : {}),
                }}>
                  Around Loei
                </Text>
              </Animated.View>
              <View style={{ width: 70, height: 3, borderRadius: 3, backgroundColor: GOLD, marginTop: 18, marginBottom: 26, shadowColor: GOLD, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }} />

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleBookNow(user ? 'book' : 'check')}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  borderRadius: 999, paddingHorizontal: 32, paddingVertical: 13,
                  backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
                  pointerEvents: 'auto',
                  ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}),
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 15, letterSpacing: 1 }}>
                  {t.bookNow}
                </Text>
                <Ionicons name="arrow-forward" size={17} color="white" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        <View style={{ marginTop: -40, backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25 }}>
          {!roomNumber && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleBookNow(user ? 'book' : 'check')}
              style={{
                borderRadius: 24, marginBottom: 22, overflow: 'hidden',
                shadowColor: '#0178C7', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
              }}
            >
              <LinearGradient
                colors={['#38B6FF', '#0194F3', '#0166C8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 20, flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', padding: 12, borderRadius: 16 }}>
                  <FontAwesome5 name="door-open" size={20} color="white" />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={{ fontWeight: '900', fontSize: 18, color: 'white', letterSpacing: 0.5 }}>
                    {t.bookButton}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2, fontWeight: '600' }}>
                    {lang === 'TH' ? 'เลือกห้องรายวัน / รายเดือน' : 'Daily / Monthly rooms'}
                  </Text>
                </View>
                <View style={{ width: 3, height: 34, borderRadius: 3, backgroundColor: GOLD, marginRight: 12 }} />
                <Ionicons name="chevron-forward-circle" size={30} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {rentType === 'daily' && roomNumber && (
            <View style={styles.roomCardDaily}>
              <View style={styles.roomCardHeaderRow}>
                <Text style={styles.roomCardEyebrowDaily}>ห้องพักรายวันของคุณ</Text>
                <View style={styles.confirmedBadgeLight}>
                  <Ionicons name="checkmark-circle" size={13} color="#0284C7" />
                  <Text style={styles.confirmedBadgeLightText}>ยืนยันแล้ว</Text>
                </View>
              </View>
              <Text style={{ color: '#0284C7', fontSize: 12, marginBottom: 15, marginTop: 2, fontWeight: '600' }}>📅 รายการเข้าพักระยะสั้น (Daily Tenant)</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 15 }}>
                <View style={{ flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' }}>
                  <Ionicons name="wifi" size={22} color="#0284C7" />
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 5 }}>Wi-Fi หอพัก</Text>
                  <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: 'bold' }}>Pass: ALoei999</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E0F2FE' }}>
                  <Ionicons name="qr-code" size={22} color="#0284C7" />
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 5 }}>คีย์การ์ดเข้าตึก</Text>
                  <Text style={{ fontSize: 10, color: '#64748B' }}>แตะเปิด QR Code</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleBookNow('book')}
                style={{ backgroundColor: '#0284C7', padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <FontAwesome5 name="plus-circle" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>{t.bookingActiveButton}</Text>
              </TouchableOpacity>
            </View>
          )}

          {rentType === 'monthly' && roomNumber && (
            <View style={{ marginBottom: 20 }}>
              <View style={styles.roomCardMonthly}>
                <View style={styles.roomCardMonthlyGlow} pointerEvents="none" />
                <View style={styles.roomCardHeaderRow}>
                  <Text style={styles.roomCardEyebrowMonthly}>บัญชีลูกบ้านรายเดือน</Text>
                  <View style={styles.confirmedBadgeDark}>
                    <Ionicons name={isRoomRevealed ? 'checkmark-circle' : 'time-outline'} size={13} color="#0178C7" />
                    <Text style={styles.confirmedBadgeDarkText}>{isRoomRevealed ? 'ยืนยันแล้ว' : 'รอยืนยัน'}</Text>
                  </View>
                </View>
                <Text style={[styles.roomCardNumberMonthly, !isRoomRevealed && { fontSize: 20 }]}>{isRoomRevealed ? `ห้อง ${roomNumber}` : 'รอยืนยันที่เคาน์เตอร์'}</Text>
              </View>
            </View>
          )}

          {user && (
            <TouchableOpacity
              onPress={() => router.push('/reservationlist')}
              style={{
                backgroundColor: '#FFF0E6',
                padding: 18,
                borderRadius: 20,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#FFDAB9'
              }}
            >
              <View style={{ backgroundColor: '#FF5E1F', padding: 8, borderRadius: 10 }}>
                <Ionicons name="calendar" size={20} color="white" />
              </View>

              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#FF5E1F' }}>
                  {t.bookingList}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#FF5E1F" />
            </TouchableOpacity>
          )}

          <View style={{ marginBottom: 22 }}>
            <View style={{ width: 46, height: 3, borderRadius: 3, backgroundColor: GOLD, marginBottom: 12 }} />
            <Text style={{ fontSize: 38, fontWeight: '900', color: '#0194F3', letterSpacing: 0.3 }}>{t.price}<Text style={{ fontSize: 18, color: '#9AA6B2', fontWeight: 'normal' }}>{t.unit}</Text></Text>
            <Text style={{ fontSize: 24, fontFamily: SERIF, fontWeight: '700', color: '#1B2A3A', marginTop: 6 }}>{t.slogan}</Text>
          </View>

          <Text style={{ fontSize: 15, color: '#5B6875', lineHeight: 25, marginBottom: 26 }}>{t.desc}</Text>

          <Text style={{ fontSize: 19, fontFamily: SERIF, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 }}>{t.amenTitle}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 26 }}>
            {[
              { icon: 'wifi', label: 'WiFi' },
              { icon: 'snow', label: lang === 'TH' ? 'แอร์' : 'Air' },
              { icon: 'videocam', label: 'CCTV' },
              { icon: 'car', label: lang === 'TH' ? 'ที่จอดรถ' : 'Parking' }
            ].map((item, i) => (
              <View key={i} style={{
                width: '23%', alignItems: 'center', backgroundColor: 'white', paddingVertical: 16, borderRadius: 18,
                borderWidth: 1, borderColor: '#EAF2FA',
                shadowColor: '#0A2540', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
              }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name={item.icon} size={22} color="#0194F3" />
                </View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#33475B' }}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 1, backgroundColor: '#EEE', marginBottom: 25 }} />

          <Text style={{ fontSize: 19, fontFamily: SERIF, fontWeight: '700', color: '#1A1A1A', marginBottom: 15 }}>{lang === 'TH' ? 'ช่องทางการติดต่อ' : 'Contact Us'}</Text>

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

      <Modal
        animationType="fade"
        transparent={true}
        visible={bookingModalVisible}
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setBookingModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setBookingModalVisible(false)}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              {currentAction === 'book' ? t.modalTitleBook : t.modalTitleCheck}
            </Text>
            <Text style={styles.modalSubtitle}>
              {currentAction === 'book' ? t.modalSubtitleBook : t.modalSubtitleCheck}
            </Text>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.choiceButton, styles.dailyButton]}
                onPress={() => handleSelectBookingType('daily')}
              >
                <Ionicons name={currentAction === 'book' ? "bookmark" : "search-outline"} size={22} color="#0284C7" />
                <Text style={[styles.choiceButtonText, { color: '#0284C7' }]}>{t.dailyChoice}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choiceButton, styles.monthlyButton]}
                onPress={() => handleSelectBookingType('monthly')}
              >
                <Ionicons name={currentAction === 'book' ? "calendar" : "business-outline"} size={22} color="#0D9488" />
                <Text style={[styles.choiceButtonText, { color: '#0D9488' }]}>{t.monthlyChoice}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  roomCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmedBadgeLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  confirmedBadgeLightText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '800',
  },
  confirmedBadgeDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  confirmedBadgeDarkText: {
    color: '#0178C7',
    fontSize: 11,
    fontWeight: '800',
  },
  roomCardDaily: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 20,
    borderRadius: 25,
    marginBottom: 20,
  },
  roomCardEyebrowDaily: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  roomCardNumberDaily: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0369A1',
    marginTop: 4,
  },
  roomCardMonthly: {
    backgroundColor: '#0178C7',
    padding: 20,
    borderRadius: 25,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#0178C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  roomCardMonthlyGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  roomCardEyebrowMonthly: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  roomCardNumberMonthly: {
    color: 'white',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 10,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  choiceButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  dailyButton: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  monthlyButton: {
    backgroundColor: '#CCFBF1',
    borderColor: '#99F6E4',
  },
  choiceButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});