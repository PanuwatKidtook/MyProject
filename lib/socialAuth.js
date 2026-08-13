import Constants from 'expo-constants';
import api from './api';

// อ่าน client id ของ Google จาก app.json > extra (ใส่ค่าจริงจาก Google Cloud Console)
// - webClientId: ใช้ให้ id_token มี audience ตรงกับ GOOGLE_CLIENT_ID ฝั่ง backend
// - android/iosClientId: จำเป็นตอน build จริง (dev build / standalone)
const extra = Constants.expoConfig?.extra || {};

export const googleClientIds = {
  webClientId: extra.googleWebClientId,
  androidClientId: extra.googleAndroidClientId || undefined,
  iosClientId: extra.googleIosClientId || undefined,
};

// เช็คว่าตั้งค่า Google ครบพอจะใช้งานได้ไหม (อย่างน้อยต้องมี webClientId)
export const isGoogleConfigured = () => !!googleClientIds.webClientId;

// ส่ง id_token ที่ได้จาก Google ให้ backend ตรวจเอง แล้วคืน { success, token, payload, isNewUser, ... }
// backend endpoint นี้มีอยู่แล้ว (controllers/social.js → socialLogin)
export async function loginWithGoogle(idToken) {
  const res = await api.post('/auth/social', { provider: 'google', token: idToken });
  return res.data;
}
