import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  ActivityIndicator, Alert, StatusBar, SafeAreaView, RefreshControl
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';

// แยกข้อมูลเตียง/จำนวนคนพักจากชื่อประเภทห้อง (typeName) — ไม่มีฟิลด์ capacity ใน DB
// กติกา: ห้อง 3 เตียง เข้าพักได้ 3 คน · ห้องอื่นๆ เข้าพักได้ 2 คน
function bedInfoOf(typeName) {
  const label = String(typeName || '').trim() || 'ห้องมาตรฐาน';
  const m = label.match(/(\d+)/);           // ดึงตัวเลขเตียงจากชื่อ เช่น "3 เตียง" → 3
  const beds = m ? Number(m[1]) : 1;
  const capacity = beds >= 3 ? 3 : 2;       // 3 เตียง = 3 คน, อื่นๆ = 2 คน
  return { label, beds, capacity };
}

// สิ่งอำนวยความสะดวกมาตรฐานของทุกห้อง (โชว์เป็นเช็กลิสต์ในการ์ด สไตล์ Agoda)
const AMENITIES = ['ฟรี WiFi', 'เครื่องปรับอากาศ', 'ห้องน้ำส่วนตัว', 'ทีวีดาวเทียม', 'ตู้เย็น', 'ที่จอดรถ'];

// รูปประกอบการ์ดแต่ละประเภท (สุ่มจากชุดรูปตามลำดับประเภท)
const ROOM_IMAGES = [
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800',
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=800',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800',
];

// จัดกลุ่มห้องตามประเภท (label) — คืนอาร์เรย์การ์ด: ประเภท, ความจุ, รายการห้อง, จำนวนว่าง, ราคาต่ำสุด
function groupByType(rooms) {
  const map = new Map();
  for (const r of rooms) {
    const info = bedInfoOf(r.typeName);
    if (!map.has(info.label)) map.set(info.label, { label: info.label, capacity: info.capacity, beds: info.beds, rooms: [] });
    map.get(info.label).rooms.push(r);
  }
  return [...map.values()].map((g) => {
    const availRooms = g.rooms.filter((r) => r.status === 'ว่าง');
    const prices = availRooms.map((r) => Number(r.price || 0)).filter((p) => p > 0);
    return { ...g, availableCount: availRooms.length, minPrice: prices.length ? Math.min(...prices) : 0 };
  });
}

export default function DailyReservationScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [roomsData, setRoomsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [slowNotice, setSlowNotice] = useState(false); // แจ้งเตือนกลางจอเมื่อรอนานผิดปกติ (ระบบช้า/ค้าง)
  const slowNoticeTimer = useRef(null);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  // แสดงกล่องยืนยันนโยบายมัดจำในตัว Modal (ไม่ใช้ Alert ซ้อน Modal — iOS ไม่แสดง)
  const [confirmingDeposit, setConfirmingDeposit] = useState(false);

  const [showInitialModal, setShowInitialModal] = useState(true);
  const [isDateSelected, setIsDateSelected] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]);
  const [showStartPicker, setShowStartPicker] = useState(true);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // ---- ตัวเลือกสไตล์ Agoda: จำนวนผู้เข้าพัก / จำนวนห้อง / ประเภทเตียง ----
  const [guests, setGuests] = useState(0);          // จำนวนผู้เข้าพักทั้งหมด (เริ่มที่ 0 — กรอกในหน้าดูห้อง)
  const [roomsWanted, setRoomsWanted] = useState(0); // จำนวนห้องที่ต้องการจอง (เริ่มที่ 0)
  const [bedFilter, setBedFilter] = useState(null);  // กรองตามประเภทเตียง (typeName) — null = ทั้งหมด
  const [selectedRoomIds, setSelectedRoomIds] = useState([]); // ห้องที่เลือกไว้ (จองหลายห้อง)
  const [showConfirm, setShowConfirm] = useState(false); // กล่องสรุป+ยืนยันการจองรวม
  const [openedType, setOpenedType] = useState(null); // ประเภทที่กดเข้าไปดูห้องทีละห้อง (null = หน้าเลือกประเภท)
  const [countConfirmed, setCountConfirmed] = useState(false); // กดยืนยันจำนวนคน/ห้องแล้ว → ห้องถึงจะโผล่

  const text = {
    TH: {
      welcomeGuest: 'Around Loei (รายวัน)',
      welcomeUser: 'สวัสดีคุณ ',
      location: 'ในเมืองเลย ใกล้ มรภ.เลย',
      selectTitle: 'ห้องว่างสำหรับวันที่',
      floor: 'ชั้นที่ ', available: 'ว่างพร้อมจอง', backHome: 'เปลี่ยนวันที่เข้าพัก',
      unitD: ' /คืน', confirmBtn: 'ยืนยันการจองรายวันตอนนี้',
      loginRequiredBtn: 'กรุณาเข้าสู่ระบบก่อนทำการจองห้องพัก',
      success: 'จองสำเร็จ!', viewList: 'ดูรายการจองของคุณ',
      desc: 'สัมผัสประสบการณ์การพักผ่อนระดับพรีเมียม สไตล์มินิมอล พร้อมสิ่งอำนวยความสะดวกครบครัน รูปแบบรายวันข้ามคืน',
      fail: 'ไม่สามารถจองได้',
      pickDateDaily: 'ระบุวันที่เข้าพักและวันที่ออก',
      goBack: 'กลับสู่หน้าหลัก',
      home: 'กลับหน้าหลัก',
      logout: 'ออกจากระบบ'
    },
    EN: {
      welcomeGuest: 'Around Loei (Daily)',
      welcomeUser: 'Welcome, ',
      location: 'Loei City, near LRU',
      selectTitle: 'Available Rooms for',
      floor: 'Floor ', available: 'Vacant', backHome: 'Change Date',
      unitD: ' /day', confirmBtn: 'Book Now',
      loginRequiredBtn: 'Please Login to Continue Booking',
      desc: 'Experience premium living with minimalist style and 24h security. Daily stay package.',
      fail: 'Booking failed',
      pickDateDaily: 'Select Check-in & Check-out Date',
      goBack: 'Back to Home',
      home: 'Back to Home',
      logout: 'Logout'
    }
  };

  const t = text[lang];

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
          setUser(null);
        }
      };
      checkUserStatus();
      // รีเฟรชผังห้องทุกครั้งที่กลับเข้าหน้านี้ — กันโชว์ห้องเป็น "ไม่ว่าง" ค้าง
      // เช่น กรณีจองไว้แล้วปล่อยให้หมดเวลา 5 นาที (ห้องถูกปล่อยคืนฝั่งเซิร์ฟเวอร์แล้วแต่หน้าจอยังไม่รู้)
      if (isDateSelected) fetchRooms();
      else fetchAllRooms();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDateSelected, startDate, endDate])
  );

  const fetchRooms = async () => {
    if (!isDateSelected) return;
    setFetching(true);
    try {
      const response = await api.post('/search-rooms', { checkIn: startDate, checkOut: endDate });
      setRoomsData(response.data?.data || []);
    } catch (error) {
      setRoomsData([]);
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  const fetchAllRooms = async () => {
    try {
      setFetching(true);
      const response = await api.get('/getRoom');
      setRoomsData(response.data?.data || []);
    } catch (error) {
      setRoomsData([]);
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isDateSelected) fetchRooms();
  }, [isDateSelected, startDate, endDate]);

  useEffect(() => {
    if (!isDateSelected) {
      fetchAllRooms();
    }
  }, [isDateSelected]);

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (isDateSelected) fetchRooms();
    else fetchAllRooms();
  }, [startDate, endDate, isDateSelected]);

  const handleConfirmInitialDate = () => {
    setIsDateSelected(true);
    setShowInitialModal(false);
  };

  const formatDateTH = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ยิงคำขอจองหลายห้องพร้อมกัน (เรียกหลังผู้ใช้กดรับทราบนโยบายมัดจำแล้ว)
  const doBooking = async () => {
    if (selectedRoomIds.length === 0) return;
    setConfirmingDeposit(false);
    setShowConfirm(false);   // ปิดกล่องยืนยันทันที แล้วโชว์ overlay หมุนโหลดเต็มจอระหว่างพาไปหน้าจ่ายเงิน
    setLoading(true);
    try {
      // token แนบอัตโนมัติจาก interceptor ใน lib/api.js — จองทุกห้องในทรานแซกชันเดียว
      const res = await api.post('/booking/batch', {
        roomIds: selectedRoomIds,
        startDate: startDate,
        endDate: endDate,
      });
      const b = res.data;
      setShowConfirm(false);
      setSelectedRoomIds([]);
      fetchRooms();
      // จองสำเร็จ → พาไปหน้าชำระเงิน /bill (โหมดรวมจ่าย)
      router.push({
        pathname: '/bill',
        params: {
          bookingIds: (b.bookings || []).map((x) => x.bookingId).join(','),
          bookingRef: (b.bookings || []).map((x) => x.bookingRef).join(', '),
          roomNumbers: (b.bookings || []).map((x) => x.roomNumber).join(', '),
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          bookedAt: b.bookedAt || '',
          rentType: b.rentType,
          totalPrice: b.totalPrice,
          holdExpiresAt: b.holdExpiresAt || '',
          emailSent: b.emailSent ? '1' : '0',
          beds: selectedRooms[0] ? bedInfoOf(selectedRooms[0].typeName).beds : '',
        }
      });
    } catch (error) {
      Alert.alert("ขออภัย", error.response?.data?.message || t.fail);
      fetchRooms();
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  // กดยืนยันจอง → แสดงกล่องเตือนนโยบายมัดจำในตัว Modal (USER_FLOWS ข้อ 4.5) → ค่อยจองจริง
  const handleConfirmBooking = () => {
    if (selectedRoomIds.length === 0) return;
    setConfirmingDeposit(true);
  };

  // สลับเลือก/ยกเลิกเลือกห้อง (จองหลายห้อง) — จำกัดไม่เกินจำนวนห้องที่ต้องการ
  const toggleRoom = (roomId) => {
    setSelectedRoomIds((prev) => {
      if (prev.includes(roomId)) return prev.filter((x) => x !== roomId);
      if (prev.length >= roomsWanted) {
        // เลือกครบตามจำนวนห้องที่ตั้งไว้แล้ว
        Alert.alert('เลือกครบแล้ว', `คุณเลือกจะจอง ${roomsWanted} ห้อง หากต้องการเพิ่ม กรุณาปรับจำนวนห้องด้านบน`);
        return prev;
      }
      return [...prev, roomId];
    });
  };

  // ปิดกล่องยืนยันการจองรวม + รีเซ็ตสถานะยืนยัน
  const closeRoomModal = () => {
    setShowConfirm(false);
    setConfirmingDeposit(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['token', 'userProfile']);
      setUser(null);
      setShowProfileMenu(false);
      router.replace('/(auth)/login');
    } catch (e) {
      Alert.alert('ขออภัย', 'ไม่สามารถออกจากระบบได้');
    }
  };

  // รายวัน: ห้องที่ "มีราคารายวัน" (price != null) — โชว์เป็นผังชั้นแบบเดียวกับรายเดือน (ว่าง/ไม่ว่าง)
  const dailyRooms = roomsData.filter(room => room.price != null);
  // ประเภทเตียงทั้งหมด (จาก typeName) ไว้ทำ chip กรอง
  const bedTypes = [...new Set(dailyRooms.map((r) => bedInfoOf(r.typeName).label))];
  // จำนวนคืน (ใช้คิดยอดรวมพรีวิว)
  const nights = Math.max(1, Math.ceil(Math.abs(new Date(endDate) - new Date(startDate)) / 86400000));
  // ห้องที่แสดงในผัง — ทุกห้อง กรองตามประเภทเตียงที่เลือก
  const visibleRooms = dailyRooms
    .filter((r) => !bedFilter || bedInfoOf(r.typeName).label === bedFilter);
  // จัดกลุ่มเป็นการ์ดตามประเภทห้อง (สไตล์ Agoda)
  const roomTypes = groupByType(visibleRooms);

  // เพิ่มห้องของประเภทนี้ 1 ห้อง (เลือกห้องว่างที่ยังไม่ถูกเลือก) — reuse toggleRoom เพื่อคงลิมิตจำนวนห้อง
  const addRoomOfType = (group) => {
    const next = group.rooms.find((r) => r.status === 'ว่าง' && !selectedRoomIds.includes(r.id));
    if (next) toggleRoom(next.id);
  };
  // ลดห้องของประเภทนี้ 1 ห้อง (เอาห้องที่เลือกล่าสุดของประเภทนี้ออก)
  const removeRoomOfType = (group) => {
    const chosen = group.rooms.filter((r) => selectedRoomIds.includes(r.id));
    if (chosen.length) toggleRoom(chosen[chosen.length - 1].id);
  };
  // ห้องที่ถูกเลือกไว้ (ทุกชั้น) + ยอดรวมพรีวิว
  const selectedRooms = dailyRooms.filter((r) => selectedRoomIds.includes(r.id));
  const selectedTotal = selectedRooms.reduce((sum, r) => sum + Number(r.price || 0) * nights, 0);
  const selectedCapacity = selectedRooms.reduce((sum, r) => sum + bedInfoOf(r.typeName).capacity, 0);

  // กติกาความจุ: 1 ห้องพักได้สูงสุด 2 คน — จำนวนห้องปรับได้อิสระ 0..เพดานบัญชี
  const MAX_PER_ROOM = 2;
  const MAX_ROOMS_PER_ACCOUNT = 5;   // 1 บัญชีจองได้สูงสุด 5 ห้อง/การจอง (กันกักห้อง)
  const roomsMin = 0;                 // เริ่มที่ 0 ห้อง
  const roomsMax = MAX_ROOMS_PER_ACCOUNT; // สูงสุดตามเพดานบัญชี (5 ห้อง)

  // ปรับจำนวนผู้เข้าพัก — เปลี่ยนเฉพาะจำนวนคน (0..20)
  const changeGuests = (delta) => {
    setGuests((g) => Math.min(20, Math.max(0, g + delta)));
  };
  // ปรับจำนวนห้อง — อิสระในช่วง 0..5 ห้อง
  const changeRooms = (delta) => {
    setRoomsWanted((rw) => {
      const next = Math.min(roomsMax, Math.max(roomsMin, rw + delta));
      setSelectedRoomIds((ids) => ids.slice(0, next)); // ลดห้อง → ตัดห้องที่เลือกเกินออก
      return next;
    });
  };

  // ตรวจความถูกต้องของจำนวนคน/ห้อง ก่อนกดยืนยันให้ห้องโผล่
  // - กติกาเดียว: ผู้เข้าพักอย่างน้อย 1 คน/ห้อง (คน ≥ จำนวนห้อง)
  // - จึงจองคนเดียวในห้อง 2/3 เตียงได้ (เผื่อฉุกเฉิน เช่น 1 เตียงเต็ม) · แต่ 2 ห้อง 1 คน จะโดนเตือน
  const minGuests = roomsWanted; // ต้องมีคนอย่างน้อยเท่าจำนวนห้อง
  const countError =
    roomsWanted < 1
      ? 'กรุณากดเพิ่มจำนวนห้องและจำนวนคนเพื่อจองห้อง'
      : guests < 1
      ? 'กรุณาเพิ่มจำนวนผู้เข้าพัก'
      : guests < minGuests
      ? `ห้องประเภทนี้ต้องมีผู้เข้าพัก ${minGuests} คนขึ้นไป`
      : '';
  const canConfirmCount = countError === '';

  // เปิดประเภท → รีเซ็ตจำนวนคน/ห้องเป็น 0 และให้กรอกใหม่ในหน้าดูห้อง
  const openType = (label) => {
    setOpenedType(label);
    setCountConfirmed(false);
    setGuests(0);
    setRoomsWanted(0);
    setSelectedRoomIds([]);
  };
  // ย้อนกลับไปหน้าเลือกประเภท → ล้างสถานะการเลือกทั้งหมด
  const closeType = () => {
    setOpenedType(null);
    setCountConfirmed(false);
    setGuests(0);
    setRoomsWanted(0);
    setSelectedRoomIds([]);
  };

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
  <TouchableOpacity
    onPress={() => setShowProfileMenu(true)}
    style={{
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#E0F2FE',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2.5,
      borderColor: '#2DD4BF',
      overflow: 'hidden',
      position: 'relative'
    }}
  >
    <View style={{
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#D9F3FF',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#A7F3D0'
    }}>
      {user?.avatar ? (
        <Image
          source={{ uri: user.avatar }}
          style={{ width: '100%', height: '100%', borderRadius: 17 }}
        />
      ) : (
        <Ionicons name="person" size={22} color="#0194F3" />
      )}
    </View>

    <View style={{
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#22C55E',
      borderWidth: 2,
      borderColor: 'white'
    }} />
  </TouchableOpacity>
)}
          </View>
        </View>
      </SafeAreaView>

      <Modal visible={showProfileMenu} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowProfileMenu(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
          <View style={{ position: 'absolute', top: 86, right: 16, width: 220 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 22, padding: 12, elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              <TouchableOpacity
                onPress={() => {
                  setShowProfileMenu(false);
                  router.replace('/(tabs)');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="home-outline" size={18} color="#0194F3" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>{t.home}</Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 8 }} />

              <TouchableOpacity
                onPress={handleLogout}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>{t.logout}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0194F3']} />}>
        {showInitialModal ? (
          <View style={{ padding: 25 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 20 }}>{t.pickDateDaily}</Text>
            <TouchableOpacity onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }} style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: showStartPicker ? '#0194F3' : '#E2E8F0', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#E0F2FE', padding: 8, borderRadius: 12, marginRight: 15 }}>
                <Ionicons name="calendar-sharp" size={24} color="#0194F3" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '900' }}>CHECK-IN DATE</Text>
                <Text style={{ fontSize: 18, color: '#1E293B', fontWeight: '700', marginTop: 2 }}>{formatDateTH(startDate)}</Text>
              </View>
            </TouchableOpacity>
            {showStartPicker && (
              <View style={{ marginTop: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Calendar
                  current={startDate}
                  minDate={new Date().toISOString().split('T')[0]}
                  onDayPress={day => {
                    setStartDate(day.dateString);
                    setShowStartPicker(false);
                    setShowEndPicker(true);
                    if (day.dateString >= endDate) {
                      const nextDay = new Date(day.timestamp);
                      nextDay.setDate(nextDay.getDate() + 1);
                      setEndDate(nextDay.toISOString().split('T')[0]);
                    }
                  }}
                  markedDates={{ [startDate]: { selected: true, selectedColor: '#0194F3' } }}
                  theme={{ todayTextColor: '#0194F3', selectedDayBackgroundColor: '#0194F3' }}
                />
              </View>
            )}
            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }} style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: showEndPicker ? '#F43F5E' : '#E2E8F0', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#FFF1F2', padding: 8, borderRadius: 12, marginRight: 15 }}>
                <Ionicons name="exit-sharp" size={24} color="#F43F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '900' }}>CHECK-OUT DATE</Text>
                <Text style={{ fontSize: 18, color: '#1E293B', fontWeight: '700', marginTop: 2 }}>{formatDateTH(endDate)}</Text>
              </View>
            </TouchableOpacity>
            {showEndPicker && (
              <View style={{ marginTop: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Calendar
                  current={endDate}
                  minDate={startDate}
                  onDayPress={day => {
                    setEndDate(day.dateString);
                    setShowEndPicker(false);
                  }}
                  markedDates={{ [endDate]: { selected: true, selectedColor: '#F43F5E' } }}
                  theme={{ todayTextColor: '#F43F5E', selectedDayBackgroundColor: '#F43F5E' }}
                />
              </View>
            )}
            <TouchableOpacity onPress={handleConfirmInitialDate} style={{ backgroundColor: '#0194F3', marginTop: 30, paddingVertical: 18, borderRadius: 25, alignItems: 'center', elevation: 5 }}>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>ยืนยันวันที่และค้นหาห้องว่าง</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <>
        <View style={{ height: 220, width: '100%', position: 'relative' }}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1590490359683-658d3d23f972?q=80&w=1000' }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
          <View style={{ position: 'absolute', bottom: 30, left: 25 }}>
            <Text style={{ color: 'white', fontSize: 32, fontWeight: '900' }}>Around Loei รายวัน</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <MaterialIcons name="location-on" size={18} color="#0194F3" />
              <Text style={{ color: '#E2E8F0', fontSize: 14, marginLeft: 6 }}>{t.location}</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 25 }}>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B' }}>{t.selectTitle}</Text>
            <Text style={{ fontSize: 15, color: '#0194F3', fontWeight: '700', marginTop: 4 }}>
              {formatDateTH(startDate)} - {formatDateTH(endDate)}
            </Text>
          </View>

          {/* ตัวกรองประเภทเตียง — แสดงเฉพาะหน้าเลือกประเภท (ตัวเลือกจำนวนคน/ห้องย้ายไปหน้าดูห้อง) */}
          {openedType == null && bedTypes.length > 0 && (
            <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 10 }}>ประเภทเตียง</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity onPress={() => setBedFilter(null)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: !bedFilter ? '#0194F3' : '#F1F5F9' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: !bedFilter ? 'white' : '#64748B' }}>ทั้งหมด</Text>
                </TouchableOpacity>
                {bedTypes.map((bt) => {
                  const active = bedFilter === bt;
                  return (
                    <TouchableOpacity key={bt} onPress={() => setBedFilter(active ? null : bt)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: active ? '#0194F3' : '#F1F5F9' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? 'white' : '#64748B' }}>{bt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {fetching ? (
            <ActivityIndicator size="large" color="#0194F3" style={{ marginTop: 30 }} />
          ) : dailyRooms.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#94A3B8' }}>ไม่พบห้องว่างสำหรับรายวันในช่วงเวลาดังกล่าว</Text>
            </View>
          ) : (
            <>
              {openedType == null ? (
                <>
                  {/* หน้าเลือกประเภท — การ์ดสรุปต่อประเภท กดเข้าไปดูห้องทีละห้อง */}
                  {roomTypes.map((group, idx) => {
                    const img = ROOM_IMAGES[idx % ROOM_IMAGES.length];
                    const soldOut = group.availableCount === 0;
                    const pickedCount = group.rooms.filter((r) => selectedRoomIds.includes(r.id)).length;
                    return (
                      <TouchableOpacity
                        key={group.label}
                        activeOpacity={0.9}
                        onPress={() => openType(group.label)}
                        style={{
                          backgroundColor: 'white', borderRadius: 24, marginBottom: 18, overflow: 'hidden',
                          borderWidth: 1, borderColor: '#EEF3F8',
                          shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
                          opacity: soldOut ? 0.6 : 1,
                        }}
                      >
                        {/* รูปห้อง + ป้ายสถานะ */}
                        <View style={{ height: 168, width: '100%', position: 'relative' }}>
                          <Image source={{ uri: img }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.12)' }} />
                          <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: soldOut ? '#EF4444' : '#0194F3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
                            <Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }}>
                              {soldOut ? 'เต็มแล้ว' : `เหลือ ${group.availableCount} ห้อง`}
                            </Text>
                          </View>
                          {pickedCount > 0 && (
                            <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
                              <Ionicons name="checkmark-circle" size={14} color="white" />
                              <Text style={{ color: 'white', fontSize: 12, fontWeight: '900', marginLeft: 4 }}>เลือก {pickedCount}</Text>
                            </View>
                          )}
                        </View>

                        <View style={{ padding: 18 }}>
                          {/* ชื่อประเภท + ความจุ */}
                          <Text style={{ fontSize: 19, fontWeight: '900', color: '#1E293B' }}>{group.label}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <Ionicons name="people-outline" size={15} color="#0194F3" />
                            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700', marginLeft: 5 }}>เข้าพักได้สูงสุด {group.capacity} คน</Text>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 8 }} />
                            <Ionicons name="bed-outline" size={15} color="#0194F3" />
                            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700', marginLeft: 5 }}>{group.beds} เตียง</Text>
                          </View>

                          {/* สิ่งอำนวยความสะดวก (เช็กลิสต์) */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                            {AMENITIES.map((a) => (
                              <View key={a} style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 7 }}>
                                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                                <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600', marginLeft: 6 }} numberOfLines={1}>{a}</Text>
                              </View>
                            ))}
                          </View>

                          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 }} />

                          {/* ราคา + ปุ่มเข้าไปดูห้อง */}
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            <View>
                              {soldOut ? (
                                <Text style={{ fontSize: 15, fontWeight: '900', color: '#EF4444' }}>ไม่มีห้องว่าง</Text>
                              ) : (
                                <>
                                  <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700' }}>เริ่มต้น</Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#0194F3' }}>฿{group.minPrice.toLocaleString()}</Text>
                                    <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700', marginLeft: 4, marginBottom: 3 }}>/คืน</Text>
                                  </View>
                                </>
                              )}
                            </View>

                            <View style={{ backgroundColor: soldOut ? '#F1F5F9' : '#0194F3', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 18, flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ color: soldOut ? '#94A3B8' : 'white', fontSize: 15, fontWeight: '900', marginRight: 5 }}>ดูห้อง</Text>
                              <Ionicons name="chevron-forward-circle" size={18} color={soldOut ? '#94A3B8' : 'white'} />
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {roomTypes.length === 0 && (
                    <Text style={{ color: '#94A3B8', paddingVertical: 10 }}>ไม่มีห้องตรงกับตัวกรอง</Text>
                  )}
                </>
              ) : (
                (() => {
                  // เข้าไปดูห้องทีละห้อง เฉพาะประเภทที่เลือก (เรียงตามหมายเลขห้อง) — สไตล์เดียวกับหน้ารายเดือน
                  const openedRooms = dailyRooms
                    .filter((r) => bedInfoOf(r.typeName).label === openedType)
                    .sort((a, b) => Number(a.roomNumber || 0) - Number(b.roomNumber || 0) || String(a.roomNumber || '').localeCompare(String(b.roomNumber || '')));
                  const availCount = openedRooms.filter((r) => r.status === 'ว่าง').length;
                  const cap = bedInfoOf(openedType).capacity;
                  // ห้องที่ให้เลือก = ห้องว่างของประเภทนี้ ตัดตามจำนวนห้องที่ระบุ (1 ห้อง → โผล่ 1 ห้อง)
                  const availableRooms = openedRooms.filter((r) => r.status === 'ว่าง');
                  const displayRooms = availableRooms.slice(0, roomsWanted);
                  return (
                    <>
                      {/* หัวข้อประเภท + ปุ่มย้อนกลับไปหน้าเลือกประเภท */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <TouchableOpacity onPress={closeType} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Ionicons name="arrow-back" size={20} color="#0194F3" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E293B' }}>{openedType}</Text>
                          <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700', marginTop: 2 }}>ว่าง {availCount} จาก {openedRooms.length} ห้อง · พักได้ {cap} คน/ห้อง</Text>
                        </View>
                      </View>

                      {/* ---- ตัวเลือกผู้เข้าพัก / จำนวนห้อง (อยู่ในหน้าดูห้อง) ---- */}
                      <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={20} color="#0194F3" />
                            <View style={{ marginLeft: 10 }}>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>ผู้เข้าพัก</Text>
                              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>รวมทุกห้อง</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity disabled={countConfirmed || guests <= 0} onPress={() => changeGuests(-1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', opacity: (countConfirmed || guests <= 0) ? 0.4 : 1 }}>
                              <Ionicons name="remove" size={18} color="#0194F3" />
                            </TouchableOpacity>
                            <Text style={{ width: 40, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#1E293B' }}>{guests}</Text>
                            <TouchableOpacity disabled={countConfirmed || guests >= 20} onPress={() => changeGuests(1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', opacity: (countConfirmed || guests >= 20) ? 0.4 : 1 }}>
                              <Ionicons name="add" size={18} color="#0194F3" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="bed-outline" size={20} color="#0194F3" />
                            <View style={{ marginLeft: 10 }}>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>จำนวนห้อง</Text>
                              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>เลือก {selectedRoomIds.length}/{roomsWanted} ห้อง</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity disabled={countConfirmed || roomsWanted <= roomsMin} onPress={() => changeRooms(-1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', opacity: (countConfirmed || roomsWanted <= roomsMin) ? 0.4 : 1 }}>
                              <Ionicons name="remove" size={18} color="#0194F3" />
                            </TouchableOpacity>
                            <Text style={{ width: 40, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#1E293B' }}>{roomsWanted}</Text>
                            <TouchableOpacity disabled={countConfirmed || roomsWanted >= roomsMax} onPress={() => changeRooms(1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', opacity: (countConfirmed || roomsWanted >= roomsMax) ? 0.4 : 1 }}>
                              <Ionicons name="add" size={18} color="#0194F3" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* ข้อความกติกา/เตือนความจุ */}
                        <Text style={{ fontSize: 11, color: countError ? '#EF4444' : roomsWanted >= MAX_ROOMS_PER_ACCOUNT ? '#F97316' : '#94A3B8', fontWeight: '600', marginTop: 10 }}>
                          {countError
                            ? countError
                            : roomsWanted >= MAX_ROOMS_PER_ACCOUNT
                            ? `จองได้สูงสุด ${MAX_ROOMS_PER_ACCOUNT} ห้องต่อการจอง 1 ครั้ง — ต้องการมากกว่านี้ กรุณาติดต่อเจ้าหน้าที่`
                            : `รองรับได้สูงสุด ${roomsWanted * MAX_PER_ROOM} คนใน ${roomsWanted} ห้อง`}
                        </Text>

                        {/* ปุ่มยืนยันจำนวน — ห้องจะโผล่หลังกดยืนยัน */}
                        {!countConfirmed ? (
                          <TouchableOpacity
                            disabled={!canConfirmCount}
                            onPress={() => setCountConfirmed(true)}
                            style={{ marginTop: 14, backgroundColor: canConfirmCount ? '#0194F3' : '#CBD5E1', paddingVertical: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                          >
                            <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginRight: 6 }}>ยืนยันจำนวน แล้วดูห้อง</Text>
                            <Ionicons name="chevron-forward-circle" size={18} color="white" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => { setCountConfirmed(false); setSelectedRoomIds([]); }}
                            style={{ marginTop: 14, backgroundColor: '#F1F5F9', paddingVertical: 12, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                          >
                            <Ionicons name="create-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '800' }}>แก้ไขจำนวนคน/ห้อง</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* ยังไม่กดยืนยัน → โชว์ข้อความสีเทาตรงกลาง ยังไม่โชว์ห้อง */}
                      {!countConfirmed && (
                        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
                          <Ionicons name="bed-outline" size={48} color="#E2E8F0" />
                          <Text style={{ marginTop: 14, fontSize: 14, color: '#CBD5E1', fontWeight: '700', textAlign: 'center' }}>
                            กรุณากดเพิ่มจำนวนห้องและจำนวนคนเพื่อจองห้อง
                          </Text>
                        </View>
                      )}

                      {countConfirmed && displayRooms.map((room, idx) => {
                        const available = room.status === 'ว่าง';
                        const img = ROOM_IMAGES[idx % ROOM_IMAGES.length];
                        const picked = selectedRoomIds.includes(room.id);
                        return (
                          <View
                            key={room.id}
                            style={{
                              backgroundColor: 'white', borderRadius: 24, marginBottom: 18, overflow: 'hidden',
                              borderWidth: picked ? 2 : 1, borderColor: picked ? '#0194F3' : '#EEF3F8',
                              shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
                              opacity: available ? 1 : 0.6,
                            }}
                          >
                            {/* รูปห้อง + ป้ายสถานะ/เลขห้อง */}
                            <View style={{ height: 168, width: '100%', position: 'relative' }}>
                              <Image source={{ uri: img }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.12)' }} />
                              <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: available ? '#0194F3' : '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
                                <Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }}>{available ? 'ว่าง' : 'ไม่ว่าง'}</Text>
                              </View>
                              {room.roomNumber != null && (
                                <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(15,23,42,0.65)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
                                  <Text style={{ color: 'white', fontSize: 12, fontWeight: '900' }}>ห้อง {room.roomNumber}</Text>
                                </View>
                              )}
                            </View>

                            <View style={{ padding: 18 }}>
                              <Text style={{ fontSize: 19, fontWeight: '900', color: '#1E293B' }}>{bedInfoOf(room.typeName).label}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                <Ionicons name="people-outline" size={15} color="#0194F3" />
                                <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700', marginLeft: 5 }}>เข้าพักได้สูงสุด {bedInfoOf(room.typeName).capacity} คน</Text>
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 8 }} />
                                <Ionicons name="bed-outline" size={15} color="#0194F3" />
                                <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700', marginLeft: 5 }}>{bedInfoOf(room.typeName).beds} เตียง</Text>
                              </View>

                              {/* สิ่งอำนวยความสะดวก (เช็กลิสต์) */}
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                                {AMENITIES.map((a) => (
                                  <View key={a} style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 7 }}>
                                    <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                                    <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600', marginLeft: 6 }} numberOfLines={1}>{a}</Text>
                                  </View>
                                ))}
                              </View>

                              <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 }} />

                              {/* ราคา + ปุ่มเลือกห้องนี้ */}
                              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                <View>
                                  {available ? (
                                    <>
                                      <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700' }}>ราคา</Text>
                                      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0194F3' }}>฿{Number(room.price || 0).toLocaleString()}</Text>
                                        <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '700', marginLeft: 4, marginBottom: 3 }}>/คืน</Text>
                                      </View>
                                    </>
                                  ) : (
                                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#EF4444' }}>ห้องไม่ว่าง</Text>
                                  )}
                                </View>

                                {available && (
                                  <TouchableOpacity
                                    onPress={() => toggleRoom(room.id)}
                                    activeOpacity={0.85}
                                    style={{ backgroundColor: picked ? '#10B981' : '#0194F3', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 18, flexDirection: 'row', alignItems: 'center' }}
                                  >
                                    <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginRight: 5 }}>{picked ? 'เลือกแล้ว' : 'เลือกห้องนี้'}</Text>
                                    <Ionicons name={picked ? 'checkmark-circle' : 'add-circle'} size={18} color="white" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      {countConfirmed && displayRooms.length === 0 && (
                        <View style={{ alignItems: 'center', backgroundColor: 'white', borderRadius: 24, borderWidth: 1, borderColor: '#FEE2E2', paddingVertical: 30, paddingHorizontal: 24, marginTop: 4 }}>
                          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="bed" size={30} color="#EF4444" />
                          </View>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#1E293B', marginTop: 14 }}>ห้องประเภทนี้เต็มแล้ว</Text>
                          <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                            ขออภัย ขณะนี้ไม่มีห้องว่างในประเภทนี้{'\n'}กรุณาเลือกประเภทอื่น หรือติดต่อเจ้าหน้าที่
                          </Text>
                          <TouchableOpacity onPress={closeType} style={{ marginTop: 18, backgroundColor: '#0194F3', paddingHorizontal: 26, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-back" size={16} color="white" style={{ marginRight: 6 }} />
                            <Text style={{ color: 'white', fontSize: 14, fontWeight: '900' }}>เลือกประเภทอื่น</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  );
                })()
              )}
            </>
          )}

          <TouchableOpacity onPress={() => setShowInitialModal(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 10, borderRadius: 20, backgroundColor: '#F1F5F9' }}>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <Text style={{ marginLeft: 10, color: '#64748B', fontWeight: 'bold' }}>{t.backHome}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 12, marginBottom: 40, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Ionicons name="home-outline" size={20} color="#0194F3" />
            <Text style={{ marginLeft: 10, color: '#0194F3', fontWeight: 'bold' }}>{t.goBack}</Text>
          </TouchableOpacity>
        </View>
        </>
        )}
      </ScrollView>

      {/* แถบสรุปการจองแบบติดด้านล่าง (โผล่เมื่อเลือกห้องแล้ว) */}
      {isDateSelected && !showInitialModal && selectedRoomIds.length > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, flexDirection: 'row', alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: -6 }, elevation: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700' }}>เลือก {selectedRoomIds.length} ห้อง · พักได้ {selectedCapacity} คน · {nights} คืน</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#0194F3', marginTop: 2 }}>฿{selectedTotal.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            onPress={() => { if (!user) { router.push('/(auth)/login'); return; } setShowConfirm(true); }}
            style={{ backgroundColor: user ? '#0194F3' : '#FF7043', paddingHorizontal: 26, paddingVertical: 15, borderRadius: 18, flexDirection: 'row', alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginRight: 6 }}>{user ? 'จองเลย' : 'เข้าสู่ระบบ'}</Text>
            <Ionicons name="chevron-forward-circle" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* กล่องสรุป + ยืนยันการจองรวมหลายห้อง */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={closeRoomModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1E293B' }}>ยืนยันการจอง {selectedRooms.length} ห้อง</Text>
              <TouchableOpacity onPress={closeRoomModal} style={{ backgroundColor: '#F1F5F9', borderRadius: 20, padding: 6 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 22 }}>
              {/* รายละเอียดเข้าพัก */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: '#94A3B8' }}>วันเข้าพัก</Text>
                  <Text style={{ fontWeight: '700', color: '#1E293B' }}>{formatDateTH(startDate)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: '#94A3B8' }}>วันคืนห้อง</Text>
                  <Text style={{ fontWeight: '700', color: '#1E293B' }}>{formatDateTH(endDate)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#94A3B8' }}>ผู้เข้าพัก</Text>
                  <Text style={{ fontWeight: '700', color: '#1E293B' }}>{guests} คน · พักได้รวม {selectedCapacity} คน</Text>
                </View>
              </View>

              {/* รายการห้องที่เลือก */}
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#64748B', marginTop: 18, marginBottom: 8 }}>ห้องที่เลือก</Text>
              {selectedRooms.map((room) => {
                const info = bedInfoOf(room.typeName);
                return (
                  <View key={room.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#EEF3F8', marginBottom: 10 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="bed" size={20} color="#0194F3" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>{info.label}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 }}>พักได้ {info.capacity} คน · ฿{Number(room.price || 0).toLocaleString()}/คืน</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleRoom(room.id)} style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={18} color="#F87171" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* ยอดรวม */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B' }}>ยอดรวมโดยประมาณ ({nights} คืน)</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#0194F3' }}>฿{selectedTotal.toLocaleString()}</Text>
              </View>

              {confirmingDeposit ? (
                <View style={{ marginTop: 18, marginBottom: 30, padding: 18, backgroundColor: '#FFF7ED', borderRadius: 20, borderWidth: 1, borderColor: '#FED7AA' }}>
                  <Text style={{ color: '#9A3412', fontWeight: '800', fontSize: 14, marginBottom: 4 }}>⚠️ นโยบายการยกเลิก</Text>
                  <Text style={{ color: '#C2410C', fontSize: 13, lineHeight: 20, marginBottom: 14 }}>หากยกเลิกการจองภายหลัง จะไม่ได้รับเงินมัดจำคืน — ยืนยันการจองทั้ง {selectedRooms.length} ห้องนี้?</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity disabled={loading} onPress={() => setConfirmingDeposit(false)} style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#64748B', fontWeight: '800' }}>ย้อนกลับ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={loading} onPress={doBooking} style={{ flex: 2, backgroundColor: '#0194F3', paddingVertical: 14, borderRadius: 16, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
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
                <TouchableOpacity disabled={loading || selectedRooms.length === 0} onPress={handleConfirmBooking} style={{ backgroundColor: '#0194F3', paddingVertical: 18, borderRadius: 22, alignItems: 'center', marginTop: 20, marginBottom: 30, elevation: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '900', marginRight: 8 }}>จองรวม {selectedRooms.length} ห้อง</Text>
                    <Ionicons name="chevron-forward-circle" size={20} color="white" />
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Overlay หมุนโหลดเต็มจอ — โชว์ระหว่างทำรายการจองและพาไปหน้าชำระเงิน */}
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 9999 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, paddingVertical: 28, paddingHorizontal: 36, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 20 }}>
            <ActivityIndicator size="large" color="#0194F3" />
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