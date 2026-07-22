import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../../lib/api';

// นับเวลาที่เหลือจนถึง hold_expires_at เป็นวินาที (0 ถ้าหมดเวลา/ไม่มีค่า)
function secondsLeft(holdExpiresAt) {
  if (!holdExpiresAt) return 0;
  const diff = Math.floor((new Date(holdExpiresAt) - new Date()) / 1000);
  return diff > 0 ? diff : 0;
}

// หน้าชำระค่าจอง — มาแทน BookingSuccessModal เดิม (เต็มหน้าแทน Modal ซ้อน Modal)
// รับผลจาก POST /booking ผ่าน router params แล้วให้ชำระด้วย QR PromptPay จริง + แนบสลิป
export default function BillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const bookingId = params.bookingId;
  const bookingRef = params.bookingRef;
  const roomNumber = params.roomNumber;
  const checkInDate = params.checkInDate;
  const checkOutDate = params.checkOutDate;
  const rentType = params.rentType;
  const totalPrice = Number(params.totalPrice || 0);
  const holdExpiresAt = params.holdExpiresAt || null;
  const emailSent = params.emailSent === '1';

  const isMonthly = rentType === 'monthly';
  const canPayNow = !!holdExpiresAt;

  const [qr, setQr] = useState(null);
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(secondsLeft(holdExpiresAt));
  const [payError, setPayError] = useState(null);
  const [slipError, setSlipError] = useState(null);
  const [payTab, setPayTab] = useState('qr'); // 'qr' | 'manual' — สแกน QR หรือโอนด้วยเบอร์พร้อมเพย์เอง
  const [paymentStarted, setPaymentStarted] = useState(false); // เริ่มนับถอยหลังเมื่อกดเลือกวิธีชำระ ไม่ใช่ตอนเข้าหน้า
  // เวลาหมดอายุที่ใช้นับถอยหลังจริงบนหน้าจอ — ตั้งใหม่เป็น "ตอนนี้ + 5 นาที" ทุกครั้งที่กดเริ่มชำระ
  // แทนที่จะยึดตาม holdExpiresAt ที่มาจากตอนสร้างการจอง (ซึ่งเวลาผ่านไปก่อนหน้านั้นแล้ว เลยเหลือไม่ครบ 5 นาที)
  const [payDeadline, setPayDeadline] = useState(null);

  // จัดเบอร์พร้อมเพย์ให้อ่านง่าย: เบอร์มือถือ 10 หลัก -> 08X-XXX-XXXX, อย่างอื่นคงรูปเดิม
  const formatPromptpayId = (id) => {
    const digits = String(id || '').replace(/\D/g, '');
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return id || '-';
  };

  useEffect(() => {
    if (!canPayNow || submitted) return;
    const effectiveExpiry = payDeadline || holdExpiresAt;
    setRemaining(secondsLeft(effectiveExpiry));
    const timer = setInterval(() => setRemaining(secondsLeft(effectiveExpiry)), 1000);
    return () => clearInterval(timer);
  }, [canPayNow, submitted, holdExpiresAt, payDeadline]);

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const expired = canPayNow && !submitted && remaining <= 0;

  // แนบสลิปสำเร็จ → พาไปหน้าประวัติการจองอัตโนมัติหลังโชว์สถานะสำเร็จสักครู่
  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => router.replace('/reservationlist'), 1200);
    return () => clearTimeout(t);
  }, [submitted]);

  // หมดเวลาล็อกห้อง → โชว์สถานะปล่อยห้องคืนให้เห็นชัดๆ สักครู่ ก่อนพาไปหน้าประวัติการจอง
  // (เซิร์ฟเวอร์มี cron ทำงานทุก 1 นาทีคอยลบการจองที่หมดเวลา + ปล่อยห้องคืนจริงอยู่แล้ว)
  useEffect(() => {
    if (!expired) return;
    const t = setTimeout(() => router.replace('/reservationlist'), 3000);
    return () => clearTimeout(t);
  }, [expired]);

  const startPay = async () => {
    try {
      setLoading(true);
      setPayError(null);
      setPaymentStarted(true);
      setPayDeadline(new Date(Date.now() + 5 * 60 * 1000)); // ตรึงเป็น 5:00 เสมอ ไม่สุ่มตามเวลาที่เหลือจริง
      const res = await api.post(`/booking/${bookingId}/pay-now`);
      if (res.data?.success && res.data.data?.qrImage) setQr(res.data.data);
      else setPayError(res.data?.message || 'สร้าง QR ไม่สำเร็จ');
    } catch (err) {
      setPayError(err.response?.data?.message || 'สร้าง QR ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const pickSlip = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตให้เข้าถึงคลังรูปภาพเพื่อแนบสลิป');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) {
      setSlip(res.assets[0]);
      setSlipError(null);
    }
  };

  const submitSlip = async () => {
    if (!slip) {
      setSlipError('กรุณาแนบสลิปการโอนเงิน');
      return;
    }
    try {
      setLoading(true);
      setSlipError(null);
      const form = new FormData();
      form.append('invoice_id', String(qr.invoiceId));
      form.append('payment_method', 'โอนเงิน');
      const fileName = slip.fileName || `slip_${Date.now()}.jpg`;
      if (Platform.OS === 'web') {
        // เว็บ: ต้องแนบเป็น Blob จริง — ส่ง {uri,name,type} แบบ RN ตรงๆ จะกลายเป็น "[object Object]" แทนไฟล์
        const blob = await (await fetch(slip.uri)).blob();
        form.append('slip', blob, fileName);
      } else {
        form.append('slip', {
          uri: slip.uri,
          name: fileName,
          type: slip.mimeType || 'image/jpeg',
        });
      }
      const res = await api.post('/payment', form);
      if (res.data?.success) setSubmitted(true);
      else setSlipError(res.data?.message || 'แจ้งชำระไม่สำเร็จ');
    } catch (err) {
      setSlipError(err.response?.data?.message || 'แจ้งชำระไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // กดกลับหน้าหลักโดยยังไม่ได้จ่าย → ยกเลิกการจองทันที ปล่อยห้องคืนทันที
  // (ไม่งั้นห้องจะค้างสถานะ "มีผู้เช่า" จนกว่า cron จะเก็บกวาดตอนหมดเวลา 5 นาที ทำให้ผู้ใช้กลับมาจองใหม่ไม่เห็นห้อง)
  const cancelAndGoHome = async () => {
    if (canPayNow && !submitted && !expired) {
      try {
        await api.put(`/editBooking/${bookingId}`, { status: 'ยกเลิก' });
      } catch (_err) {
        // best-effort — ถ้ายกเลิกไม่สำเร็จ cron จะเก็บกวาดให้เองตอนหมดเวลา
      }
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F7EE6" />

      <View style={styles.header}>
        <TouchableOpacity onPress={cancelAndGoHome} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>ชำระค่าจอง</Text>
          <Text style={styles.headerSub}>เลขที่การจอง {bookingRef}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>ห้องพัก</Text>
              <Text style={styles.heroRoom}>{roomNumber}</Text>
              <Text style={styles.heroMonth}>{isMonthly ? 'ห้องพักรายเดือน' : 'ห้องพักรายวัน'}</Text>
            </View>
            <View style={styles.heroIconBox}>
              <MaterialCommunityIcons name="check-decagram-outline" size={36} color="white" />
            </View>
          </View>

          <View style={styles.totalCard}>
            <View style={styles.totalRowTop}>
              <Text style={styles.totalLabel}>{isMonthly ? 'มัดจำล็อกห้อง' : 'ยอดชำระค่าจอง'}</Text>
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>{submitted ? 'ส่งสลิปแล้ว' : 'รอชำระ'}</Text>
              </View>
            </View>
            <Text style={styles.totalValue}>฿{Number(totalPrice).toLocaleString()}</Text>
          </View>
        </View>

        {/* นับเวลาถอยหลังแบบตัวใหญ่ ให้ผู้ใช้เห็นชัดว่าเหลือเวลาชำระเท่าไหร่ — เริ่มโชว์หลังกดเลือกวิธีชำระ */}
        {canPayNow && !submitted && paymentStarted && (
          expired ? (
            <View style={styles.countdownBoxExpired}>
              <Ionicons name="alert-circle" size={22} color="#B91C1C" />
              <Text style={styles.countdownExpiredTitle}>⏱ หมดเวลาชำระแล้ว</Text>
              <Text style={styles.countdownExpiredSub}>ระบบกำลังยกเลิกการจองและปล่อยห้องคืนอัตโนมัติ กำลังพาไปหน้าประวัติการจอง...</Text>
            </View>
          ) : (
            <View style={styles.countdownBox}>
              <Text style={styles.countdownLabel}>⏱ กรุณาชำระเงินภายใน</Text>
              <Text style={styles.countdownValue}>{mmss}</Text>
              <Text style={styles.countdownSub}>มิฉะนั้นการจองจะถูกยกเลิกอัตโนมัติและปล่อยห้องคืน</Text>
            </View>
          )
        )}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>รายละเอียดการจอง</Text>
        </View>

        <View style={styles.billCard}>
          <SummaryRow label="ห้องพัก" value={`ห้อง ${roomNumber}`} />
          <SummaryRow label="วันเข้าพัก" value={checkInDate} />
          {!isMonthly && <SummaryRow label="วันออก" value={checkOutDate} />}
          <View style={styles.detailDivider} />
          <SummaryRow
            label={isMonthly ? 'ยอดมัดจำล็อกห้อง' : 'ยอดรวมโดยประมาณ'}
            value={`฿${Number(totalPrice).toLocaleString()}`}
            highlight
          />
        </View>

        {isMonthly && !submitted && (
          <View style={styles.monthlyNote}>
            <Text style={styles.monthlyNoteText}>ชำระตอนนี้เฉพาะมัดจำล็อกห้อง เพื่อกันห้องไว้</Text>
            <Text style={styles.monthlyNoteSub}>ค่าเช่าและมัดจำสัญญาที่เหลือจะเก็บตอนเจ้าหน้าที่เช็คอิน</Text>
          </View>
        )}

        {canPayNow ? (
          expired ? null : submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={26} color="#16A34A" />
              <Text style={styles.successText}>ส่งสลิปแล้ว · ยืนยันการจองแล้ว</Text>
              <Text style={styles.successSub}>กำลังพาไปหน้าประวัติการจอง...</Text>
            </View>
          ) : (
            <View style={{ marginHorizontal: 16 }}>
              {/* เลือกวิธีชำระ 2 แบบ: สแกน QR พร้อมเพย์ / โอนด้วยเบอร์พร้อมเพย์เอง */}
              <View style={styles.payTabRow}>
                <TouchableOpacity
                  onPress={() => setPayTab('qr')}
                  style={[styles.payTabCard, payTab === 'qr' && styles.payTabCardActiveQr]}
                >
                  <View style={[styles.payTabIconBox, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="qr-code-outline" size={20} color="#0284C7" />
                  </View>
                  <Text style={styles.payTabTitle}>QR พร้อมเพย์</Text>
                  <Text style={styles.payTabSub}>สแกนจ่ายได้ทันที</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPayTab('manual')}
                  style={[styles.payTabCard, payTab === 'manual' && styles.payTabCardActiveManual]}
                >
                  <View style={[styles.payTabIconBox, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="call-outline" size={20} color="#16A34A" />
                  </View>
                  <Text style={styles.payTabTitle}>เบอร์พร้อมเพย์</Text>
                  <Text style={styles.payTabSub}>โอนเองผ่านแอปธนาคาร</Text>
                </TouchableOpacity>
              </View>

              {qr ? (
                <View style={styles.qrBox}>
                  {payTab === 'qr' ? (
                    <>
                      <View style={styles.previewBadge}>
                        <Ionicons name="qr-code" size={16} color="#0284C7" />
                        <Text style={styles.previewBadgeText}>QR PromptPay</Text>
                      </View>
                      <Image source={{ uri: qr.qrImage }} style={styles.qrImage} />
                    </>
                  ) : (
                    <>
                      <View style={styles.previewBadge}>
                        <Ionicons name="call" size={16} color="#16A34A" />
                        <Text style={styles.previewBadgeText}>โอนด้วยเบอร์พร้อมเพย์</Text>
                      </View>
                      <View style={styles.promptpayNumberBox}>
                        <Text style={styles.promptpayNumberText} selectable>
                          {formatPromptpayId(qr.promptpayId)}
                        </Text>
                      </View>
                      <Text style={styles.qrHint}>เปิดแอปธนาคาร เลือกโอนผ่านพร้อมเพย์ แล้วกรอกเบอร์นี้ (แตะค้างที่เบอร์เพื่อคัดลอก)</Text>
                    </>
                  )}
                  <Text style={styles.qrAmount}>สแกนโอน ฿{Number(qr.amount).toLocaleString()}</Text>
                  <Text style={styles.qrHint}>โอนแล้วแนบสลิปด้านล่างเพื่อแจ้งชำระ</Text>

                  <TouchableOpacity onPress={pickSlip} style={styles.slipDrop}>
                    {slip ? (
                      <Image source={{ uri: slip.uri }} style={styles.slipPreview} />
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="cloud-upload-outline" size={26} color="#64748B" />
                        <Text style={styles.slipDropText}>แตะเพื่อแนบสลิปการโอนเงิน</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={submitSlip} disabled={loading} style={styles.confirmPayButton}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmPayText}>ส่งแจ้งชำระ</Text>}
                  </TouchableOpacity>

                  {slipError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorTitle}>แจ้งชำระไม่สำเร็จ</Text>
                      <Text style={styles.errorText}>{slipError}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={startPay}
                    disabled={loading || expired}
                    style={[styles.payNowButton, (loading || expired) && { opacity: 0.5 }]}
                  >
                    {loading ? <ActivityIndicator color="white" /> : (
                      <>
                        <Ionicons name={payTab === 'qr' ? 'qr-code-outline' : 'call-outline'} size={20} color="white" />
                        <Text style={styles.payNowText}>
                          {isMonthly ? 'ชำระมัดจำล็อกห้อง' : 'ชำระค่าจอง'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {payError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorTitle}>สร้าง QR ไม่สำเร็จ</Text>
                      <Text style={styles.errorText}>{payError}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )
        ) : (
          <Text style={styles.pendingText}>
            สถานะปัจจุบัน: รอชำระมัดจำ · ดูรายละเอียดการชำระได้ที่ "ประวัติการจอง"
          </Text>
        )}

        <Text style={styles.emailText}>
          {emailSent ? '📧 ส่งอีเมลยืนยันการจองให้แล้ว' : 'บันทึกการจองเรียบร้อย'}
        </Text>

        {!submitted && (
          <TouchableOpacity onPress={() => router.push('/reservationlist')} style={styles.historyButton}>
            <Text style={styles.historyButtonText}>ดูประวัติการจอง</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SummaryRow = ({ label, value, highlight }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, highlight && { color: '#0F7EE6', fontSize: 16 }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0F7EE6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  heroCard: {
    margin: 16,
    borderRadius: 28,
    backgroundColor: '#0F7EE6',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
  },
  heroRoom: {
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  heroMonth: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalCard: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    padding: 16,
  },
  totalRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  totalBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  totalBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
  totalValue: {
    color: 'white',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 6,
  },
  countdownBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  countdownLabel: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
  },
  countdownValue: {
    color: '#C2410C',
    fontWeight: '900',
    fontSize: 34,
    fontVariant: ['tabular-nums'],
  },
  countdownSub: {
    color: '#9A3412',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  countdownBoxExpired: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  countdownExpiredTitle: {
    color: '#B91C1C',
    fontWeight: '900',
    fontSize: 15,
    marginTop: 6,
  },
  countdownExpiredSub: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitleRow: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  billCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  detailValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '900',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  monthlyNote: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 18,
    padding: 14,
  },
  monthlyNoteText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '800',
  },
  monthlyNoteSub: {
    color: '#16A34A',
    fontSize: 11,
    marginTop: 4,
  },
  payTabRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  payTabCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  payTabCardActiveQr: {
    borderColor: '#0194F3',
    backgroundColor: '#EFF6FF',
  },
  payTabCardActiveManual: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  payTabIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  payTabTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  payTabSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  promptpayNumberBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginTop: 4,
  },
  promptpayNumberText: {
    color: '#15803D',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  payNowButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 18,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  payNowText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  errorTitle: {
    color: '#B91C1C',
    fontWeight: '800',
    fontSize: 13,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 2,
  },
  qrBox: {
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
  },
  qrAmount: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 10,
  },
  qrHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  slipDrop: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  slipPreview: {
    width: 110,
    height: 110,
    borderRadius: 12,
  },
  slipDropText: {
    color: '#64748B',
    fontWeight: '700',
    marginTop: 6,
    fontSize: 12,
  },
  confirmPayButton: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmPayText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
  },
  successBox: {
    marginHorizontal: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  successText: {
    color: '#16A34A',
    fontWeight: '900',
    fontSize: 15,
    marginTop: 8,
  },
  successSub: {
    color: '#15803D',
    fontSize: 12,
    marginTop: 4,
  },
  pendingText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 8,
    marginHorizontal: 16,
  },
  emailText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  historyButton: {
    marginHorizontal: 16,
    backgroundColor: '#0194F3',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  historyButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 15,
  },
});
