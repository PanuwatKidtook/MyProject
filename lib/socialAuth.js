import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// ปิด session ของ browser ที่ค้างอยู่เมื่อกลับเข้าแอป (จำเป็นสำหรับ openAuthSessionAsync)
WebBrowser.maybeCompleteAuthSession();

// LINE Channel ID (client_id) — เป็นข้อมูลสาธารณะ ตั้ง override ได้ผ่าน env
export const LINE_CHANNEL_ID =
  process.env.EXPO_PUBLIC_LINE_CHANNEL_ID || '2010947282';

// redirect_uri ต่างกันตามแพลตฟอร์ม และต้องตรงเป๊ะกับที่ลงทะเบียนใน LINE console:
//  - web (expo web)  -> http://<origin>/auth/line/callback  (ส่วน "web app" ของ console)
//  - native (มือถือ) -> myproject://auth/line/callback       (ส่วน "mobile app" ของ console)
export function getLineRedirectUri() {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/line/callback`;
  }
  return 'myproject://auth/line/callback';
}

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';

// สุ่ม state ไว้กัน CSRF (ไม่ต้องพึ่ง expo-crypto)
const randomState = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * เปิดหน้า login ของ LINE แล้วรอ redirect กลับ deep link
 * @returns {Promise<{ code: string, redirectUri: string }>}
 *   - คืน code ที่ต้องเอาไป POST /api/auth/line/exchange
 *   - โยน Error พร้อม .code = 'cancelled' ถ้าผู้ใช้ยกเลิก
 */
export async function startLineLogin() {
  const state = randomState();
  const redirectUri = getLineRedirectUri();

  const authUrl =
    `${LINE_AUTHORIZE_URL}?response_type=code` +
    `&client_id=${encodeURIComponent(LINE_CHANNEL_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent('openid profile email')}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) {
    const err = new Error('LINE login ถูกยกเลิก');
    err.code = 'cancelled';
    throw err;
  }

  // แยก query string ออกจาก redirect url (เช่น myproject://auth/line/callback?code=...&state=...)
  const query = result.url.split('?')[1] || '';
  const params = new URLSearchParams(query);

  const returnedError = params.get('error');
  if (returnedError) {
    throw new Error(params.get('error_description') || returnedError);
  }

  const returnedState = params.get('state');
  if (returnedState !== state) {
    throw new Error('state ไม่ตรงกัน (อาจถูกดักกลางทาง)');
  }

  const code = params.get('code');
  if (!code) {
    throw new Error('ไม่ได้รับ code จาก LINE');
  }

  return { code, redirectUri };
}

// ===== Google OAuth =====

// Google OAuth Client ID (client_id) — ข้อมูลสาธารณะ ตั้ง override ได้ผ่าน env
export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

// redirect_uri ต่างกันตามแพลตฟอร์ม และต้องตรงเป๊ะกับที่ลงทะเบียนใน
// Google Cloud Console (APIs & Services > Credentials > OAuth 2.0 Client):
//  - web (expo web)  -> http://<origin>/auth/google/callback  (Authorized redirect URIs)
//  - native (มือถือ) -> myproject://auth/google/callback
export function getGoogleRedirectUri() {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/google/callback`;
  }
  return 'myproject://auth/google/callback';
}

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/**
 * เปิดหน้า login ของ Google แล้วรอ redirect กลับ deep link
 * @returns {Promise<{ code: string, redirectUri: string }>}
 *   - คืน code ที่ต้องเอาไป POST /api/auth/google/exchange
 *   - โยน Error พร้อม .code = 'cancelled' ถ้าผู้ใช้ยกเลิก
 */
export async function startGoogleLogin() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('ยังไม่ได้ตั้งค่า EXPO_PUBLIC_GOOGLE_CLIENT_ID');
  }

  const state = randomState();
  const redirectUri = getGoogleRedirectUri();

  const authUrl =
    `${GOOGLE_AUTHORIZE_URL}?response_type=code` +
    `&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent('openid profile email')}` +
    `&prompt=select_account`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) {
    const err = new Error('Google login ถูกยกเลิก');
    err.code = 'cancelled';
    throw err;
  }

  const query = result.url.split('?')[1] || '';
  const params = new URLSearchParams(query);

  const returnedError = params.get('error');
  if (returnedError) {
    throw new Error(params.get('error_description') || returnedError);
  }

  const returnedState = params.get('state');
  if (returnedState !== state) {
    throw new Error('state ไม่ตรงกัน (อาจถูกดักกลางทาง)');
  }

  const code = params.get('code');
  if (!code) {
    throw new Error('ไม่ได้รับ code จาก Google');
  }

  return { code, redirectUri };
}
