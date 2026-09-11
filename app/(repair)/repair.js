import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
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

// แปลงสถานะแจ้งซ่อม -> ป้ายสี (รองรับค่าจาก backend หลายแบบ)
const getRepairStatusInfo = (status) => {
  const s = normalizeStatus(status);
  // เสร็จสิ้น
  if (['เสร็จสิ้น', 'เสร็จ', 'สำเร็จ', 'done', 'complete', 'completed', 'closed', 'finish'].some((k) => s.includes(k))) {
    return { label: 'เสร็จสิ้น', color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD', icon: 'checkmark-done-circle' };
  }
  // กำลังดำเนินการ / แอดมินรับเรื่องแล้ว
  if (['กำลังดำเนินการ', 'ดำเนินการ', 'รับเรื่อง', 'รับแล้ว', 'accept', 'progress', 'processing', 'inprogress'].some((k) => s.includes(k))) {
    return { label: 'กำลังดำเนินการ', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: 'construct' };
  }
  // ยกเลิก
  if (['ยกเลิก', 'cancel', 'reject', 'ปฏิเสธ'].some((k) => s.includes(k))) {
    return { label: 'ยกเลิก', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', icon: 'close-circle' };
  }
  // ค่าเริ่มต้น = ยังไม่รับเรื่อง -> รอตรวจสอบ (แดง)
  return { label: 'รอตรวจสอบ', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: 'time' };
};

// ดึงค่าจากรายการแจ้งซ่อม รองรับชื่อ field ได้หลายแบบ
const pickField = (item, keys, fallback = '') => {
  for (const k of keys) {
    if (item?.[k] !== undefined && item?.[k] !== null && item?.[k] !== '') return item[k];
  }
  return fallback;
};

// ไอคอนประจำแต่ละประเภทปัญหา (เพื่อความสวยงาม ไม่กระทบการทำงาน)
const PROBLEM_ICONS = {
  'ไฟฟ้า': 'flash',
  'แอร์': 'snow',
  'น้ำประปา': 'water',
  'ประตู/กุญแจ': 'key',
  'อินเทอร์เน็ต': 'wifi',
  'บิล/มิเตอร์': 'receipt',
  'อื่น ๆ': 'ellipsis-horizontal',
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
  const [repairs, setRepairs] = useState([]);
  const [loadingRepairs, setLoadingRepairs] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]); // ไฟล์แนบ (รูป/วิดีโอ) ก่อนส่ง

  // โหลดรายการแจ้งซ่อมของผู้ใช้ (GET /my-repairs/:bookingId — เฉพาะ Monthly ที่กำลังเข้าพัก)
  const fetchRepairs = useCallback(async () => {
    try {
      setLoadingRepairs(true);
      // หา booking ที่กำลังเข้าพักอยู่ เพื่อใช้เป็น bookingId
      const bookingsRes = await api.post('/checkbooking', {});
      const all = bookingsRes.data?.data || [];
      const active = all.find((b) => b.bookingStatus === 'กำลังเข้าพัก')
        || all.find((b) => !isCancelledStatus(b.bookingStatus) && !isPendingStatus(b.bookingStatus));

      if (!active?.bookingId) {
        setRepairs([]);
        return;
      }

      const res = await api.get(`/my-repairs/${active.bookingId}`);
      const raw = res.data?.data ?? [];
      setRepairs(Array.isArray(raw) ? raw : []);
    } catch (e) {
      setRepairs([]);
    } finally {
      setLoadingRepairs(false);
    }
  }, []);

  // เลือกรูป/วิดีโอจากเครื่อง (สูงสุด 5 ไฟล์ตามที่ backend รองรับ)
  const pickMedia = async () => {
    try {
      const remaining = 5 - mediaFiles.length;
      if (remaining <= 0) {
        Alert.alert('แนบได้สูงสุด 5 ไฟล์', 'กรุณาลบไฟล์เดิมก่อนเพิ่มไฟล์ใหม่');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // รูป + วิดีโอ
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (result.canceled) return;

      const picked = (result.assets || []).map((a) => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || `${a.type === 'video' ? 'video' : 'image'}_${Date.now()}.${a.type === 'video' ? 'mp4' : 'jpg'}`,
        mimeType: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        file: a.file, // มีเฉพาะบนเว็บ
      }));
      setMediaFiles((prev) => [...prev, ...picked].slice(0, 5));
      setJustSubmitted(false);
    } catch (e) {
      Alert.alert('เลือกไฟล์ไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
    }
  };

  const removeMedia = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
            // โหลดรายการแจ้งของผู้ใช้ (สำหรับผู้ที่ล็อกอินแล้ว)
            fetchRepairs();
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
    }, [fetchConfirmedRoom, fetchRepairs])
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

      // 2. ส่งแจ้งซ่อมแบบ multipart (แนบรูป/วิดีโอได้) — field ไฟล์ชื่อ 'media'
      const fd = new FormData();
      fd.append('booking_id', String(activeBooking.bookingId));
      fd.append('problem_title', problemType);
      fd.append('problem_details', problemDetail);
      if (preferredTime?.trim()) fd.append('preferred_time', preferredTime.trim());

      for (const m of mediaFiles) {
        if (Platform.OS === 'web') {
          // เว็บ: ใช้ File object ถ้ามี ไม่งั้นแปลง uri เป็น blob
          const fileObj = m.file || await (await fetch(m.uri)).blob();
          fd.append('media', fileObj, m.fileName);
        } else {
          // native: ส่งเป็น { uri, name, type }
          fd.append('media', { uri: m.uri, name: m.fileName, type: m.mimeType });
        }
      }

      await api.post('/repair', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMediaFiles([]);
      setJustSubmitted(true);
      // รีเฟรชรายการแจ้งให้เห็นรายการใหม่ทันที
      fetchRepairs();
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
          <LinearGradient
            colors={['#0B3C6E', '#082C54', '#04203E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* ลวดลายตกแต่งโปร่งแสง (ไม่กระทบการใช้งาน) */}
            <View style={styles.heroDecorLg} pointerEvents="none" />
            <View style={styles.heroDecorSm} pointerEvents="none" />

            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={22} color="white" />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>แจ้งซ่อมและแจ้งปัญหา</Text>
                <Text style={styles.headerSub}>ส่งเรื่องให้หอพักตรวจสอบได้เลย</Text>
              </View>

              <LinearGradient
                colors={['#F5D77A', '#D4AF37', '#B8901E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerIcon}
              >
                <View style={styles.headerIconInner}>
                  <FontAwesome5 name="tools" size={17} color="#0B3C6E" />
                </View>
              </LinearGradient>
            </View>
          </LinearGradient>

          <View style={styles.body}>
            {renderTopCard()}

            <View style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <View style={styles.titleWithBar}>
                  <LinearGradient
                    colors={['#F5D77A', '#D4AF37']}
                    style={styles.goldBar}
                  />
                  <Text style={styles.cardTitle}>{profileTitle}</Text>
                </View>
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
                  const inner = (
                    <>
                      <Ionicons
                        name={PROBLEM_ICONS[item] || 'construct'}
                        size={14}
                        color={active ? '#FFFFFF' : '#94A3B8'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </>
                  );
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => { setProblemType(item); setJustSubmitted(false); }}
                      style={active ? styles.chipActiveShadow : undefined}
                      activeOpacity={0.85}
                    >
                      {active ? (
                        <LinearGradient
                          colors={['#0A8DEE', '#0178C7', '#025FA3']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.chip, styles.chipActive]}
                        >
                          {inner}
                        </LinearGradient>
                      ) : (
                        <View style={styles.chip}>{inner}</View>
                      )}
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

              <Text style={styles.label}>แนบรูปภาพ / วิดีโอ (สูงสุด 5 ไฟล์)</Text>
              <View style={styles.mediaWrap}>
                {mediaFiles.map((m, i) => (
                  <View key={`${m.uri}-${i}`} style={styles.mediaThumb}>
                    <Image source={{ uri: m.uri }} style={styles.mediaImage} />
                    {m.type === 'video' && (
                      <View style={styles.mediaVideoOverlay}>
                        <Ionicons name="play-circle" size={26} color="rgba(255,255,255,0.95)" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.mediaRemove}
                      onPress={() => removeMedia(i)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={13} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}

                {mediaFiles.length < 5 && (
                  <TouchableOpacity style={styles.mediaAddBtn} onPress={pickMedia} activeOpacity={0.8}>
                    <Ionicons name="camera" size={22} color="#0178C7" />
                    <Text style={styles.mediaAddText}>เพิ่มไฟล์</Text>
                  </TouchableOpacity>
                )}
              </View>

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
                style={[styles.submitShadow, (submitting || justSubmitted) && { opacity: 0.7 }]}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={(submitting || justSubmitted)
                    ? ['#94A3B8', '#94A3B8']
                    : ['#0A8DEE', '#0178C7', '#025FA3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitButton}
                >
                  <Ionicons name="paper-plane" size={18} color="white" />
                  <Text style={styles.submitText}>
                    {submitting ? 'กำลังส่ง...' : justSubmitted ? 'ส่งแล้ว' : 'ส่งแจ้งซ่อม'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ===== รายการแจ้งของฉัน ===== */}
            {role === 'Monthly_Tenant' && (
              <View style={[styles.formCard, { marginBottom: 16 }]}>
                <View style={styles.repairListHead}>
                  <View style={styles.titleWithBar}>
                    <LinearGradient colors={['#F5D77A', '#D4AF37']} style={styles.goldBar} />
                    <Text style={styles.cardTitle}>รายการแจ้งของฉัน</Text>
                  </View>
                  <TouchableOpacity onPress={fetchRepairs} style={styles.refreshBtn} activeOpacity={0.7}>
                    <Ionicons name="refresh" size={18} color="#0178C7" />
                  </TouchableOpacity>
                </View>

                {loadingRepairs ? (
                  <Text style={styles.repairEmptyText}>กำลังโหลดรายการ...</Text>
                ) : repairs.length === 0 ? (
                  <View style={styles.repairEmptyBox}>
                    <Ionicons name="document-text-outline" size={30} color="#94A3B8" />
                    <Text style={styles.repairEmptyText}>ยังไม่มีรายการแจ้ง</Text>
                  </View>
                ) : (
                  repairs.map((item, idx) => {
                    const status = pickField(item, ['status', 'repairStatus', 'repair_status', 'repairstatus', 'state']);
                    const info = getRepairStatusInfo(status);
                    const title = pickField(item, ['problem_title', 'problemTitle', 'title', 'problem_type', 'problemType'], 'แจ้งปัญหา');
                    const detail = pickField(item, ['problem_details', 'problemDetails', 'detail', 'details', 'description']);
                    const room = pickField(item, ['room_number', 'roomNumber', 'room', 'roomNo']);
                    const created = pickField(item, ['reported_date', 'created_at', 'createdAt', 'created', 'date', 'report_date']);
                    const key = pickField(item, ['repair_id', 'repairId', 'id', '_id'], String(idx));
                    const mediaUrls = pickField(item, ['media_urls', 'mediaUrls', 'media'], []);
                    const mediaList = Array.isArray(mediaUrls) ? mediaUrls : [];
                    return (
                      <View key={key} style={styles.repairItem}>
                        <View style={styles.repairItemTop}>
                          <View style={styles.repairIconWrap}>
                            <Ionicons name={PROBLEM_ICONS[title] || 'construct'} size={16} color="#0178C7" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.repairItemTitle} numberOfLines={1}>{title}</Text>
                            {!!room && <Text style={styles.repairItemMeta}>ห้อง {room}</Text>}
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: info.bg, borderColor: info.border }]}>
                            <Ionicons name={info.icon} size={13} color={info.color} />
                            <Text style={[styles.statusBadgeText, { color: info.color }]}>{info.label}</Text>
                          </View>
                        </View>
                        {!!detail && <Text style={styles.repairItemDetail} numberOfLines={2}>{detail}</Text>}

                        {mediaList.length > 0 && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                            {mediaList.map((url, mi) => {
                              const isVideo = /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(String(url));
                              return (
                                <View key={mi} style={styles.repairMediaThumb}>
                                  {isVideo ? (
                                    <View style={styles.repairVideoThumb}>
                                      <Ionicons name="videocam" size={20} color="#0178C7" />
                                    </View>
                                  ) : (
                                    <Image source={{ uri: url }} style={styles.repairMediaImg} />
                                  )}
                                </View>
                              );
                            })}
                          </ScrollView>
                        )}

                        {!!created && (
                          <Text style={styles.repairItemDate}>
                            {String(created).replace('T', ' ').slice(0, 16)}
                          </Text>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}

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
  safeArea: { flex: 1, backgroundColor: '#EEF3F8' },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroDecorLg: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  heroDecorSm: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerIconInner: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 18, width: '100%', maxWidth: 620, alignSelf: 'center' },
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
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
    marginBottom: 16,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleWithBar: { flexDirection: 'row', alignItems: 'center', flex: 1, marginBottom: 12 },
  goldBar: {
    width: 4,
    height: 22,
    borderRadius: 2,
    marginRight: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#0B3C6E', flex: 1 },
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F7FAFD',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    borderColor: 'transparent',
  },
  chipActiveShadow: {
    borderRadius: 999,
    shadowColor: '#0178C7',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
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
  submitShadow: {
    marginTop: 18,
    borderRadius: 18,
    shadowColor: '#0178C7',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
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
  mediaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mediaThumb: {
    width: 74,
    height: 74,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mediaRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaAddBtn: {
    width: 74,
    height: 74,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaAddText: {
    fontSize: 11,
    color: '#0178C7',
    fontWeight: '800',
    marginTop: 4,
  },
  repairMediaThumb: {
    marginRight: 8,
  },
  repairMediaImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  repairVideoThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#EAF4FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repairListHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF4FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  repairEmptyBox: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  repairEmptyText: {
    fontSize: 13.5,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 8,
  },
  repairItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
  },
  repairItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repairIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EAF4FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  repairItemTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0B3C6E',
  },
  repairItemMeta: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
  },
  repairItemDetail: {
    fontSize: 13,
    color: '#475569',
    marginTop: 10,
    lineHeight: 19,
    fontWeight: '500',
  },
  repairItemDate: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 8,
  },
  timelineCard: {
    backgroundColor: 'white',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0B3C6E',
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