import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  ActivityIndicator, Alert, StatusBar, SafeAreaView, RefreshControl
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';

export default function DailyReservationScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [roomsData, setRoomsData] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);
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

  // 1 บัญชี จองห้องรายวันได้ทีละ 1 ห้อง — ถ้ามีการจองรายวันที่ยังไม่ยกเลิกอยู่แล้ว ต้องกดยกเลิกก่อนถึงจะจองห้องใหม่ได้
  const [activeDailyBooking, setActiveDailyBooking] = useState(null);

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

  // เช็คว่าบัญชีนี้มีห้องรายวันที่จองอยู่แล้ว (ยังไม่ยกเลิก) หรือไม่ — ถ้ามีต้องยกเลิกก่อนถึงจะจองห้องใหม่ได้
  const fetchActiveDailyBooking = async () => {
    try {
      const response = await api.post('/checkbooking', {});
      const bookings = response.data?.success && Array.isArray(response.data.data) ? response.data.data : [];
      const active = bookings.find((item) => {
        const status = String(item.bookingStatus || '').trim().toLowerCase();
        const isCancelled = status === 'ยกเลิก' || status === 'cancelled' || status === 'canceled';
        return item.rentType === 'daily' && !isCancelled;
      });
      setActiveDailyBooking(active || null);
    } catch (e) {
      setActiveDailyBooking(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const checkUserStatus = async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          if (userData) {
            setUser(JSON.parse(userData));
            fetchActiveDailyBooking();
          } else {
            setUser(null);
            setActiveDailyBooking(null);
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

  // ยิงคำขอจองจริง (เรียกหลังผู้ใช้กดรับทราบนโยบายมัดจำแล้ว)
  const doBooking = async () => {
    if (!selectedRoom) return;
    setConfirmingDeposit(false);
    setLoading(true);
    try {
      // token แนบอัตโนมัติจาก interceptor ใน lib/api.js
      const res = await api.post('/booking', {
        roomId: selectedRoom.id,
        startDate: startDate,
        endDate: endDate,
        rentType: 'daily',
      });
      setSelectedRoom(null);
      fetchRooms();
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
          rentType: b.rentType,
          totalPrice: b.totalPrice,
          holdExpiresAt: b.holdExpiresAt || '',
          emailSent: b.emailSent ? '1' : '0',
        }
      });
    } catch (error) {
      Alert.alert("ขออภัย", error.response?.data?.message || t.fail);
      fetchRooms();
      setSelectedRoom(null);
    } finally {
      setLoading(false);
    }
  };

  // กดยืนยันจอง → แสดงกล่องเตือนนโยบายมัดจำในตัว Modal (USER_FLOWS ข้อ 4.5) → ค่อยจองจริง
  const handleConfirmBooking = () => {
    if (!selectedRoom) return;
    if (activeDailyBooking) {
      Alert.alert(
        'จองได้แค่ 1 ห้องต่อบัญชี',
        `คุณมีห้องพักรายวันที่จองไว้อยู่แล้ว (ห้อง ${activeDailyBooking.roomNumber}) กรุณายกเลิกการจองเดิมก่อน ถึงจะจองห้องใหม่ได้`,
        [
          { text: 'ปิด', style: 'cancel' },
          { text: 'ไปหน้ายกเลิก', onPress: () => { setSelectedRoom(null); router.push('/reservationlist'); } }
        ]
      );
      return;
    }
    setConfirmingDeposit(true);
  };

  // ปิด Modal รายละเอียดห้อง + รีเซ็ตสถานะยืนยัน
  const closeRoomModal = () => {
    setSelectedRoom(null);
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

  // รายวัน: เฉพาะห้องว่างที่ "มีราคารายวัน" (price != null) — ตรงกับ Roomuser.jsx ฝั่ง y3
  const availableRooms = roomsData.filter(room => room.status === 'ว่าง' && room.price != null);

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
          {activeDailyBooking && (
            <TouchableOpacity
              onPress={() => router.push('/reservationlist')}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 20, padding: 16, marginBottom: 20 }}
            >
              <Ionicons name="alert-circle" size={22} color="#EA580C" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#9A3412', fontWeight: '800', fontSize: 13 }}>คุณมีห้องพักรายวันที่จองไว้แล้ว (ห้อง {activeDailyBooking.roomNumber})</Text>
                <Text style={{ color: '#C2410C', fontSize: 12, marginTop: 2 }}>ต้องยกเลิกการจองเดิมก่อน ถึงจะจองห้องใหม่ได้ — แตะเพื่อไปหน้ายกเลิก</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#EA580C" />
            </TouchableOpacity>
          )}

          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B' }}>{t.selectTitle}</Text>
            <Text style={{ fontSize: 15, color: '#0194F3', fontWeight: '700', marginTop: 4 }}>
              {formatDateTH(startDate)} - {formatDateTH(endDate)}
            </Text>
          </View>

          {fetching ? (
            <ActivityIndicator size="large" color="#0194F3" style={{ marginTop: 20 }} />
          ) : (
            availableRooms.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {availableRooms.map(room => (
                  <TouchableOpacity key={room.id} onPress={() => setSelectedRoom(room)} style={{ width: '30%', margin: '1.5%', height: 90, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#F1F5F9', elevation: 3 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>{room.number}</Text>
                    <View style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#E3F6ED' }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#10B981' }}>{t.available}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Text style={{ color: '#94A3B8' }}>ไม่พบห้องว่างสำหรับรายวันในช่วงเวลาดังกล่าว</Text>
              </View>
            )
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

      <Modal visible={selectedRoom !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', height: '75%' }}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1000' }} style={{ width: '100%', height: 240 }} />
                <TouchableOpacity onPress={closeRoomModal} style={{ position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 8 }}>
                  <Ionicons name="close" size={22} color="white" />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 25 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: '#1E293B' }}>ห้อง {selectedRoom?.number}</Text>
                    <Text style={{ color: '#94A3B8', marginTop: 4, fontSize: 14, fontWeight: '600' }}>รายวันสุดหรู</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: '#0194F3' }}>฿{selectedRoom?.price}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', fontWeight: 'bold' }}>{t.unitD}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#64748B', marginBottom: 8 }}>รายละเอียดเช็คอิน</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ color: '#94A3B8' }}>วันที่เข้าพัก:</Text>
                    <Text style={{ fontWeight: '700', color: '#1E293B' }}>{formatDateTH(startDate)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#94A3B8' }}>วันที่คืนห้อง:</Text>
                    <Text style={{ fontWeight: '700', color: '#1E293B' }}>{formatDateTH(endDate)}</Text>
                  </View>
                </View>
                <View style={{ marginTop: 20, padding: 18, backgroundColor: '#F1F5F9', borderRadius: 20 }}>
                  <Text style={{ color: '#475569', fontSize: 13, lineHeight: 20 }}>{t.desc}</Text>
                </View>
                {user ? (
                  confirmingDeposit ? (
                    // กล่องยืนยันนโยบายมัดจำในตัว Modal (แทน Alert ที่ไม่แสดงบน iOS)
                    <View style={{ marginTop: 24, marginBottom: 40, padding: 18, backgroundColor: '#FFF7ED', borderRadius: 20, borderWidth: 1, borderColor: '#FED7AA' }}>
                      <Text style={{ color: '#9A3412', fontWeight: '800', fontSize: 14, marginBottom: 4 }}>⚠️ นโยบายการยกเลิก</Text>
                      <Text style={{ color: '#C2410C', fontSize: 13, lineHeight: 20, marginBottom: 14 }}>หากยกเลิกการจองภายหลัง จะไม่ได้รับเงินมัดจำคืน — ยืนยันการจองห้องพักนี้?</Text>
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
                    <TouchableOpacity
                      disabled={loading}
                      onPress={handleConfirmBooking}
                      style={{ backgroundColor: '#0194F3', paddingVertical: 18, borderRadius: 22, alignItems: 'center', marginTop: 30, marginBottom: 40, elevation: 5 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: 'white', fontSize: 16, fontWeight: '900', marginRight: 8 }}>{t.confirmBtn}</Text>
                          <Ionicons name="chevron-forward-circle" size={20} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                ) : (
                  <TouchableOpacity
                    onPress={() => { setSelectedRoom(null); router.push('/(auth)/login'); }}
                    style={{ backgroundColor: '#FF7043', paddingVertical: 18, borderRadius: 22, alignItems: 'center', marginTop: 30, marginBottom: 40 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="log-in-outline" size={22} color="white" style={{ marginRight: 8 }} />
                      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>{t.loginRequiredBtn}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}