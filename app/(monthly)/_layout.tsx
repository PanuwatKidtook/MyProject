import { Stack } from 'expo-router';

export default function MonthlyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="reservation" />
      <Stack.Screen name="reservationlist" />
    </Stack>
  );
}