import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
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

const PAYMENT_STATUS_COLOR = {
  'รอตรวจ': { bg: '#FEF3C7', text: '#D97706' },
  'ยืนยันแล้ว': { bg: '#E3F6ED', text: '#10B981' },
  'ปฏิเสธ': { bg: '#FEF2F2', text: '#EF4444' },
};

const PAYMENT_METHODS = ['โอนเงิน', 'เงินสด', 'บัตรเครดิต', 'อื่นๆ'];

// ไอคอน+สีของแต่ละรายการย่อยในบิล ตามคำในชื่อรายการ (ค่าน้ำ/ค่าไฟ/ค่าห้อง)
const itemStyle = (itemName) => {
  const name = String(itemName || '');
  if (name.includes('น้ำ')) return { icon: 'water-outline', color: '#06B6D4', bg: '#ECFEFF', rank: 0 };
  if (name.includes('ไฟ')) return { icon: 'flash-outline', color: '#F59E0B', bg: '#FFFBEB', rank: 1 };
  return { icon: 'home-outline', color: '#0F7EE6', bg: '#EFF6FF', rank: 2 };
};

// เรียงรายการบิลให้อยู่ในลำดับ ค่าน้ำ → ค่าไฟ → ค่าห้อง เสมอ ให้อ่านง่าย
const sortedBillDetails = (details) => {
  return [...(details || [])].sort((a, b) => itemStyle(a.item_name).rank - itemStyle(b.item_name).rank);
};

const formatMonth = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ค่าปรับล่าช้าคิด 50 บาท/วัน (ตรงกับ calculateLateFee ฝั่ง backend) — ย้อนคำนวณจำนวนวันเพื่ออธิบายเหตุผล
const lateDays = (lateFee) => Math.round(Number(lateFee || 0) / 50);

// ===================================================================
// การ์ดรายละเอียดบิล 1 ใบแบบยาวลงมา: ค่าห้อง/น้ำ/ไฟ + เหตุผลค่าปรับ + ชำระเงิน (QR/แจ้งโอน+สลิป) + ประวัติการชำระ
// ===================================================================
function InvoiceDetailCard({ detail, onPaid, onSlipPreview }) {
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [payTab, setPayTab] = useState('qr'); // 'qr' | 'manual' — เลือกวิธีจ่ายแบบการ์ด 2 ช่อง เหมือนหน้า bill.js
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('โอนเงิน');
  const [paySlip, setPaySlip] = useState(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [receiptGenerating, setReceiptGenerating] = useState(false);

  const remaining = (Number(detail.total_amount) || 0) + (Number(detail.late_fee) || 0);
  const billItems = sortedBillDetails(detail.details);

  useEffect(() => {
    setPayAmount(remaining > 0 ? String(remaining) : '');
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.invoice_id]);

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const response = await api.get('/my-payments');
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setPayments(rows.filter((p) => String(p.invoice_id) === String(detail.invoice_id)));
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchQr = async () => {
    setQrLoading(true);
    try {
      const response = await api.get(`/invoice/${detail.invoice_id}/promptpay`);
      if (response.data?.success) setQrData(response.data.data);
    } catch (error) {
      Alert.alert('ผิดพลาด', error.response?.data?.message || 'ขอ QR พร้อมเพย์ไม่สำเร็จ');
    } finally {
      setQrLoading(false);
    }
  };

  const pickPaySlip = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตให้เข้าถึงคลังรูปภาพเพื่อแนบสลิป');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setPaySlip(res.assets[0]);
  };

  const submitPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      Alert.alert('กรอกยอดเงินให้ถูกต้อง', 'ยอดชำระต้องมากกว่า 0');
      return;
    }
    setPaySubmitting(true);
    try {
      const form = new FormData();
      form.append('invoice_id', String(detail.invoice_id));
      form.append('amount_paid', String(amount));
      form.append('payment_method', payMethod);
      if (paySlip) {
        form.append('slip', {
          uri: paySlip.uri,
          name: paySlip.fileName || `slip_${Date.now()}.jpg`,
          type: paySlip.mimeType || 'image/jpeg',
        });
      }
      await api.post('/payment', form);
      Alert.alert('แจ้งชำระเงินสำเร็จ', 'รอเจ้าหน้าที่ตรวจสอบการชำระเงิน');
      setPaySlip(null);
      fetchPayments();
      onPaid && onPaid();
    } catch (error) {
      Alert.alert('ผิดพลาด', error.response?.data?.message || 'แจ้งชำระเงินไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setPaySubmitting(false);
    }
  };

  // สร้างใบเสร็จสรุปยอด (PDF) จากรายละเอียดบิลที่ชำระแล้ว แล้วเปิดให้ดู/แชร์/บันทึก
  const generateReceipt = async () => {
    setReceiptGenerating(true);
    try {
      const rows = billItems.map((line) => `
        <tr>
          <td class="cell">${line.item_name}</td>
          <td class="cell amount">฿${Number(line.subtotal || 0).toLocaleString()}</td>
        </tr>
      `).join('');
      const lastPayment = payments.find((p) => p.payment_status === 'ยืนยันแล้ว') || payments[0];
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1E293B; }
              h1 { font-size: 20px; margin-bottom: 2px; }
              .sub { color: #64748B; font-size: 12px; margin-bottom: 24px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
              .cell { padding: 10px 4px; border-bottom: 1px solid #E2E8F0; font-size: 13px; }
              .amount { text-align: right; font-weight: bold; }
              .total-row td { padding-top: 14px; font-size: 16px; font-weight: bold; border-bottom: none; }
              .badge { display: inline-block; background: #E3F6ED; color: #10B981; font-weight: bold; font-size: 12px; padding: 4px 12px; border-radius: 999px; }
              .footer { margin-top: 28px; font-size: 11px; color: #94A3B8; }
            </style>
          </head>
          <body>
            <h1>ใบเสร็จรับเงิน · ห้อง ${detail.room_number}</h1>
            <div class="sub">บิลประจำเดือน ${formatMonth(detail.invoice_date)} · ครบกำหนด ${formatDate(detail.due_date)}</div>
            <span class="badge">ชำระแล้ว</span>
            <table style="margin-top:20px;">
              ${rows}
              ${detail.late_fee > 0 ? `<tr><td class="cell">ค่าปรับชำระล่าช้า (${lateDays(detail.late_fee)} วัน)</td><td class="cell amount">฿${Number(detail.late_fee).toLocaleString()}</td></tr>` : ''}
              <tr class="total-row"><td>ยอดชำระทั้งหมด</td><td class="amount">฿${remaining.toLocaleString()}</td></tr>
            </table>
            ${lastPayment ? `<div class="sub">ชำระผ่าน ${lastPayment.payment_method || '-'} เมื่อ ${formatDate(lastPayment.payment_date)}</div>` : ''}
            <div class="footer">เอกสารนี้สร้างโดยระบบอัตโนมัติ</div>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', 'สร้างใบเสร็จ PDF ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setReceiptGenerating(false);
    }
  };

  const canPay = detail.invoice_status !== 'ชำระแล้ว' && detail.invoice_status !== 'ยกเลิก';

  return (
    <View style={{ marginBottom: 24 }}>
      {/* ยอดรวมที่ต้องจ่ายทั้งหมด */}
      <View style={{ backgroundColor: '#0F7EE6', borderRadius: 24, padding: 18, marginBottom: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' }}>
          บิลประจำเดือน {formatMonth(detail.invoice_date)} · ยอดที่ต้องชำระทั้งหมด
        </Text>
        <Text style={{ color: 'white', fontSize: 32, fontWeight: '900', marginTop: 2 }}>
          ฿{remaining.toLocaleString()}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
            <Ionicons name={detail.invoice_status === 'ชำระแล้ว' ? 'checkmark-circle' : 'time'} size={13} color="white" />
            <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{detail.invoice_status}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' }}>ครบกำหนด {formatDate(detail.due_date)}</Text>
        </View>
      </View>

      {/* รายละเอียดเรียงลำดับ: ค่าน้ำ → ค่าไฟ → ค่าห้อง → ยอดรวม → หมายเหตุค่าปรับ (ถ้ามี) */}
      <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Ionicons name="list-outline" size={16} color="#64748B" />
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            รายละเอียดค่าเช่าและสาธารณูปโภค
          </Text>
        </View>

        {billItems.map((line, idx) => {
          const st = itemStyle(line.item_name);
          return (
            <View
              key={idx}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: st.bg, borderRadius: 14, padding: 12,
                marginBottom: idx === billItems.length - 1 ? 0 : 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={st.icon} size={17} color={st.color} />
                </View>
                <Text style={{ color: '#334155', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={2}>{line.item_name}</Text>
              </View>
              <Text style={{ color: st.color, fontSize: 14, fontWeight: '900' }}>฿{Number(line.subtotal || 0).toLocaleString()}</Text>
            </View>
          );
        })}

        <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 14 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '900', fontSize: 15, color: '#0F172A' }}>ยอดรวมทั้งหมด</Text>
          <Text style={{ fontWeight: '900', fontSize: 20, color: '#0F7EE6' }}>฿{remaining.toLocaleString()}</Text>
        </View>

        {/* หมายเหตุ: ค่าปรับชำระล่าช้า แสดงต่อจากยอดรวมทันที */}
        {detail.late_fee > 0 && (
          <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 12, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#B91C1C' }}>หมายเหตุ: โดนค่าปรับชำระล่าช้า</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#DC2626', marginTop: 4, fontWeight: '600' }}>
              ค้างชำระเกินกำหนดมาแล้ว {lateDays(detail.late_fee)} วัน (คิดค่าปรับวันละ 50 บาท) รวมเป็นค่าปรับ ฿{Number(detail.late_fee).toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      {/* ใบเสร็จ PDF — แสดงเมื่อบิลนี้ชำระครบแล้วเท่านั้น */}
      {detail.invoice_status === 'ชำระแล้ว' && (
        <TouchableOpacity
          onPress={generateReceipt}
          disabled={receiptGenerating}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
            borderRadius: 16, paddingVertical: 14, marginBottom: 16,
          }}
        >
          {receiptGenerating ? (
            <ActivityIndicator color="#16A34A" />
          ) : (
            <Ionicons name="document-text-outline" size={18} color="#16A34A" />
          )}
          <Text style={{ color: '#16A34A', fontWeight: '900', fontSize: 13 }}>ดูใบเสร็จรับเงิน (PDF)</Text>
        </TouchableOpacity>
      )}

      {/* ชำระเงิน: เลือกวิธีแบบการ์ด 2 ช่อง เหมือนหน้า bill.js — QR พร้อมเพย์ / แจ้งโอนเอง+แนบสลิป */}
      {canPay && (
        <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Ionicons name="wallet-outline" size={16} color="#64748B" />
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 }}>ชำระเงิน</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setPayTab('qr')}
              style={{
                flex: 1, borderRadius: 18, padding: 16, alignItems: 'center', minHeight: 110,
                borderWidth: 1.5, borderColor: payTab === 'qr' ? '#0194F3' : '#E2E8F0',
                backgroundColor: payTab === 'qr' ? '#EFF6FF' : '#F8FAFC',
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="qr-code-outline" size={22} color="#0284C7" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#0F172A' }}>QR พร้อมเพย์</Text>
              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 3, textAlign: 'center' }}>สแกนจ่ายได้ทันที</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPayTab('manual')}
              style={{
                flex: 1, borderRadius: 18, padding: 16, alignItems: 'center', minHeight: 110,
                borderWidth: 1.5, borderColor: payTab === 'manual' ? '#10B981' : '#E2E8F0',
                backgroundColor: payTab === 'manual' ? '#F0FDF4' : '#F8FAFC',
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="receipt-outline" size={22} color="#16A34A" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#0F172A' }}>แจ้งโอนเอง</Text>
              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 3, textAlign: 'center' }}>โอนแล้วแนบสลิป</Text>
            </TouchableOpacity>
          </View>

          {payTab === 'qr' ? (
            qrData ? (
              <View style={{ alignItems: 'center', backgroundColor: '#F0F9FF', borderRadius: 20, padding: 20 }}>
                <Image source={{ uri: qrData.qrImage }} style={{ width: 200, height: 200 }} resizeMode="contain" />
                <Text style={{ marginTop: 10, fontSize: 16, fontWeight: 'bold', color: '#0369A1' }}>
                  ยอดชำระ ฿{Number(qrData.amount || 0).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4, textAlign: 'center' }}>สแกนจ่ายผ่านแอปธนาคารที่รองรับพร้อมเพย์</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={fetchQr}
                disabled={qrLoading}
                style={{ backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', paddingVertical: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                {qrLoading ? <ActivityIndicator color="#0284C7" /> : <Ionicons name="qr-code" size={18} color="#0284C7" />}
                <Text style={{ color: '#0284C7', fontWeight: 'bold' }}>ขอ QR พร้อมเพย์</Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15 }}>
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

              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 }}>แนบสลิปการโอนเงิน (ถ้ามี)</Text>
              <TouchableOpacity
                onPress={pickPaySlip}
                style={{ borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 16, padding: 14, alignItems: 'center', backgroundColor: 'white', marginBottom: 15 }}
              >
                {paySlip ? (
                  <Image source={{ uri: paySlip.uri }} style={{ width: 100, height: 100, borderRadius: 10 }} />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="cloud-upload-outline" size={24} color="#64748B" />
                    <Text style={{ color: '#64748B', fontWeight: '700', marginTop: 6, fontSize: 12 }}>แตะเพื่อแนบสลิป</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitPayment}
                disabled={paySubmitting}
                style={{ backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
              >
                {paySubmitting ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold' }}>ยืนยันแจ้งชำระเงิน</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ประวัติการชำระ + ดูสลิปที่เคยส่ง */}
      <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Ionicons name="time-outline" size={16} color="#64748B" />
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            ประวัติการชำระ
          </Text>
        </View>
        {loadingPayments ? (
          <ActivityIndicator color="#0194F3" />
        ) : payments.length === 0 ? (
          <Text style={{ color: '#94A3B8', fontSize: 13 }}>ยังไม่มีรายการแจ้งชำระ</Text>
        ) : (
          payments.map((p) => {
            const pc = PAYMENT_STATUS_COLOR[p.payment_status] || PAYMENT_STATUS_COLOR['รอตรวจ'];
            return (
              <View key={p.payment_id} style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E293B' }}>
                    ฿{Number(p.amount_paid || 0).toLocaleString()} · {p.payment_method}
                  </Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: pc.bg }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: pc.text }}>{p.payment_status}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{formatDate(p.payment_date)}</Text>
                {p.payment_evidence ? (
                  <TouchableOpacity
                    onPress={() => onSlipPreview(p.payment_evidence)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
                  >
                    <Ionicons name="image-outline" size={16} color="#0284C7" />
                    <Text style={{ fontSize: 12, color: '#0284C7', fontWeight: '700' }}>ดูสลิป</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

export default function InvoiceScreen() {
  const router = useRouter();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [slipPreview, setSlipPreview] = useState(null);

  // รายละเอียดบิลที่กำลังเปิดดู
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
    setSelectedDetail(null);
    setDetailLoading(true);
    try {
      const response = await api.get(`/invoice/${invoiceId}`);
      if (response.data?.success) setSelectedDetail(response.data.data);
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงรายละเอียดบิลได้');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" />

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#0F7EE6',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: 'white' }}>บิลค่าน้ำ ค่าไฟ และค่าเช่าห้อง</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '600' }}>
            {filteredInvoices.length} รายการ
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* แท็บกรองสถานะ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {[
          { id: 'all', title: 'ทั้งหมด', icon: 'apps-outline' },
          { id: 'ยังไม่ชำระ', title: 'ยังไม่ชำระ', icon: 'alert-circle-outline' },
          { id: 'ชำระบางส่วน', title: 'ชำระบางส่วน', icon: 'time-outline' },
          { id: 'ชำระแล้ว', title: 'ชำระแล้ว', icon: 'checkmark-circle-outline' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999,
                backgroundColor: isActive ? '#0F7EE6' : '#F1F5F9'
              }}
            >
              <Ionicons name={tab.icon} size={14} color={isActive ? 'white' : '#94A3B8'} />
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
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredInvoices.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 90, backgroundColor: 'white', borderRadius: 20, paddingVertical: 50, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
              <Text style={{ fontSize: 14, color: '#94A3B8', marginTop: 12, fontWeight: '600' }}>
                ไม่มีบิลในหมวดหมู่นี้
              </Text>
            </View>
          ) : (
            filteredInvoices.map((item) => {
              const color = STATUS_COLOR[item.invoice_status] || STATUS_COLOR['ยังไม่ชำระ'];
              const paid = item.invoice_status === 'ชำระแล้ว';
              return (
                <TouchableOpacity
                  key={item.invoice_id}
                  onPress={() => openDetail(item.invoice_id)}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 12,
                    borderWidth: 1, borderColor: '#E2E8F0',
                  }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: paid ? '#DCFCE7' : '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={paid ? 'checkmark-done-outline' : 'home-outline'} size={22} color={paid ? '#16A34A' : '#0F7EE6'} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '900', fontSize: 15, color: '#1E293B' }}>
                        ห้อง {item.room_number}
                      </Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: color.bg }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: color.text }}>{item.invoice_status}</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                      {formatMonth(item.invoice_date)} · ครบกำหนด {formatDate(item.due_date)}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ fontSize: 19, fontWeight: '900', color: '#0F7EE6' }}>
                        ฿{Number(item.total_amount || 0).toLocaleString()}
                      </Text>
                      {item.late_fee > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="alert-circle" size={12} color="#EF4444" />
                          <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>
                            +฿{Number(item.late_fee).toLocaleString()} ปรับล่าช้า
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* หน้ารายละเอียดบิลแบบเต็มจอ + ชำระเงิน (โหมดรายการทั่วไป) */}
      <Modal visible={selectedDetail !== null || detailLoading} animationType="slide" onRequestClose={() => setSelectedDetail(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <StatusBar barStyle="light-content" backgroundColor="#0F7EE6" />
          <View style={{ backgroundColor: '#0F7EE6', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setSelectedDetail(null)} style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>ใบแจ้งหนี้{selectedDetail ? ` ห้อง ${selectedDetail.room_number}` : ''}</Text>
            </View>
          </View>

          {detailLoading || !selectedDetail ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#0194F3" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              <InvoiceDetailCard
                detail={selectedDetail}
                onPaid={() => { setSelectedDetail(null); fetchInvoices(); }}
                onSlipPreview={setSlipPreview}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* พรีวิวสลิปแบบเต็มจอ */}
      <Modal visible={slipPreview !== null} transparent animationType="fade" onRequestClose={() => setSlipPreview(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setSlipPreview(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Image source={{ uri: slipPreview }} style={{ width: '100%', height: '80%', borderRadius: 12 }} resizeMode="contain" />
          <TouchableOpacity onPress={() => setSlipPreview(null)} style={{ position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 8 }}>
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
