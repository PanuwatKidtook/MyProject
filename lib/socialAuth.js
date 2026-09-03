import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from './api';

// ปิด session ของ browser ที่ค้างอยู่เมื่อกลับเข้าแอป (จำเป็นสำหรับ openAuthSessionAsync)
WebBrowser.maybeCompleteAuthSession();

// LINE Channel ID (client_id) — เป็นข้อมูลสาธารณะ ตั้ง override ได้ผ่าน env
export const LINE_CHANNEL_ID =
  process.env.EXPO_PUBLIC_LINE_CHANNEL_ID || '2010947282';

// deep link ที่ server เด้งกลับมาหาแอป (ต้องตรงกับ scheme ใน app.json)
const LINE_APP_RETURN_URL = 'myproject://auth/line/callback';

// redirect_uri ที่ส่งให้ LINE — ต้องเป็น URL ที่ลงทะเบียนใน LINE console (LINE รับแค่ http/https):
//  - web (expo web)  -> http://<origin>/auth/line/callback
//  - native (มือถือ) -> https ของ server (/api/auth/line/callback) แล้ว server เด้งกลับ deep link แอป
//    (LINE ไม่ยอมรับ custom scheme myproject:// เป็น redirect_uri)
export function getLineRedirectUri() {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/line/callback`;
  }
  return `${API_BASE_URL}/auth/line/callback`;
}

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';

// สุ่ม state ไว้กัน CSRF (ไม่ต้องพึ่ง expo-crypto)
const randomState = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * เปิดหน้า LINE สำหรับ native (APK) — ไม่ประมวลผลผลลัพธ์เอง
 * ปล่อยให้ server เด้ง deep link กลับไปที่ route /auth/line/callback จัดการ token แทน
 * (กันการจัดการซ้ำซ้อน + กันหน้า Unmatched Route ค้าง)
 */
export async function openLineAuthNative() {
  const state = randomState();
  const redirectUri = getLineRedirectUri(); // https ของ server
  const authUrl =
    `${LINE_AUTHORIZE_URL}?response_type=code` +
    `&client_id=${encodeURIComponent(LINE_CHANNEL_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent('openid profile email')}`;
  return WebBrowser.openAuthSessionAsync(authUrl, LINE_APP_RETURN_URL);
}

/**
 * เปิดหน้า login ของ LINE แล้วรอ redirect กลับ
 * @returns {Promise<Object>}
 *   - native: { token, isNewUser, full_name, email, username }  (server แลก+เด้ง JWT กลับ deep link แล้ว)
 *   - web   : { code, redirectUri }  (ผู้เรียกต้องไปแลกเองที่ POST /api/auth/line/exchange)
 *   - โยน Error พร้อม .code = 'cancelled' ถ้าผู้ใช้ยกเลิก
 */
export async function startLineLogin() {
  const state = randomState();
  const redirectUri = getLineRedirectUri();
  // native: browser จะถูก server เด้งกลับมาที่ deep link ของแอป ไม่ใช่ redirectUri (https) ที่ส่งให้ LINE
  const returnUrl = Platform.OS === 'web' ? redirectUri : LINE_APP_RETURN_URL;

  const authUrl =
    `${LINE_AUTHORIZE_URL}?response_type=code` +
    `&client_id=${encodeURIComponent(LINE_CHANNEL_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent('openid profile email')}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

  if (result.type !== 'success' || !result.url) {
    const err = new Error('LINE login ถูกยกเลิก');
    err.code = 'cancelled';
    throw err;
  }

  // แยก query string ออกจาก redirect url
  const query = result.url.split('?')[1] || '';
  const params = new URLSearchParams(query);

  const returnedError = params.get('error');
  if (returnedError) {
    throw new Error(params.get('error_description') || returnedError);
  }

  const returnedState = params.get('state');
  if (returnedState && returnedState !== state) {
    throw new Error('state ไม่ตรงกัน (อาจถูกดักกลางทาง)');
  }

  // native (bridge): server แลก token ให้แล้ว เด้งกลับพร้อม JWT + โปรไฟล์
  const token = params.get('token');
  if (token) {
    return {
      token,
      isNewUser: params.get('isNewUser') === '1',
      full_name: params.get('full_name') || '',
      email: params.get('email') || '',
      username: params.get('username') || '',
    };
  }

  // web: ได้ code → ผู้เรียกไปแลกที่ /auth/line/exchange
  const code = params.get('code');
  if (!code) {
    throw new Error('ไม่ได้รับข้อมูลจาก LINE');
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

// ---------- Web: ใช้ Google Identity Services (GIS) เหมือนเว็บ projectY3 ----------
// GIS คืน id_token (resp.credential) มาตรง ๆ โดยไม่ใช้ popup/redirect_uri
// จึงเลี่ยงปัญหา Cross-Origin-Opener-Policy (window.closed) และไม่ต้องลง redirect_uri
// เงื่อนไข: origin ของหน้าเว็บต้องถูกเพิ่มใน "Authorized JavaScript origins" ของ OAuth client
function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const src = 'https://accounts.google.com/gsi/client';
    if (document.querySelector(`script[src="${src}"]`)) {
      // สคริปต์กำลังโหลดอยู่ — รอจน window.google พร้อม
      const t = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(t);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        reject(new Error('โหลด Google SDK ไม่สำเร็จ'));
      }, 8000);
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('โหลด Google SDK ไม่สำเร็จ'));
    document.head.appendChild(el);
  });
}

async function startGoogleLoginWeb() {
  await loadGisScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    let overlay = null;

    const cleanup = () => {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
    };

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      // ใช้ FedCM แทน third-party cookie — เลี่ยงปัญหา ITP/403 บน localhost และเบราว์เซอร์ที่บล็อกคุกกี้
      use_fedcm_for_prompt: true,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (resp?.credential) resolve({ idToken: resp.credential }); // credential = id_token (JWT)
        else reject(new Error('ไม่ได้รับ token จาก Google'));
      },
    });

    // แสดงปุ่ม Google อย่างเป็นทางการ (renderButton) เป็น overlay กลางจอ —
    // ทำงานผ่าน top-level popup ไม่พึ่ง third-party cookie จึงติดปุ่มได้เสมอ
    const showButtonFallback = () => {
      if (settled || overlay) return;
      overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;' +
        'display:flex;align-items:center;justify-content:center;';

      const card = document.createElement('div');
      card.style.cssText =
        'background:#fff;border-radius:18px;padding:24px;width:320px;max-width:90%;' +
        'display:flex;flex-direction:column;align-items:center;gap:16px;' +
        'box-shadow:0 10px 40px rgba(0,0,0,0.2);';

      const title = document.createElement('div');
      title.textContent = 'เข้าสู่ระบบด้วย Google';
      title.style.cssText = 'font-size:16px;font-weight:bold;color:#222;';

      const btnHolder = document.createElement('div');

      const cancel = document.createElement('button');
      cancel.textContent = 'ยกเลิก';
      cancel.style.cssText =
        'margin-top:4px;background:#E6E6E6;border:none;border-radius:10px;' +
        'padding:10px 22px;font-size:14px;color:#444;cursor:pointer;';
      cancel.onclick = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const err = new Error('Google login ถูกยกเลิก');
        err.code = 'cancelled';
        reject(err);
      };

      card.appendChild(title);
      card.appendChild(btnHolder);
      card.appendChild(cancel);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      window.google.accounts.id.renderButton(btnHolder, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
      });
    };

    // แสดงปุ่ม Google ทันที (ใช้ได้เสมอ ไม่ต้องพึ่ง third-party cookie)
    // แล้วค่อยลอง One Tap เป็นทางลัดเสริม — ถ้าผู้ใช้เลือกจาก One Tap ได้ callback จะ resolve เอง
    showButtonFallback();
    try {
      window.google.accounts.id.prompt();
    } catch (_) {
      // ไม่เป็นไร ปุ่มด้านบนใช้กดแทนได้
    }
  });
}

// ---------- Native (มือถือ): Google Sign-In SDK ----------
// ใช้ @react-native-google-signin (native SDK จริง) แทน implicit flow ผ่าน browser
// เพราะ Google บล็อก implicit + custom scheme บนแอปมือถือ ("doesn't comply with OAuth 2.0 policy")
// SDK นี้คืน id_token ที่มี audience = webClientId → ตรงกับที่ backend ยืนยันอยู่แล้ว (ตัวเดียวกับฝั่งเว็บ)
// *ต้องใช้ EAS build (dev/preview/production) — ใช้ใน Expo Go ไม่ได้*
let _googleConfigured = false;

function getGoogleSignin() {
  // require แบบ lazy กัน error ตอนรันบนเว็บ (แพ็กเกจนี้เป็น native module)
  const mod = require('@react-native-google-signin/google-signin');
  if (!_googleConfigured) {
    mod.GoogleSignin.configure({
      // ต้องเป็น "Web" client ID เพื่อให้ได้ id_token สำหรับส่งไปยืนยันที่ backend
      webClientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
    });
    _googleConfigured = true;
  }
  return mod;
}

async function startGoogleLoginNative() {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = getGoogleSignin();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // เคลียร์เซสชันเดิมเพื่อให้ผู้ใช้เลือกบัญชีใหม่ได้เสมอ
  try { await GoogleSignin.signOut(); } catch (_) {}

  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      const e = new Error('Google login ถูกยกเลิก');
      e.code = 'cancelled';
      throw e;
    }
    throw err;
  }

  // v13+ คืนผลเป็น { type: 'success' | 'cancelled', data }
  if (!isSuccessResponse(response)) {
    const e = new Error('Google login ถูกยกเลิก');
    e.code = 'cancelled';
    throw e;
  }

  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('ไม่ได้รับ id_token จาก Google');
  }

  return { idToken };
}

/**
 * ล็อกอิน Google แล้วคืน id_token เพื่อส่งไป POST /api/auth/social
 *   - web   : Google Identity Services (เหมือนเว็บ projectY3)
 *   - native: OIDC implicit flow ผ่าน browser
 * @returns {Promise<{ idToken: string }>}
 *   - โยน Error พร้อม .code = 'cancelled' ถ้าผู้ใช้ยกเลิก
 */
export async function startGoogleLogin() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('ยังไม่ได้ตั้งค่า EXPO_PUBLIC_GOOGLE_CLIENT_ID');
  }
  if (Platform.OS === 'web') {
    return startGoogleLoginWeb();
  }
  return startGoogleLoginNative();
}
