// กำหนดโครง HTML ของเว็บ (Expo Router static export) — ใส่ meta/ลิงก์เพื่อทำเป็น PWA
// ทำให้ตอน "เพิ่มไปยังหน้าจอโฮม" บน iPhone ได้ไอคอน+ชื่อ+เปิดเต็มจอ เหมือนแอปจริง
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover + user-scalable=no ให้เต็มจอเหมือนแอป */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* ---- PWA (Android/Chrome) ---- */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0194F3" />
        <meta name="application-name" content="Around Loei" />

        {/* ---- iOS (Safari) — เปิดเต็มจอ + ชื่อ + ไอคอน ตอนเพิ่มหน้าจอโฮม ---- */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Around Loei" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.png" />

        <title>Around Loei</title>

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
