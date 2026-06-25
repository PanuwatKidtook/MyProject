import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal,
  RefreshControl,
  SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View
} from 'react-native';

export default function ReservationListScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  // 📑 เพิ่ม State สำหรับจัดการแท็บการกรองข้อมูล ('all', 'daily', 'monthly')
  const [activeTab, setActiveTab] = useState('all');

  // ✅ 1. ฟังก์ชันดึงข้อมูลจาก API
  const fetchBookings = async () => {
    try {
      const payload = { userId: 5 }; // แก้เป็น ID ผู้ใช้ที่เข้าสู่ระบบจริงถ้ามี
      const response = await axios.post('https://projeccty3-server.onrender.com/api/checkbooking', payload);
      
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        const myData = response.data.data.reverse(); // เอาอันล่าสุดขึ้นก่อน
        setBookings(myData);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ 2. ระบบ Auto-Refresh
  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [])
  );

  // ✅ 3. ฟังก์ชันยกเลิกการจอง
  const handleCancelBooking = (bookingId) => {
    if (!bookingId) {
      Alert.alert("ผิดพลาด", "ไม่พบรหัสการจอง");
      return;
    }

    Alert.alert(
      "ยืนยันการยกเลิก",
      "คุณแน่ใจหรือไม่ที่จะยกเลิกการจองนี้? ข้อมูลจะถูกลบออกจากระบบทันที",
      [
        { text: "เปลี่ยนใจ", style: "cancel" },
        { 
          text: "ยืนยันยกเลิก", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const response = await axios.delete(`https://projeccty3-server.onrender.com/api/Booking/${bookingId}`);
              
              if (response.status === 200 || response.status === 204 || response.data.success) {
                Alert.alert("สำเร็จ", "ยกเลิกการจองเรียบร้อยแล้ว");
                fetchBookings(); 
              } else {
                Alert.alert("ผิดพลาด", "ไม่สามารถยกเลิกรายการได้");
              }
            } catch (err) {
              console.error("Cancel Error:", err);
              const errorMsg = err.response?.data?.message || "ไม่สามารถยกเลิกได้ กรุณาลองใหม่";
              Alert.alert("ผิดพลาด", errorMsg);
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

  // 🔍 ฟังก์ชัน Filter จำแนกข้อมูลตามแท็บที่เลือก
  const filteredBookings = bookings.filter(item => {
    if (activeTab === 'all') return true;
    
    const typeStr = (item.roomType || '').toLowerCase();
    // ตรวจสอบคำว่า "รายวัน" / "daily" หรือ "รายเดือน" / "monthly" ในโครงสร้างข้อมูล
    if (activeTab === 'daily') {
      return typeStr.includes('รายวัน') || typeStr.includes('daily');
    }
    if (activeTab === 'monthly') {
      return typeStr.includes('รายเดือน') || typeStr.includes('monthly');
    }
    return true;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
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

      {/* 🧭 Tabs Navigator สำหรับเลือกหมวดหมู่ */}
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
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderBottomWidth: 3,
                borderBottomColor: isActive ? '#0194F3' : 'transparent'
              }}
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
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: item.bookingStatus === 'PENDING' ? '#FEF3C7' : '#E3F6ED' }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: item.bookingStatus === 'PENDING' ? '#D97706' : '#10B981' }}>{item.bookingStatus || 'SUCCESS'}</Text>
                        </View>
                      </View>
                      <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
                        ประเภท: {item.roomType || 'Standard Room'}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0194F3', marginTop: 5 }}>฿{item.totalPrice}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        onPress={() => setSelectedDetail(item)}
                        style={{ flex: 1, backgroundColor: '#0194F3', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>ดูข้อมูล</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleCancelBooking(item.bookingId)}
                        style={{ flex: 1, backgroundColor: '#FEF2F2', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444' }}>ยกเลิก</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* --- Detail Modal --- */}
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
              <DetailRow label="ประเภทห้อง" value={selectedDetail?.roomType || 'Standard'} />
              <DetailRow label="ราคารวม" value={`฿${selectedDetail?.totalPrice}`} />
              <DetailRow label="วันที่เข้าพัก" value={selectedDetail?.startDate ? new Date(selectedDetail.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} />
              <DetailRow label="ถึงวันที่" value={selectedDetail?.endDate ? new Date(selectedDetail.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} />
              <DetailRow label="สถานะ" value={selectedDetail?.bookingStatus || 'ยืนยันแล้ว'} />
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

      {/* Footer */}
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