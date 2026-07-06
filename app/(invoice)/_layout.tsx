import React from 'react';
import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'invoice',
};

export default function InvoiceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
