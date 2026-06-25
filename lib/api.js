import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// URL จริงบน Render — เปลี่ยนเป็น http://10.0.2.2:5000/api เมื่อทดสอบ local กับ Android Emulator
export const API_BASE_URL = 'https://projeccty3-server.onrender.com/api';

const api = axios.create({ baseURL: API_BASE_URL });

// แนบ JWT token ทุก request อัตโนมัติ
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
