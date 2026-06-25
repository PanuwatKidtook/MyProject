import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal,
  RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View
} from 'react-native';
import api from '../../lib/api';

export default function ReservationListScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // ดึงประวัติการจองจาก API — token จาก interceptor ใน lib/api.js
  const fetchBookings = async () => {
    try {
      const response = await api.post('/checkbooking', {});
      if (response.data?.success && Array.isArray(response.data.data)) {
        setBookings(response.data.data);
      } else {
        setBookings([]);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert('กรุณาเข้าสู่ระบบ', 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        router.replace('/(auth)/login');
      } else {
        setBookings([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [])
  );

  // ยกเลิกการจอง — ใช้ editBooking เปลี่ยน status เป็น 'ยกเลิก'
  const handleCancelBooking = (bookingId) => {
    if (!bookingId) {
      Alert.alert('ผิดพลาด', 'ไม่พบรหัสการจอง');
      return;
    }

    Alert.alert(
      'ยืนยันการยกเลิก',
      'คุณแน่ใจหรือไม่ที่จะยกเลิกการจองนี้?',
      [
        { text: 'เปลี่ยนใจ', style: 'cancel' },
        {
          text: 'ยืนยันยกเลิก',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await api.put(`/editBooking/${bookingId}`, { status: 'ยกเลิก' });
              Alert.alert('สำเร็จ', 'ยกเลิกการจองเรียบร้อยแล้ว');
              fetchBookings();
            } catch (err) {
              const errorMsg = err.response?.data?.message || 'ไม่สามารถยกเลิกได้ กรุณาลองใหม่';
              Alert.alert('ผิดพลาด', errorMsg);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  // กรองตามแท็บ — ใช้ rentType ('daily' หรือ 'monthly') จาก backend
  const filteredBookings = bookings.filter(item => {
    if (activeTab === 'all') return true;
    return item.rentType === activeTab;
  });

  // คำนวณราคารวมจาก field ที่ backend ส่งมา
  const calcPrice = (item) => {
    if (!item.startDate || !item.endDate) return '-';
    const days = Math.ceil(
      (new Date(item.endDate) - new Date(item.startDate)) / 86400000
    ) || 1;
    if (item.rentType === 'monthly') {
      const months = Math.ceil(days / 30) || 1;
      return item.priceMonthly ? `฿${(months * item.priceMonthly).toLocaleString()}` : '-';
    }
    return item.pricePerDay ? `฿${(days * item.pricePerDay).toLocaleString()}` : '-';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" />

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white',
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, zIndex: 10
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="#0194F3" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B' }}>ประวัติการจองของฉัน</Text>
        <TouchableOpacity onPress={onRefresh} style={{ width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="refresh" size={22} color="#0194F3" />
        </TouchableOpacity>
      </View>

      {/* แท็บกรองประเภท */}
      <View style={{ flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        {[
          { id: 'all', title: 'ทั้งหมด' },
          { id: 'daily', title: 'รายวัน' },
          { id: 'monthly', title: 'รายเดือน' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: isActive ? '#0194F3' : 'transparent' }}
            >
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: isActive ? '#0194F3' : '#64748B' }}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={{ marginTop: 10, color: '#64748B' }}>กำลังโหลดข้อมูล...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredBookings.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="receipt-outline" size={80} color="#CBD5E1" />
              <Text style={{ fontSize: 16, color: '#94A3B8', marginTop: 15 }}>
                ไม่มีประวัติการจองในหมวดหมู่นี้
              </Text>
            </View>
          ) : (
            filteredBookings.map((item, index) => (
              <View key={index} style={{
                backgroundColor: 'white', borderRadius: 28, marginBottom: 20,
                overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1
              }}>
                <View style={{ flexDirection: 'row' }}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400' }}
                    style={{ width: 110, height: 150 }}
                  />
                  <View style={{ flex: 1, padding: 15, justifyContent: 'space-between' }}>
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontWeight: '800', fontSize: 18, color: '#1E293B' }}>ห้อง {item.roomNumber}</Text>
                        <View style={{
                          paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                          backgroundColor: item.bookingStatus === 'รอชำระมัดจำ' ? '#FEF3C7' : '#E3F6ED'
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: item.bookingStatus === 'รอชำระมัดจำ' ? '#D97706' : '#10B981' }}>
                            {item.bookingStatus}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
                        {item.rentType === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0194F3', marginTop: 5 }}>
                        {calcPrice(item)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setSelectedDetail(item)}
                        style={{ flex: 1, backgroundColor: '#0194F3', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>ดูข้อมูล</Text>
                      </TouchableOpacity>
                      {(item.bookingStatus === 'รอชำระมัดจำ' || item.bookingStatus === 'ยืนยันการจอง') && (
                        <TouchableOpacity
                          onPress={() => handleCancelBooking(item.bookingId)}
                          style={{ flex: 1, backgroundColor: '#FEF2F2', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444' }}>ยกเลิก</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal รายละเอียด */}
      <Modal visible={selectedDetail !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 25 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 30, padding: 25 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ionicons name="information-circle" size={50} color="#0194F3" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>ข้อมูลการเข้าพัก</Text>
            </View>
            <View style={{ gap: 12 }}>
              <DetailRow label="ID การจอง" value={`#${selectedDetail?.bookingId}`} />
              <DetailRow label="หมายเลขห้อง" value={selectedDetail?.roomNumber} />
              <DetailRow label="ประเภท" value={selectedDetail?.rentType === 'monthly' ? 'รายเดือน' : 'รายวัน'} />
              <DetailRow label="ราคารวม" value={calcPrice(selectedDetail || {})} />
              <DetailRow label="วันที่เข้าพัก" value={selectedDetail?.startDate ? new Date(selectedDetail.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} />
              <DetailRow label="ถึงวันที่" value={selectedDetail?.endDate ? new Date(selectedDetail.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} />
              <DetailRow label="สถานะ" value={selectedDetail?.bookingStatus || '-'} />
            </View>
            <TouchableOpacity
              onPress={() => setSelectedDetail(null)}
              style={{ backgroundColor: '#0194F3', paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 25 }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>ปิดหน้าต่าง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#EEE' }}>
        <TouchableOpacity onPress={() => router.replace('/')} style={{ backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 20, alignItems: 'center' }}>
          <Text style={{ color: '#475569', fontWeight: 'bold' }}>กลับหน้าหลัก</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const DetailRow = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8 }}>
    <Text style={{ color: '#64748B' }}>{label}</Text>
    <Text style={{ fontWeight: '600', color: '#1E293B' }}>{value}</Text>
  </View>
);
