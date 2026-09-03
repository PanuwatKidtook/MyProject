import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, SafeAreaView, StatusBar, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import api from '../../lib/api';

// หน้าสัญญาเช่าของผู้เช่า — พอร์ตจาก client/src/page/user/MyContracts.jsx
// GET /my-contracts · แจ้งย้ายออก (notice-request) · ขอต่อสัญญา (renew-request) · ดูไฟล์สัญญา
export default function MyContractsScreen() {
  const router = useRouter();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchContracts = async () => {
    try {
      const res = await api.get('/my-contracts');
      setContracts(res.data?.success && Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert('กรุณาเข้าสู่ระบบ', 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        router.replace('/(auth)/login');
      } else {
        setContracts([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchContracts(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchContracts(); };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  // จำนวนวันที่เหลือจนครบสัญญา
  const daysLeft = (endDate) => Math.ceil((new Date(endDate) - new Date()) / 86400000);

  // ยิงคำขอ (แจ้งย้ายออก / ต่อสัญญา) พร้อม popup ยืนยัน
  const doRequest = (endpoint, contractId, okMsg) => {
    setActing(true);
    api.post(`/contract/${contractId}/${endpoint}`)
      .then((res) => {
        Alert.alert('สำเร็จ', res.data?.message || okMsg);
        fetchContracts();
      })
      .catch((err) => Alert.alert('ผิดพลาด', err.response?.data?.message || 'ทำรายการไม่สำเร็จ'))
      .finally(() => setActing(false));
  };

  const confirmNotice = (id) => Alert.alert(
    'แจ้งย้ายออก',
    'ต้องการส่งคำขอแจ้งย้ายออกใช่หรือไม่? (เริ่มนับ 30 วันเมื่อแอดมินยืนยัน)',
    [{ text: 'ยกเลิก', style: 'cancel' }, { text: 'ส่งคำขอ', onPress: () => doRequest('notice-request', id, 'ส่งคำขอแจ้งย้ายออกแล้ว') }]
  );

  const confirmRenew = (id) => Alert.alert(
    'ขอต่อสัญญา',
    'ต้องการส่งคำขอต่อสัญญาใช่หรือไม่?',
    [{ text: 'ยกเลิก', style: 'cancel' }, { text: 'ขอต่อสัญญา', onPress: () => doRequest('renew-request', id, 'ส่งคำขอต่อสัญญาแล้ว') }]
  );

  const openFile = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert('ผิดพลาด', 'เปิดไฟล์สัญญาไม่ได้'));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white', elevation: 4, zIndex: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="#0194F3" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B' }}>สัญญาเช่าของฉัน</Text>
        <TouchableOpacity onPress={onRefresh} style={{ width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="refresh" size={22} color="#0194F3" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={{ marginTop: 10, color: '#64748B' }}>กำลังโหลดสัญญา...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {contracts.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="document-text-outline" size={80} color="#CBD5E1" />
              <Text style={{ fontSize: 16, color: '#94A3B8', marginTop: 15 }}>ยังไม่มีสัญญาเช่า</Text>
            </View>
          ) : (
            contracts.map((c) => {
              const active = c.contract_status === 'มีผลใช้งาน' && !c.settled_at;
              const noticeConfirmed = !!c.notice_date;
              const noticePending = !!c.notice_requested_at && !c.notice_date;
              const renewPending = !!c.renewal_requested_at;
              const nearExpiry = active && !noticeConfirmed && !noticePending && c.end_date && daysLeft(c.end_date) <= 30;

              return (
                <View key={c.contract_id} style={{ backgroundColor: 'white', borderRadius: 24, padding: 18, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>ห้อง {c.room_number}</Text>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: active ? '#E3F6ED' : '#F1F5F9' }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: active ? '#10B981' : '#64748B' }}>{c.settled_at ? 'สิ้นสุดแล้ว' : c.contract_status}</Text>
                    </View>
                  </View>

                  {/* แบนเนอร์ใกล้ครบสัญญา */}
                  {nearExpiry && (
                    <View style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: '#9A3412', fontWeight: '800', fontSize: 13 }}>⏰ สัญญาจะครบกำหนดในอีก {daysLeft(c.end_date)} วัน</Text>
                      <Text style={{ color: '#C2410C', fontSize: 12, marginTop: 2 }}>กรุณาติดต่อต่อสัญญาหรือแจ้งย้ายออก</Text>
                    </View>
                  )}

                  {/* สถานะแจ้งย้ายออก / ต่อสัญญา */}
                  {noticeConfirmed && <StatusPill color="#DC2626" bg="#FEF2F2" text={`แจ้งย้ายออกแล้ว (มีผล ${formatDate(c.notice_date)})`} />}
                  {noticePending && <StatusPill color="#D97706" bg="#FEF3C7" text="รอแอดมินยืนยันการแจ้งย้ายออก" />}
                  {renewPending && <StatusPill color="#7C3AED" bg="#F3E8FF" text="ส่งคำขอต่อสัญญาแล้ว รอแอดมินดำเนินการ" />}

                  <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginTop: 6 }}>
                    <Row label="เริ่มสัญญา" value={formatDate(c.start_date)} />
                    <Row label="สิ้นสุดสัญญา" value={formatDate(c.end_date)} />
                    <Row label="ค่าเช่าล่วงหน้า" value={`฿${Number(c.rent_prepaid || 0).toLocaleString()}`} />
                    <Row label="เงินประกัน" value={`฿${Number(c.security_deposit || 0).toLocaleString()}`} />
                    <Row label="มัดจำกุญแจ" value={`฿${Number(c.key_deposit || 0).toLocaleString()}`} />
                    {c.settled_at && <Row label="เงินคืนสุทธิ" value={`฿${Number(c.refund_amount || 0).toLocaleString()}`} />}
                  </View>

                  {/* ปุ่มดูไฟล์สัญญา */}
                  {c.contract_file_url && (
                    <TouchableOpacity onPress={() => openFile(c.contract_file_url)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE', paddingVertical: 12, borderRadius: 14, marginTop: 12 }}>
                      <Ionicons name="document-attach-outline" size={18} color="#0194F3" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#0194F3', fontWeight: '800', fontSize: 14 }}>ดูไฟล์สัญญา</Text>
                    </TouchableOpacity>
                  )}

                  {/* ปุ่มแจ้งย้ายออก / ขอต่อสัญญา (เฉพาะสัญญาที่ยัง active และยังไม่แจ้งย้ายออก) */}
                  {active && !noticeConfirmed && !noticePending && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      {!renewPending && (
                        <TouchableOpacity disabled={acting} onPress={() => confirmRenew(c.contract_id)} style={{ flex: 1, backgroundColor: '#0194F3', paddingVertical: 12, borderRadius: 14, alignItems: 'center', opacity: acting ? 0.5 : 1 }}>
                          <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>ขอต่อสัญญา</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity disabled={acting} onPress={() => confirmNotice(c.contract_id)} style={{ flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingVertical: 12, borderRadius: 14, alignItems: 'center', opacity: acting ? 0.5 : 1 }}>
                        <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13 }}>แจ้งย้ายออก</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const Row = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
    <Text style={{ color: '#94A3B8', fontSize: 13 }}>{label}</Text>
    <Text style={{ color: '#1E293B', fontSize: 13, fontWeight: '700' }}>{value}</Text>
  </View>
);

const StatusPill = ({ color, bg, text }) => (
  <View style={{ backgroundColor: bg, borderRadius: 12, padding: 10, marginBottom: 10 }}>
    <Text style={{ color, fontSize: 12, fontWeight: '800' }}>{text}</Text>
  </View>
);
