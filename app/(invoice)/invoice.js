import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal,
  RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import api from '../../lib/api';

// สีตามสถานะบิล
const STATUS_COLOR = {
  'ยังไม่ชำระ': { bg: '#FEF2F2', text: '#EF4444' },
  'ชำระบางส่วน': { bg: '#FEF3C7', text: '#D97706' },
  'ชำระแล้ว': { bg: '#E3F6ED', text: '#10B981' },
  'ยกเลิก': { bg: '#F1F5F9', text: '#64748B' },
};

const PAYMENT_METHODS = ['โอนเงิน', 'เงินสด', 'บัตรเครดิต', 'อื่นๆ'];

export default function InvoiceScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // รายละเอียดบิลที่กำลังเปิดดู
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // QR พร้อมเพย์
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // แจ้งชำระเงิน
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('โอนเงิน');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // ดึงบิลของตัวเองจาก API
  const fetchInvoices = async () => {
    try {
      const response = await api.get('/my-invoices');
      if (response.data?.success && Array.isArray(response.data.data)) {
        setInvoices(response.data.data);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert('กรุณาเข้าสู่ระบบ', 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        router.replace('/(auth)/login');
      } else {
        Alert.alert('ผิดพลาด', 'ไม่สามารถดึงรายการบิลได้ กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInvoices();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  const filteredInvoices = invoices.filter(item => {
    if (activeTab === 'all') return true;
    return item.invoice_status === activeTab;
  });

  // เปิดดูรายละเอียดบิล — ดึงข้อมูลเต็มจาก /invoice/:id
  const openDetail = async (invoiceId) => {
    setSelectedId(invoiceId);
    setDetail(null);
    setQrData(null);
    setShowPayForm(false);
    setDetailLoading(true);
    try {
      const response = await api.get(`/invoice/${invoiceId}`);
      if (response.data?.success) {
        setDetail(response.data.data);
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงรายละเอียดบิลได้');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setQrData(null);
    setShowPayForm(false);
  };

  // ขอ QR พร้อมเพย์สำหรับบิลที่เปิดอยู่
  const fetchQr = async () => {
    if (!selectedId) return;
    setQrLoading(true);
    try {
      const response = await api.get(`/invoice/${selectedId}/promptpay`);
      if (response.data?.success) {
        setQrData(response.data.data);
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'ขอ QR พร้อมเพย์ไม่สำเร็จ';
      Alert.alert('ผิดพลาด', msg);
    } finally {
      setQrLoading(false);
    }
  };

  // เปิดฟอร์มแจ้งชำระเงิน — ตั้งยอดเริ่มต้นเป็นยอดคงเหลือ
  const openPayForm = () => {
    const remaining = (Number(detail?.total_amount) || 0) + (Number(detail?.late_fee) || 0);
    setPayAmount(remaining > 0 ? String(remaining) : '');
    setPayMethod('โอนเงิน');
    setShowPayForm(true);
  };

  // ส่งแจ้งชำระเงิน — backend จะตั้งสถานะเป็น 'รอตรวจ' ให้แอดมินตรวจสอบ (ยกเว้นแอดมินจ่ายเงินสดเอง)
  const submitPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      Alert.alert('กรอกยอดเงินให้ถูกต้อง', 'ยอดชำระต้องมากกว่า 0');
      return;
    }
    setPaySubmitting(true);
    try {
      await api.post('/payment', {
        invoice_id: selectedId,
        amount_paid: amount,
        payment_method: payMethod,
      });
      Alert.alert('แจ้งชำระเงินสำเร็จ', 'รอเจ้าหน้าที่ตรวจสอบการชำระเงิน', [
        { text: 'ตกลง', onPress: () => { closeDetail(); fetchInvoices(); } },
      ]);
    } catch (error) {
      const msg = error.response?.data?.message || 'แจ้งชำระเงินไม่สำเร็จ กรุณาลองใหม่';
      Alert.alert('ผิดพลาด', msg);
    } finally {
      setPaySubmitting(false);
    }
  };

  const formatMonth = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
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
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B' }}>บิลค่าน้ำ ค่าไฟ และค่าเช่าห้อง</Text>
        <TouchableOpacity onPress={onRefresh} style={{ width: 45, height: 45, borderRadius: 12, backgroundColor: '#F0F8FF', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="refresh" size={22} color="#0194F3" />
        </TouchableOpacity>
      </View>

      {/* แท็บกรองสถานะ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}
        contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10, gap: 10 }}
      >
        {[
          { id: 'all', title: 'ทั้งหมด' },
          { id: 'ยังไม่ชำระ', title: 'ยังไม่ชำระ' },
          { id: 'ชำระบางส่วน', title: 'ชำระบางส่วน' },
          { id: 'ชำระแล้ว', title: 'ชำระแล้ว' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999,
                backgroundColor: isActive ? '#0194F3' : '#F1F5F9'
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: isActive ? 'white' : '#64748B' }}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={{ marginTop: 10, color: '#64748B' }}>กำลังโหลดข้อมูล...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredInvoices.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="receipt-outline" size={80} color="#CBD5E1" />
              <Text style={{ fontSize: 16, color: '#94A3B8', marginTop: 15 }}>
                ไม่มีบิลในหมวดหมู่นี้
              </Text>
            </View>
          ) : (
            filteredInvoices.map((item) => {
              const color = STATUS_COLOR[item.invoice_status] || STATUS_COLOR['ยังไม่ชำระ'];
              return (
                <TouchableOpacity
                  key={item.invoice_id}
                  onPress={() => openDetail(item.invoice_id)}
                  style={{
                    backgroundColor: 'white', borderRadius: 22, padding: 18, marginBottom: 15,
                    elevation: 6, shadowColor: '#000', shadowOpacity: 0.08
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: '#1E293B' }}>
                      ห้อง {item.room_number} · {formatMonth(item.invoice_date)}
                    </Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: color.bg }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: color.text }}>{item.invoice_status}</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 6 }}>
                    ครบกำหนดชำระ {formatDate(item.due_date)}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0194F3', marginTop: 8 }}>
                    ฿{Number(item.total_amount || 0).toLocaleString()}
                  </Text>
                  {item.late_fee > 0 && (
                    <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 2, fontWeight: '600' }}>
                      + ค่าปรับล่าช้า ฿{Number(item.late_fee).toLocaleString()}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal รายละเอียดบิล + ชำระเงิน */}
      <Modal visible={selectedId !== null} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '85%' }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {detailLoading || !detail ? (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#0194F3" />
                </View>
              ) : (
                <>
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Ionicons name="receipt" size={50} color="#0194F3" />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>รายละเอียดใบแจ้งหนี้</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>ห้อง {detail.room_number} · {formatMonth(detail.invoice_date)}</Text>
                  </View>

                  <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15, marginBottom: 15 }}>
                    {(detail.details || []).map((line, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                        <Text style={{ color: '#334155', fontSize: 13 }}>{line.item_name}</Text>
                        <Text style={{ color: '#334155', fontSize: 13, fontWeight: '600' }}>฿{Number(line.subtotal || 0).toLocaleString()}</Text>
                      </View>
                    ))}
                    {detail.late_fee > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                        <Text style={{ color: '#EF4444', fontSize: 13 }}>ค่าปรับล่าช้า</Text>
                        <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>฿{Number(detail.late_fee).toLocaleString()}</Text>
                      </View>
                    )}
                    <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 8, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '800', fontSize: 15, color: '#1E293B' }}>ยอดรวม</Text>
                      <Text style={{ fontWeight: '800', fontSize: 15, color: '#0194F3' }}>
                        ฿{(Number(detail.total_amount || 0) + Number(detail.late_fee || 0)).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 8, marginBottom: 15 }}>
                    <DetailRow label="สถานะ" value={detail.invoice_status} />
                    <DetailRow label="ครบกำหนดชำระ" value={formatDate(detail.due_date)} />
                  </View>

                  {detail.invoice_status !== 'ชำระแล้ว' && detail.invoice_status !== 'ยกเลิก' && (
                    <>
                      {qrData ? (
                        <View style={{ alignItems: 'center', backgroundColor: '#F0F9FF', borderRadius: 20, padding: 20, marginBottom: 15 }}>
                          <Image source={{ uri: qrData.qrImage }} style={{ width: 200, height: 200 }} resizeMode="contain" />
                          <Text style={{ marginTop: 10, fontSize: 16, fontWeight: 'bold', color: '#0369A1' }}>
                            ยอดชำระ ฿{Number(qrData.amount || 0).toLocaleString()}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>สแกนจ่ายผ่านแอปธนาคาร</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={fetchQr}
                          disabled={qrLoading}
                          style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginBottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                          {qrLoading ? <ActivityIndicator color="#0284C7" /> : <Ionicons name="qr-code" size={18} color="#0284C7" />}
                          <Text style={{ color: '#0284C7', fontWeight: 'bold' }}>ขอ QR พร้อมเพย์</Text>
                        </TouchableOpacity>
                      )}

                      {!showPayForm ? (
                        <TouchableOpacity
                          onPress={openPayForm}
                          style={{ backgroundColor: '#0194F3', paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginBottom: 10 }}
                        >
                          <Text style={{ color: 'white', fontWeight: 'bold' }}>แจ้งชำระเงิน</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15, marginBottom: 10 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 }}>ยอดที่ชำระ (บาท)</Text>
                          <TextInput
                            value={payAmount}
                            onChangeText={setPayAmount}
                            keyboardType="numeric"
                            placeholder="ระบุยอดเงิน"
                            style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 12 }}
                          />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 }}>ช่องทางชำระ</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                            {PAYMENT_METHODS.map((m) => {
                              const active = payMethod === m;
                              return (
                                <TouchableOpacity
                                  key={m}
                                  onPress={() => setPayMethod(m)}
                                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? '#0194F3' : 'white', borderWidth: 1, borderColor: active ? '#0194F3' : '#E2E8F0' }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: active ? 'white' : '#475569' }}>{m}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          <TouchableOpacity
                            onPress={submitPayment}
                            disabled={paySubmitting}
                            style={{ backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                          >
                            {paySubmitting ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold' }}>ยืนยันแจ้งชำระเงิน</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}

                  <TouchableOpacity
                    onPress={closeDetail}
                    style={{ backgroundColor: '#F1F5F9', paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 }}
                  >
                    <Text style={{ color: '#475569', fontWeight: 'bold' }}>ปิดหน้าต่าง</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const DetailRow = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8 }}>
    <Text style={{ color: '#64748B' }}>{label}</Text>
    <Text style={{ fontWeight: '600', color: '#1E293B' }}>{value}</Text>
  </View>
);
