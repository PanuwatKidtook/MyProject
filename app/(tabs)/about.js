import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Image, 
  SafeAreaView, 
  TouchableOpacity,
  StatusBar,
  useWindowDimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function AboutScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= 650;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* --- Header Navbar --- */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
          <Text style={styles.backText}>กลับหน้าหลัก</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เกี่ยวกับเรา</Text>
        <View style={{ width: 80 }} /> {/* ส่วนสมดุลฝั่งขวา */}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
        
        {/* --- Hero Section --- */}
        <View style={[styles.heroSection, { flexDirection: isMobile ? 'column' : 'row' }]}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000' }} 
            style={[styles.heroImage, { width: isMobile ? '100%' : '45%', height: isMobile ? 220 : 300 }]} 
          />
          <View style={[styles.heroTextContainer, { width: isMobile ? '100%' : '50%', marginLeft: isMobile ? 0 : 25, marginTop: isMobile ? 20 : 0 }]}>
            <Text style={styles.brandTitle}>Around Loei</Text>
            <Text style={styles.brandSubtitle}>"ดูแลคุณด้วยใจ เหมือนเป็นครอบครัวเดียวกัน"</Text>
            <Text style={styles.brandDesc}>
              Around Loei เริ่มต้นขึ้นจากความตั้งใจที่จะพัฒนาแพลตฟอร์มและยกระดับมาตรฐานการอยู่อาศัยในจังหวัดเลย 
              เรามุ่งเน้นการให้บริการหอพักที่สะอาด ปลอดภัย มีสิ่งอำนวยความสะดวกครบครัน และเดินทางสะดวกสบาย 
              ใกล้ชิดแหล่งชุมชนและสถานศึกษา เพื่อตอบโจทย์ไลฟ์สไตล์ของนักศึกษาและคนทำงานในยุคปัจจุบันอย่างแท้จริง
            </Text>
          </View>
        </View>

        {/* --- Vision & Mission Cards --- */}
        <View style={[styles.sectionContainer, { flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between' }]}>
          <View style={[styles.card, { width: isMobile ? '100%' : '48%', marginBottom: isMobile ? 15 : 0 }]}>
            <View style={[styles.iconWrapper, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="eye" size={28} color="#0194F3" />
            </View>
            <Text style={styles.cardTitle}>วิสัยทัศน์ (Vision)</Text>
            <Text style={styles.cardDetail}>
              เป็นผู้นำด้านแพลตฟอร์มและการจัดการที่พักอาศัยที่ทันสมัยที่สุดในจังหวัดเลย 
              โดยนำเทคโนโลยีเข้ามาช่วยอำนวยความสะดวก เพื่อให้การใช้ชีวิตของผู้พักอาศัยเป็นเรื่องง่ายและมีความสุข
            </Text>
          </View>

          <View style={[styles.card, { width: isMobile ? '100%' : '48%' }]}>
            <View style={[styles.iconWrapper, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="rocket" size={28} color="#00C853" />
            </View>
            <Text style={styles.cardTitle}>พันธกิจ (Mission)</Text>
            <Text style={styles.cardDetail}>
              มุ่งมั่นรักษามาตรฐานความสะอาดและความปลอดภัยระดับสูงสุด พร้อมทั้งพัฒนาบุคลากรและการบริการ
              แจ้งซ่อมรวดเร็ว ใส่ใจในทุกข้อเสนอแนะ เพื่อสร้างความพึงพอใจสูงสุดให้แก่สมาชิก Around Loei ทุกคน
            </Text>
          </View>
        </View>

        {/* --- Why Choose Us Section --- */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>ทำไมต้องเลือก Around Loei?</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={24} color="#00C853" style={styles.infoIcon} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoRowTitle}>ทำเลเด่น ใกล้ มรภ.เลย</Text>
              <Text style={styles.infoRowDesc}>เดินทางสะดวกสบาย ประหยัดเวลาและค่าเดินทาง รายล้อมไปด้วยร้านค้าและร้านอาหาร</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={24} color="#00C853" style={styles.infoIcon} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoRowTitle}>ระบบรักษาความปลอดภัย 24 ชม.</Text>
              <Text style={styles.infoRowDesc}>อุ่นใจด้วยระบบกล้อง CCTV ทั่วทุกมุมตึก พร้อมระบบคีย์การ์ดและการดูแลที่เข้มงวด</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="construct" size={24} color="#00C853" style={styles.infoIcon} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoRowTitle}>ระบบแจ้งซ่อมออนไลน์เสร็จสรรพ</Text>
              <Text style={styles.infoRowDesc}>ห้องพักมีปัญหาสามารถกดแจ้งซ่อมผ่านระบบแอปพลิเคชันได้ทันที มีช่างประจำตึกคอยสแตนด์บายดูแล</Text>
            </View>
          </View>
        </View>

        {/* --- Footer Text --- */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 Around Loei. All Rights Reserved.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0194F3',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#0178C7',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  backText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  scrollContent: {
    backgroundColor: '#F8F9FA',
    paddingBottom: 40,
  },
  heroSection: {
    backgroundColor: 'white',
    padding: 25,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroImage: {
    borderRadius: 20,
    resizeMode: 'cover',
  },
  heroTextContainer: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0194F3',
    marginBottom: 5,
  },
  brandSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  brandDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 25,
    padding: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoIcon: {
    marginTop: 2,
    marginRight: 15,
  },
  infoTextGroup: {
    flex: 1,
  },
  infoRowTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  infoRowDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#A0AEC0',
    fontWeight: '500',
  },
});