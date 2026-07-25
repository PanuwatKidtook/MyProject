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

// ชั้นของห้อง = เลขตัวแรกของเลขห้อง (102 → ชั้น 1) — ใช้จัดกลุ่มผังชั้น (ตรงกับฝั่งรายเดือน)
const floorOf = (roomNumber) => String(roomNumber || '').charAt(0) || '?';

// รายชื่อชั้นทั้งหมด เรียงจากน้อยไปมาก (['1','2','3'])
function floorsOf(rooms) {
  const set = new Set(rooms.map((r) => floorOf(r.number)));
  return [...set].sort();
}

// แยกข้อมูลเตียง/จำนวนคนพักจากชื่อประเภทห้อง (typeName) — ไม่มีฟิลด์ capacity ใน DB
// กติกา: ห้อง 3 เตียง เข้าพักได้ 3 คน · ห้องอื่นๆ เข้าพักได้ 2 คน
function bedInfoOf(typeName) {
  const label = String(typeName || '').trim() || 'ห้องมาตรฐาน';
  const m = label.match(/(\d+)/);           // ดึงตัวเลขเตียงจากชื่อ เช่น "3 เตียง" → 3
  const beds = m ? Number(m[1]) : 1;
  const capacity = beds >= 3 ? 3 : 2;       // 3 เตียง = 3 คน, อื่นๆ = 2 คน
  return { label, beds, capacity };
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
  const [selectedFloor, setSelectedFloor] = useState('');

  // ---- ตัวเลือกสไตล์ Agoda: จำนวนผู้เข้าพัก / จำนวนห้อง / ประเภทเตียง ----
  const [guests, setGuests] = useState(2);          // จำนวนผู้เข้าพักทั้งหมด
  const [roomsWanted, setRoomsWanted] = useState(1); // จำนวนห้องที่ต้องการจอง
  const [bedFilter, setBedFilter] = useState(null);  // กรองตามประเภทเตียง (typeName) — null = ทั้งหมด
  const [selectedRoomIds, setSelectedRoomIds] = useState([]); // ห้องที่เลือกไว้ (จองหลายห้อง)
  const [showConfirm, setShowConfirm] = useState(false); // กล่องสรุป+ยืนยันการจองรวม

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
          rentType: b.rentType,
          totalPrice: b.totalPrice,
          holdExpiresAt: b.holdExpiresAt || '',
          emailSent: b.emailSent ? '1' : '0',
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
  const floors = floorsOf(dailyRooms);
  // ประเภทเตียงทั้งหมด (จาก typeName) ไว้ทำ chip กรอง
  const bedTypes = [...new Set(dailyRooms.map((r) => bedInfoOf(r.typeName).label))];
  // จำนวนคืน (ใช้คิดยอดรวมพรีวิว)
  const nights = Math.max(1, Math.ceil(Math.abs(new Date(endDate) - new Date(startDate)) / 86400000));
  // ห้องในชั้นที่เลือก + กรองตามประเภทเตียงที่เลือก
  const floorRooms = dailyRooms
    .filter((r) => floorOf(r.number) === selectedFloor)
    .filter((r) => !bedFilter || bedInfoOf(r.typeName).label === bedFilter);
  // ห้องที่ถูกเลือกไว้ (ทุกชั้น) + ยอดรวมพรีวิว
  const selectedRooms = dailyRooms.filter((r) => selectedRoomIds.includes(r.id));
  const selectedTotal = selectedRooms.reduce((sum, r) => sum + Number(r.price || 0) * nights, 0);
  const selectedCapacity = selectedRooms.reduce((sum, r) => sum + bedInfoOf(r.typeName).capacity, 0);

  // ให้ชั้นที่เลือกอยู่ในลิสต์เสมอ (ค่าเริ่มต้น = ชั้นแรก) เมื่อข้อมูลห้องเปลี่ยน
  useEffect(() => {
    setSelectedFloor((prev) => (floors.includes(prev) ? prev : (floors[0] || '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsData]);

  // ปรับจำนวนผู้เข้าพัก/ห้องแบบมีขอบเขต — เพิ่มคนแล้วแนะนำจำนวนห้องอัตโนมัติ (2 คน/ห้อง)
  const changeGuests = (delta) => {
    setGuests((g) => {
      const next = Math.min(20, Math.max(1, g + delta));
      setRoomsWanted((rw) => Math.max(rw, Math.ceil(next / 2)));
      return next;
    });
  };
  const changeRooms = (delta) => {
    setRoomsWanted((rw) => {
      const next = Math.min(10, Math.max(1, rw + delta));
      // ลดจำนวนห้องต่ำกว่าที่เลือกไว้ → ตัดห้องที่เกินออก
      setSelectedRoomIds((ids) => ids.slice(0, next));
      return next;
    });
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

          {/* ---- ตัวเลือกผู้เข้าพัก / จำนวนห้อง (สไตล์ Agoda) ---- */}
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
                <TouchableOpacity onPress={() => changeGuests(-1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="remove" size={18} color="#0194F3" />
                </TouchableOpacity>
                <Text style={{ width: 40, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#1E293B' }}>{guests}</Text>
                <TouchableOpacity onPress={() => changeGuests(1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' }}>
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
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>เลือกจากผังด้านล่าง {selectedRoomIds.length}/{roomsWanted}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => changeRooms(-1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="remove" size={18} color="#0194F3" />
                </TouchableOpacity>
                <Text style={{ width: 40, textAlign: 'center', fontSize: 17, fontWeight: '900', color: '#1E293B' }}>{roomsWanted}</Text>
                <TouchableOpacity onPress={() => changeRooms(1)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="add" size={18} color="#0194F3" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ประเภทเตียง (จำแนกจากชื่อห้อง) */}
            {bedTypes.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 }} />
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
              </>
            )}
          </View>

          {/* คำอธิบายสี */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC', marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>ว่าง (แตะเพื่อเลือก)</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#0194F3', marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>เลือกแล้ว</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>ไม่ว่าง</Text>
            </View>
          </View>

          {fetching ? (
            <ActivityIndicator size="large" color="#0194F3" style={{ marginTop: 30 }} />
          ) : dailyRooms.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#94A3B8' }}>ไม่พบห้องว่างสำหรับรายวันในช่วงเวลาดังกล่าว</Text>
            </View>
          ) : (
            <>
              {/* แท็บเลือกชั้น */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {floors.map((f) => {
                  const active = selectedFloor === f;
                  return (
                    <TouchableOpacity key={f} onPress={() => setSelectedFloor(f)} style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? '#0194F3' : '#F1F5F9' }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: active ? 'white' : '#64748B' }}>ชั้น {f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ผังห้องของชั้นที่เลือก — แตะเพื่อเลือกหลายห้อง · ไม่แสดงเลขห้อง */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {floorRooms.map((room) => {
                  const available = room.status === 'ว่าง';
                  const selected = selectedRoomIds.includes(room.id);
                  const info = bedInfoOf(room.typeName);
                  const bg = !available ? '#FEF2F2' : selected ? '#0194F3' : '#F0FDF4';
                  const border = !available ? '#FECACA' : selected ? '#0194F3' : '#A7F3D0';
                  const priceColor = selected ? 'white' : '#15803D';
                  return (
                    <TouchableOpacity
                      key={room.id}
                      disabled={!available}
                      activeOpacity={0.85}
                      onPress={() => toggleRoom(room.id)}
                      style={{
                        width: '30.33%', margin: '1.5%', height: 128, borderRadius: 20,
                        justifyContent: 'center', alignItems: 'center', borderWidth: 1.5,
                        paddingHorizontal: 6, position: 'relative',
                        backgroundColor: bg, borderColor: border,
                        shadowColor: available ? '#10B981' : '#F87171',
                        shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                        elevation: available ? 3 : 1,
                      }}
                    >
                      {selected && (
                        <View style={{ position: 'absolute', top: 6, right: 6 }}>
                          <Ionicons name="checkmark-circle" size={20} color="white" />
                        </View>
                      )}
                      <View style={{
                        width: 40, height: 40, borderRadius: 13, marginBottom: 6,
                        justifyContent: 'center', alignItems: 'center',
                        backgroundColor: !available ? '#FEE2E2' : selected ? 'rgba(255,255,255,0.25)' : '#DCFCE7',
                      }}>
                        <Ionicons name={available ? 'bed' : 'lock-closed'} size={20} color={!available ? '#F87171' : selected ? 'white' : '#16A34A'} />
                      </View>
                      {available ? (
                        <>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: priceColor }}>฿{Number(room.price || 0).toLocaleString()}</Text>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: selected ? 'rgba(255,255,255,0.9)' : '#16A34A', marginTop: 1 }} numberOfLines={1}>{info.label}</Text>
                          <Text style={{ fontSize: 8, fontWeight: '700', color: selected ? 'rgba(255,255,255,0.9)' : '#64748B', marginTop: 1 }}>พักได้ {info.capacity} คน</Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#F87171' }}>ไม่ว่าง</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {floorRooms.length === 0 && (
                  <Text style={{ color: '#94A3B8', paddingVertical: 10 }}>ไม่มีห้องตรงกับตัวกรองในชั้นนี้</Text>
                )}
              </View>
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
    </View>
  );
}