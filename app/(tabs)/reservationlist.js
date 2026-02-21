import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, 
  ScrollView, StatusBar, StyleSheet, Dimensions, Image 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function ReservationListScreen() {
  const router = useRouter();

  // ข้อมูลจำลองรายการจอง
  const [bookings, setBookings] = useState([
    {
      id: 'BK001',
      roomNo: '102',
      type: 'Daily',
      checkIn: '12 ก.พ. 2024',
      status: 'Confirmed',
      price: '฿500',
      img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1000'
    },
    {
      id: 'BK002',
      roomNo: '304',
      type: 'Monthly',
      checkIn: '01 มี.ค. 2024',
      status: 'Pending',
      price: '฿3,500',
      img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1000'
    }
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* --- Custom Header --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0194F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายการจองของฉัน</Text>
        <View style={{ width: 45 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* --- Summary Card --- */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>รวมการจองทั้งหมด</Text>
            <Text style={styles.summaryValue}>{bookings.length} รายการ</Text>
          </View>
          <MaterialCommunityIcons name="book-clock" size={40} color="rgba(255,255,255,0.3)" />
        </View>

        <Text style={styles.sectionTitle}>ประวัติการจองล่าสุด</Text>

        {bookings.length > 0 ? (
          bookings.map((item) => (
            <View key={item.id} style={styles.bookingCard}>
              <Image source={{ uri: item.img }} style={styles.roomImg} />
              
              <View style={styles.cardDetail}>
                <View style={styles.cardHeader}>
                  <Text style={styles.roomText}>ห้อง {item.roomNo}</Text>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: item.status === 'Confirmed' ? '#E3F6ED' : '#FFF4E5' }
                  ]}>
                    <Text style={[
                      styles.statusText, 
                      { color: item.status === 'Confirmed' ? '#10B981' : '#FF9800' }
                    ]}>
                      {item.status === 'Confirmed' ? 'ยืนยันแล้ว' : 'รอตรวจสอบ'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color="#64748B" />
                  <Text style={styles.infoText}> เริ่มเข้าพัก: {item.checkIn}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="bookmark-outline" size={14} color="#64748B" />
                  <Text style={styles.infoText}> ประเภท: {item.type}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.priceText}>{item.price}</Text>
                  <TouchableOpacity style={styles.detailBtn}>
                    <Text style={styles.detailBtnText}>ดูรายละเอียด</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={80} color="#CBD5E1" />
            <Text style={styles.emptyText}>ยังไม่มีรายการจองในขณะนี้</Text>
          </View>
        )}
      </ScrollView>

      {/* --- Bottom Back Home --- */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.homeBtn}
          onPress={() => router.replace('/')}
        >
          <Ionicons name="home" size={20} color="white" />
          <Text style={styles.homeBtnText}>กลับหน้าหลัก</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  backBtn: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  
  summaryCard: { 
    backgroundColor: '#0194F3', borderRadius: 24, padding: 25, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 30, elevation: 5, shadowColor: '#0194F3', shadowOpacity: 0.3, shadowRadius: 10
  },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  summaryValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 15 },
  
  bookingCard: { 
    backgroundColor: 'white', borderRadius: 20, marginBottom: 15, 
    overflow: 'hidden', flexDirection: 'row', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10
  },
  roomImg: { width: 100, height: '100%' },
  cardDetail: { flex: 1, padding: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  roomText: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  infoText: { fontSize: 13, color: '#64748B', marginLeft: 5 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  priceText: { fontSize: 16, fontWeight: 'bold', color: '#0194F3' },
  detailBtn: { backgroundColor: '#F0F8FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  detailBtnText: { color: '#0194F3', fontSize: 12, fontWeight: 'bold' },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 10 },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'white' },
  homeBtn: { 
    backgroundColor: '#0194F3', flexDirection: 'row', justifyContent: 'center', 
    alignItems: 'center', paddingVertical: 15, borderRadius: 15 
  },
  homeBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 16 }
});