import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import api from '../../lib/api';

LocaleConfig.locales['th'] = {
  monthNames: [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ],
  monthNamesShort: [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ],
  dayNames: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'],
  dayNamesShort: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  today: 'วันนี้'
};
LocaleConfig.defaultLocale = 'th';

export default function CalendarScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingData, setBookingData] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [lang, setLang] = useState('TH');

  const text = {
    TH: {
      title: 'เช็คปฏิทินห้องพัก',
      subtitle: 'แตะวันที่ในปฏิทินเพื่อดูรายการจองของวันนั้น',
      empty: 'ไม่มีรายการในวันนี้',
      available: 'ว่าง',
      full: 'เต็ม',
      partial: 'มีจองบางส่วน',
      loading: 'กำลังโหลดข้อมูล...',
      room: 'ห้อง',
      startDate: 'เริ่ม',
      endDate: 'สิ้นสุด',
      status: 'สถานะ',
      detail: 'รายละเอียด',
      close: 'ปิด',
      today: 'วันนี้',
      daily: 'รายวัน',
      monthly: 'รายเดือน',
      roomInfo: 'ข้อมูลห้อง',
      roomPhoto: 'รูปห้อง',
      bed: 'เตียง',
      furniture: 'เฟอร์นิเจอร์',
      langButton: 'เปลี่ยนภาษา',
      listTitle: 'รายการในวันที่เลือก',
      back: 'ย้อนกลับ',
    },
    EN: {
      title: 'Room Calendar Check',
      subtitle: 'Tap a date to see reservations for that day',
      empty: 'No booking on this day',
      available: 'Available',
      full: 'Full',
      partial: 'Partially booked',
      loading: 'Loading...',
      room: 'Room',
      startDate: 'Start',
      endDate: 'End',
      status: 'Status',
      detail: 'Details',
      close: 'Close',
      today: 'Today',
      daily: 'Daily',
      monthly: 'Monthly',
      roomInfo: 'Room Info',
      roomPhoto: 'Room Photo',
      bed: 'Bed',
      furniture: 'Furniture',
      langButton: 'Change language',
      listTitle: 'Selected day bookings',
      back: 'Back',
    }
  };

  const t = text[lang];

  const normalizeDate = (value) => (value ? String(value).slice(0, 10) : '');
  const parseDate = (value) => new Date(`${normalizeDate(value)}T00:00:00`);

  const isDaily = (item) => String(item.rentType || '').toLowerCase() === 'daily';
  const isMonthly = (item) => String(item.rentType || '').toLowerCase() === 'monthly';

  const getStatusKind = (item) => {
    if (String(item.bookingStatus || '').includes('เต็ม')) return 'full';
    if (isDaily(item) && isMonthly(item)) return 'both';
    if (isDaily(item)) return 'daily';
    if (isMonthly(item)) return 'monthly';
    return 'booked';
  };

  const getColor = (item) => {
    if (isDaily(item)) return '#F59E0B';
    if (isMonthly(item)) return '#8B5CF6';
    return '#0194F3';
  };

  const isCancelled = (status) => {
    const s = String(status || '').trim().toLowerCase();
    return s === 'ยกเลิก' || s === 'cancelled' || s === 'canceled';
  };

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
      fetchBookings();
    }, [])
  );

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await api.post('/checkbooking', {});
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setBookingData(data);
    } catch {
      setBookingData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, []);

  const dayBookings = useMemo(() => {
    const target = parseDate(selectedDate);
    return bookingData.filter((item) => {
      if (isCancelled(item.bookingStatus)) return false;
      const start = parseDate(item.startDate);
      const end = parseDate(item.endDate);
      return start <= target && end >= target;
    });
  }, [bookingData, selectedDate]);

  const dayStatus = useMemo(() => {
    if (dayBookings.length === 0) return 'available';
    const hasFull = dayBookings.some((item) => String(item.bookingStatus || '').includes('เต็ม'));
    if (hasFull) return 'full';
    return 'partial';
  }, [dayBookings]);

  const markedDates = useMemo(() => {
    const marks = {};

    bookingData.forEach((item) => {
      if (isCancelled(item.bookingStatus)) return;

      const start = parseDate(item.startDate);
      const end = parseDate(item.endDate);
      const color = getColor(item);
      const statusKind = getStatusKind(item);
      const isFull = statusKind === 'full';

      const d = new Date(start);
      while (d <= end) {
        const key = d.toISOString().split('T')[0];
        if (!marks[key]) {
          marks[key] = { marked: true, dots: [] };
        }

        if (isFull) {
          marks[key].dots = [{ color: '#CBD5E1' }];
        } else {
          const exists = marks[key].dots.some((dot) => dot.color === color);
          if (!exists) marks[key].dots.push({ color });
        }

        d.setDate(d.getDate() + 1);
      }
    });

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: '#0EA5E9',
      selectedTextColor: 'white',
    };

    return marks;
  }, [bookingData, selectedDate]);

  const filteredData = useMemo(() => dayBookings, [dayBookings]);

  const formatDateTH = (dateString) => {
    if (!dateString) return '-';
    const d = parseDate(dateString);
    return d.toLocaleDateString(lang === 'TH' ? 'th-TH' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const renderCard = (item, index) => {
    const isFull = String(item.bookingStatus || '').includes('เต็ม');
    const kind = getStatusKind(item);

    let badgeText = t.partial;
    if (isFull) badgeText = t.full;
    else if (kind === 'daily') badgeText = t.daily;
    else if (kind === 'monthly') badgeText = t.monthly;
    else if (kind === 'both') badgeText = `${t.daily} + ${t.monthly}`;

    const chipColor = isFull ? '#CBD5E1' : getColor(item);
    const chipText = isFull ? '#64748B' : '#FFFFFF';

    return (
      <TouchableOpacity
        key={`${item.bookingId || item.id || index}`}
        onPress={() => setSelectedBooking(item)}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          <Text style={styles.roomText}>{t.room} {item.roomNumber || '-'}</Text>
          <View style={[styles.statusChip, { backgroundColor: chipColor }]}>
            <Text style={[styles.statusChipText, { color: chipText }]}>
              {badgeText}
            </Text>
          </View>
        </View>

        <Text style={styles.cardLine}>{t.startDate}: {formatDateTH(item.startDate)}</Text>
        <Text style={styles.cardLine}>{t.endDate}: {formatDateTH(item.endDate)}</Text>
        <Text style={styles.cardLine}>{t.status}: {item.bookingStatus || '-'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
        </View>

        <TouchableOpacity
          onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')}
          style={styles.langButton}
        >
          <Text style={styles.langButtonText}>{t.langButton}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0194F3']} />}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View style={styles.legendWrap}>
          <Legend color="#F59E0B" label={t.daily} />
          <Legend color="#8B5CF6" label={t.monthly} />
          <Legend color="#CBD5E1" label={t.full} />
          <Legend color="#0194F3" label="เลือกแล้ว" />
        </View>

        <View style={styles.calendarBox}>
          <Calendar
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            markingType="multi-dot"
            hideExtraDays={false}
            monthFormat={lang === 'TH' ? 'MMMM yyyy' : 'MMMM yyyy'}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#64748B',
              selectedDayBackgroundColor: '#0EA5E9',
              todayTextColor: '#0EA5E9',
              dayTextColor: '#0F172A',
              textDisabledColor: '#CBD5E1',
              arrowColor: '#0EA5E9',
              monthTextColor: '#0F172A',
              textDayFontWeight: '700',
              textMonthFontWeight: '900',
              textDayHeaderFontWeight: '800'
            }}
          />
        </View>

        <View style={styles.dayInfo}>
          <Text style={styles.dayInfoTitle}>{selectedDate}</Text>
          <Text style={styles.dayInfoStatus}>
            {dayStatus === 'available' ? t.available : dayStatus === 'full' ? t.full : t.partial}
          </Text>
        </View>

        <View style={styles.listBox}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>{t.listTitle}</Text>
            <TouchableOpacity onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
              <Text style={styles.todayLink}>{t.today}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0194F3" />
              <Text style={styles.loadingText}>{t.loading}</Text>
            </View>
          ) : filteredData.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>{t.empty}</Text>
            </View>
          ) : (
            filteredData.map(renderCard)
          )}
        </View>
      </ScrollView>

      <Modal
        visible={selectedBooking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBooking(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedBooking(null)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedBooking(null)}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>{t.detail}</Text>

            <View style={styles.photoRow}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200' }}
                style={styles.photoMain}
              />
            </View>

            <View style={styles.facilityRow}>
              <View style={styles.facilityCard}>
                <Ionicons name="bed-outline" size={20} color="#0194F3" />
                <Text style={styles.facilityText}>{t.bed}</Text>
              </View>
              <View style={styles.facilityCard}>
                <Ionicons name="home-outline" size={20} color="#8B5CF6" />
                <Text style={styles.facilityText}>{t.furniture}</Text>
              </View>
            </View>

            <Text style={styles.modalText}>{t.room}: {selectedBooking?.roomNumber || '-'}</Text>
            <Text style={styles.modalText}>{t.startDate}: {formatDateTH(selectedBooking?.startDate)}</Text>
            <Text style={styles.modalText}>{t.endDate}: {formatDateTH(selectedBooking?.endDate)}</Text>
            <Text style={styles.modalText}>{t.status}: {selectedBooking?.bookingStatus || '-'}</Text>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const Legend = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
  },
  langButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  calendarBox: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayInfo: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayInfoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayInfoStatus: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  listBox: {
    marginTop: 14,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  todayLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardLine: {
    fontSize: 13,
    color: '#475569',
    marginTop: 3,
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyBox: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 22,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 10,
  },
  photoRow: {
    marginBottom: 12,
  },
  photoMain: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  facilityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  facilityCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  facilityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  modalText: {
    fontSize: 14,
    color: '#334155',
    marginTop: 5,
    fontWeight: '600',
  },
});