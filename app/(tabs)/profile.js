import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';


const ROLE_LABEL = {
  Monthly_Tenant: 'ผู้เช่ารายเดือน',
  Daily_Tenant: 'ผู้เช่ารายวัน',
  Admin: 'ผู้ดูแลระบบ',
};


export default function ProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    full_name: '',
    username: '',
    email: '',
    phone_number: '',
    role: '',
  });
  const [linkedProviders, setLinkedProviders] = useState([]);


  const loadAll = useCallback(async () => {
    try {
      const [meRes, socialRes] = await Promise.allSettled([
        api.get('/current-user'),
        api.get('/my-social-accounts'),
      ]);

      if (meRes.status === 'fulfilled') {
        const data = meRes.value.data?.data || {};
        setProfile({
          full_name: data.full_name || '',
          username: data.username || '',
          email: data.email || '',
          phone_number: data.phone_number || '',
          role: data.role || '',
        });
      } else {
        // fallback จาก AsyncStorage
        const raw = await AsyncStorage.getItem('userProfile');
        if (raw) {
          const u = JSON.parse(raw);
          setProfile({
            full_name: u.full_name || u.name || '',
            username: u.username || '',
            email: u.email || '',
            phone_number: u.phone_number || '',
            role: u.role || '',
          });
        }
      }

      if (socialRes.status === 'fulfilled') {
        const providers = (socialRes.value.data?.data || []).map((a) => a.provider);
        setLinkedProviders(providers);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // โหลดใหม่ทุกครั้งที่กลับเข้าหน้านี้ (เช่น หลังแก้ไขเสร็จ)
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );


  const initial = (profile.full_name || profile.username || 'U').trim().charAt(0).toUpperCase();
  const roleLabel = ROLE_LABEL[profile.role] || null;


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#014E86" />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }


  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={16} color="#0178C7" />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value || '-'}</Text>
    </View>
  );


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#014E86" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ===== Hero header ไล่เฉดสี ===== */}
        <LinearGradient
          colors={['#0A6FC2', '#0154A0', '#023E7D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>โปรไฟล์ของฉัน</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.heroProfile}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            </View>
            <Text style={styles.heroName}>{profile.full_name || profile.username || 'ผู้ใช้'}</Text>
            {!!profile.username && <Text style={styles.heroUsername}>@{profile.username}</Text>}
            {roleLabel && (
              <View style={styles.roleBadge}>
                <Ionicons name="ribbon-outline" size={13} color="#fff" />
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* ===== ข้อมูลส่วนตัว ===== */}
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>ข้อมูลส่วนตัว</Text>
            </View>

            <InfoRow icon="person-outline" label="ชื่อ - นามสกุล" value={profile.full_name} />
            <View style={styles.rowDivider} />
            <InfoRow icon="at-outline" label="Username" value={profile.username} />
            <View style={styles.rowDivider} />
            <InfoRow icon="mail-outline" label="อีเมล" value={profile.email} />
            <View style={styles.rowDivider} />
            <InfoRow icon="call-outline" label="เบอร์โทรศัพท์" value={profile.phone_number} />
          </View>

          {/* ===== บัญชีที่เชื่อมต่อ ===== */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>บัญชีที่เชื่อมต่อ</Text>
            </View>

            {linkedProviders.length === 0 ? (
              <Text style={styles.emptyText}>ยังไม่มีบัญชีที่เชื่อมต่อ</Text>
            ) : (
              <View style={styles.chipRow}>
                {linkedProviders.includes('google') && (
                  <View style={styles.providerChip}>
                    <View style={[styles.chipIcon, { backgroundColor: '#EA4335' }]}>
                      <Ionicons name="logo-google" size={13} color="white" />
                    </View>
                    <Text style={styles.chipText}>Google</Text>
                  </View>
                )}
                {linkedProviders.includes('line') && (
                  <View style={styles.providerChip}>
                    <View style={[styles.chipIcon, { backgroundColor: '#06C755' }]}>
                      <Ionicons name="chatbubble" size={12} color="white" />
                    </View>
                    <Text style={styles.chipText}>LINE</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ===== ปุ่มแก้ไขข้อมูล ===== */}
          <TouchableOpacity
            onPress={() => router.push('/profileedit')}
            activeOpacity={0.85}
            style={styles.editShadow}
          >
            <LinearGradient
              colors={['#0A8DEE', '#0178C7', '#025FA3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editButton}
            >
              <Ionicons name="create-outline" size={19} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.editButtonText}>แก้ไขข้อมูล</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ===== ปุ่มกลับหน้าแรก ===== */}
          <TouchableOpacity
            onPress={() => router.push('/')}
            activeOpacity={0.85}
            style={styles.homeButton}
          >
            <Ionicons name="home-outline" size={18} color="#0178C7" style={{ marginRight: 8 }} />
            <Text style={styles.homeButtonText}>กลับหน้าแรก</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF3F8',
  },
  scroll: {
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  hero: {
    paddingTop: Platform.OS === 'web' ? 18 : 8,
    paddingBottom: 30,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroProfile: {
    alignItems: 'center',
    marginTop: 6,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarInner: {
    flex: 1,
    width: '100%',
    borderRadius: 46,
    backgroundColor: '#EAF4FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0178C7',
  },
  heroName: {
    fontSize: 21,
    fontWeight: '900',
    color: 'white',
    marginTop: 12,
  },
  heroUsername: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontWeight: '600',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  roleBadgeText: {
    color: 'white',
    fontSize: 12.5,
    fontWeight: '800',
    marginLeft: 5,
  },
  body: {
    paddingHorizontal: 20,
    marginTop: 20,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    shadowColor: '#1E3A5F',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#0178C7',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EAF4FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14.5,
    color: '#0F172A',
    fontWeight: '800',
    marginLeft: 12,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  emptyText: {
    fontSize: 13.5,
    color: '#94A3B8',
    fontWeight: '600',
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F7FD',
    borderWidth: 1,
    borderColor: '#D8E9F8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 10,
    marginBottom: 8,
  },
  chipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0178C7',
  },
  editShadow: {
    marginTop: 22,
    borderRadius: 18,
    shadowColor: '#0178C7',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  editButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 18,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  homeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#D8E9F8',
  },
  homeButtonText: {
    color: '#0178C7',
    fontSize: 15,
    fontWeight: '900',
  },
});
