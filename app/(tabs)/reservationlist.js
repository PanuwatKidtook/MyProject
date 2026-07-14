import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import api from '../../lib/api';

export default function ReservationListScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [choiceTarget, setChoiceTarget] = useState(null); // ห้องรายเดือนที่กด "ดูรายละเอียด" → เลือกดูข้อมูลห้อง/ดูการชำระบิล
  // เก็บผลยกเลิกไว้ในเครื่อง เผื่อ backend ไม่ได้อัปเดต bookingStatus ให้ตรงกันจริง ๆ หลังกดยกเลิก
  const [cancelledOverrides, setCancelledOverrides] = useState({});

  const CANCELLED_OVERRIDES_KEY = 'cancelledBookingOverrides';

  // โรลของบัญชี กำหนดว่าเห็นได้แค่รายวันหรือรายเดือนเท่านั้น (ไม่มี "ทั้งหมด" อีกต่อไป)
  const roleType = user?.role === 'Monthly_Tenant' ? 'monthly' : 'daily';

  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          setUser(userData ? JSON.parse(userData) : null);
        } catch {
          setUser(null);
        }
      };
      loadUser();
    }, [])
  );

  useEffect(() => {
    const loadOverrides = async () => {
      try {
        const raw = await AsyncStorage.getItem(CANCELLED_OVERRIDES_KEY);
        setCancelledOverrides(raw ? JSON.parse(raw) : {});
      } catch {
        setCancelledOverrides({});
      }
    };
    loadOverrides();
  }, []);

  // เก็บ "สแนปช็อต" ข้อมูลห้องไว้ทั้งชุด (ไม่ใช่แค่เหตุผล) เพราะ backend /checkbooking
  // จะไม่ส่งรายการที่ถูกยกเลิกกลับมาให้อีกเลยหลังยกเลิกสำเร็จ — ถ้าอ้างอิงจาก `bookings`
  // ที่ fetch ใหม่ รายการที่เพิ่งยกเลิกจะหายไปทันที ต้องเก็บข้อมูลที่จำเป็นไว้เองฝั่ง frontend
  const saveCancelledOverride = async (item, reason) => {
    setCancelledOverrides((prev) => {
      const next = {
        ...prev,
        [item.bookingId]: {
          roomNumber: item.roomNumber,
          rentType: item.rentType,
          reason,
          cancelledAt: new Date().toISOString()
        }
      };
      AsyncStorage.setItem(CANCELLED_OVERRIDES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const fetchBookings = async () => {
    try {
      const response = await api.post('/checkbooking', {});
      if (response.data?.success && Array.isArray(response.data.data)) {
        setBookings(response.data.data);
      } else {
        setBookings([]);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert('กรุณาเข้าสู่ระบบ', 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        router.replace('/(auth)/login');
      } else {
        setBookings([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [])
  );

  const normalizeStatus = (status) => {
    if (!status) return '';
    return String(status).trim().toLowerCase();
  };

  const isCancelledBooking = (item) => {
    const status = normalizeStatus(item.bookingStatus);
    return status === 'ยกเลิก' || status === 'cancelled' || status === 'canceled';
  };

  const isPendingBooking = (item) => {
    const status = normalizeStatus(item.bookingStatus);
    return status === 'รอชำระมัดจำ' || status === 'ยืนยันการจอง' || status === 'รอดำเนินการ';
  };

  const cancelReasons = [
    'เปลี่ยนใจไม่เข้าพัก',
    'ต้องการย้ายห้อง',
    'พบห้องอื่นที่เหมาะกว่า',
    'มีเหตุส่วนตัว',
    'จองซ้ำโดยไม่ตั้งใจ'
  ];

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const openCancelModal = (item) => {
    setCancelTarget(item);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const submitCancelRequest = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      Alert.alert('กรุณากรอกเหตุผล', 'ต้องระบุเหตุผลก่อนยกเลิก');
      return;
    }

    setCancelModalVisible(false);
    setCheckLoading(true);

    const targetId = cancelTarget.bookingId;
    const reasonText = cancelReason.trim();

    setTimeout(async () => {
      try {
        await api.put(`/editBooking/${targetId}`, {
          status: 'ยกเลิก',
          cancelReason: reasonText,
          cancelCheckStatus: 'approved'
        });

        // จำผลยกเลิกไว้ในเครื่องทันที เพราะ backend จะไม่ส่งรายการนี้กลับมาให้อีกแล้วหลังยกเลิกสำเร็จ
        await saveCancelledOverride(cancelTarget, reasonText);

        Alert.alert('ยกเลิกสำเร็จ', 'ระบบตรวจสอบเรียบร้อยและย้ายไปหน้า ยกเลิก แล้ว');
        setCancelTarget(null);
        setCancelReason('');
        fetchBookings();
        setActiveTab('history');
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'ไม่สามารถยกเลิกได้ กรุณาลองใหม่';
        Alert.alert('ผิดพลาด', errorMsg);
      } finally {
        setCheckLoading(false);
      }
    }, 2000);
  };

  const simulateCheckAndMove = async (item) => {
    setCheckLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await api.put(`/editBooking/${item.bookingId}`, {
        status: 'ยกเลิก',
        cancelReason: item.cancelReason || 'ตรวจสอบแล้วพบว่าการจองถูกยกเลิก',
        cancelCheckStatus: 'approved'
      });
      Alert.alert('ตรวจสอบเสร็จแล้ว', 'ระบบย้ายรายการไปหน้า ยกเลิก เรียบร้อย');
      fetchBookings();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'ตรวจสอบไม่สำเร็จ';
      Alert.alert('ผิดพลาด', errorMsg);
    } finally {
      setCheckLoading(false);
    }
  };

  // รายการที่ยัง active — backend กรอง "รอชำระมัดจำ"/"ยกเลิก" ออกให้อยู่แล้ว จึงกรองแค่ประเภทห้อง
  const filteredBookings = useMemo(() => {
    return bookings.filter(item => item.rentType === roleType && !isCancelledBooking(item));
  }, [roleType, bookings]);

  // ประวัติยกเลิกการจอง — สร้างจาก cancelledOverrides ที่เก็บไว้ในเครื่องล้วน ๆ (ไม่อิง `bookings` จาก backend)
  // เพราะ backend ไม่ส่งรายการที่ถูกยกเลิกกลับมาให้อีกเลย ถ้าอิงจาก `bookings` รายการที่เพิ่งยกเลิกจะหายไปทันที
  const historyBookings = useMemo(() => {
    return Object.entries(cancelledOverrides)
      .map(([bookingId, ov]) => ({
        bookingId,
        roomNumber: ov.roomNumber,
        rentType: ov.rentType,
        bookingStatus: 'ยกเลิก',
        cancelReason: ov.reason,
        cancelledAt: ov.cancelledAt
      }))
      .filter(item => item.rentType === roleType)
      .sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt));
  }, [cancelledOverrides, roleType]);

  const calcPrice = (item) => {
    if (!item.startDate || !item.endDate) return '-';
    const days = Math.ceil((new Date(item.endDate) - new Date(item.startDate)) / 86400000) || 1;

    if (item.rentType === 'monthly') {
      const months = Math.ceil(days / 30) || 1;
      return item.priceMonthly ? `฿${(months * item.priceMonthly).toLocaleString()}` : '-';
    }

    return item.pricePerDay ? `฿${(days * item.pricePerDay).toLocaleString()}` : '-';
  };

  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderBookingCard = (item, index) => (
    <View
      key={index}
      style={{
        backgroundColor: 'white',
        borderRadius: 28,
        marginBottom: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.1
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400' }}
          style={{ width: 110, height: 150 }}
        />
        <View style={{ flex: 1, padding: 15, justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 18, color: '#1E293B' }}>ห้อง {item.roomNumber}</Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: item.bookingStatus === 'รอชำระมัดจำ' ? '#FEF3C7' : '#E3F6ED'
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: item.bookingStatus === 'รอชำระมัดจำ' ? '#D97706' : '#10B981'
                  }}
                >
                  {item.bookingStatus}
                </Text>
              </View>
            </View>

            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
              {item.rentType === 'monthly' ? 'รายเดือน' : 'รายวัน'}
            </Text>

            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0194F3', marginTop: 5 }}>
              {calcPrice(item)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => (item.rentType === 'monthly' ? setChoiceTarget(item) : setSelectedDetail(item))}
              style={{ flex: 1, backgroundColor: '#0194F3', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>ดูรายละเอียด</Text>
            </TouchableOpacity>

            {isPendingBooking(item) && (
              <TouchableOpacity
                onPress={() => openCancelModal(item)}
                style={{
                  flex: 1,
                  backgroundColor: '#FEF2F2',
                  paddingVertical: 8,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#FECACA'
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444' }}>ยกเลิก</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  // แถวข้อมูลใน "ประวัติยกเลิกการจอง" — โชว์เฉพาะห้องที่ถูกยกเลิกแล้ว ดูอย่างเดียว ไม่มีปุ่มกดทำอะไรต่อ
  const renderHistoryItem = (item, index) => {
    return (
      <View
        key={`${item.bookingId || index}`}
        style={styles.historyItemCard}
      >
        <View style={styles.historyItemHeader}>
          <View>
            <Text style={styles.historyRoomText}>ห้อง {item.roomNumber}</Text>
            <Text style={styles.historyTypeText}>
              {item.rentType === 'monthly' ? 'รายเดือน' : 'รายวัน'}
            </Text>
          </View>
          <View style={[styles.historyPriceBadge, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.historyPriceText, { color: '#EF4444' }]}>ยกเลิก</Text>
          </View>
        </View>

        <View style={styles.historyDetailGrid}>
          <View style={styles.historyDetailBox}>
            <Text style={styles.historyDetailLabel}>วันที่ยกเลิก</Text>
            <Text style={styles.historyDetailValue}>{formatDate(item.cancelledAt)}</Text>
          </View>
          <View style={styles.historyDetailBox}>
            <Text style={styles.historyDetailLabel}>เวลาที่ยกเลิก</Text>
            <Text style={styles.historyDetailValue}>{formatTime(item.cancelledAt)}</Text>
          </View>
        </View>

        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>เหตุผลที่ยกเลิก</Text>
          <Text style={styles.reasonValue}>{item.cancelReason || 'ไม่ระบุเหตุผล'}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 15,
          backgroundColor: 'white',
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          zIndex: 10
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 45,
            height: 45,
            borderRadius: 12,
            backgroundColor: '#F0F8FF',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#0194F3" />
        </TouchableOpacity>

        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B' }}>ประวัติการจองของฉัน</Text>

        <TouchableOpacity
          onPress={onRefresh}
          style={{
            width: 45,
            height: 45,
            borderRadius: 12,
            backgroundColor: '#F0F8FF',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Ionicons name="refresh" size={22} color="#0194F3" />
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: 'white',
          paddingHorizontal: 15,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0'
        }}
      >
        {[
          { id: roleType, title: roleType === 'monthly' ? 'รายเดือน' : 'รายวัน' },
          { id: 'history', title: 'ประวัติยกเลิกการจอง' }
        ].map((tab) => {
          const isActive = (activeTab || roleType) === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderBottomWidth: 3,
                borderBottomColor: isActive ? '#0194F3' : 'transparent'
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: isActive ? '#0194F3' : '#64748B' }}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={{ marginTop: 10, color: '#64748B' }}>กำลังโหลดข้อมูล...</Text>
        </View>
      ) : activeTab === 'history' ? (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.historyCard}>
            <View style={styles.historyHeaderRow}>
              <View style={[styles.historyIconWrap, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="close-circle-outline" size={22} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>ประวัติยกเลิกการจอง</Text>
                <Text style={styles.historySub}>
                  {roleType === 'monthly' ? 'ห้องพักรายเดือนที่คุณยกเลิกไปแล้ว' : 'ห้องพักรายวันที่คุณยกเลิกไปแล้ว'}
                </Text>
              </View>
              <View style={styles.roleTag}>
                <Ionicons
                  name={roleType === 'monthly' ? 'calendar' : 'sunny'}
                  size={12}
                  color="#0284C7"
                />
                <Text style={styles.roleTagText}>{roleType === 'monthly' ? 'รายเดือน' : 'รายวัน'}</Text>
              </View>
            </View>
          </View>

          {historyBookings.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="checkmark-done-circle-outline" size={80} color="#CBD5E1" />
              <Text style={{ fontSize: 16, color: '#94A3B8', marginTop: 15 }}>
                ยังไม่มีการยกเลิกการจอง
              </Text>
            </View>
          ) : (
            historyBookings.map((item, index) => renderHistoryItem(item, index))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredBookings.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="receipt-outline" size={80} color="#CBD5E1" />
              <Text style={{ fontSize: 16, color: '#94A3B8', marginTop: 15 }}>
                ไม่มีประวัติการจองในหมวดหมู่นี้
              </Text>
            </View>
          ) : (
            filteredBookings.map((item, index) => renderBookingCard(item, index))
          )}
        </ScrollView>
      )}

      <Modal visible={cancelModalVisible} transparent animationType="fade" onRequestClose={() => setCancelModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>เหตุผลที่ยกเลิก</Text>
            <Text style={styles.modalSub}>กรุณาระบุเหตุผลก่อนส่งไปตรวจสอบ</Text>

            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="เช่น เปลี่ยนใจ, มีเหตุส่วนตัว..."
              placeholderTextColor="#94A3B8"
              style={styles.modalInput}
              multiline
            />

            <View style={styles.modalQuickReasons}>
              {cancelReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setCancelReason(reason)}
                  style={styles.quickReasonChip}
                >
                  <Text style={styles.quickReasonText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setCancelTarget(null);
                  setCancelReason('');
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>ปิด</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitCancelRequest}
                style={styles.modalSubmitBtn}
              >
                <Text style={styles.modalSubmitText}>ส่งตรวจสอบ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={checkLoading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0194F3" />
            <Text style={styles.loadingText}>กำลังตรวจสอบ ไม่เกิน 2 นาที...</Text>
          </View>
        </View>
      </Modal>

      {/* ห้องรายเดือน: กด "ดูรายละเอียด" แล้วเลือกก่อนว่าจะดูข้อมูลห้องพักหรือดูการชำระบิล */}
      <Modal visible={choiceTarget !== null} transparent animationType="fade" onRequestClose={() => setChoiceTarget(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setChoiceTarget(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 30 }}
        >
          <View onStartShouldSetResponder={() => true} style={{ backgroundColor: 'white', borderRadius: 26, padding: 22 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#1E293B', textAlign: 'center' }}>
              ห้อง {choiceTarget?.roomNumber}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 18 }}>
              เลือกสิ่งที่ต้องการดู
            </Text>

            <TouchableOpacity
              onPress={() => { setSelectedDetail(choiceTarget); setChoiceTarget(null); }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', borderRadius: 16, padding: 14, marginBottom: 10 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="bed-outline" size={18} color="#0284C7" />
              </View>
              <Text style={{ flex: 1, fontWeight: '800', color: '#0369A1' }}>ดูข้อมูลห้องพัก</Text>
              <Ionicons name="chevron-forward" size={18} color="#0284C7" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const item = choiceTarget;
                setChoiceTarget(null);
                router.push({
                  pathname: '/invoice',
                  params: {
                    bookingId: item.bookingId,
                    roomNumber: item.roomNumber,
                  }
                });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 16, padding: 14, marginBottom: 16 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="card-outline" size={18} color="#16A34A" />
              </View>
              <Text style={{ flex: 1, fontWeight: '800', color: '#15803D' }}>ดูการชำระบิล</Text>
              <Ionicons name="chevron-forward" size={18} color="#16A34A" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setChoiceTarget(null)} style={{ paddingVertical: 6, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 13 }}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={selectedDetail !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 25 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 30, padding: 25 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ionicons name="information-circle" size={50} color="#0194F3" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>ข้อมูลการเข้าพัก</Text>
            </View>

            <View style={{ gap: 12 }}>
              <DetailRow label="ID การจอง" value={`#${selectedDetail?.bookingId}`} />
              <DetailRow label="หมายเลขห้อง" value={selectedDetail?.roomNumber} />
              <DetailRow label="ประเภท" value={selectedDetail?.rentType === 'monthly' ? 'รายเดือน' : 'รายวัน'} />
              <DetailRow label="ราคารวม" value={calcPrice(selectedDetail || {})} />
              <DetailRow
                label="วันที่เข้าพัก"
                value={
                  selectedDetail?.startDate
                    ? new Date(selectedDetail.startDate).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : '-'
                }
              />
              <DetailRow
                label="ถึงวันที่"
                value={
                  selectedDetail?.endDate
                    ? new Date(selectedDetail.endDate).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : '-'
                }
              />
              <DetailRow label="สถานะ" value={selectedDetail?.bookingStatus || '-'} />
              {selectedDetail?.cancelReason ? (
                <DetailRow label="เหตุผลยกเลิก" value={selectedDetail.cancelReason} />
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => setSelectedDetail(null)}
              style={{
                backgroundColor: '#0194F3',
                paddingVertical: 15,
                borderRadius: 15,
                alignItems: 'center',
                marginTop: 25
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>ปิดหน้าต่าง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#EEE'
        }}
      >
        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={{ backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 20, alignItems: 'center' }}
        >
          <Text style={{ color: '#475569', fontWeight: 'bold' }}>กลับหน้าหลัก</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const DetailRow = ({ label, value }) => (
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
      paddingBottom: 8
    }}
  >
    <Text style={{ color: '#64748B' }}>{label}</Text>
    <Text style={{ fontWeight: '600', color: '#1E293B' }}>{value}</Text>
  </View>
);

const styles = {
  historyCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  historyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0194F3',
    justifyContent: 'center',
    alignItems: 'center'
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0284C7'
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B'
  },
  historySub: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600'
  },
  historyItemCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14
  },
  historyRoomText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B'
  },
  historyTypeText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600'
  },
  historyPriceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  historyPriceText: {
    fontSize: 13,
    fontWeight: '900'
  },
  historyDetailGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  historyDetailBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10
  },
  historyDetailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700'
  },
  historyDetailValue: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '800',
    marginTop: 5
  },
  reasonBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14
  },
  reasonLabel: {
    fontSize: 11,
    color: '#C2410C',
    fontWeight: '800'
  },
  reasonValue: {
    marginTop: 4,
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '600',
    lineHeight: 18
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B'
  },
  modalSub: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500'
  },
  modalInput: {
    marginTop: 14,
    minHeight: 110,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    textAlignVertical: 'top'
  },
  modalQuickReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12
  },
  quickReasonChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  quickReasonText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '800'
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: '#0194F3',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  modalSubmitText: {
    color: 'white',
    fontWeight: '800'
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: '#334155',
    fontWeight: '700'
  }
};