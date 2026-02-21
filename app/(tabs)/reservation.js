import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, 
  ScrollView, StatusBar, Dimensions, Image, Modal, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LuxuryReservationScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('TH'); 
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedRoom, setSelectedRoom] = useState(null);

  const text = {
    TH: {
      review: ' (120 รีวิว)', location: 'ในเมืองเลย ใกล้ มรภ.เลย', 
      daily: 'รายวัน', monthly: 'รายเดือน', selectTitle: 'เลือกห้องพักของคุณ',
      startAt: 'ราคาเริ่มต้นเพียง ', map: 'ดูแผนที่', floor: 'ชั้นที่ ',
      busy: 'จองแล้ว', available: 'ว่าง', backHome: 'กลับหน้าหลัก',
      unitD: ' /คืน', unitM: ' /เดือน', confirmBtn: 'ยืนยันการจองตอนนี้',
      cancel: 'กลับไปเลือกห้องอื่น', desc: 'ห้องพักสุดหรูตกแต่งสไตล์มินิมอล พร้อมระบบความปลอดภัย 24 ชม. และที่จอดรถส่วนตัว'
    },
    EN: {
      review: ' (120 Reviews)', location: 'Loei City, near LRU', 
      daily: 'Daily Stay', monthly: 'Monthly Stay', selectTitle: 'Select Your Room',
      startAt: 'Starting from ', map: 'View Map', floor: 'Floor ',
      busy: 'Busy', available: 'Vacant', backHome: 'Back to Home',
      unitD: ' /day', unitM: ' /month', confirmBtn: 'Book Now',
      cancel: 'Go back', desc: 'Luxury minimalist room with 24h security and private parking.'
    }
  };

  const t = text[lang];

  const floors = [
    { floor: 1, type: 'daily', rooms: ['101', '102', '103', '104', '105', '106'] },
    { floor: 2, type: 'monthly', rooms: ['201', '202', '203', '204', '205', '206'] },
    { floor: 3, type: 'monthly', rooms: ['301', '302', '303', '304', '305', '306'] },
    { floor: 4, type: 'monthly', rooms: ['401', '402', '403', '404', '405', '406'] },
  ];

  const busyRooms = ['102', '205', '304', '401', '406'];

  const content = {
    daily: {
      img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1000',
      price: '฿500',
      unit: t.unitD
    },
    monthly: {
      img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1000',
      price: '฿3,500',
      unit: t.unitM
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F2F5' }}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
        {/* --- 1. Luxury Hero Header --- */}
        <View style={{ height: 350, width: '100%', position: 'relative' }}>
          <Image source={{ uri: content[activeTab].img }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          
          <SafeAreaView style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, position: 'absolute', top: Platform.OS === 'ios' ? 0 : 40, left: 0, right: 0, zIndex: 10 }}>
            <View />
            <TouchableOpacity 
              onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>{lang === 'TH' ? 'EN' : 'TH'}</Text>
            </TouchableOpacity>
          </SafeAreaView>

          <View style={{ position: 'absolute', bottom: 30, left: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10 }}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}> 4.9{t.review}</Text>
            </View>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>Around Loei Residence</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
              <MaterialIcons name="location-pin" size={16} color="#0194F3" />
              <Text style={{ color: '#E2E8F0', fontSize: 14 }}>{t.location}</Text>
            </View>
          </View>
        </View>

        {/* --- 2. Luxury Tab Switcher --- */}
        <View style={{ backgroundColor: '#F0F2F5', paddingVertical: 15, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', backgroundColor: 'white', padding: 5, borderRadius: 50, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
            <TouchableOpacity 
              onPress={() => setActiveTab('daily')}
              style={[{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 40 }, activeTab === 'daily' && { backgroundColor: '#0194F3' }]}
            >
              <Text style={[{ fontSize: 14, fontWeight: '700', color: '#64748B' }, activeTab === 'daily' && { color: 'white' }]}>{t.daily}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveTab('monthly')}
              style={[{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 40 }, activeTab === 'monthly' && { backgroundColor: '#0194F3' }]}
            >
              <Text style={[{ fontSize: 14, fontWeight: '700', color: '#64748B' }, activeTab === 'monthly' && { color: 'white' }]}>{t.monthly}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- 3. Room Selection Grid --- */}
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B' }}>{t.selectTitle}</Text>
              <Text style={{ fontSize: 14, color: '#64748B', marginTop: 2 }}>{t.startAt}{content[activeTab].price}</Text>
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
              <Ionicons name="map-outline" size={18} color="#0194F3" />
              <Text style={{ color: '#0194F3', fontWeight: 'bold', fontSize: 13, marginLeft: 5 }}>{t.map}</Text>
            </TouchableOpacity>
          </View>

          {floors.filter(f => f.type === activeTab).map(floor => (
            <View key={floor.floor} style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 20, elevation: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 15 }}>{t.floor}{floor.floor}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {floor.rooms.map(room => {
                  const isBusy = busyRooms.includes(room);
                  return (
                    <TouchableOpacity 
                      key={room} 
                      disabled={isBusy}
                      onPress={() => setSelectedRoom(room)}
                      style={[{ width: '31%', height: 90, backgroundColor: '#F8FAFC', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }, isBusy && { backgroundColor: '#F1F5F9', opacity: 0.6 }]}
                    >
                      <Text style={[{ fontSize: 18, fontWeight: 'bold', color: '#0194F3' }, isBusy && { color: '#94A3B8' }]}>{room}</Text>
                      <View style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: isBusy ? '#E2E8F0' : '#E3F6ED' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: isBusy ? '#94A3B8' : '#10B981' }}>{isBusy ? t.busy : t.available}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity 
            onPress={() => router.replace('/')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, marginTop: 10, marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 15, backgroundColor: 'white' }}
          >
            <Ionicons name="home-outline" size={20} color="#64748B" />
            <Text style={{ marginLeft: 8, color: '#64748B', fontWeight: '600', fontSize: 15 }}>{t.backHome}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* --- 4. Booking Modal --- */}
      <Modal visible={selectedRoom !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginVertical: 15 }} />
            <Image source={{ uri: content[activeTab].img }} style={{ width: '100%', height: 220 }} />
            
            <View style={{ padding: 25 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#1E293B' }}>Suite Room {selectedRoom}</Text>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0194F3' }}>
                   {content[activeTab].price}
                   <Text style={{fontSize: 14, color: '#999'}}>{content[activeTab].unit}</Text>
                </Text>
              </View>
              
              <Text style={{ color: '#64748B', lineHeight: 22, marginBottom: 25 }}>{t.desc}</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
                <Amenity icon="wifi" label="Free WiFi" />
                <Amenity icon="snowflake" label="Air Con" />
                <Amenity icon="utensils" label="Kitchen" />
                <Amenity icon="tv" label="4K TV" />
              </View>

              <TouchableOpacity 
                style={{ backgroundColor: '#0194F3', paddingVertical: 18, borderRadius: 20, alignItems: 'center', elevation: 5, shadowColor: '#0194F3', shadowOpacity: 0.3, shadowRadius: 10 }}
                onPress={() => { alert(lang === 'TH' ? 'จองสำเร็จ!' : 'Booking Successful!'); setSelectedRoom(null); }}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{t.confirmBtn}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setSelectedRoom(null)} style={{ marginTop: 15, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontWeight: 'bold' }}>{t.cancel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Amenity = ({ icon, label }) => (
  <View style={{ alignItems: 'center' }}>
    <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
      <FontAwesome5 name={icon} size={14} color="#0194F3" />
    </View>
    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>{label}</Text>
  </View>
);