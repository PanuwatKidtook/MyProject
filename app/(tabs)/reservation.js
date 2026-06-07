import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Modal, Platform,
  RefreshControl,
  SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View
} from 'react-native';
import { Calendar } from 'react-native-calendars';

export default function LuxuryReservationScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH');
  const [activeTab, setActiveTab] = useState('daily');
  const [roomsData, setRoomsData] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // --- ระบบวันที่ (Initial Popup) ---
  const [showInitialModal, setShowInitialModal] = useState(true);
  const [isDateSelected, setIsDateSelected] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]);
  const [showStartPicker, setShowStartPicker] = useState(true); 
  const [showEndPicker, setShowEndPicker] = useState(false);

  const slideAnim = useRef(new Animated.Value(-200)).current;

  const text = {
    TH: {
      location: 'ในเมืองเลย ใกล้ มรภ.เลย',
      daily: 'รายวัน', monthly: 'รายเดือน', selectTitle: 'ห้องว่างสำหรับวันที่',
      floor: 'ชั้นที่ ', available: 'ว่างพร้อมจอง', backHome: 'เปลี่ยนวันที่ดูห้องพัก',
      unitD: ' /คืน', unitM: ' /เดือน', confirmBtn: 'ยืนยันการจองตอนนี้',
      success: 'จองสำเร็จ!', viewList: 'ดูรายการจองของคุณ',
      desc: 'สัมผัสประสบการณ์การพักผ่อนระดับพรีเมียม สไตล์มินิมอล พร้อมสิ่งอำนวยความสะดวกครบครัน',
      fail: 'ไม่สามารถจองได้', pickDate: 'ระบุวันที่เข้าพักและวันที่ออก',
      goBack: 'กลับสู่หน้าหลัก'
    },
    EN: {
      location: 'Loei City, near LRU',
      daily: 'Daily', monthly: 'Monthly', selectTitle: 'Available Rooms for',
      floor: 'Floor ', available: 'Vacant', backHome: 'Change Date',
      unitD: ' /day', unitM: ' /month', confirmBtn: 'Book Now',
      success: 'Success!', viewList: 'View your bookings',
      desc: 'Experience premium living with minimalist style and 24h security.',
      fail: 'Booking failed', pickDate: 'Select Check-in & Check-out Date',
      goBack: 'Back to Home'
    }
  };

  const t = text[lang];

  const fetchRooms = async () => {
    if (!isDateSelected) return;
    setFetching(true);
    try {
      const payload = { checkIn: startDate, checkOut: endDate };
      const response = await axios.post('https://projeccty3-server.onrender.com/api/search-rooms', payload);
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

  useEffect(() => {
    if (isDateSelected) fetchRooms();
  }, [isDateSelected, startDate, endDate]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRooms();
  }, [startDate, endDate, isDateSelected]);

  const handleConfirmInitialDate = () => {
    setIsDateSelected(true);
    setShowInitialModal(false);
  };

  const triggerNotification = () => {
    Animated.spring(slideAnim, { toValue: Platform.OS === 'ios' ? 50 : 30, useNativeDriver: true, bounciness: 10 }).start();
    setTimeout(() => hideNotification(), 5000);
  };

  const hideNotification = (callback) => {
    Animated.timing(slideAnim, { toValue: -200, duration: 300, useNativeDriver: true }).start(() => { if (callback) callback(); });
  };

  const formatDateTH = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;
    setLoading(true);
    try {
      const payload = {
        roomId: selectedRoom.id,
        userId: 5,
        startDate: startDate,
        endDate: endDate,
        bookingType: activeTab === 'daily' ? 'Daily' : 'Monthly'
      };
      const response = await axios.post('https://projeccty3-server.onrender.com/api/Booking', payload);
      if (response.status === 200 || response.status === 201) {
        setSelectedRoom(null);
        triggerNotification();
        fetchRooms();
      }
    } catch (error) {
      Alert.alert("ขออภัย", error.response?.data?.message || t.fail);
      fetchRooms();
      setSelectedRoom(null);
    } finally {
      setLoading(false);
    }
  };

  const floors = [...new Set(roomsData.map(item => item.floor))].filter(f => f !== undefined).sort();

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
      <StatusBar barStyle="light-content" />

      {/* --- Initial Date Selection Modal --- */}
      <Modal visible={showInitialModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 30, padding: 25, maxHeight: '90%', position: 'relative' }}>
            
            {/* --- เพิ่มปุ่มปิดกากบาทตรงนี้ --- */}
            <TouchableOpacity 
              onPress={() => setShowInitialModal(false)} 
              style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: '#F1F5F9', borderRadius: 20, padding: 8 }}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>

            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 20, paddingHorizontal: 30 }}>{t.pickDate}</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }}
                style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: showStartPicker ? '#0194F3' : '#E2E8F0', alignItems: 'center' }}
              >
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

              <TouchableOpacity 
                onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }}
                style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: showEndPicker ? '#F43F5E' : '#E2E8F0', alignItems: 'center' }}
              >
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

              <TouchableOpacity 
                onPress={handleConfirmInitialDate}
                style={{ backgroundColor: '#0194F3', marginTop: 30, paddingVertical: 18, borderRadius: 25, alignItems: 'center', elevation: 5 }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>ยืนยันวันที่และค้นหา</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Notification */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 15, right: 15, zIndex: 10000,
        transform: [{ translateY: slideAnim }],
        backgroundColor: 'white', borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center',
        elevation: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15, borderLeftWidth: 8, borderLeftColor: '#10B981'
      }}>
        <View style={{ backgroundColor: '#E3F6ED', borderRadius: 14, padding: 10, marginRight: 15 }}>
          <Ionicons name="checkmark-done" size={26} color="#10B981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: '#1E293B' }}>{t.success}</Text>
          <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{t.viewList}</Text>
        </View>
        <TouchableOpacity onPress={() => hideNotification(() => router.push('/reservationlist'))} style={{ backgroundColor: '#0194F3', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>ประวัติ</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0194F3']} />}
      >
        <View style={{ height: 320, width: '100%', position: 'relative' }}>
          <Image 
            source={{ uri: activeTab === 'daily' ? 'https://images.unsplash.com/photo-1590490359683-658d3d23f972?q=80&w=1000' : 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1000' }} 
            style={{ width: '100%', height: '100%', resizeMode: 'cover' }} 
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
          
          <SafeAreaView style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginTop: Platform.OS === 'ios' ? 0 : 40 }}>
            <TouchableOpacity 
              onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')} 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
            </TouchableOpacity>
          </SafeAreaView>

          <View style={{ position: 'absolute', bottom: 50, left: 25 }}>
            <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', letterSpacing: -0.5 }}>Around Loei</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <MaterialIcons name="location-on" size={18} color="#0194F3" />
              <Text style={{ color: '#E2E8F0', fontSize: 14, marginLeft: 6, fontWeight: '600' }}>{t.location}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: -35, paddingHorizontal: 25 }}>
          <View style={{ flexDirection: 'row', backgroundColor: 'white', padding: 8, borderRadius: 30, elevation: 15, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15 }}>
            <TouchableOpacity onPress={() => setActiveTab('daily')} style={[{ flex: 1, paddingVertical: 15, alignItems: 'center', borderRadius: 25 }, activeTab === 'daily' && { backgroundColor: '#0194F3' }]}>
              <Text style={[{ fontSize: 16, fontWeight: 'bold', color: '#94A3B8' }, activeTab === 'daily' && { color: 'white' }]}>{t.daily}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('monthly')} style={[{ flex: 1, paddingVertical: 15, alignItems: 'center', borderRadius: 25 }, activeTab === 'monthly' && { backgroundColor: '#0194F3' }]}>
              <Text style={[{ fontSize: 16, fontWeight: 'bold', color: '#94A3B8' }, activeTab === 'monthly' && { color: 'white' }]}>{t.monthly}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ padding: 25 }}>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#1E293B' }}>{t.selectTitle}</Text>
            <Text style={{ fontSize: 16, color: '#0194F3', fontWeight: '700', marginTop: 4 }}>
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
                  <View key={floorNum} style={{ marginBottom: 30 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                      <View style={{ width: 4, height: 18, backgroundColor: '#0194F3', borderRadius: 2, marginRight: 10 }} />
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#64748B' }}>{t.floor}{floorNum}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {availableRooms.map(room => (
                        <TouchableOpacity 
                          key={room.id} 
                          onPress={() => setSelectedRoom(room)}
                          style={{ 
                            width: '30%', margin: '1.5%', height: 100, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
                            backgroundColor: 'white', borderWidth: 1, borderColor: '#F1F5F9', elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10
                          }}
                        >
                          <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B' }}>{room.number}</Text>
                          <View style={{ marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#E3F6ED' }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#10B981' }}>{t.available}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Text style={{ color: '#94A3B8' }}>ไม่พบห้องว่างในช่วงเวลาดังกล่าว</Text>
              </View>
            )
          )}
          
          <TouchableOpacity 
            onPress={() => setShowInitialModal(true)} 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, marginTop: 10, borderRadius: 25, backgroundColor: '#F1F5F9' }}
          >
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <Text style={{ marginLeft: 10, color: '#64748B', fontWeight: 'bold', fontSize: 16 }}>{t.backHome}</Text>
          </TouchableOpacity>

          {/* --- ปุ่มกลับสู่หน้าหลักที่เพิ่มเข้ามาใหม่ --- */}
          <TouchableOpacity 
            onPress={() => router.replace('/')} 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, marginTop: 12, marginBottom: 80, borderRadius: 25, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }}
          >
            <Ionicons name="home-outline" size={20} color="#0194F3" />
            <Text style={{ marginLeft: 10, color: '#0194F3', fontWeight: 'bold', fontSize: 16 }}>{t.goBack}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Booking Confirmation Modal */}
      <Modal visible={selectedRoom !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', height: '80%' }}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1000' }} style={{ width: '100%', height: 280 }} />
                <TouchableOpacity onPress={() => setSelectedRoom(null)} style={{ position: 'absolute', top: 25, right: 25, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, padding: 10 }}>
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 25 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                  <View>
                    <Text style={{ fontSize: 32, fontWeight: '900', color: '#1E293B' }}>ห้อง {selectedRoom?.number}</Text>
                    <Text style={{ color: '#94A3B8', marginTop: 5, fontSize: 16, fontWeight: '600' }}>{activeTab === 'daily' ? 'รายวันสุดหรู' : 'รายเดือนสุดพรีเมียม'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: '#0194F3' }}>฿{activeTab === 'daily' ? selectedRoom?.basePricedaily : selectedRoom?.basePriceMonthly}</Text>
                    <Text style={{ fontSize: 14, color: '#64748B', fontWeight: 'bold' }}>{activeTab === 'daily' ? t.unitD : t.unitM}</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 10 }}>รายละเอียดการจอง</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ color: '#94A3B8' }}>วันที่เข้าพัก:</Text>
                    <Text style={{ fontWeight: '700', color: '#1E293B' }}>{formatDateTH(startDate)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#94A3B8' }}>วันที่คืนห้อง:</Text>
                    <Text style={{ fontWeight: '700', color: '#1E293B' }}>{formatDateTH(endDate)}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 25, padding: 20, backgroundColor: '#F1F5F9', borderRadius: 20 }}>
                   <Text style={{ color: '#475569', fontSize: 14, lineHeight: 22, fontWeight: '500' }}>{t.desc}</Text>
                </View>

                <TouchableOpacity 
                  disabled={loading} 
                  onPress={handleConfirmBooking} 
                  style={{ 
                    backgroundColor: '#0194F3', paddingVertical: 20, borderRadius: 25, alignItems: 'center', 
                    marginTop: 35, elevation: 10, shadowColor: '#0194F3', shadowOpacity: 0.4, shadowRadius: 15, marginBottom: 50
                  }}
                >
                  {loading ? <ActivityIndicator color="white" /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginRight: 10 }}>{t.confirmBtn}</Text>
                      <Ionicons name="chevron-forward-circle" size={22} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}