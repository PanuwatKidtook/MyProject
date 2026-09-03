import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  ActivityIndicator, Alert, StatusBar, SafeAreaView, RefreshControl, Dimensions
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';

const GALLERY_W = Dimensions.get('window').width; // กว้างเท่าจอ — ให้แกลเลอรีรูปห้อง paging พอดีทีละรูป

// อาคารมี 4 ชั้น — ดึงเลขชั้นจากเลขห้อง (เช่น 101→ชั้น 1, 204→ชั้น 2) ถ้าอ่านไม่ได้ให้เป็นชั้น 1
function floorOf(room) {
  const n = parseInt(String(room.room_number ?? '').replace(/\D/g, ''), 10);
  if (!n) return 1;
  const f = n >= 100 ? Math.floor(n / 100) : Number(String(n)[0]);
  return Math.min(4, Math.max(1, f || 1));
}

// จัดกลุ่มห้องตามชั้น 1-4 → [{ floor, rooms:[...] }, ...] (เรียงชั้นจากน้อยไปมาก)
function groupRoomsByFloor(rooms) {
  const map = new Map();
  for (const r of rooms) {
    const f = floorOf(r);
    if (!map.has(f)) map.set(f, []);
    map.get(f).push(r);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([floor, list]) => ({ floor, rooms: list }));
}

// รูปภายในห้องตามประเภท — เวลากดจองจะโชว์เป็นแกลเลอรีหลายรูป (เลือกชุดตามชื่อประเภทให้คงที่)
const TYPE_GALLERIES = [
  [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=900',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=900',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=900',
    'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?q=80&w=900',
  ],
  [
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=900',
    'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=900',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=900',
    'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=900',
  ],
  [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=900',
    'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=900',
    'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?q=80&w=900',
    'https://images.unsplash.com/photo-1560184897-ae75f418493e?q=80&w=900',
  ],
];

// ได้แกลเลอรีรูปของห้อง — เอา image_url ของห้องมาเป็นรูปแรก (ถ้ามี) แล้วต่อด้วยชุดรูปตามประเภท
function galleryFor(typeName, imageUrl) {
  const key = String(typeName || '');
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  const pool = TYPE_GALLERIES[sum % TYPE_GALLERIES.length];
  const imgs = imageUrl ? [imageUrl, ...pool.filter((u) => u !== imageUrl)] : [...pool];
  return imgs.slice(0, 4);
}

// มัดจำล็อกห้องรายเดือน (บาท) — เก็บก่อนเพื่อกันห้อง ค่าเช่า/มัดจำสัญญาที่เหลือเก็บตอนเช็คอิน
const DEPOSIT_LOCK = 2000;

// สิ่งอำนวยความสะดวกมาตรฐานของทุกห้อง (โชว์เป็นเช็กลิสต์ในการ์ด)
const AMENITIES = ['ฟรี WiFi', 'เครื่องปรับอากาศ', 'ห้องน้ำส่วนตัว', 'ทีวีดาวเทียม', 'ตู้เย็น', 'ที่จอดรถ'];

// รูปสำรองของการ์ด (ใช้เมื่อห้องไม่มี image_url)
const ROOM_IMAGES = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
];

export default function MonthlyReservationScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [user, setUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // วันเข้าพัก (รายเดือนเลือกแค่วันเดียว — วันสิ้นสุดคำนวณตอนเช็คอิน)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showInitialModal, setShowInitialModal] = useState(true);
  const [isDateSelected, setIsDateSelected] = useState(false);

  // ผังชั้น: ห้องทั้งหมด + ว่าง/ไม่ว่าง ณ วันเข้าพักที่เลือก
  const [availability, setAvailability] = useState([]);
  const [bedFilter, setBedFilter] = useState(null); // กรองตามประเภทห้อง/เตียง (type_name) — null = ทั้งหมด
  const [floorFilter, setFloorFilter] = useState(null); // กรองตามชั้น 1-4 — null = ทุกชั้น
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [detailRoom, setDetailRoom] = useState(null); // ห้องที่เปิดดูรายละเอียด
  const [galleryIndex, setGalleryIndex] = useState(0); // รูปที่กำลังดูในแกลเลอรีของ Modal
  const [galleryW, setGalleryW] = useState(GALLERY_W); // ความกว้างจริงของแกลเลอรี (วัดจาก onLayout — พอดีทั้งเว็บ/แอป)
  const [loading, setLoading] = useState(false);       // ระหว่างส่งคำขอจอง
  const [confirmingDeposit, setConfirmingDeposit] = useState(false); // กล่องยืนยันมัดจำในตัว Modal
  const [slowNotice, setSlowNotice] = useState(false); // แจ้งเตือนกลางจอเมื่อรอนานผิดปกติ (ระบบช้า/ค้าง)
  const slowNoticeTimer = useRef(null);

  // ระหว่างรอจองห้อง ถ้าเกิน 7 วิยังไม่เสร็จ ให้ขึ้นแจ้งเตือนว่าระบบกำลังช้า (ไม่ใช่แอปค้าง)
  useEffect(() => {
    if (loading) {
      slowNoticeTimer.current = setTimeout(() => setSlowNotice(true), 7000);
    } else {
      clearTimeout(slowNoticeTimer.current);
      setSlowNotice(false);
    }
    return () => clearTimeout(slowNoticeTimer.current);
  }, [loading]);

  // 1 บัญชี จองห้องรายเดือนได้ทีละ 1 ห้อง — ถ้ามีการจองรายเดือนที่ยังไม่ยกเลิกอยู่แล้ว ต้องกดยกเลิกก่อนถึงจะจองห้องใหม่ได้
  const [activeMonthlyBooking, setActiveMonthlyBooking] = useState(null);

  const text = {
    TH: {
      welcomeGuest: 'Around Loei (รายเดือน)', welcomeUser: 'สวัสดีคุณ ',
      location: 'ในเมืองเลย ใกล้ มรภ.เลย',
      home: 'กลับหน้าหลัก', logout: 'ออกจากระบบ',
      pickDateMonthly: 'ระบุวันที่ต้องการเริ่มเข้าพัก\n(สัญญากำหนดตอนเจ้าหน้าที่เช็คอิน)',
    },
    EN: {
      welcomeGuest: 'Around Loei (Monthly)', welcomeUser: 'Welcome, ',
      location: 'Loei City, near LRU',
      home: 'Back to Home', logout: 'Logout',
      pickDateMonthly: 'Select your move-in date\n(contract set at check-in)',
    },
  };
  const t = text[lang];

  // เช็คว่าบัญชีนี้มีห้องรายเดือนที่จองอยู่แล้ว (ยังไม่ยกเลิก) หรือไม่ — ถ้ามีต้องยกเลิกก่อนถึงจะจองห้องใหม่ได้
  const fetchActiveMonthlyBooking = async () => {
    try {
      const response = await api.post('/checkbooking', {});
      const bookings = response.data?.success && Array.isArray(response.data.data) ? response.data.data : [];
      const active = bookings.find((item) => {
        const status = String(item.bookingStatus || '').trim().toLowerCase();
        const isCancelled = status === 'ยกเลิก' || status === 'cancelled' || status === 'canceled';
        return item.rentType === 'monthly' && !isCancelled;
      });
      setActiveMonthlyBooking(active || null);
    } catch (e) {
      setActiveMonthlyBooking(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          if (userData) {
            setUser(JSON.parse(userData));
            fetchActiveMonthlyBooking();
          } else {
            setUser(null);
            setActiveMonthlyBooking(null);
          }
        } catch { setUser(null); }
      })();
      // รีเฟรชผังชั้นทุกครั้งที่กลับเข้าหน้านี้ — กันโชว์ห้องเป็น "ไม่ว่าง" ค้าง
      // เช่น กรณีจองไว้แล้วปล่อยให้หมดเวลา 5 นาที (ห้องถูกปล่อยคืนฝั่งเซิร์ฟเวอร์แล้วแต่หน้าจอยังไม่รู้)
      if (isDateSelected) loadAvailability(startDate);
    }, [isDateSelected, startDate])
  );

  // โหลดผังชั้น ณ วันเข้าพักที่เลือก (ใช้ทั้งตอนกดค้นหา และตอนเปลี่ยนวัน) — GET /rooms/availability?date=
  const loadAvailability = async (date) => {
    if (!date) return;
    setFetching(true);
    try {
      const res = await api.get(`/rooms/availability?date=${date}`);
      const rows = res.data?.data || [];
      setAvailability(rows);
    } catch (err) {
      setAvailability([]);
      Alert.alert('ผิดพลาด', err.response?.data?.message || 'โหลดผังห้องไม่สำเร็จ');
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  const handleConfirmInitialDate = () => {
    setIsDateSelected(true);
    setShowInitialModal(false);
    loadAvailability(startDate);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAvailability(startDate);
  };

  // เปิด popup รายละเอียดห้องจากผังชั้น (แปลงชื่อฟิลด์ให้ตรงกับที่โมดัลใช้)
  const openDetail = (row) => {
    setGalleryIndex(0);
    setDetailRoom({
      id: row.room_id,
      number: row.room_number,
      typeName: row.type_name,
      priceMonthly: row.price_monthly,
      imageUrl: row.image_url,
      floor: floorOf(row),
      images: galleryFor(row.type_name, row.image_url),
    });
  };

  // ยิงคำขอจองจริง (หลังผู้ใช้กดรับทราบนโยบายมัดจำ)
  const doBooking = async () => {
    if (!detailRoom) return;
    setConfirmingDeposit(false);
    if (!user) {
      setDetailRoom(null);
      router.push('/(auth)/login');
      return;
    }
    const roomId = detailRoom.id;
    setDetailRoom(null);   // ปิด modal ทันที แล้วโชว์ overlay หมุนโหลดกลางจอระหว่างพาไปหน้าจ่ายเงิน
    setLoading(true);
    try {
      // วันออกชั่วคราว = วันเข้าพัก + 1 เดือน (พอผ่าน overlap-check; สัญญาจริงกำหนดตอนเช็คอิน)
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + 1);
      const endDate = end.toISOString().split('T')[0];

      const res = await api.post('/booking', {
        roomId,
        startDate,
        endDate,
        rentType: 'monthly',
      });
      loadAvailability(startDate);
      // จองสำเร็จ → พาไปหน้าชำระเงิน /bill แทนการเปิด Modal ซ้อน Modal
      const b = res.data;
      router.push({
        pathname: '/bill',
        params: {
          bookingId: b.bookingId,
          bookingRef: b.bookingRef,
          roomNumber: b.roomNumber,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          bookedAt: b.bookedAt || '',
          rentType: b.rentType,
          totalPrice: b.totalPrice,
          holdExpiresAt: b.holdExpiresAt || '',
          emailSent: b.emailSent ? '1' : '0',
          beds: (String(detailRoom?.typeName || '').match(/(\d+)/) || [])[1] || '',
        }
      });
    } catch (error) {
      Alert.alert('ขออภัย', error.response?.data?.message || 'ไม่สามารถจองได้');
      loadAvailability(startDate);
      setDetailRoom(null);
    } finally {
      setLoading(false);
    }
  };

  // กด "จองห้องนี้" → แสดงกล่องเตือนนโยบายมัดจำในตัว Modal (USER_FLOWS ข้อ 3.5) → ค่อยจองจริง
  const handleConfirmBooking = () => {
    if (!detailRoom) return;
    if (activeMonthlyBooking) {
      Alert.alert(
        'จองได้แค่ 1 ห้องต่อบัญชี',
        `คุณมีห้องพักรายเดือนที่จองไว้อยู่แล้ว กรุณายกเลิกการจองเดิมก่อน ถึงจะจองห้องใหม่ได้`,
        [
          { text: 'ปิด', style: 'cancel' },
          { text: 'ไปหน้ายกเลิก', onPress: () => { setDetailRoom(null); router.push('/reservationlist'); } }
        ]
      );
      return;
    }
    setConfirmingDeposit(true);
  };

  // ปิด Modal รายละเอียดห้อง + รีเซ็ตสถานะยืนยัน
  const closeDetail = () => {
    setDetailRoom(null);
    setConfirmingDeposit(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['token', 'userProfile']);
      setUser(null);
      setShowProfileMenu(false);
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('ขออภัย', 'ไม่สามารถออกจากระบบได้');
    }
  };

  const formatDateTH = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ประเภทห้องทั้งหมด (เตียงเดี่ยว/คู่/ฯลฯ) ไว้ทำชิปกรอง — เหมือนรายวัน
  const roomTypeNames = [...new Set(availability.map((r) => r.type_name || 'ห้องพักรายเดือน'))];
  // ชั้นทั้งหมดที่มีห้องจริง (เรียง 1→4) ไว้ทำชิปกรองชั้น + สรุปจำนวนห้องว่างต่อชั้น
  const floorNumbers = [...new Set(availability.map(floorOf))].sort((a, b) => a - b);
  const availByFloor = (f) => availability.filter((r) => floorOf(r) === f && r.available).length;
  const visibleRooms = availability
    .filter((r) => r.available) // ห้องไม่ว่าง ไม่ต้องแสดง
    .filter((r) => !bedFilter || (r.type_name || 'ห้องพักรายเดือน') === bedFilter)
    .filter((r) => !floorFilter || floorOf(r) === floorFilter);
  const roomGroups = groupRoomsByFloor(visibleRooms); // การ์ดต่อห้อง แยกตามชั้น 1-4

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <SafeAreaView style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 10 }}>
        <View style={{ height: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
              <Ionicons name="arrow-back" size={18} color="#1E293B" />
            </TouchableOpacity>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: user ? '#10B981' : '#94A3B8', marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }} numberOfLines={1}>
              {user ? `${t.welcomeUser}${user.name || 'User'}` : t.welcomeGuest}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')} style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: user ? 12 : 0 }}>
              <Text style={{ color: '#64748B', fontWeight: 'bold', fontSize: 12 }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
            </TouchableOpacity>
            {user && (
              <TouchableOpacity onPress={() => setShowProfileMenu(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: '#2DD4BF' }}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%', borderRadius: 22 }} />
                ) : (
                  <Ionicons name="person" size={22} color="#7C3AED" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* เมนูโปรไฟล์ */}
      <Modal visible={showProfileMenu} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setShowProfileMenu(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ position: 'absolute', top: 86, right: 16, width: 220 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 22, padding: 12, elevation: 10 }}>
              <TouchableOpacity onPress={() => { setShowProfileMenu(false); router.replace('/(tabs)'); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="home-outline" size={18} color="#7C3AED" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>{t.home}</Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 8 }} />
              <TouchableOpacity onPress={handleLogout} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>{t.logout}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />}>
        {showInitialModal ? (
          <View style={{ padding: 25 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 20 }}>{t.pickDateMonthly}</Text>
            <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: '#7C3AED', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#EDE9FE', padding: 8, borderRadius: 12, marginRight: 15 }}>
                <Ionicons name="calendar-sharp" size={24} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '900' }}>MOVE-IN DATE</Text>
                <Text style={{ fontSize: 18, color: '#1E293B', fontWeight: '700', marginTop: 2 }}>{formatDateTH(startDate)}</Text>
              </View>
            </View>
            <View style={{ marginTop: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Calendar
                current={startDate}
                minDate={new Date().toISOString().split('T')[0]}
                onDayPress={(day) => setStartDate(day.dateString)}
                markedDates={{ [startDate]: { selected: true, selectedColor: '#7C3AED' } }}
                theme={{ todayTextColor: '#7C3AED', selectedDayBackgroundColor: '#7C3AED' }}
              />
            </View>
            <TouchableOpacity onPress={handleConfirmInitialDate} style={{ backgroundColor: '#7C3AED', marginTop: 25, paddingVertical: 18, borderRadius: 25, alignItems: 'center', elevation: 5 }}>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>ดูผังห้องว่าง</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <>
        <View style={{ height: 200, width: '100%', position: 'relative' }}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1000' }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <View style={{ position: 'absolute', bottom: 25, left: 25, right: 25 }}>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginBottom: 10 }}>
              <Ionicons name="home" size={13} color="white" />
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '900', marginLeft: 6 }}>เช่าอยู่ยาว · ทำสัญญารายเดือน</Text>
            </View>
            <Text style={{ color: 'white', fontSize: 30, fontWeight: '900' }}>Around Loei รายเดือน</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <MaterialIcons name="location-on" size={18} color="#C4B5FD" />
              <Text style={{ color: '#E2E8F0', fontSize: 14, marginLeft: 6 }}>{t.location}</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 20 }}>
          {activeMonthlyBooking && (
            <TouchableOpacity
              onPress={() => router.push('/reservationlist')}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 20, padding: 16, marginBottom: 16 }}
            >
              <Ionicons name="alert-circle" size={22} color="#EA580C" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#9A3412', fontWeight: '800', fontSize: 13 }}>คุณมีห้องพักรายเดือนที่จองไว้แล้ว</Text>
                <Text style={{ color: '#C2410C', fontSize: 12, marginTop: 2 }}>ต้องยกเลิกการจองเดิมก่อน ถึงจะจองห้องใหม่ได้ — แตะเพื่อไปหน้ายกเลิก</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#EA580C" />
            </TouchableOpacity>
          )}

          {/* แถบวันเข้าพัก + ปุ่มเปลี่ยนวัน */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '900' }}>เลือกห้องจากผังชั้น · วันเข้าพัก</Text>
              <Text style={{ fontSize: 16, color: '#1E293B', fontWeight: '800', marginTop: 2 }}>{formatDateTH(startDate)}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowInitialModal(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
              <Ionicons name="calendar-outline" size={16} color="#7C3AED" />
              <Text style={{ color: '#7C3AED', fontWeight: 'bold', fontSize: 12, marginLeft: 6 }}>เปลี่ยนวัน</Text>
            </TouchableOpacity>
          </View>

          {fetching ? (
            <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 30 }} />
          ) : availability.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#94A3B8' }}>ไม่มีข้อมูลห้อง</Text>
            </View>
          ) : (
            <>
              {/* ชิปกรองประเภทห้อง/เตียง (เหมือนรายวัน) */}
              {roomTypeNames.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 10 }}>ประเภทห้อง</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity onPress={() => setBedFilter(null)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: !bedFilter ? '#7C3AED' : '#F1F5F9' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: !bedFilter ? 'white' : '#64748B' }}>ทั้งหมด</Text>
                    </TouchableOpacity>
                    {roomTypeNames.map((tn) => {
                      const active = bedFilter === tn;
                      return (
                        <TouchableOpacity key={tn} onPress={() => setBedFilter(active ? null : tn)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: active ? '#7C3AED' : '#F1F5F9' }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: active ? 'white' : '#64748B' }}>{tn}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* เลือกชั้น (อาคาร 4 ชั้น) — การ์ดชั้นบอกจำนวนห้องว่างของแต่ละชั้น */}
              {floorNumbers.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 10 }}>เลือกชั้น (อาคาร 4 ชั้น)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
                    {/* การ์ด "ทุกชั้น" */}
                    <TouchableOpacity
                      onPress={() => setFloorFilter(null)}
                      activeOpacity={0.85}
                      style={{
                        width: 96, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center',
                        backgroundColor: !floorFilter ? '#7C3AED' : 'white',
                        borderWidth: 1.5, borderColor: !floorFilter ? '#7C3AED' : '#EEE9F8',
                        shadowColor: '#7C3AED', shadowOpacity: !floorFilter ? 0.25 : 0, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: !floorFilter ? 4 : 0,
                      }}
                    >
                      <Ionicons name="business" size={22} color={!floorFilter ? 'white' : '#7C3AED'} />
                      <Text style={{ fontSize: 14, fontWeight: '900', color: !floorFilter ? 'white' : '#1E293B', marginTop: 8 }}>ทุกชั้น</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: !floorFilter ? '#EDE9FE' : '#94A3B8', marginTop: 2 }}>ว่าง {floorNumbers.reduce((s, f) => s + availByFloor(f), 0)} ห้อง</Text>
                    </TouchableOpacity>
                    {floorNumbers.map((f) => {
                      const active = floorFilter === f;
                      const count = availByFloor(f);
                      return (
                        <TouchableOpacity
                          key={f}
                          onPress={() => setFloorFilter(active ? null : f)}
                          activeOpacity={0.85}
                          style={{
                            width: 96, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center',
                            backgroundColor: active ? '#7C3AED' : 'white',
                            borderWidth: 1.5, borderColor: active ? '#7C3AED' : '#EEE9F8',
                            shadowColor: '#7C3AED', shadowOpacity: active ? 0.25 : 0, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: active ? 4 : 0,
                          }}
                        >
                          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: active ? 'rgba(255,255,255,0.2)' : '#F5F3FF', justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: active ? 'white' : '#7C3AED' }}>{f}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: active ? 'white' : '#1E293B', marginTop: 8 }}>ชั้น {f}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#EDE9FE' : (count ? '#10B981' : '#94A3B8'), marginTop: 2 }}>ว่าง {count} ห้อง</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* การ์ดยูนิตห้อง (ต่อห้อง) แยกตามชั้น 1-4 — โทนม่วง + ข้อมูลเช่ารายเดือน */}
              {roomGroups.map((group) => (
                <View key={group.floor}>
                  {/* หัวข้อชั้น + จำนวนห้องว่าง */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 4 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center', marginRight: 12, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: 'white' }}>{group.floor}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E293B' }}>ชั้น {group.floor}</Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700', marginTop: 1 }}>มีห้องว่าง {group.rooms.filter((r) => r.available).length} ห้อง</Text>
                    </View>
                    <View style={{ backgroundColor: '#F5F3FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#DDD6FE' }}>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: '#6D28D9' }}>{group.rooms.length} ห้อง</Text>
                    </View>
                  </View>
                  {group.rooms.map((room, idx) => {
                const available = room.available;
                const img = room.image_url || ROOM_IMAGES[idx % ROOM_IMAGES.length];
                return (
                  <View
                    key={room.room_id}
                    style={{
                      backgroundColor: 'white', borderRadius: 24, marginBottom: 18, overflow: 'hidden',
                      borderWidth: 1, borderColor: '#EEE9F8',
                      shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
                      opacity: available ? 1 : 0.6,
                    }}
                  >
                    {/* รูปห้อง + ป้ายสถานะ/ชั้น */}
                    <View style={{ height: 168, width: '100%', position: 'relative' }}>
                      <Image source={{ uri: img }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.12)' }} />
                      <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: available ? '#7C3AED' : '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }}>{available ? 'ว่าง' : 'ไม่ว่าง'}</Text>
                      </View>
                      <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 }}>
                        <Ionicons name="layers-outline" size={13} color="#7C3AED" />
                        <Text style={{ color: '#6D28D9', fontSize: 12, fontWeight: '900', marginLeft: 5 }}>ชั้น {group.floor}</Text>
                      </View>
                    </View>

                    <View style={{ padding: 18 }}>
                      {/* ประเภท */}
                      <Text style={{ fontSize: 19, fontWeight: '900', color: '#1E293B' }}>{room.type_name || 'ห้องพักรายเดือน'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <Ionicons name="home-outline" size={15} color="#7C3AED" />
                        <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700', marginLeft: 5 }}>เช่าอยู่ยาว · ทำสัญญารายเดือน</Text>
                      </View>

                      {/* สิ่งอำนวยความสะดวก */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                        {AMENITIES.map((a) => (
                          <View key={a} style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 7 }}>
                            <Ionicons name="checkmark-circle" size={15} color="#8B5CF6" />
                            <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600', marginLeft: 6 }} numberOfLines={1}>{a}</Text>
                          </View>
                        ))}
                      </View>

                      {/* กล่องมัดจำล็อกห้อง */}
                      <View style={{ marginTop: 6, marginBottom: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 12, paddingVertical: 10 }}>
                        <Ionicons name="lock-closed" size={15} color="#7C3AED" />
                        <Text style={{ fontSize: 12, color: '#6D28D9', fontWeight: '700', marginLeft: 8 }}>มัดจำล็อกห้อง ฿{DEPOSIT_LOCK.toLocaleString()} · ค่าเช่า/มัดจำสัญญาเก็บตอนเช็คอิน</Text>
                      </View>

                      {/* ราคา + ปุ่มจอง */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <View>
                          {available ? (
                            <>
                              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700' }}>ค่าเช่า</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 24, fontWeight: '900', color: '#7C3AED' }}>฿{Number(room.price_monthly || 0).toLocaleString()}</Text>
                                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700', marginLeft: 4, marginBottom: 3 }}>/เดือน</Text>
                              </View>
                            </>
                          ) : (
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#EF4444' }}>ห้องไม่ว่าง</Text>
                          )}
                        </View>

                        {available && (
                          <TouchableOpacity
                            onPress={() => openDetail(room)}
                            activeOpacity={0.85}
                            style={{ backgroundColor: '#7C3AED', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 18, flexDirection: 'row', alignItems: 'center' }}
                          >
                            <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginRight: 5 }}>จองห้องนี้</Text>
                            <Ionicons name="chevron-forward-circle" size={18} color="white" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
                  })}
                </View>
              ))}
              {visibleRooms.length === 0 && (
                <Text style={{ color: '#94A3B8', paddingVertical: 10 }}>ไม่มีห้องตรงกับตัวกรอง</Text>
              )}
            </>
          )}

          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 20, marginBottom: 40, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Ionicons name="home-outline" size={20} color="#7C3AED" />
            <Text style={{ marginLeft: 10, color: '#7C3AED', fontWeight: 'bold' }}>กลับสู่หน้าหลัก</Text>
          </TouchableOpacity>
        </View>
        </>
        )}
      </ScrollView>

      {/* รายละเอียดห้อง + ปุ่มจองห้องนี้ */}
      <Modal visible={detailRoom !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', height: '72%' }}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View
                style={{ position: 'relative', width: '100%' }}
                onLayout={(e) => setGalleryW(e.nativeEvent.layout.width)}
              >
                {/* แกลเลอรีรูปห้องหลายรูป (เลื่อนแนวนอน) ตามประเภทห้อง — กว้างตามกล่องจริงจึงพอดีทั้งเว็บ/แอป */}
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / galleryW))}
                  scrollEventThrottle={16}
                >
                  {(detailRoom?.images?.length ? detailRoom.images : ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1000']).map((uri, i) => (
                    <Image key={i} source={{ uri }} style={{ width: galleryW, height: 260, resizeMode: 'cover' }} />
                  ))}
                </ScrollView>
                {/* จุดบอกตำแหน่งรูป */}
                {(detailRoom?.images?.length || 0) > 1 && (
                  <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
                    {detailRoom.images.map((_, i) => (
                      <View key={i} style={{ width: galleryIndex === i ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: galleryIndex === i ? '#7C3AED' : 'rgba(255,255,255,0.75)' }} />
                    ))}
                  </View>
                )}
                {/* ป้ายจำนวนรูป */}
                <View style={{ position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                  <Ionicons name="images-outline" size={13} color="white" />
                  <Text style={{ color: 'white', fontSize: 11, fontWeight: '800', marginLeft: 5 }}>{(galleryIndex + 1)}/{detailRoom?.images?.length || 1}</Text>
                </View>
                <TouchableOpacity onPress={closeDetail} style={{ position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 8 }}>
                  <Ionicons name="close" size={22} color="white" />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 25 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: '#1E293B' }}>{detailRoom?.typeName || 'ห้องพักรายเดือน'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Ionicons name="layers-outline" size={14} color="#7C3AED" />
                      <Text style={{ color: '#7C3AED', marginLeft: 5, fontSize: 13, fontWeight: '700' }}>ห้องพักรายเดือน · ชั้น {detailRoom?.floor}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: '#7C3AED' }}>฿{Number(detailRoom?.priceMonthly || 0).toLocaleString()}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', fontWeight: 'bold' }}> /เดือน</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#64748B', marginBottom: 8 }}>ข้อมูลเงื่อนไขสัญญาเช่า</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ color: '#94A3B8' }}>วันที่เริ่มเข้าพัก:</Text>
                    <Text style={{ fontWeight: '700', color: '#1E293B' }}>{formatDateTH(startDate)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#94A3B8' }}>ระยะเวลาสัญญา:</Text>
                    <Text style={{ fontWeight: '700', color: '#1E293B' }}>กำหนดตอนเช็คอิน</Text>
                  </View>
                </View>
                <View style={{ marginTop: 16, padding: 16, backgroundColor: '#F0FDF4', borderRadius: 18, borderWidth: 1, borderColor: '#BBF7D0' }}>
                  <Text style={{ color: '#15803D', fontSize: 13, fontWeight: '700' }}>จองห้องนี้ต้องชำระมัดจำล็อกห้อง 2,000 บาท เพื่อกันห้องไว้</Text>
                  <Text style={{ color: '#16A34A', fontSize: 12, marginTop: 4 }}>ค่าเช่าและมัดจำสัญญาที่เหลือเก็บตอนเจ้าหน้าที่เช็คอิน</Text>
                </View>
                {user ? (
                  confirmingDeposit ? (
                    // กล่องยืนยันนโยบายมัดจำในตัว Modal (แทน Alert ที่ไม่แสดงบน iOS)
                    <View style={{ marginTop: 20, marginBottom: 40, padding: 18, backgroundColor: '#FFF7ED', borderRadius: 20, borderWidth: 1, borderColor: '#FED7AA' }}>
                      <Text style={{ color: '#9A3412', fontWeight: '800', fontSize: 14, marginBottom: 4 }}>⚠️ นโยบายการยกเลิก</Text>
                      <Text style={{ color: '#C2410C', fontSize: 13, lineHeight: 20, marginBottom: 14 }}>หากยกเลิกการจองภายหลัง จะไม่ได้รับเงินมัดจำคืน — ยืนยันการจองห้องพักรายเดือนนี้?</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity disabled={loading} onPress={() => setConfirmingDeposit(false)} style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}>
                          <Text style={{ color: '#64748B', fontWeight: '800' }}>ยกเลิก</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={loading} onPress={doBooking} style={{ flex: 2, backgroundColor: '#7C3AED', paddingVertical: 14, borderRadius: 16, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
                          {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '900' }}>ยอมรับ และจองเลย</Text>}
                        </TouchableOpacity>
                      </View>
                      {slowNotice && (
                        <View style={{ marginTop: 14, padding: 12, backgroundColor: '#FEF3C7', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', alignItems: 'center' }}>
                          <Text style={{ color: '#92400E', fontWeight: '800', fontSize: 13, textAlign: 'center' }}>⏳ ระบบกำลังใช้เวลานานกว่าปกติ</Text>
                          <Text style={{ color: '#B45309', fontSize: 12, marginTop: 4, textAlign: 'center' }}>กรุณารอสักครู่ ระบบกำลังพยายามทำรายการอยู่</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity disabled={loading} onPress={handleConfirmBooking} style={{ backgroundColor: '#7C3AED', paddingVertical: 18, borderRadius: 22, alignItems: 'center', marginTop: 25, marginBottom: 40, elevation: 5 }}>
                      {loading ? <ActivityIndicator color="white" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: 'white', fontSize: 16, fontWeight: '900', marginRight: 8 }}>จองห้องนี้ (ทำสัญญารายเดือน)</Text>
                          <Ionicons name="chevron-forward-circle" size={20} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                ) : (
                  <TouchableOpacity onPress={() => { setDetailRoom(null); router.push('/(auth)/login'); }} style={{ backgroundColor: '#FF7043', paddingVertical: 18, borderRadius: 22, alignItems: 'center', marginTop: 25, marginBottom: 40 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="log-in-outline" size={22} color="white" style={{ marginRight: 8 }} />
                      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>กรุณาเข้าสู่ระบบก่อนทำการจองห้องพัก</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Overlay หมุนโหลดเต็มจอ — โชว์ระหว่างทำรายการจองและพาไปหน้าชำระเงิน */}
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 9999 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, paddingVertical: 28, paddingHorizontal: 36, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 20 }}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={{ marginTop: 16, fontSize: 15, fontWeight: '900', color: '#1E293B' }}>กำลังทำรายการจอง…</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>กำลังพาไปหน้าชำระเงิน</Text>
            {slowNotice && (
              <View style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FEF3C7', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', maxWidth: 240 }}>
                <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>⏳ ระบบใช้เวลานานกว่าปกติ</Text>
                <Text style={{ color: '#B45309', fontSize: 11, marginTop: 2, textAlign: 'center' }}>กรุณารอสักครู่ อย่าเพิ่งปิดแอป</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
