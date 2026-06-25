import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';


export default function ProfileEditScreen() {
  const router = useRouter();


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
  });


  useEffect(() => {
    loadProfile();
  }, []);


  const loadProfile = async () => {
    try {
      // ดึงข้อมูลล่าสุดจาก server — ไม่ใช้แค่ AsyncStorage ที่อาจเก่า
      const response = await api.get('/current-user');
      const data = response.data.data;
      setForm({
        name: data.full_name || '',
        phone: data.phone_number || '',
        email: data.email || '',
      });
    } catch (error) {
      // ถ้า API ล้มเหลว fallback จาก AsyncStorage
      try {
        const userData = await AsyncStorage.getItem('userProfile');
        if (userData) {
          const user = JSON.parse(userData);
          setForm({
            name: user.full_name || user.name || '',
            phone: user.phone_number || '',
            email: user.email || '',
          });
        }
      } catch (e) {
        Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
      }
    } finally {
      setLoading(false);
    }
  };


  const handleChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };


  const handleSave = async () => {
    try {
      setSaving(true);

      // 1. บันทึกไปยัง backend
      await api.put('/profile', {
        full_name: form.name,
        email: form.email,
        phone_number: form.phone,
      });

      // 2. อัปเดต AsyncStorage ให้ตรงกัน
      const userData = await AsyncStorage.getItem('userProfile');
      const oldUser = userData ? JSON.parse(userData) : {};
      await AsyncStorage.setItem('userProfile', JSON.stringify({
        ...oldUser,
        name: form.name,
        full_name: form.name,
        email: form.email,
        phone_number: form.phone,
      }));

      Alert.alert('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว', [
        { text: 'ตกลง', onPress: () => router.back() }
      ]);
    } catch (error) {
      const msg = error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้';
      Alert.alert('เกิดข้อผิดพลาด', msg);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0178C7" />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0194F3" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0178C7" />


      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แก้ไขโปรไฟล์</Text>
        <View style={{ width: 36 }} />
      </View>


      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarBox}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={42} color="#0194F3" />
            </View>
            <Text style={styles.avatarName}>{form.name || 'Your Profile'}</Text>
          </View>


          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ข้อมูลทั่วไป</Text>


            <Text style={styles.label}>UserName</Text>
            <TextInput
              value={form.name}
              editable={false}
              selectTextOnFocus={false}
              placeholder="กรอกชื่อ-นามสกุล"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.readOnlyInput]}
            />


            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              value={form.phone}
              onChangeText={(text) => handleChange('phone', text)}
              placeholder="กรอกเบอร์โทรศัพท์"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={form.email}
              onChangeText={(text) => handleChange('email', text)}
              placeholder="กรอกอีเมล"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>


          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, saving && { opacity: 0.7 }]}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>บันทึกข้อมูล</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#0178C7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    padding: 20,
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
  avatarBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    marginBottom: 10,
  },
  avatarName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0194F3',
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  readOnlyInput: {
    color: '#0F172A',
    opacity: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 18,
    backgroundColor: '#0194F3',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
});