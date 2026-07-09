import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import api from '../../lib/api';
import PayInvoiceModal from '../../components/booking/PayInvoiceModal';

// หน้าบิลรายเดือนของผู้เช่า — พอร์ตจาก client/src/page/user/MyBills.jsx
// GET /my-invoices → รายการบิล · จ่ายผ่าน QR PromptPay + แนบสลิป (PayInvoiceModal)
export default function MyBillsScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payInvoice, setPayInvoice] = useState(null); // บิลที่กำลังจ่าย

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/my-invoices');
      setInvoices(res.data?.success && Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert('กรุณาเข้าสู่ระบบ', 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        router.replace('/(auth)/login');
      } else {
        setInvoices([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchInvoices(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchInvoices(); };

  const isPaid = (s) => s === 'ชำระแล้ว';
  const statusColor = (s) => (isPaid(s) ? { bg: '#E3F6ED', fg: '#10B981' } : { bg: '#FEF3C7', fg: '#D97706' });

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white', elevation: 4, zIndex: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="#0194F3" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B' }}>บิลของฉัน</Text>
        <TouchableOpacity onPress={onRefresh} style={{ width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="refresh" size={22} color="#0194F3" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={{ marginTop: 10, color: '#64748B' }}>กำลังโหลดบิล...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {invoices.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="file-tray-outline" size={80} color="#CBD5E1" />
              <Text style={{ fontSize: 16, color: '#94A3B8', marginTop: 15 }}>ยังไม่มีบิล</Text>
            </View>
          ) : (
            invoices.map((inv) => {
              const sc = statusColor(inv.invoice_status);
              const lateFee = Number(inv.late_fee || 0);
              return (
                <View key={inv.invoice_id} style={{ backgroundColor: 'white', borderRadius: 24, padding: 18, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B' }}>บิล #{inv.invoice_id} · ห้อง {inv.room_number}</Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>ออกบิล {formatDate(inv.invoice_date)} · ครบกำหนด {formatDate(inv.due_date)}</Text>
                    </View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: sc.bg }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: sc.fg }}>{inv.invoice_status}</Text>
                    </View>
                  </View>

                  <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                    <BillRow label="ค่าห้อง" value={inv.room_cost} />
                    <BillRow label="ค่าน้ำ" value={inv.water_cost} />
                    <BillRow label="ค่าไฟ" value={inv.elec_cost} />
                    {lateFee > 0 && <BillRow label="ค่าปรับล่าช้า" value={lateFee} danger />}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: '#1E293B' }}>ยอดรวม</Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#0194F3' }}>฿{(Number(inv.total_amount) + lateFee).toLocaleString()}</Text>
                    </View>
                  </View>

                  {!isPaid(inv.invoice_status) && (
                    <TouchableOpacity onPress={() => setPayInvoice(inv)} style={{ backgroundColor: '#D32F2F', paddingVertical: 13, borderRadius: 16, alignItems: 'center', marginTop: 14, flexDirection: 'row', justifyContent: 'center' }}>
                      <Ionicons name="qr-code" size={18} color="white" style={{ marginRight: 8 }} />
                      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>ชำระเงิน (QR PromptPay)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <PayInvoiceModal
        visible={payInvoice !== null}
        invoice={payInvoice}
        onClose={() => setPayInvoice(null)}
        onPaid={fetchInvoices}
      />
    </SafeAreaView>
  );
}

const BillRow = ({ label, value, danger }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
    <Text style={{ color: '#64748B', fontSize: 13 }}>{label}</Text>
    <Text style={{ color: danger ? '#DC2626' : '#334155', fontSize: 13, fontWeight: '600' }}>฿{Number(value || 0).toLocaleString()}</Text>
  </View>
);
