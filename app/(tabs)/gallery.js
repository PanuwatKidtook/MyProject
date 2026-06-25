import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Modal,
  useWindowDimensions,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function GalleryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  // ตรวจสอบขนาดหน้าจอ: มือถือ = 2 คอลัมน์, จอใหญ่/เว็บ = 4 คอลัมน์
  const isMobile = width <= 650;
  const numColumns = isMobile ? 2 : 4;
  const imageSize = (width - (isMobile ? 50 : 80)) / numColumns;

  // สถานะตัวกรองหมวดหมู่และการดูรูปใหญ่
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedImage, setSelectedImage] = useState(null);

  // ข้อมูลหมวดหมู่
  const categories = [
    { id: 'ALL', label: 'ทั้งหมด' },
    { id: 'DAILY', label: 'ห้องรายวัน' },
    { id: 'MONTHLY', label: 'ห้องรายเดือน' },
    { id: 'AMBIENT', label: 'บรรยากาศ & ที่จอดรถ' },
  ];

  // จำลองข้อมูลรูปภาพภายใน Around Loei แยกตามหมวดหมู่
  const galleryData = [
    { id: '1', category: 'DAILY', title: 'ห้องรายวัน Standard', url: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=800' },
    { id: '2', category: 'DAILY', title: 'ห้องน้ำรายวัน สะอาดกว้างขวาง', url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?q=80&w=800' },
    { id: '3', category: 'DAILY', title: 'ห้องรายวัน Deluxe Double Bed', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800' },
    
    { id: '4', category: 'MONTHLY', title: 'ห้องรายเดือน พร้อมเฟอร์นิเจอร์', url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800' },
    { id: '5', category: 'MONTHLY', title: 'มุมห้องครัวและซิงก์ล้างจาน', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=800' },
    { id: '6', category: 'MONTHLY', title: 'ห้องรายเดือน ตกแต่งสไตล์มินิมอล', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800' },
    
    { id: '7', category: 'AMBIENT', title: 'บรรยากาศตึก Around Loei', url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=800' },
    { id: '8', category: 'AMBIENT', title: 'พื้นที่จอดรถกว้างขวาง ปลอดภัย', url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?q=80&w=800' },
    { id: '9', category: 'AMBIENT', title: 'ทางเข้าหน้าหอพัก ติดถนนใหญ่', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=800' },
  ];

  // กรองรูปภาพตามแท็บที่เลือก
  const filteredData = activeTab === 'ALL' 
    ? galleryData 
    : galleryData.filter(item => item.category === activeTab);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* --- Top Header Navbar --- */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
          <Text style={styles.backText}>กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แกลเลอรี่</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* --- Main Content Area --- */}
      <View style={styles.contentBody}>
        
        {/* 📥 แถบตัวกรองหมวดหมู่แบบสไลด์ข้างอัตโนมัติ */}
        <View style={styles.filterWrapper}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {categories.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.filterTab,
                    isSelected ? styles.filterTabActive : styles.filterTabInactive
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.filterText,
                    isSelected ? styles.filterTextActive : styles.filterTextInactive
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 📸 ส่วนแสดงตารางรูปภาพ (Grid Gallery) */}
        <FlatList
          data={filteredData}
          key={numColumns} // บังคับรีเรนเดอร์เมื่อเปลี่ยนสลับ Responsive โหมดคอม/มือถือ
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedImage(item)}
              style={[styles.imageCard, { width: imageSize, height: imageSize }]}
              activeOpacity={0.9}
            >
              <Image source={{ uri: item.url }} style={styles.galleryImage} />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={50} color="#CCC" />
              <Text style={styles.emptyText}>ไม่พบรูปภาพในหมวดหมู่นี้</Text>
            </View>
          }
        />
      </View>

      {/* --- 💥 หน้าต่างดูรูปภาพขนาดใหญ่ (Image Preview Modal) 💥 --- */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton} 
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>

          {selectedImage && (
            <View style={styles.modalContent}>
              <Image 
                source={{ uri: selectedImage.url }} 
                style={styles.modalImage} 
                resizeMode="contain"
              />
              <Text style={styles.modalTitle}>{selectedImage.title}</Text>
            </View>
          )}
        </View>
      </Modal>

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
    width: 60,
  },
  backText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  contentBody: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    overflow: 'hidden',
  },
  filterWrapper: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterScroll: {
    paddingHorizontal: 15,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  filterTabActive: {
    backgroundColor: '#0194F3',
    borderColor: '#0194F3',
  },
  filterTabInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  filterText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  filterTextActive: {
    color: 'white',
  },
  filterTextInactive: {
    color: '#64748B',
  },
  gridContainer: {
    padding: 15,
    paddingBottom: 40,
  },
  imageCard: {
    margin: 5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  imageTitle: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 10,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 25,
    zIndex: 10,
  },
  modalContent: {
    width: '90%',
    height: '75%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  modalTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
});