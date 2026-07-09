import { Stack } from 'expo-router';

export default function TenantLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="mybills" />
      <Stack.Screen name="mycontracts" />
    </Stack>
  );
}
