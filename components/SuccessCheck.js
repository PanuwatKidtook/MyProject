import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ไอคอนเครื่องหมายถูกแบบขยับได้ (เหมือนฝั่งเว็บ)
// - วงกลมพื้นเขียวเด้งเข้า (pop) + วงแหวนเต้นเป็นจังหวะ (pulse)
// - เส้นเครื่องหมายถูกค่อย ๆ วาดเข้า (draw)
// props: size (เส้นผ่านศูนย์กลางวงพื้น), color, bg
export default function SuccessCheck({ size = 96, color = '#16A34A', bg = '#DCFCE7' }) {
  const pop = useRef(new Animated.Value(0)).current;      // 0→1 สเกลวงพื้น
  const draw = useRef(new Animated.Value(0)).current;     // 0→1 วาดเส้นเช็ค
  const pulse = useRef(new Animated.Value(0)).current;    // วงแหวนเต้น (loop)

  const DASH = 48; // ความยาวเส้นเช็คโดยประมาณ (ต้องมากกว่าความยาวจริงเล็กน้อย)

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(draw, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pop, draw, pulse]);

  const svg = Math.round(size * 0.58);
  const strokeDashoffset = draw.interpolate({ inputRange: [0, 1], outputRange: [DASH, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* วงแหวนเต้นเป็นจังหวะ */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
        }}
      />

      {/* วงพื้นเขียว + เครื่องหมายถูก */}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pop }],
        }}
      >
        <Svg width={svg} height={svg} viewBox="0 0 52 52">
          <Circle cx="26" cy="26" r="24" fill="none" stroke={color} strokeWidth="3" opacity={0.25} />
          <AnimatedPath
            d="M15 27 l7 7 l15 -16"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={DASH}
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
