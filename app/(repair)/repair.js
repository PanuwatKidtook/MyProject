import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// เดียวกับ Home: ใช้ตรวจว่าการจองนี้ "ยืนยันแล้ว" จริง ๆ (ไม่ใช่รอชำระ/ยกเลิก)
const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const isCancelledStatus = (status) => {
  const s = normalizeStatus(status);
  return s === 'ยกเลิก' || s === 'cancelled' || s === 'canceled';
};

const isPendingStatus = (status) => {
  const s = normalizeStatus(status);
  return s === 'รอชำระมัดจำ' || s === 'รอดำเนินการ';
};

export default function RepairScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [roomNo, setRoomNo] = useState('');
  const [confirmedRoom, setConfirmedRoom] = useState(null);
  const [problemType, setProblemType] = useState('');
  const [problemDetail, setProblemDetail] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactLine, setContactLine] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ตรวจสอบว่าผู้เช่ารายเดือนคนนี้จองห้องไว้หรือยัง (เช็คแบบเดียวกับหน้าแรก)
  const fetchConfirmedRoom = useCallback(async () => {
    try {
      const response = await api.post('/checkbooking', {});
      const bookings = response.data?.success && Array.isArray(response.data.data) ? response.data.data : [];
      const confirmed = bookings.find(
        (item) => !isCancelledStatus(item.bookingStatus) && !isPendingStatus(item.bookingStatus)
      );
      setConfirmedRoom(confirmed || null);
      setRoomNo(confirmed?.roomNumber ? String(confirmed.roomNumber) : '');
    } catch (e) {
      setConfirmedRoom(null);
      setRoomNo('');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          if (userData) {
            const parsed = JSON.parse(userData);
            setUser(parsed);
            setContactPhone(parsed?.phone || '');
            setContactLine(parsed?.lineId || '');
            if (parsed?.role === 'Monthly_Tenant') {
              fetchConfirmedRoom();
            } else {
              setConfirmedRoom(null);
              setRoomNo(parsed?.roomNo ? String(parsed.roomNo) : '');
            }
          } else {
            setUser(null);
            setConfirmedRoom(null);
            setRoomNo('');
            setContactPhone('');
            setContactLine('');
          }
        } catch (e) {
          setUser(null);
        }
      };
      loadUser();
    }, [fetchConfirmedRoom])
  );

  // backend ใช้ PascalCase เสมอ
  const role = user?.role || 'guest';

  const profileTitle = useMemo(() => {
    if (role === 'Daily_Tenant') return 'ผู้แจ้งปัญหา: ผู้เช่ารายวัน';
    if (role === 'Monthly_Tenant') return 'ผู้แจ้งปัญหา: ผู้เช่ารายเดือน';
    return 'ข้อมูลผู้แจ้ง';
  }, [role]);

  const roleSubtitle = useMemo(() => {
    if (role === 'Daily_Tenant') return 'ผู้เช่ารายวันไม่สามารถแจ้งซ่อมได้ (สิทธิ์เฉพาะผู้เช่ารายเดือน)';
    if (role === 'Monthly_Tenant') return 'รูปแบบการแจ้งสำหรับลูกบ้านประจำ';
    return 'กรุณาเข้าสู่ระบบเพื่อใช้งานแบบเต็มรูปแบบ';
  }, [role]);

  const problemButtons = useMemo(() => {
    return ['ไฟฟ้า', 'แอร์', 'น้ำประปา', 'ประตู/กุญแจ', 'อินเทอร์เน็ต', 'บิล/มิเตอร์', 'อื่น ๆ'];
  }, []);

  const submitRepair = async () => {
    if (submitting || justSubmitted) return;

    // เฉพาะ Monthly_Tenant เท่านั้นที่แจ้งซ่อมได้ (backend มี monthlyTenantCheck)
    if (role !== 'Monthly_Tenant') {
      Alert.alert('ไม่มีสิทธิ์', 'การแจ้งซ่อมสำหรับผู้เช่ารายเดือนเท่านั้น');
      return;
    }
    if (!problemType.trim()) {
      Alert.alert('กรุณาเลือกประเภทปัญหา', 'เลือกประเภทปัญหาก่อน');
      return;
    }
    if (!problemDetail.trim()) {
      Alert.alert('กรุณากรอกรายละเอียด', 'กรอกรายละเอียดปัญหาเพิ่ม');
      return;
    }

    setSubmitting(true);
    try {
      // 1. ดึง booking ที่กำลังเข้าพักอยู่ — ต้องมี booking_id ก่อนส่งแจ้งซ่อม
      const bookingsRes = await api.post('/checkbooking', {});
      const allBookings = bookingsRes.data?.data || [];
      const activeBooking = allBookings.find(b => b.bookingStatus === 'กำลังเข้าพัก');

      if (!activeBooking) {
        Alert.alert('ไม่พบการเข้าพัก', 'ต้องมีการจองที่เช็คอินแล้ว (สถานะ "กำลังเข้าพัก") จึงแจ้งซ่อมได้');
        return;
      }

      // 2. ส่งแจ้งซ่อมพร้อม booking_id และเลขห้องจากการจองจริง
      await api.post('/repair', {
        booking_id: activeBooking.bookingId,
        room_number: activeBooking.roomNumber,
        problem_title: problemType,
        problem_details: problemDetail,
      });

      setJustSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'ส่งแจ้งซ่อมไม่สำเร็จ กรุณาลองใหม่';
      Alert.alert('ส่งไม่สำเร็จ', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderRoleBadge = () => {
    if (role === 'Daily_Tenant') {
      return (
        <View style={[styles.roleBadge, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
          <FontAwesome5 name="hotel" size={14} color="#0284C7" />
          <Text style={[styles.roleBadgeText, { color: '#0284C7' }]}>Daily Tenant</Text>
        </View>
      );
    }
    if (role === 'Monthly_Tenant') {
      return (
        <View style={[styles.roleBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
          <FontAwesome5 name="building" size={14} color="#059669" />
          <Text style={[styles.roleBadgeText, { color: '#059669' }]}>Monthly Tenant</Text>
        </View>
      );
    }
    return (
      <View style={[styles.roleBadge, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
        <FontAwesome5 name="user-alt" size={14} color="#EA580C" />
        <Text style={[styles.roleBadgeText, { color: '#EA580C' }]}>Guest</Text>
      </View>
    );
  };

  const renderTopCard = () => {
    if (role === 'Daily_Tenant') {
      return (
        <View style={styles.topCardDaily}>
          <View style={styles.topCardRow}>
            <View style={styles.topIconWrapDaily}>
              <Ionicons name="calendar" size={18} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.topCardTitleDaily}>งานแจ้งซ่อมสำหรับผู้เช่ารายวัน</Text>
              <Text style={styles.topCardSubDaily}>กรอกข้อมูลสั้น กระชับ และส่งให้แม่บ้าน/ช่างเข้าตรวจสอบ</Text>
            </View>
          </View>
          <View style={styles.smallInfoGrid}>
            <View style={styles.smallInfoBox}>
              <Text style={styles.smallInfoLabel}>ห้อง</Text>
              <Text style={styles.smallInfoValue}>{roomNo || user?.roomNo || '-'}</Text>
            </View>
            <View style={styles.smallInfoBox}>
              <Text style={styles.smallInfoLabel}>สถานะ</Text>
              <Text style={styles.smallInfoValue}>Daily</Text>
            </View>
          </View>
        </View>
      );
    }

    if (role === 'Monthly_Tenant') {
      return (
        <View style={styles.topCardMonthly}>
          <View style={styles.topCardRow}>
            <View style={styles.topIconWrapMonthly}>
              <Ionicons name="home" size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.topCardTitleMonthly}>ใบแจ้งซ่อมลูกบ้านรายเดือน</Text>
              <Text style={styles.topCardSubMonthly}>ใช้สำหรับติดตามงานซ่อม, ประวัติการแจ้ง, และการนัดหมายช่าง</Text>
            </View>
          </View>
          <View style={styles.smallInfoGrid}>
            <View style={styles.smallInfoBox}>
              <Text style={styles.smallInfoLabel}>ห้อง</Text>
              <Text style={styles.smallInfoValue}>{roomNo || user?.roomNo || '-'}</Text>
            </View>
            <View style={styles.smallInfoBox}>
              <Text style={styles.smallInfoLabel}>สถานะ</Text>
              <Text style={styles.smallInfoValue}>Monthly</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.topCardGuest}>
        <View style={styles.topCardRow}>
          <View style={styles.topIconWrapGuest}>
            <Ionicons name="lock-closed" size={18} color="#C2410C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.topCardTitleGuest}>กรุณาเข้าสู่ระบบก่อนแจ้งซ่อม</Text>
            <Text style={styles.topCardSubGuest}>หลังเข้าสู่ระบบ ระบบจะดึงประเภทผู้ใช้และเลขห้องให้อัตโนมัติ</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0178C7" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>แจ้งซ่อมและแจ้งปัญหา</Text>
              <Text style={styles.headerSub}>ส่งเรื่องให้หอพักตรวจสอบได้เลย</Text>
            </View>

            <View style={styles.headerIcon}>
              <FontAwesome5 name="tools" size={18} color="#0178C7" />
            </View>
          </View>

          <View style={styles.body}>
            {renderTopCard()}

            <View style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <Text style={styles.cardTitle}>{profileTitle}</Text>
                {renderRoleBadge()}
              </View>
              <Text style={styles.cardSub}>{roleSubtitle}</Text>

              <Text style={styles.label}>เลขห้อง</Text>
              <TextInput
                value={roomNo}
                onChangeText={role === 'Monthly_Tenant' ? undefined : setRoomNo}
                editable={role !== 'Monthly_Tenant'}
                placeholder={role === 'Monthly_Tenant' ? '-' : (user?.roomNo ? `เช่น ${user.roomNo}` : 'กรอกเลขห้อง')}
                placeholderTextColor="#94A3B8"
                style={[styles.input, role === 'Monthly_Tenant' && styles.inputDisabled]}
              />

              {(role === 'Monthly_Tenant' || role === 'Daily_Tenant') && (
                <>
                  <Text style={styles.label}>ข้อมูลติดต่อ</Text>
                  <View style={styles.contactGrid}>
                    <TextInput
                      value={contactPhone}
                      onChangeText={setContactPhone}
                      placeholder="เบอร์โทรติดต่อ"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      style={[styles.input, styles.contactInput]}
                    />
                    <TextInput
                      value={contactLine}
                      onChangeText={setContactLine}
                      placeholder="Line ID"
                      placeholderTextColor="#94A3B8"
                      style={[styles.input, styles.contactInput]}
                    />
                  </View>
                </>
              )}

              {role === 'Monthly_Tenant' && (
                <>
                  <Text style={styles.label}>เวลาที่สะดวกให้ช่างติดต่อ</Text>
                  <TextInput
                    value={preferredTime}
                    onChangeText={setPreferredTime}
                    placeholder="เช่น 09:00-12:00"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                  />
                </>
              )}

              <Text style={styles.label}>ประเภทปัญหา</Text>
              <View style={styles.chipWrap}>
                {problemButtons.map((item) => {
                  const active = problemType === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => { setProblemType(item); setJustSubmitted(false); }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>รายละเอียดปัญหา</Text>
              <TextInput
                value={problemDetail}
                onChangeText={(text) => { setProblemDetail(text); setJustSubmitted(false); }}
                placeholder='เช่น แอร์เสีย, ประตูล็อกไม่ได้, ปลั๊กไม่ทำงาน'
                placeholderTextColor="#94A3B8"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                onPress={() => setUrgent(!urgent)}
                style={styles.urgentBox}
                activeOpacity={0.85}
              >
                <View style={[styles.checkbox, urgent && styles.checkboxActive]}>
                  {urgent ? <Ionicons name="checkmark" size={14} color="white" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.urgentTitle}>แจ้งด่วน</Text>
                  <Text style={styles.urgentSub}>
                    เลือกถ้าปัญหานี้ต้องการให้รีบตรวจสอบ
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitRepair}
                disabled={submitting || justSubmitted}
                style={[styles.submitButton, (submitting || justSubmitted) && styles.submitButtonDisabled]}
                activeOpacity={0.9}
              >
                <Ionicons name="paper-plane" size={18} color="white" />
                <Text style={styles.submitText}>
                  {submitting ? 'กำลังส่ง...' : justSubmitted ? 'ส่งแล้ว' : 'ส่งแจ้งซ่อม'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>รูปแบบงานมาตรฐาน</Text>

              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineItemTitle}>รับเรื่อง</Text>
                  <Text style={styles.timelineItemText}>ระบบบันทึกเลขห้องและประเภทผู้แจ้ง</Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineItemTitle}>คัดแยกงาน</Text>
                  <Text style={styles.timelineItemText}>
                    รายวันจะเน้นงานเร็วและสั้น, รายเดือนจะมีรายละเอียดและติดตามงานต่อเนื่อง
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineItemTitle}>ส่งต่อช่าง</Text>
                  <Text style={styles.timelineItemText}>ส่งข้อมูลพร้อมสถานะ urgent เพื่อจัดลำดับงาน</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={justSubmitted} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color="#059669" />
            </View>
            <Text style={styles.modalTitle}>ส่งแจ้งซ่อมสำเร็จ</Text>
            <Text style={styles.modalSub}>ระบบได้รับรายการแจ้งปัญหาของคุณแล้ว</Text>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.9}
              onPress={() => router.back()}
            >
              <Text style={styles.modalButtonText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0194F3' },
  header: {
    backgroundColor: '#0178C7',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4, fontWeight: '600' },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 18 },
  topCardDaily: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
  },
  topCardMonthly: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
  },
  topCardGuest: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
  },
  topCardRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  topIconWrapDaily: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  topIconWrapMonthly: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  topIconWrapGuest: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  topCardTitleDaily: { color: '#0369A1', fontSize: 16, fontWeight: '900' },
  topCardSubDaily: { color: '#0284C7', fontSize: 12, marginTop: 4, fontWeight: '600', lineHeight: 18 },
  topCardTitleMonthly: { color: '#065F46', fontSize: 16, fontWeight: '900' },
  topCardSubMonthly: { color: '#059669', fontSize: 12, marginTop: 4, fontWeight: '600', lineHeight: 18 },
  topCardTitleGuest: { color: '#C2410C', fontSize: 16, fontWeight: '900' },
  topCardSubGuest: { color: '#EA580C', fontSize: 12, marginTop: 4, fontWeight: '600', lineHeight: 18 },
  smallInfoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  smallInfoBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smallInfoLabel: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  smallInfoValue: { fontSize: 16, color: '#0F172A', fontWeight: '900', marginTop: 4 },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
    marginBottom: 16,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', flex: 1 },
  cardSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 14, fontWeight: '500' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  successBannerText: { color: '#059669', fontSize: 13, fontWeight: '700', flex: 1 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '900' },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: '#0F172A',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  contactGrid: {
    gap: 10,
  },
  contactInput: {
    marginBottom: 0,
  },
  textArea: { minHeight: 120, paddingTop: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '700' },
  chipTextActive: { color: '#0284C7' },
  urgentBox: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 14,
    borderRadius: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  checkboxActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  urgentTitle: { fontSize: 14, fontWeight: '900', color: '#C2410C' },
  urgentSub: { fontSize: 12, color: '#9A3412', marginTop: 2, fontWeight: '500' },
  submitButton: {
    marginTop: 18,
    backgroundColor: '#0194F3',
    paddingVertical: 15,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: 'white', fontSize: 16, fontWeight: '900' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
  modalSub: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center', fontWeight: '500' },
  modalButton: {
    marginTop: 20,
    backgroundColor: '#0194F3',
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: { color: 'white', fontSize: 15, fontWeight: '900' },
  timelineCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0194F3',
    marginTop: 6,
  },
  timelineItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineItemText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '500',
  },
});