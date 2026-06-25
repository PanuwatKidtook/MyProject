import React from 'react';
import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'repair',
};

export default function RepairLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}