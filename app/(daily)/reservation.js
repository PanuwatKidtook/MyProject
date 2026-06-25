import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  ActivityIndicator, Alert, Animated, Platform, StatusBar, SafeAreaView, RefreshControl
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = 'https://projeccty3-server.onrender.com/api';

export default function DailyReservationScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [roomsData, setRoomsData] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  const [showInitialModal, setShowInitialModal] = useState(true);
  const [isDateSelected, setIsDateSelected] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]);
  const [showStartPicker, setShowStartPicker] = useState(true);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const slideAnim = useRef(new Animated.Value(-200)).current;

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

  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };

  useFocusEffect(
    useCallback(() => {
      const checkUserStatus = async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          if (userData) setUser(JSON.parse(userData));
          else setUser(null);
        } catch (e) {
          setUser(null);
        }
      };
      checkUserStatus();
    }, [])
  );

  const fetchRooms = async () => {
    if (!isDateSelected) return;
    setFetching(true);
    try {
      const payload = { checkIn: startDate, checkOut: endDate };
      const response = await axios.post(`${API_BASE_URL}/search-rooms`, payload);

      if (response.data && response.data.data) {
        setRoomsData(response.data.data);
      } else {
        setRoomsData([]);
      }
    } catch (error) {
      console.error("Fetch Error:", error.message);
      setRoomsData([]);
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  const fetchAllRooms = async () => {
    try {
      setFetching(true);
      const response = await axios.get(`${API_BASE_URL}/getRoom`);
      if (response.data && response.data.data) {
        setRoomsData(response.data.data);
      } else {
        setRoomsData([]);
      }
    } catch (error) {
      console.error("Fetch All Rooms Error:", error.message);
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

  const triggerNotification = () => {
    Animated.spring(slideAnim, {
      toValue: Platform.OS === 'ios' ? 50 : 30,
      useNativeDriver: true,
      bounciness: 10
    }).start();
    setTimeout(() => hideNotification(), 5000);
  };

  const hideNotification = (callback) => {
    Animated.timing(slideAnim, { toValue: -200, duration: 300, useNativeDriver: true }).start(() => {
      if (callback) callback();
    });
  };

  const formatDateTH = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const payload = {
        roomId: selectedRoom.id,
        userId: user?.id || 5,
        startDate: startDate,
        endDate: endDate
      };

      const response = await axios.post(`${API_BASE_URL}/booking`, payload, { headers });

      if (response.status === 200 || response.status === 201) {
        setSelectedRoom(null);
        triggerNotification();
        fetchRooms();
      } else {
        Alert.alert("ขออภัย", t.fail);
      }
    } catch (error) {
      Alert.alert("ขออภัย", error.response?.data?.message || t.fail);
      fetchRooms();
      setSelectedRoom(null);
    } finally {
      setLoading(false);
    }
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

  const floors = [...new Set(roomsData.map(item => item.floor))].filter(f => f !== undefined).sort();

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

      <Modal visible={showInitialModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 30, padding: 25, maxHeight: '90%' }}>
            <TouchableOpacity onPress={() => setShowInitialModal(false)} style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: '#F1F5F9', borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 20 }}>{t.pickDateDaily}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Animated.View style={{
        position: 'absolute', top: 80, left: 15, right: 15, zIndex: 10000, transform: [{ translateY: slideAnim }],
        backgroundColor: 'white', borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', elevation: 20, borderLeftWidth: 8, borderLeftColor: '#10B981'
      }}>
        <View style={{ backgroundColor: '#E3F6ED', borderRadius: 14, padding: 10, marginRight: 15 }}>
          <Ionicons name="checkmark-done" size={26} color="#10B981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: '#1E293B' }}>{t.success}</Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{t.viewList}</Text>
        </View>
        <TouchableOpacity onPress={() => hideNotification(() => router.push('/(daily)/reservationlist'))} style={{ backgroundColor: '#0194F3', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>ประวัติ</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0194F3']} />}>
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

          {fetching ? (
            <ActivityIndicator size="large" color="#0194F3" style={{ marginTop: 20 }} />
          ) : (
            floors.length > 0 ? (
              floors.map(floorNum => {
                const availableRooms = roomsData.filter(room => room.floor === floorNum && room.monthly_booked_status === false);
                if (availableRooms.length === 0) return null;
                return (
                  <View key={floorNum} style={{ marginBottom: 25 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 4, height: 16, backgroundColor: '#0194F3', borderRadius: 2, marginRight: 10 }} />
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#64748B' }}>{t.floor}{floorNum}</Text>
                    </View>
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
                  </View>
                );
              })
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
      </ScrollView>

      <Modal visible={selectedRoom !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', height: '75%' }}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1000' }} style={{ width: '100%', height: 240 }} />
                <TouchableOpacity onPress={() => setSelectedRoom(null)} style={{ position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 8 }}>
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
                    <Text style={{ fontSize: 26, fontWeight: '900', color: '#0194F3' }}>฿{selectedRoom?.basePricedaily}</Text>
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