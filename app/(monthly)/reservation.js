import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  ActivityIndicator, Alert, StatusBar, SafeAreaView, RefreshControl
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import BookingSuccessModal from '../../components/booking/BookingSuccessModal';

// ชั้นของห้อง = เลขตัวแรกของเลขห้อง (102 → ชั้น 1) — ใช้จัดกลุ่มผังชั้น (ตรงกับ Roomuser.jsx ฝั่ง y3)
const floorOf = (roomNumber) => String(roomNumber || '').charAt(0) || '?';

// รายชื่อชั้นทั้งหมด เรียงจากน้อยไปมาก (['1','2','3'])
function floorsOf(rooms) {
  const set = new Set(rooms.map((r) => floorOf(r.room_number)));
  return [...set].sort();
}

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
  const [selectedFloor, setSelectedFloor] = useState('');
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [detailRoom, setDetailRoom] = useState(null); // ห้องที่เปิดดูรายละเอียด
  const [loading, setLoading] = useState(false);       // ระหว่างส่งคำขอจอง
  const [bookingResult, setBookingResult] = useState(null); // ผลจองสำเร็จ → เปิดโมดัล
  const [confirmingDeposit, setConfirmingDeposit] = useState(false); // กล่องยืนยันมัดจำในตัว Modal

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

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          setUser(userData ? JSON.parse(userData) : null);
        } catch { setUser(null); }
      })();
    }, [])
  );

  // โหลดผังชั้น ณ วันเข้าพักที่เลือก (ใช้ทั้งตอนกดค้นหา และตอนเปลี่ยนวัน) — GET /rooms/availability?date=
  const loadAvailability = async (date) => {
    if (!date) return;
    setFetching(true);
    try {
      const res = await api.get(`/rooms/availability?date=${date}`);
      const rows = res.data?.data || [];
      setAvailability(rows);
      const floors = floorsOf(rows);
      setSelectedFloor((prev) => (floors.includes(prev) ? prev : (floors[0] || '')));
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
    setDetailRoom({
      id: row.room_id,
      number: row.room_number,
      typeName: row.type_name,
      priceMonthly: row.price_monthly,
      imageUrl: row.image_url,
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
    setLoading(true);
    try {
      // วันออกชั่วคราว = วันเข้าพัก + 1 เดือน (พอผ่าน overlap-check; สัญญาจริงกำหนดตอนเช็คอิน)
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + 1);
      const endDate = end.toISOString().split('T')[0];

      const res = await api.post('/booking', {
        roomId: detailRoom.id,
        startDate,
        endDate,
        rentType: 'monthly',
      });
      setDetailRoom(null);
      loadAvailability(startDate);
      // เปิดโมดัลสำเร็จ+ชำระมัดจำหลังโมดัลรายละเอียดห้องปิดเสร็จ
      // (RN เปิด Modal 2 ตัวพร้อมกันไม่ได้ — ตัวที่สองจะไม่เด้งถ้าตัวแรกยังปิดไม่เสร็จ)
      setTimeout(() => setBookingResult(res.data), 450);
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

  const floors = floorsOf(availability);
  const floorRooms = availability.filter((r) => floorOf(r.room_number) === selectedFloor);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <SafeAreaView style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 10 }}>
        <View style={{ height: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
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
              <TouchableOpacity onPress={() => setShowProfileMenu(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: '#2DD4BF' }}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%', borderRadius: 22 }} />
                ) : (
                  <Ionicons name="person" size={22} color="#0194F3" />
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
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name="home-outline" size={18} color="#0194F3" />
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

      {/* เลือกวันเข้าพักก่อน (รายเดือนเลือกแค่วันเดียว) */}
      <Modal visible={showInitialModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 30, padding: 25, maxHeight: '90%' }}>
            {isDateSelected && (
              <TouchableOpacity onPress={() => setShowInitialModal(false)} style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: '#F1F5F9', borderRadius: 20, padding: 8 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            )}
            <Text style={{ fontSize: 19, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 20 }}>{t.pickDateMonthly}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: '#0194F3', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#E0F2FE', padding: 8, borderRadius: 12, marginRight: 15 }}>
                  <Ionicons name="calendar-sharp" size={24} color="#0194F3" />
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
                  markedDates={{ [startDate]: { selected: true, selectedColor: '#0194F3' } }}
                  theme={{ todayTextColor: '#0194F3', selectedDayBackgroundColor: '#0194F3' }}
                />
              </View>
              <TouchableOpacity onPress={handleConfirmInitialDate} style={{ backgroundColor: '#0194F3', marginTop: 25, paddingVertical: 18, borderRadius: 25, alignItems: 'center', elevation: 5 }}>
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>ดูผังห้องว่าง</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0194F3']} />}>
        <View style={{ height: 200, width: '100%', position: 'relative' }}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1000' }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <View style={{ position: 'absolute', bottom: 25, left: 25 }}>
            <Text style={{ color: 'white', fontSize: 30, fontWeight: '900' }}>Around Loei รายเดือน</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <MaterialIcons name="location-on" size={18} color="#0194F3" />
              <Text style={{ color: '#E2E8F0', fontSize: 14, marginLeft: 6 }}>{t.location}</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 20 }}>
          {/* แถบวันเข้าพัก + ปุ่มเปลี่ยนวัน */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '900' }}>เลือกห้องจากผังชั้น · วันเข้าพัก</Text>
              <Text style={{ fontSize: 16, color: '#1E293B', fontWeight: '800', marginTop: 2 }}>{formatDateTH(startDate)}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowInitialModal(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
              <Ionicons name="calendar-outline" size={16} color="#0194F3" />
              <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 12, marginLeft: 6 }}>เปลี่ยนวัน</Text>
            </TouchableOpacity>
          </View>

          {/* คำอธิบายสี */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC', marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>ว่าง (กดจองได้)</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>ไม่ว่าง</Text>
            </View>
          </View>

          {fetching ? (
            <ActivityIndicator size="large" color="#0194F3" style={{ marginTop: 30 }} />
          ) : availability.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#94A3B8' }}>ไม่มีข้อมูลห้อง</Text>
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

              {/* ผังห้องของชั้นที่เลือก — ว่าง(เขียว)/ไม่ว่าง(แดง) */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {floorRooms.map((room) => {
                  const available = room.available;
                  return (
                    <TouchableOpacity
                      key={room.room_id}
                      disabled={!available}
                      onPress={() => openDetail(room)}
                      style={{
                        width: '30.33%', margin: '1.5%', height: 92, borderRadius: 16,
                        justifyContent: 'center', alignItems: 'center', borderWidth: 2,
                        backgroundColor: available ? '#F0FDF4' : '#FEF2F2',
                        borderColor: available ? '#86EFAC' : '#FECACA',
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '800', color: available ? '#15803D' : '#F87171' }}>{room.room_number}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: available ? '#16A34A' : '#F87171', marginTop: 4 }}>
                        {available ? `฿${Number(room.price_monthly || 0).toLocaleString()}/ด.` : 'ไม่ว่าง'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 20, marginBottom: 40, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Ionicons name="home-outline" size={20} color="#0194F3" />
            <Text style={{ marginLeft: 10, color: '#0194F3', fontWeight: 'bold' }}>กลับสู่หน้าหลัก</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* รายละเอียดห้อง + ปุ่มจองห้องนี้ */}
      <Modal visible={detailRoom !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', height: '72%' }}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: detailRoom?.imageUrl || 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1000' }} style={{ width: '100%', height: 230 }} />
                <TouchableOpacity onPress={closeDetail} style={{ position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 8 }}>
                  <Ionicons name="close" size={22} color="white" />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 25 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: '#1E293B' }}>ห้อง {detailRoom?.number}</Text>
                    <Text style={{ color: '#94A3B8', marginTop: 4, fontSize: 14, fontWeight: '600' }}>{detailRoom?.typeName || 'รายเดือน'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: '#0194F3' }}>฿{Number(detailRoom?.priceMonthly || 0).toLocaleString()}</Text>
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
                        <TouchableOpacity disabled={loading} onPress={doBooking} style={{ flex: 2, backgroundColor: '#0194F3', paddingVertical: 14, borderRadius: 16, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
                          {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '900' }}>ยอมรับ และจองเลย</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity disabled={loading} onPress={handleConfirmBooking} style={{ backgroundColor: '#0194F3', paddingVertical: 18, borderRadius: 22, alignItems: 'center', marginTop: 25, marginBottom: 40, elevation: 5 }}>
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

      {/* โมดัลจองสำเร็จ + ชำระมัดจำล็อกห้อง (นับถอยหลัง 5 นาที + QR PromptPay + แนบสลิป) */}
      <BookingSuccessModal
        visible={bookingResult !== null}
        result={bookingResult}
        onGoHistory={() => { setBookingResult(null); router.push('/(tabs)/reservationlist'); }}
        onClose={() => setBookingResult(null)}
      />
    </View>
  );
}
