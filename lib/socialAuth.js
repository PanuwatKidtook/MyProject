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

// ---------- Native (มือถือ): OIDC implicit flow ผ่าน browser ----------
async function startGoogleLoginNative() {
  const state = randomState();
  const nonce = randomState(); // จำเป็นสำหรับ response_type=id_token
  const redirectUri = getGoogleRedirectUri();

  const authUrl =
    `${GOOGLE_AUTHORIZE_URL}?response_type=id_token` +
    `&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&nonce=${encodeURIComponent(nonce)}` +
    `&scope=${encodeURIComponent('openid profile email')}` +
    `&prompt=select_account`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) {
    const err = new Error('Google login ถูกยกเลิก');
    err.code = 'cancelled';
    throw err;
  }

  // implicit flow คืนค่ามาใน fragment (#...) ไม่ใช่ query (?...)
  const fragment = result.url.split('#')[1] || result.url.split('?')[1] || '';
  const params = new URLSearchParams(fragment);

  const returnedError = params.get('error');
  if (returnedError) {
    throw new Error(params.get('error_description') || returnedError);
  }

  const returnedState = params.get('state');
  if (returnedState !== state) {
    throw new Error('state ไม่ตรงกัน (อาจถูกดักกลางทาง)');
  }

  const idToken = params.get('id_token');
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
