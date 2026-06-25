import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Modal,
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


export default function HomeScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [pressedMenuItem, setPressedMenuItem] = useState(null);


  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState('check');


  const { width } = useWindowDimensions();
  const windowWidth = width;
  const isMobile = width <= 768;


  const scrollRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const images = [
    'https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=1200',
    'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1200',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1200'
  ];


  useEffect(() => {
    const timer = setInterval(() => {
      let nextSlide = currentSlide + 1;
      if (nextSlide >= images.length) {
        nextSlide = 0;
      }
      scrollToSlide(nextSlide);
    }, 4000);


    return () => clearInterval(timer);
  }, [currentSlide, windowWidth]);


  const scrollToSlide = (index) => {
    setCurrentSlide(index);
    scrollRef.current?.scrollTo({
      x: index * windowWidth,
      animated: true,
    });
  };


  const handlePrevSlide = () => {
    const prevSlide = currentSlide === 0 ? images.length - 1 : currentSlide - 1;
    scrollToSlide(prevSlide);
  };


  const handleNextSlide = () => {
    const nextSlide = currentSlide === images.length - 1 ? 0 : currentSlide + 1;
    scrollToSlide(nextSlide);
  };


  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / windowWidth);
    if (currentIndex !== currentSlide && currentIndex >= 0 && currentIndex < images.length) {
      setCurrentSlide(currentIndex);
    }
  };


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
      bookButton: 'เช็คห้องพัก',
      bookingActiveButton: 'จองห้องพัก',
      logout: 'ออกจากระบบ',
      editProfile: 'แก้ไขโปรไฟล์ผู้ใช้',
      gallery: 'แกลเลอรี่',
      about: 'เกี่ยวกับเรา',
      welcome: 'Welcome to Around Loei',
      bookNow: 'จองเลย',
      modalTitleCheck: 'เช็คสถานะห้องพัก',
      modalTitleBook: 'เริ่มการจองห้องพัก',
      modalSubtitleCheck: 'เลือกประเภทห้องพักที่คุณต้องการเปิดดูข้อมูลครับ',
      modalSubtitleBook: 'เลือกประเภทห้องพักที่คุณต้องการทำรายการจองครับ',
      dailyChoice: 'ห้องพักรายวัน',
      monthlyChoice: 'ห้องพักรายเดือน'
    },
    EN: {
      subtitle: 'LEOI RESIDENCE', title: 'Around Loei', login: 'Login', register: 'Register',
      status: '● Available', price: '฿500-5,xxx', unit: ' days/month', slogan: 'Cozy Living in Loei City',
      desc: 'Experience superior living at "Around Loei". New, clean, and convenient location near Loei Rajabhat University.',
      bookingList: 'My Bookings',
      repair: 'Maintenance Request',
      line: 'Line Official', fb: 'Facebook Fanpage', call: 'Call for Inquiry',
      amenTitle: 'Premium Amenities',
      bookButton: 'Check Available Rooms',
      bookingActiveButton: 'Book a Room',
      logout: 'Logout',
      editProfile: 'Edit Profile',
      gallery: 'Gallery',
      about: 'About Us',
      welcome: 'Welcome to Around Loei',
      bookNow: 'Book Now',
      modalTitleCheck: 'Check Room Status',
      modalTitleBook: 'Start Booking Room',
      modalSubtitleCheck: 'Select the room type you would like to view.',
      modalSubtitleBook: 'Select the room type you want to reserve.',
      dailyChoice: 'Daily Room',
      monthlyChoice: 'Monthly Room'
    }
  };


  const t = text[lang];


  const handleLogout = async () => {
    // ลบทั้ง token และ userProfile
    await AsyncStorage.multiRemove(['token', 'userProfile']);
    setUser(null);
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
            <TouchableOpacity
              onPress={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              style={{
                width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#00E676',
                justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', marginRight: 10
              }}
            >
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                style={{ width: '100%', height: '100%', borderRadius: 21 }}
              />
            </TouchableOpacity>
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
            backgroundColor: '#0164A6', position: 'absolute', top: 60, left: 0, right: 0, zIndex: 99,
            paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 2, borderBottomColor: '#014E82'
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

                <TouchableOpacity
                  onPress={() => { setPressedMenuItem('repair'); router.push('/repair'); setIsMenuOpen(false); setPressedMenuItem(null); }}
                  onPressIn={() => setPressedMenuItem('repair')}
                  onPressOut={() => setPressedMenuItem(null)}
                  style={menuItemStyle('repair')}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>🛠️ {t.repair}</Text>
                </TouchableOpacity>

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
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            style={{ width: '100%', height: '100%' }}
          >
            {images.map((imgUrl, index) => (
              <View key={index} style={{ width: windowWidth, height: '100%' }}>
                <Image source={{ uri: imgUrl }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              </View>
            ))}
          </ScrollView>


          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />


          <TouchableOpacity onPress={handlePrevSlide} style={{ position: 'absolute', left: 15, top: '50%', marginTop: -20, backgroundColor: 'rgba(0,0,0,0.4)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>


          <TouchableOpacity onPress={handleNextSlide} style={{ position: 'absolute', right: 15, top: '50%', marginTop: -20, backgroundColor: 'rgba(0,0,0,0.4)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <Ionicons name="chevron-forward" size={24} color="white" />
          </TouchableOpacity>


          <View style={{ position: 'absolute', bottom: 55, flexDirection: 'row', width: '100%', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            {images.map((_, index) => (
              <View key={index} style={{ width: currentSlide === index ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: currentSlide === index ? '#0194F3' : 'rgba(255,255,255,0.6)', marginHorizontal: 4 }} />
            ))}
          </View>


          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, pointerEvents: 'none' }}>
            <Animated.View style={{ transform: [{ translateY }], alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: isMobile ? 26 : 36, fontWeight: '900', textAlign: 'center', marginBottom: 20, textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 8 }}>
                {t.welcome}
              </Text>
            </Animated.View>


            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openBookingModal(user ? 'book' : 'check')}
              style={{ borderWidth: 2, borderColor: 'white', paddingHorizontal: 32, paddingVertical: 12, backgroundColor: 'rgba(255, 255, 255, 0.15)', pointerEvents: 'auto' }}
            >
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>
                {t.bookNow}
              </Text>
            </TouchableOpacity>
          </View>
        </View>


        <View style={{ marginTop: -40, backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25 }}>
          {(!user || (user.role !== 'Daily_Tenant' && user.role !== 'Monthly_Tenant')) && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => openBookingModal(user ? 'book' : 'check')}
              style={{
                backgroundColor: '#0194F3',
                padding: 20, borderRadius: 25, marginBottom: 20,
                flexDirection: 'row', alignItems: 'center'
              }}
            >
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 15 }}>
                <FontAwesome5 name="door-open" size={20} color="white" />
              </View>
              <Text style={{ flex: 1, marginLeft: 15, fontWeight: '900', fontSize: 18, color: 'white', letterSpacing: 0.5 }}>
                {t.bookButton}
              </Text>
              <Ionicons name="chevron-forward-circle" size={28} color="white" />
            </TouchableOpacity>
          )}


          {user && user.role === 'Daily_Tenant' && (
            <View style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', padding: 20, borderRadius: 25, marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0369A1' }}>ห้องพักรายวันของคุณ: ห้อง {user.roomNo || '204'}</Text>
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
                onPress={() => openBookingModal('book')}
                style={{ backgroundColor: '#0284C7', padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <FontAwesome5 name="plus-circle" size={16} color="white" />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>{t.bookingActiveButton}</Text>
              </TouchableOpacity>
            </View>
          )}


          {user && user.role === 'Monthly_Tenant' && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ backgroundColor: '#0178C7', padding: 20, borderRadius: 25, marginBottom: 15 }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold' }}>บัญชีลูกบ้านรายเดือน</Text>
                <Text style={{ color: 'white', fontSize: 26, fontWeight: '900', marginTop: 2 }}>ห้อง {user.roomNo || '312'}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#1E293B', marginBottom: 10, marginTop: 5 }}>บริการและฟังก์ชันลูกบ้าน</Text>
              <View style={{ gap: 10 }}>
                <TouchableOpacity onPress={() => router.push('/repair')} style={{ backgroundColor: 'white', padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ backgroundColor: '#EF4444', padding: 10, borderRadius: 12 }}>
                    <FontAwesome5 name="tools" size={14} color="white" />
                  </View>
                  <Text style={{ flex: 1, marginLeft: 15, fontWeight: '800', color: '#334155', fontSize: 15 }}>{t.repair}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>


                <TouchableOpacity onPress={() => router.push('/invoice')} style={{ backgroundColor: 'white', padding: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ backgroundColor: '#10B981', padding: 10, borderRadius: 12 }}>
                    <FontAwesome5 name="file-invoice-dollar" size={14} color="white" />
                  </View>
                  <Text style={{ flex: 1, marginLeft: 15, fontWeight: '800', color: '#334155', fontSize: 15 }}>บิลค่าน้ำ ค่ไฟ และค่าเช่าห้อง</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>
          )}


          {user && (
            <TouchableOpacity onPress={() => router.push('/reservationlist')} style={{ backgroundColor: '#FFF0E6', padding: 18, borderRadius: 20, marginBottom: 25, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FFDAB9' }}>
              <View style={{ backgroundColor: '#FF5E1F', padding: 8, borderRadius: 10 }}>
                <Ionicons name="calendar" size={20} color="white" />
              </View>
              <Text style={{ flex: 1, marginLeft: 15, fontWeight: 'bold', fontSize: 16, color: '#FF5E1F' }}>{t.bookingList}</Text>
              <Ionicons name="chevron-forward" size={20} color="#FF5E1F" />
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