import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../lib/api';

// โมดัลจ่ายบิลที่มีอยู่แล้ว (บิลรายเดือน/บิลของ booking) — ขอ QR PromptPay จาก /invoice/:id/promptpay แล้วแนบสลิป (/payment)
// props:
//   visible   = เปิด/ปิด
//   invoice   = { invoice_id, total_amount, room_number, ... } บิลที่จะจ่าย
//   onClose   = ปิดโมดัล
//   onPaid    = callback หลังแจ้งชำระสำเร็จ (ให้หน้าแม่รีเฟรช)
export default function PayInvoiceModal({ visible, invoice, onClose, onPaid }) {
  const [qr, setQr] = useState(null);        // { qrImage, amount, invoiceId, late_fee }
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [payError, setPayError] = useState(null); // เหตุผลที่สร้าง QR ไม่ได้ (โชว์ inline)

  // ขอ QR ทุกครั้งที่เปิดโมดัลด้วยบิลใหม่
  useEffect(() => {
    if (!visible || !invoice) return;
    setQr(null);
    setSlip(null);
    setSubmitted(false);
    setPayError(null);
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/invoice/${invoice.invoice_id}/promptpay`);
        if (res.data?.success && res.data.data?.qrImage) setQr(res.data.data);
        else setPayError(res.data?.message || 'สร้าง QR ไม่สำเร็จ');
      } catch (err) {
        setPayError(err.response?.data?.message || 'สร้าง QR ไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, invoice]);

  if (!invoice) return null;

  const pickSlip = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตให้เข้าถึงคลังรูปภาพเพื่อแนบสลิป');
      return;
    }
    // quality: 1 = ไม่บีบอัด — backend ต้องถอด QR ในสลิปเพื่อตรวจสอบ (บีบอัดแล้ว decode ไม่ออก)
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) setSlip(res.assets[0]);
  };

  const submitSlip = async () => {
    if (!slip) {
      Alert.alert('แจ้งเตือน', 'กรุณาแนบสลิปการโอนเงิน');
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('invoice_id', String(invoice.invoice_id));
      form.append('payment_method', 'โอนเงิน');
      form.append('slip', {
        uri: slip.uri,
        name: slip.fileName || `slip_${Date.now()}.jpg`,
        type: slip.mimeType || 'image/jpeg',
      });
      const res = await api.post('/payment', form);
      if (res.data?.success) {
        setSubmitted(true);
        onPaid?.();
      }
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1E293B' }}>ชำระบิล #{invoice.invoice_id}</Text>
              <TouchableOpacity onPress={onClose} style={{ backgroundColor: '#F1F5F9', borderRadius: 20, padding: 8 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, marginBottom: 12 }}>
              <SummaryRow label="ห้องพัก" value={`ห้อง ${invoice.room_number}`} />
              <SummaryRow label="ยอดบิล" value={`฿${Number(invoice.total_amount).toLocaleString()}`} />
              {invoice.due_date && <SummaryRow label="ครบกำหนด" value={new Date(invoice.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} />}
            </View>

            {submitted ? (
              <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 20, padding: 16 }}>
                <Text style={{ color: '#16A34A', fontWeight: '900' }}>✓ ส่งสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ</Text>
                <Text style={{ color: '#15803D', fontSize: 12, marginTop: 4 }}>สถานะจะอัปเดตเมื่อแอดมินยืนยันการชำระ</Text>
              </View>
            ) : loading && !qr ? (
              <ActivityIndicator size="large" color="#0194F3" style={{ marginVertical: 30 }} />
            ) : qr ? (
              <View style={{ alignItems: 'center' }}>
                <Image source={{ uri: qr.qrImage }} style={{ width: 220, height: 220, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }} />
                <Text style={{ color: '#1E293B', fontWeight: '900', fontSize: 18, marginTop: 8 }}>สแกนโอน ฿{Number(qr.amount).toLocaleString()}</Text>
                {qr.late_fee > 0 && (
                  <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 2, fontWeight: '700' }}>รวมค่าปรับล่าช้า ฿{Number(qr.late_fee).toLocaleString()} แล้ว</Text>
                )}
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
              <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 14, marginVertical: 12 }}>
                <Text style={{ color: '#B91C1C', fontWeight: '800', fontSize: 13 }}>สร้าง QR ไม่สำเร็จ</Text>
                <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 2 }}>{payError || 'ไม่สามารถสร้าง QR ได้'}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const SummaryRow = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
    <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 13 }}>{label}</Text>
    <Text style={{ color: '#1E293B', fontWeight: '700', fontSize: 13 }}>{value}</Text>
  </View>
);
