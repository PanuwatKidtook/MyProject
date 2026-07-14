import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../lib/api';

// นับเวลาที่เหลือจนถึง hold_expires_at เป็นวินาที (0 ถ้าหมดเวลา/ไม่มีค่า)
function secondsLeft(holdExpiresAt) {
  if (!holdExpiresAt) return 0;
  const diff = Math.floor((new Date(holdExpiresAt) - new Date()) / 1000);
  return diff > 0 ? diff : 0;
}

// โมดัล "จองสำเร็จ + ชำระค่าจอง" — พอร์ตจาก client/src/components/user/booking/BookingSuccess.jsx
// วิธีจ่าย: ขอ QR PromptPay (pay-now) → สแกนโอน → แนบสลิป (/payment) → หยุดนับถอยหลัง + การจองยืนยันอัตโนมัติ
// props:
//   visible      = เปิด/ปิดโมดัล
//   result       = ข้อมูลตอนจองสำเร็จจาก POST /booking { bookingId, bookingRef, roomNumber, checkInDate, checkOutDate, rentType, totalPrice, holdExpiresAt, emailSent }
//   onGoHistory  = ไปหน้าประวัติการจอง
//   onClose      = ปิดโมดัล (จองห้องอีกครั้ง/ปิด)
export default function BookingSuccessModal({ visible, result, onGoHistory, onClose }) {
  const isMonthly = result?.rentType === 'monthly';
  // ทั้งรายวันและรายเดือนต้องชำระตอนจอง (รายเดือน = มัดจำล็อกห้อง 2,000) — ดูจาก holdExpiresAt
  const canPayNow = !!result?.holdExpiresAt;

  const [qr, setQr] = useState(null);              // { invoiceId, qrImage, amount }
  const [slip, setSlip] = useState(null);          // asset จาก image picker
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false); // แนบสลิปแล้ว
  const [remaining, setRemaining] = useState(0);
  const [payError, setPayError] = useState(null);  // ข้อความ error ตอนสร้าง QR (โชว์ inline)

  // รีเซ็ต state ทุกครั้งที่เปิดโมดัลด้วยผลการจองใหม่
  useEffect(() => {
    if (visible && result) {
      setQr(null);
      setSlip(null);
      setSubmitted(false);
      setPayError(null);
      setRemaining(secondsLeft(result.holdExpiresAt));
    }
  }, [visible, result]);

  // ตัวนับถอยหลังเวลาชำระ (จาก hold_expires_at)
  useEffect(() => {
    if (!visible || !canPayNow || submitted) return;
    const timer = setInterval(() => {
      setRemaining(secondsLeft(result.holdExpiresAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, canPayNow, submitted, result?.holdExpiresAt]);

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const expired = canPayNow && !submitted && remaining <= 0 && !!result?.holdExpiresAt;

  // หมดเวลาชำระ → cron ยกเลิก booking + ปล่อยห้องคืน → แจ้งเตือน
  useEffect(() => {
    if (visible && expired) {
      Alert.alert('หมดเวลาชำระเงิน', 'การจองถูกยกเลิกและปล่อยห้องคืนแล้ว');
    }
  }, [visible, expired]);

  if (!result) return null;

  // ขอ QR PromptPay ของค่าจอง (สร้างบิลค่าห้องให้ด้วย)
  // ยิงตรงเลย ไม่ใช้ Alert (Alert จากในตัว Modal ไม่แสดงบน iOS → กดแล้ว QR ไม่ขึ้น)
  // คำเตือน "5 นาที" แสดงอยู่แล้วในกล่องนับถอยหลังด้านบน (USER_FLOWS ข้อ 6/5)
  const startPay = async () => {
    try {
      setLoading(true);
      setPayError(null);
      const res = await api.post(`/booking/${result.bookingId}/pay-now`);
      if (res.data?.success && res.data.data?.qrImage) setQr(res.data.data);
      else setPayError(res.data?.message || 'สร้าง QR ไม่สำเร็จ');
    } catch (err) {
      setPayError(err.response?.data?.message || 'สร้าง QR ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // เลือกรูปสลิปจากคลังภาพ
  const pickSlip = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตให้เข้าถึงคลังรูปภาพเพื่อแนบสลิป');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0]) setSlip(res.assets[0]);
  };

  // ส่งแจ้งชำระ + แนบสลิป (ใช้ endpoint /payment เดิม) — พอมีสลิปเข้ามาการจองยืนยันอัตโนมัติ
  const submitSlip = async () => {
    if (!slip) {
      Alert.alert('แจ้งเตือน', 'กรุณาแนบสลิปการโอนเงิน');
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('invoice_id', String(qr.invoiceId));
      form.append('payment_method', 'โอนเงิน');
      form.append('slip', {
        uri: slip.uri,
        name: slip.fileName || `slip_${Date.now()}.jpg`,
        type: slip.mimeType || 'image/jpeg',
      });
      const res = await api.post('/payment', form);
      if (res.data?.success) setSubmitted(true);
    } catch (err) {
      Alert.alert('ผิดพลาด', err.response?.data?.message || 'แจ้งชำระไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden', maxHeight: '92%' }}>
          <ScrollView contentContainerStyle={{ padding: 25 }} showsVerticalScrollIndicator={false}>
            {/* ไอคอนติ๊กถูก */}
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 }}>
              <Ionicons name="checkmark" size={36} color="#16A34A" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '900', color: '#1E293B', textAlign: 'center' }}>จองห้องสำเร็จ!</Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4 }}>เลขที่การจองของคุณคือ</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0194F3', textAlign: 'center', marginVertical: 8 }}>{result.bookingRef}</Text>

            {/* ตัวนับถอยหลังเวลาชำระ */}
            {canPayNow && !submitted && (
              expired ? (
                <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 20, padding: 14, marginVertical: 12 }}>
                  <Text style={{ color: '#B91C1C', fontWeight: '900', fontSize: 14, textAlign: 'center' }}>⏱ หมดเวลาชำระแล้ว</Text>
                  <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 4, textAlign: 'center' }}>การจองอาจถูกยกเลิกอัตโนมัติ — กรุณาตรวจสอบที่ประวัติการจอง</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 20, padding: 14, marginVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#9A3412', fontSize: 12, fontWeight: '600' }}>⏱ กรุณาชำระเงินภายใน</Text>
                  <Text style={{ color: '#C2410C', fontWeight: '900', fontSize: 34, fontVariant: ['tabular-nums'] }}>{mmss}</Text>
                  <Text style={{ color: '#9A3412', fontSize: 11, marginTop: 2, textAlign: 'center' }}>มิฉะนั้นการจองจะถูกยกเลิกอัตโนมัติและปล่อยห้องคืน</Text>
                </View>
              )
            )}

            {/* สรุปสั้น ๆ */}
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, marginVertical: 8 }}>
              <SummaryRow label="ห้องพัก" value={`ห้อง ${result.roomNumber}`} />
              <SummaryRow label="วันเข้าพัก" value={result.checkInDate} />
              {!isMonthly && <SummaryRow label="วันออก" value={result.checkOutDate} />}
              <SummaryRow
                label={isMonthly ? 'ค่าเช่ารายเดือน (โดยประมาณ)' : 'ยอดรวมโดยประมาณ'}
                value={`฿${Number(result.totalPrice).toLocaleString()}`}
                highlight
              />
            </View>

            {/* รายเดือน: อธิบายว่าตอนนี้จ่ายแค่มัดจำล็อกห้อง 2,000 */}
            {isMonthly && !submitted && (
              <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 20, padding: 14, marginBottom: 8 }}>
                <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '800' }}>ชำระตอนนี้เฉพาะ มัดจำล็อกห้อง 2,000 บาท เพื่อกันห้องไว้</Text>
                <Text style={{ color: '#16A34A', fontSize: 11, marginTop: 2 }}>ค่าเช่าและมัดจำสัญญาที่เหลือจะเก็บตอนเจ้าหน้าที่เช็คอิน</Text>
              </View>
            )}

            {/* ===== ชำระค่าจอง — QR PromptPay + อัปสลิป ===== */}
            {canPayNow ? (
              submitted ? (
                <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 20, padding: 16, marginVertical: 8 }}>
                  <Text style={{ color: '#16A34A', fontWeight: '900' }}>✓ ส่งสลิปแล้ว · ยืนยันการจองแล้ว</Text>
                  <Text style={{ color: '#15803D', fontSize: 12, marginTop: 4 }}>รอเจ้าหน้าที่ตรวจสอบสลิป · ดูสถานะได้ที่ “ประวัติการจอง”</Text>
                </View>
              ) : qr ? (
                <View style={{ marginVertical: 8, alignItems: 'center' }}>
                  <Image source={{ uri: qr.qrImage }} style={{ width: 220, height: 220, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }} />
                  <Text style={{ color: '#1E293B', fontWeight: '900', fontSize: 18, marginTop: 8 }}>สแกนโอน ฿{Number(qr.amount).toLocaleString()}</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2, marginBottom: 12 }}>โอนแล้วแนบสลิปด้านล่างเพื่อแจ้งชำระ</Text>

                  <TouchableOpacity onPress={pickSlip} style={{ width: '100%', borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center', backgroundColor: '#F8FAFC', marginBottom: 12 }}>
                    {slip ? (
                      <Image source={{ uri: slip.uri }} style={{ width: 120, height: 120, borderRadius: 12 }} />
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="cloud-upload-outline" size={28} color="#64748B" />
                        <Text style={{ color: '#64748B', fontWeight: '700', marginTop: 6 }}>แตะเพื่อแนบสลิปการโอนเงิน</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={submitSlip} disabled={loading} style={{ width: '100%', backgroundColor: '#D32F2F', paddingVertical: 15, borderRadius: 18, alignItems: 'center', opacity: loading ? 0.5 : 1 }}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>ส่งแจ้งชำระ</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <TouchableOpacity onPress={startPay} disabled={loading || expired} style={{ backgroundColor: '#D32F2F', paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginVertical: 8, opacity: (loading || expired) ? 0.5 : 1 }}>
                    {loading ? <ActivityIndicator color="white" /> : (
                      <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>
                        {isMonthly ? '💳 ชำระมัดจำล็อกห้อง (QR PromptPay)' : '💳 ชำระค่าจอง (QR PromptPay)'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {/* แสดง error inline (เช่น server ยังไม่ตั้ง PROMPTPAY_ID) แทน Alert ที่ไม่แสดงในตัว Modal */}
                  {payError && (
                    <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 12, marginTop: 4 }}>
                      <Text style={{ color: '#B91C1C', fontWeight: '800', fontSize: 13 }}>สร้าง QR ไม่สำเร็จ</Text>
                      <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 2 }}>{payError}</Text>
                    </View>
                  )}
                </View>
              )
            ) : (
              <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginVertical: 8 }}>
                สถานะปัจจุบัน: รอชำระมัดจำ · ดูรายละเอียดการชำระได้ที่ “ประวัติการจอง”
              </Text>
            )}

            {/* แจ้งอีเมล */}
            <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginVertical: 8 }}>
              {result.emailSent ? '📧 ส่งอีเมลยืนยันการจองให้แล้ว' : 'บันทึกการจองเรียบร้อย'}
            </Text>

            <TouchableOpacity onPress={onGoHistory} style={{ backgroundColor: '#0194F3', paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>ดูประวัติการจอง</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 18, alignItems: 'center', marginTop: 10, marginBottom: 10 }}>
              <Text style={{ color: '#64748B', fontWeight: '700' }}>ปิด / จองห้องอีกครั้ง</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const SummaryRow = ({ label, value, highlight }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
    <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 13 }}>{label}</Text>
    <Text style={{ color: highlight ? '#0194F3' : '#1E293B', fontWeight: highlight ? '900' : '700', fontSize: 13 }}>{value}</Text>
  </View>
);
