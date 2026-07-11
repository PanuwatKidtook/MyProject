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

const addDaysToDateString = (dateString, days) => {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function CalendarScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyRooms, setDailyRooms] = useState([]);
  const [monthlyRooms, setMonthlyRooms] = useState([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [lang, setLang] = useState('TH');

  const text = {
    TH: {
      title: 'เช็คปฏิทินห้องพัก',
      subtitleGuest: 'แตะวันที่ในปฏิทินเพื่อดูห้องว่างวันนั้น (รายวัน/รายเดือน)',
      subtitleTenant: 'แตะวันที่ในปฏิทินเพื่อดูห้องว่างวันนั้น',
      empty: 'ไม่มีห้องว่างในวันที่เลือก',
      loading: 'กำลังโหลดข้อมูล...',
      room: 'ห้อง',
      available: 'ว่าง',
      night: '/คืน',
      month: '/เดือน',
      close: 'ปิด',
      today: 'วันนี้',
      daily: 'รายวัน',
      monthly: 'รายเดือน',
      langButton: 'เปลี่ยนภาษา',
      listTitle: 'ห้องว่างในวันที่เลือก',
      back: 'ย้อนกลับ',
      roleTag: {
        Daily_Tenant: 'บัญชีรายวัน · เห็นเฉพาะห้องรายวัน',
        Monthly_Tenant: 'บัญชีรายเดือน · เห็นเฉพาะห้องรายเดือน',
      },
      detail: 'รายละเอียดห้อง',
      type: 'ประเภทห้อง',
      price: 'ราคา',
    },
    EN: {
      title: 'Room Calendar Check',
      subtitleGuest: 'Tap a date to see available rooms (daily/monthly)',
      subtitleTenant: 'Tap a date to see available rooms',
      empty: 'No available rooms on this date',
      loading: 'Loading...',
      room: 'Room',
      available: 'Available',
      night: '/night',
      month: '/month',
      close: 'Close',
      today: 'Today',
      daily: 'Daily',
      monthly: 'Monthly',
      langButton: 'Change language',
      listTitle: 'Available rooms',
      back: 'Back',
      roleTag: {
        Daily_Tenant: 'Daily account · Daily rooms only',
        Monthly_Tenant: 'Monthly account · Monthly rooms only',
      },
      detail: 'Room Detail',
      type: 'Room type',
      price: 'Price',
    }
  };

  const t = text[lang];

  // โรลเป็นตัวกำหนดว่าเห็นห้องประเภทไหนได้บ้าง — guest หรือโรลอื่นที่ไม่ใช่ tenant เห็นได้ทั้งคู่
  const canSeeDaily = !user || user.role === 'Daily_Tenant';
  const canSeeMonthly = !user || user.role === 'Monthly_Tenant';
  const showTabs = canSeeDaily && canSeeMonthly;

  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        try {
          const userData = await AsyncStorage.getItem('userProfile');
          const parsed = userData ? JSON.parse(userData) : null;
          setUser(parsed);
          if (parsed?.role === 'Monthly_Tenant') setActiveTab('monthly');
          else setActiveTab('daily');
        } catch {
          setUser(null);
        }
      };
      loadUser();
    }, [])
  );

  const fetchAvailability = useCallback(async (dateStr, allowDaily, allowMonthly) => {
    setLoading(true);
    try {
      const requests = [];

      if (allowDaily) {
        requests.push(
          api.post('/search-rooms', { checkIn: dateStr, checkOut: addDaysToDateString(dateStr, 1) })
            .then((res) => {
              const rows = res.data?.data || [];
              return rows
                .filter((r) => r.status === 'ว่าง' && r.price != null)
                .map((r) => ({ id: r.id, number: r.number, price: r.price, type: r.typeName, image: r.imageUrl }));
            })
            .catch(() => [])
        );
      } else {
        requests.push(Promise.resolve([]));
      }

      if (allowMonthly) {
        requests.push(
          api.get(`/rooms/availability?date=${dateStr}`)
            .then((res) => {
              const rows = res.data?.data || [];
              return rows
                .filter((r) => r.available)
                .map((r) => ({ id: r.room_id, number: r.room_number, price: r.price_monthly, type: r.type_name, image: r.image_url }));
            })
            .catch(() => [])
        );
      } else {
        requests.push(Promise.resolve([]));
      }

      const [daily, monthly] = await Promise.all(requests);
      setDailyRooms(daily);
      setMonthlyRooms(monthly);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAvailability(selectedDate, canSeeDaily, canSeeMonthly);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, canSeeDaily, canSeeMonthly])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailability(selectedDate, canSeeDaily, canSeeMonthly);
  }, [selectedDate, canSeeDaily, canSeeMonthly, fetchAvailability]);

  const activeRooms = activeTab === 'monthly' ? monthlyRooms : dailyRooms;

  const markedDates = useMemo(() => ({
    [selectedDate]: { selected: true, selectedColor: '#0EA5E9', selectedTextColor: 'white' },
  }), [selectedDate]);

  const formatDateTH = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(`${dateString}T00:00:00`);
    return d.toLocaleDateString(lang === 'TH' ? 'th-TH' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const renderCard = (item) => (
    <TouchableOpacity
      key={`${activeTab}-${item.id}`}
      onPress={() => setSelectedRoom(item)}
      style={styles.card}
      activeOpacity={0.85}
    >
      <View style={styles.cardIconWrap}>
        <Ionicons name="bed-outline" size={22} color="#0EA5E9" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.roomText}>{t.room} {item.number}</Text>
        <Text style={styles.cardType}>{item.type || '-'}</Text>
      </View>
      <View style={styles.availableChip}>
        <Text style={styles.availableChipText}>{t.available}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{user ? t.subtitleTenant : t.subtitleGuest}</Text>
        </View>

        <TouchableOpacity
          onPress={() => setLang(lang === 'TH' ? 'EN' : 'TH')}
          style={styles.langButton}
        >
          <Text style={styles.langButtonText}>{t.langButton}</Text>
        </TouchableOpacity>
      </View>

      {user && (user.role === 'Daily_Tenant' || user.role === 'Monthly_Tenant') && (
        <View style={styles.roleBanner}>
          <Ionicons name="shield-checkmark" size={16} color="#0369A1" />
          <Text style={styles.roleBannerText}>{t.roleTag[user.role]}</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0194F3']} />}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {showTabs && (
          <View style={styles.tabWrap}>
            <TouchableOpacity
              onPress={() => setActiveTab('daily')}
              style={[styles.tabButton, activeTab === 'daily' && styles.tabButtonActiveDaily]}
            >
              <Ionicons name="sunny-outline" size={16} color={activeTab === 'daily' ? 'white' : '#F59E0B'} />
              <Text style={[styles.tabButtonText, activeTab === 'daily' && styles.tabButtonTextActive]}>
                {t.daily} ({dailyRooms.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('monthly')}
              style={[styles.tabButton, activeTab === 'monthly' && styles.tabButtonActiveMonthly]}
            >
              <Ionicons name="calendar-outline" size={16} color={activeTab === 'monthly' ? 'white' : '#8B5CF6'} />
              <Text style={[styles.tabButtonText, activeTab === 'monthly' && styles.tabButtonTextActive]}>
                {t.monthly} ({monthlyRooms.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.calendarBox}>
          <Calendar
            current={selectedDate}
            minDate={new Date().toISOString().split('T')[0]}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            hideExtraDays={false}
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
          <View style={styles.dayInfoIcon}>
            <Ionicons name="calendar" size={18} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayInfoTitle}>{formatDateTH(selectedDate)}</Text>
            <Text style={styles.dayInfoStatus}>
              {loading ? t.loading : `${activeRooms.length} ${t.available.toLowerCase()}`}
            </Text>
          </View>
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
          ) : activeRooms.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="bed-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>{t.empty}</Text>
            </View>
          ) : (
            activeRooms.map(renderCard)
          )}
        </View>
      </ScrollView>

      <Modal
        visible={selectedRoom !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRoom(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedRoom(null)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedRoom(null)}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>{t.detail}</Text>

            <View style={styles.photoRow}>
              <Image
                source={{ uri: selectedRoom?.image || 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200' }}
                style={styles.photoMain}
              />
            </View>

            <Text style={styles.modalRoomText}>{t.room} {selectedRoom?.number}</Text>
            <Text style={styles.modalText}>{t.type}: {selectedRoom?.type || '-'}</Text>
            <Text style={styles.modalText}>
              {t.price}: ฿{Number(selectedRoom?.price || 0).toLocaleString()} {activeTab === 'monthly' ? t.month : t.night}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

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
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  roleBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  tabWrap: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  tabButtonActiveDaily: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  tabButtonActiveMonthly: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  tabButtonTextActive: {
    color: 'white',
  },
  calendarBox: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#0EA5E9',
  },
  dayInfoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInfoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: 'white',
  },
  dayInfoStatus: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  cardType: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  availableChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  availableChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
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
    marginBottom: 14,
  },
  photoMain: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  modalRoomText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalText: {
    fontSize: 14,
    color: '#334155',
    marginTop: 5,
    fontWeight: '600',
  },
});
