import { Stack } from 'expo-router';

export default function DailyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="reservation" />
      <Stack.Screen name="reservationlist" />
    </Stack>
  );
}