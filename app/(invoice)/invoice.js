import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator, Alert, Animated, Image, Modal, Platform,
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

// ตัดเฉพาะเลขมิเตอร์ในวงเล็บท้ายชื่อออก (ตอนแสดงบนการ์ด) เช่น "ค่าน้ำ (458-469)" → "ค่าน้ำ"
// เก็บชื่อที่มีวันที่/ตัวเลขนอกวงเล็บไว้ เช่น "ค่าเช่าห้องล่วงหน้า 27-30 กันยายน 2569" และวงเล็บที่ไม่ใช่ตัวเลข เช่น "(รายเดือน)"
const cleanItemName = (name) => String(name || '').replace(/\s*\(\s*\d[^)]*\)\s*$/, '').trim();

// ก่อนถึงวันครบกำหนด: บิลยังไม่ต้องจ่าย → โชว์รายการเป็น ฿0 + "ชำระแล้ว"
// ยอดจริงจะขึ้นให้ชำระเมื่อถึง/เลยวันครบกำหนดเท่านั้น (frontend เป็นคนตัดสินใจแสดง)
const isBeforeDue = (dueDate) => {
  if (!dueDate) return false;
  const today = new Date();
  const due = new Date(dueDate);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return today < due;
};

// นโยบายใหม่: ออกบิลวันที่ 1 → ครบกำหนดชำระวันที่ 5 ของเดือนบิลเสมอ
// แสดงผลฝั่งแอปให้ตรง policy โดยไม่แก้ข้อมูลบิลเดิมใน backend
const dueOnFifth = (detail) => {
  const base = detail.invoice_date || detail.due_date;
  if (!base) return detail.due_date || null;
  return `${String(base).slice(0, 7)}-05`; // 'YYYY-MM' + '-05'
};

// ===================================================================
// การ์ดรายละเอียดบิล 1 ใบแบบยาวลงมา: ค่าห้อง/น้ำ/ไฟ + เหตุผลค่าปรับ + ชำระเงิน (QR/แจ้งโอน+สลิป) + ประวัติการชำระ
// ===================================================================
function InvoiceDetailCard({ detail, onPaid, onSlipPreview }) {
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0); // นับถอยหลัง QR พร้อมเพย์ (หมดอายุใน 5 นาที)
  const [payTab, setPayTab] = useState('qr'); // 'qr' | 'manual' — เลือกวิธีจ่ายแบบการ์ด 2 ช่อง เหมือนหน้า bill.js
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('โอนเงิน');
  const [paySlip, setPaySlip] = useState(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [receiptGenerating, setReceiptGenerating] = useState(false);

  // จ่าย QR อัตโนมัติผ่าน Omise (ยืนยันเอง ไม่ต้องแนบสลิป)
  const [omiseCharge, setOmiseCharge] = useState(null); // { paymentId, qrImage, amount }
  const [omiseLoading, setOmiseLoading] = useState(false);
  const [omisePaid, setOmisePaid] = useState(false);
  const omisePulse = React.useRef(new Animated.Value(0)).current;

  // ดูใบชำระเงิน (PDF จาก backend) แบบหน้าต่างในแอป
  const [pdfVisible, setPdfVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // วันครบกำหนดแสดงผล = วันที่ 5 ของเดือนบิล (นโยบายใหม่)
  const dueDate = dueOnFifth(detail);
  // ก่อนถึงกำหนด (หรือยังไม่มีบิลจริง = placeholder): ยอด/รายการโชว์เป็น ฿0 และสถานะ "ชำระแล้ว"
  const notYetDue = detail.__placeholder || isBeforeDue(dueDate);
  const rawRemaining = (Number(detail.total_amount) || 0) + (Number(detail.late_fee) || 0);
  const remaining = notYetDue ? 0 : rawRemaining;
  const displayStatus = notYetDue ? 'ชำระแล้ว' : detail.invoice_status;
  const rawItems = sortedBillDetails(detail.details);
  const billItems = notYetDue ? rawItems.map((l) => ({ ...l, subtotal: 0 })) : rawItems;

  useEffect(() => {
    setPayAmount(remaining > 0 ? String(remaining) : '');
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.invoice_id]);

  const fetchPayments = async () => {
    if (!detail.invoice_id) { setPayments([]); return; } // placeholder ยังไม่มีบิลจริง
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
      if (response.data?.success) {
        setQrData(response.data.data);
        setQrSecondsLeft(300); // QR ใช้ได้ 5 นาที
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', error.response?.data?.message || 'ขอ QR พร้อมเพย์ไม่สำเร็จ');
    } finally {
      setQrLoading(false);
    }
  };

  // นับถอยหลังอายุ QR — ครบ 5 นาทีให้ QR หายไป ผู้ใช้ต้องกดขอใหม่
  useEffect(() => {
    if (!qrData || qrSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setQrSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          setQrData(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [qrData, qrSecondsLeft]);

  const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // สร้าง charge Omise แล้วแสดง QR
  const startOmisePay = async () => {
    setOmiseLoading(true);
    try {
      const res = await api.post(`/invoice/${detail.invoice_id}/qr-charge`);
      if (res.data?.success) {
        setOmisePaid(false);
        setOmiseCharge(res.data.data);
      } else {
        Alert.alert('ผิดพลาด', res.data?.message || 'สร้าง QR อัตโนมัติไม่สำเร็จ');
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', error.response?.data?.message || 'สร้าง QR อัตโนมัติไม่สำเร็จ');
    } finally {
      setOmiseLoading(false);
    }
  };

  // poll สถานะ Omise ทุก 3 วิ จนจ่ายสำเร็จ → ยืนยันอัตโนมัติ
  useEffect(() => {
    if (!omiseCharge || omisePaid) return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/payment/${omiseCharge.paymentId}/qr-status`);
        if (res.data?.success && res.data.data?.paid) {
          setOmisePaid(true);
          clearInterval(timer);
          fetchPayments();
          onPaid && onPaid();
        }
      } catch {
        // poll พลาดชั่วคราว → รอบถัดไปลองใหม่
      }
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [omiseCharge, omisePaid]);

  // จุดกระพริบตอนรอชำระ
  useEffect(() => {
    if (!omiseCharge || omisePaid) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(omisePulse, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.timing(omisePulse, { toValue: 0, duration: 700, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [omiseCharge, omisePaid]);

  const pickPaySlip = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตให้เข้าถึงคลังรูปภาพเพื่อแนบสลิป');
      return;
    }
    // quality: 1 = ไม่บีบอัด — backend ต้องถอด QR ในสลิปเพื่อตรวจสอบ (บีบอัดแล้ว decode ไม่ออก)
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
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
            <div class="sub">บิลประจำเดือน ${formatMonth(detail.invoice_date)} · ครบกำหนด ${formatDate(dueDate)}</div>
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

  // เปิดใบชำระเงิน (PDF จาก backend) แบบหน้าต่างในแอป — เว็บ: โชว์ iframe, เนทีฟ: บันทึก+แชร์ (best-effort)
  const openInvoicePdf = async () => {
    if (!detail.invoice_id) return;
    setPdfUrl(null);
    setPdfLoading(true);
    setPdfVisible(true);
    try {
      const res = await api.get(`/invoice/${detail.invoice_id}/pdf`, { responseType: 'blob' });
      if (Platform.OS === 'web') {
        setPdfUrl(URL.createObjectURL(res.data));
      } else {
        try {
          const FileSystem = require('expo-file-system');
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(res.data);
          });
          const uri = FileSystem.cacheDirectory + `invoice_${detail.invoice_id}.pdf`;
          await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
          setPdfVisible(false);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
          }
        } catch {
          setPdfVisible(false);
          Alert.alert('แจ้งเตือน', 'พรีวิวใบชำระเงินบนแอปยังไม่รองรับ กรุณาเปิดผ่านเว็บ');
        }
      }
    } catch (error) {
      setPdfVisible(false);
      Alert.alert('ผิดพลาด', error.response?.data?.message || 'เปิดใบชำระเงินไม่สำเร็จ');
    } finally {
      setPdfLoading(false);
    }
  };

  const closePdf = () => {
    if (Platform.OS === 'web' && pdfUrl) { try { URL.revokeObjectURL(pdfUrl); } catch {} }
    setPdfUrl(null);
    setPdfVisible(false);
  };

  // ก่อนถึงกำหนดยังไม่ต้องจ่าย → ซ่อนช่องชำระเงิน
  const canPay = !notYetDue && detail.invoice_status !== 'ชำระแล้ว' && detail.invoice_status !== 'ยกเลิก';

  return (
    <View style={{ marginBottom: 24 }}>
      {/* ยอดรวมที่ต้องจ่ายทั้งหมด — การ์ดฟ้าไล่โทน มีเงา */}
      <View style={{
        backgroundColor: '#0F7EE6', borderRadius: 28, padding: 22, marginBottom: 16,
        shadowColor: '#0F7EE6', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="receipt-outline" size={15} color="white" />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '800' }}>
            บิลประจำเดือน {formatMonth(detail.invoice_date)}
          </Text>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', marginTop: 14 }}>
          {notYetDue ? 'ยอดที่ต้องชำระ (ยังไม่ถึงกำหนด)' : 'ยอดที่ต้องชำระทั้งหมด'}
        </Text>
        <Text style={{ color: 'white', fontSize: 40, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 }}>
          ฿{remaining.toLocaleString()}
        </Text>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 16, marginBottom: 14 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: displayStatus === 'ชำระแล้ว' ? 'rgba(16,185,129,0.95)' : 'rgba(255,255,255,0.22)',
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          }}>
            <Ionicons name={displayStatus === 'ชำระแล้ว' ? 'checkmark-circle' : 'time'} size={14} color="white" />
            <Text style={{ color: 'white', fontSize: 11.5, fontWeight: '900' }}>{displayStatus}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' }}>ครบกำหนดชำระ</Text>
            <Text style={{ color: 'white', fontSize: 12.5, fontWeight: '900', marginTop: 1 }}>{formatDate(dueDate)}</Text>
          </View>
        </View>
      </View>

      {/* รายละเอียดเรียงลำดับ: ค่าน้ำ → ค่าไฟ → ค่าห้อง → ยอดรวม → หมายเหตุค่าปรับ (ถ้ามี) */}
      <View style={{
        backgroundColor: 'white', borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#EEF2F7',
        shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="list-outline" size={15} color="#0F7EE6" />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#334155', letterSpacing: 0.2 }}>
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
                backgroundColor: st.bg, borderRadius: 16, padding: 13,
                marginBottom: idx === billItems.length - 1 ? 0 : 9,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 13, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center',
                  shadowColor: st.color, shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1,
                }}>
                  <Ionicons name={st.icon} size={19} color={st.color} />
                </View>
                <Text style={{ color: '#334155', fontSize: 13.5, fontWeight: '800', flex: 1 }} numberOfLines={2}>{cleanItemName(line.item_name)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: notYetDue ? '#94A3B8' : st.color, fontSize: 15, fontWeight: '900' }}>
                  ฿{Number(line.subtotal || 0).toLocaleString()}
                </Text>
                {notYetDue && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 999 }}>
                    <Ionicons name="checkmark-circle" size={11} color="#16A34A" />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#16A34A' }}>ชำระแล้ว</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 1, backgroundColor: '#EEF2F7', marginVertical: 16 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '900', fontSize: 15, color: '#0F172A' }}>ยอดรวมทั้งหมด</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {notYetDue && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
                <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#16A34A' }}>ชำระแล้ว</Text>
              </View>
            )}
            <Text style={{ fontWeight: '900', fontSize: 22, color: notYetDue ? '#16A34A' : '#0F7EE6' }}>฿{remaining.toLocaleString()}</Text>
          </View>
        </View>

        {/* ก่อนถึงกำหนด: อธิบายว่ายอดจะขึ้นเมื่อครบกำหนด */}
        {notYetDue && (
          <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 12, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="information-circle" size={16} color="#2563EB" />
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#1D4ED8' }}>ยังไม่ถึงกำหนดชำระ</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#2563EB', marginTop: 4, fontWeight: '600' }}>
              ยอดค่าน้ำ ค่าไฟ และค่าเช่าห้อง จะแสดงให้ชำระเมื่อถึงวันครบกำหนด {formatDate(dueDate)}
            </Text>
          </View>
        )}

        {/* หมายเหตุ: ค่าปรับชำระล่าช้า แสดงต่อจากยอดรวมทันที */}
        {!notYetDue && detail.late_fee > 0 && (
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

      {/* ดูใบชำระเงิน (PDF จาก backend) — แสดงทุกบิลจริง (ยังไม่ใช่ placeholder) */}
      {!detail.__placeholder && (
        <TouchableOpacity
          onPress={openInvoicePdf}
          disabled={pdfLoading}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
            borderRadius: 16, paddingVertical: 14, marginBottom: 16,
          }}
        >
          {pdfLoading ? (
            <ActivityIndicator color="#16A34A" />
          ) : (
            <Ionicons name="document-text-outline" size={18} color="#16A34A" />
          )}
          <Text style={{ color: '#16A34A', fontWeight: '900', fontSize: 13 }}>ดูใบชำระเงิน (PDF)</Text>
        </TouchableOpacity>
      )}

      {/* ชำระเงิน: เลือกวิธีแบบการ์ด 2 ช่อง เหมือนหน้า bill.js — QR พร้อมเพย์ / แจ้งโอนเอง+แนบสลิป */}
      {canPay && (
        <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Ionicons name="wallet-outline" size={16} color="#64748B" />
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 }}>ชำระเงิน</Text>
          </View>

          {omisePaid ? (
            // จ่ายสำเร็จ (ยืนยันอัตโนมัติ)
            <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 22, alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Ionicons name="checkmark-sharp" size={32} color="white" />
              </View>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 19 }}>ชำระเงินสำเร็จ!</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, marginTop: 4 }}>ระบบยืนยันการชำระอัตโนมัติแล้ว</Text>
            </LinearGradient>
          ) : omiseCharge ? (
            // แสดง QR Omise + รอชำระ (ยืนยันเอง)
            <View style={{ alignItems: 'center', backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 20, padding: 20 }}>
              <Image source={{ uri: omiseCharge.qrImage }} style={{ width: 210, height: 210, borderRadius: 14 }} resizeMode="contain" />
              <Text style={{ marginTop: 10, fontSize: 17, fontWeight: '900', color: '#0F172A' }}>สแกนจ่าย ฿{Number(omiseCharge.amount || 0).toLocaleString()}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#EEF2FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
                <Animated.View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#4F46E5', opacity: omisePulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }} />
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#4338CA' }}>กำลังรอชำระเงิน · ยืนยันอัตโนมัติ</Text>
              </View>
              <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 8, textAlign: 'center' }}>เปิดแอปธนาคาร สแกน QR แล้วจ่าย — ระบบยืนยันให้เองในไม่กี่วินาที</Text>
              <TouchableOpacity onPress={() => setOmiseCharge(null)} style={{ marginTop: 12 }}>
                <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 12.5 }}>เปลี่ยนวิธีชำระ</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          {/* ปุ่มจ่ายอัตโนมัติ (แนะนำ) — ไล่เฉดม่วงพรีเมียม */}
          <TouchableOpacity onPress={startOmisePay} disabled={omiseLoading} activeOpacity={0.9} style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 14 }}>
            <LinearGradient colors={['#6366F1', '#4F46E5', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="flash" size={22} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>จ่าย QR อัตโนมัติ</Text>
                  <View style={{ backgroundColor: '#FDE68A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: '#92400E', fontSize: 9.5, fontWeight: '900' }}>แนะนำ</Text>
                  </View>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, marginTop: 2 }}>จ่ายแล้วระบบยืนยันทันที ไม่ต้องแนบสลิป</Text>
              </View>
              {omiseLoading ? <ActivityIndicator color="white" /> : <Ionicons name="chevron-forward" size={20} color="white" />}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
            <Text style={{ marginHorizontal: 10, fontSize: 11, color: '#94A3B8', fontWeight: '700' }}>หรือเลือกวิธีอื่น</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
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
                {/* ตัวนับเวลา QR หมดอายุใน 5 นาที */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
                  <Ionicons name="time-outline" size={14} color="#B45309" />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#B45309' }}>
                    QR หมดอายุใน {formatCountdown(qrSecondsLeft)} นาที
                  </Text>
                </View>
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
          </>
          )}
        </View>
      )}

      {/* ประวัติการชำระ + ดูสลิปที่เคยส่ง — ซ่อนเมื่อยังไม่มีบิลจริง (placeholder) */}
      {!detail.__placeholder && (
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
      )}

      {/* หน้าต่างดูใบชำระเงิน (PDF) — เว็บโชว์ในหน้าต่าง ไม่เด้งไปหน้าอื่น */}
      <Modal visible={pdfVisible} transparent animationType="fade" onRequestClose={closePdf}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: Platform.OS === 'web' ? 20 : 0 }}>
          <View style={{ width: '100%', maxWidth: 860, height: Platform.OS === 'web' ? '92%' : '100%', backgroundColor: 'white', borderRadius: Platform.OS === 'web' ? 16 : 0, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#1E293B' }}>ใบชำระเงิน</Text>
              <TouchableOpacity onPress={closePdf} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
              {pdfLoading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color="#0194F3" />
                  <Text style={{ marginTop: 10, color: '#64748B' }}>กำลังโหลดใบชำระเงิน...</Text>
                </View>
              ) : Platform.OS === 'web' && pdfUrl ? (
                React.createElement('iframe', { src: pdfUrl, style: { width: '100%', height: '100%', border: 'none' }, title: 'ใบชำระเงิน' })
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <Text style={{ color: '#64748B', textAlign: 'center' }}>ไม่สามารถแสดงตัวอย่างได้</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function InvoiceScreen() {
  const router = useRouter();
  // มาจากหน้า "ดูการชำระบิล" — โชว์เลขห้องเฉพาะเมื่อยืนยันห้องที่เคาน์เตอร์แล้ว (roomRevealed === '1')
  const { roomRevealed, bookingId, roomNumber, checkInDate, priceMonthly } = useLocalSearchParams();
  const isRoomRevealed = roomRevealed !== '0';

  // สร้างบิล placeholder เมื่อยังไม่มีบิลจริง — โชว์ ฿0 + "ชำระแล้ว" (จ่ายล่วงหน้าไปแล้ว)
  // ยอดจริงจะขึ้นเมื่อเจ้าหน้าที่ออกบิล/ถึงวันครบกำหนด
  const buildPlaceholder = () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const invoiceDate = `${ym}-01`;   // ออกบิลวันที่ 1
    const dueDate = `${ym}-05`;       // ครบกำหนดชำระวันที่ 5 (ตรงกับ backend)
    return {
      __placeholder: true,
      invoice_id: null,
      room_number: roomNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      details: [
        { item_name: 'ค่าน้ำ', quantity: 0, subtotal: 0 },
        { item_name: 'ค่าไฟ', quantity: 0, subtotal: 0 },
        { item_name: 'ค่าเช่าห้อง (รายเดือน)', quantity: 0, subtotal: 0 },
      ],
      total_amount: 0,
      late_fee: 0,
      invoice_status: 'ยังไม่ชำระ',
    };
  };

  const [detail, setDetail] = useState(null);   // รายละเอียดบิลเต็มของห้องนี้ (รายเดือน = 1 ห้อง/บัญชี)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slipPreview, setSlipPreview] = useState(null);

  // รายเดือน 1 ห้อง/บัญชี → ดึงบิลของห้องนี้มาโชว์การ์ดตรงๆ ไม่ต้องมีลิสต์/แท็บ
  const loadInvoice = async () => {
    try {
      const res = await api.get('/my-invoices');
      const rows = res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
      // เลือกบิลของ booking นี้ก่อน ถ้าไม่ระบุ/ไม่เจอ ใช้บิลล่าสุด
      const mine = bookingId ? rows.filter((r) => String(r.booking_id) === String(bookingId)) : rows;
      const pool = mine.length ? mine : rows;
      const target = [...pool].sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date))[0];
      if (!target) { setDetail(null); return; }
      const full = await api.get(`/invoice/${target.invoice_id}`);
      setDetail(full.data?.success ? full.data.data : null);
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert('กรุณาเข้าสู่ระบบ', 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        router.replace('/(auth)/login');
      } else {
        setDetail(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInvoice();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoice();
  };

  // เลขห้องบนหัวข้อ: โชว์เมื่อยืนยันแล้วเท่านั้น (ใช้จากบิลก่อน ถ้าไม่มีใช้ param)
  const headerRoom = detail?.room_number || roomNumber;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0F7EE6" />

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#0F7EE6',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: 'white' }}>
            ใบแจ้งหนี้{isRoomRevealed && headerRoom ? ` ห้อง ${headerRoom}` : ''}
          </Text>
          {!(isRoomRevealed && headerRoom) && (
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' }}>
              รอยืนยันห้องที่เคาน์เตอร์
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </View>

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
          {/* มีบิลจริง → โชว์บิลนั้น / ยังไม่มี → โชว์การ์ด ฿0 "ชำระแล้ว" (placeholder) */}
          <InvoiceDetailCard
            detail={detail || buildPlaceholder()}
            onPaid={loadInvoice}
            onSlipPreview={setSlipPreview}
          />
        </ScrollView>
      )}

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
