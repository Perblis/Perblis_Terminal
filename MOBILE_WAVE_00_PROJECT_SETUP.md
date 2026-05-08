# TERMINAL MOBILE — WAVE 00: PROJECT SETUP
> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 01 until the Definition of Done checklist is fully complete.

---

## Context

You are building **Terminal Mobile** — a React Native (Expo) mobile app for a heavy asset leasing marketplace targeting Nigeria. The backend API already exists (Django REST at `{API_BASE_URL}/api/v1/`). This app is the primary consumer of that API.

**What Terminal is:** An industrial marketplace connecting owners of heavy equipment (cranes, excavators), vehicles (flatbed trucks, tippers), warehouses, container terminals, and facilities with renters. Operators use it outdoors, often on-site, in bright sun. The design is dark, dense, technical, and confident.

**Design system:** The Terminal Design System (TDS) v1.1 — Forge Dark — is defined in the `design-system/` directory (cloned from `https://github.com/Nwabukin/Terminal-Mobile.git`). All visual decisions come from that system. Read `design-system/project/README.md` and `design-system/project/SKILL.md` before writing any UI code.

This wave sets up the entire project skeleton. All subsequent waves build on top of this.

---

## Step 1: Create the Expo project

```bash
npx create-expo-app@latest terminal-mobile --template blank-typescript
cd terminal-mobile
```

---

## Step 2: Install core dependencies

```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context

# State management & data fetching
npx expo install @tanstack/react-query zustand

# Storage
npx expo install expo-secure-store @react-native-async-storage/async-storage

# Maps
npx expo install react-native-maps expo-location

# Media & files
npx expo install expo-image-picker expo-file-system

# Fonts (TDS requires Barlow Condensed, IBM Plex Sans, IBM Plex Mono)
npx expo install expo-font @expo-google-fonts/barlow-condensed @expo-google-fonts/ibm-plex-sans @expo-google-fonts/ibm-plex-mono

# Icons
npm install @tabler/icons-react-native react-native-svg

# Realtime messaging
npm install ably

# Forms & validation
npm install react-hook-form zod @hookform/resolvers

# Date handling
npm install date-fns

# HTTP client
npm install axios

# Gesture & animation
npx expo install react-native-gesture-handler react-native-reanimated
```

---

## Step 3: Create the directory structure

```
terminal-mobile/
├── app.config.ts                # Expo config
├── App.tsx                      # Root — providers, font loading, navigation shell
├── src/
│   ├── api/                     # API client, endpoint functions, types
│   │   ├── client.ts            # Axios instance with JWT interceptor
│   │   ├── auth.ts              # Auth endpoints (register, login, logout, OTP, password)
│   │   ├── users.ts             # User profile endpoints
│   │   ├── listings.ts          # Listing CRUD + media upload
│   │   ├── search.ts            # Map search endpoint
│   │   ├── bookings.ts          # Booking lifecycle endpoints
│   │   ├── messaging.ts         # Threads + messages + Ably token
│   │   └── types.ts             # Shared API response types
│   ├── store/                   # Zustand stores
│   │   ├── authStore.ts         # Auth state (tokens, user, isAuthenticated)
│   │   └── appStore.ts          # App-wide state (role toggle, filters)
│   ├── theme/                   # Design tokens translated to RN
│   │   ├── colors.ts            # All TDS color tokens
│   │   ├── typography.ts        # Font families, sizes, weights
│   │   ├── spacing.ts           # 4px base scale
│   │   └── index.ts             # Re-exports
│   ├── components/              # Shared UI components
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── ListingCard.tsx
│   │   ├── BookingRow.tsx
│   │   ├── MapPin.tsx
│   │   ├── StatusBar.tsx
│   │   ├── TabBar.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── ResourceIcon.tsx
│   │   ├── Avatar.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   └── index.ts
│   ├── screens/                 # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── VerifyPhoneScreen.tsx
│   │   ├── renter/
│   │   │   ├── MapScreen.tsx
│   │   │   ├── ListingDetailScreen.tsx
│   │   │   └── RequestBookingScreen.tsx
│   │   ├── owner/
│   │   │   ├── OwnerDashboardScreen.tsx
│   │   │   ├── BookingDetailScreen.tsx
│   │   │   └── ListingWizardScreen.tsx
│   │   ├── shared/
│   │   │   ├── BookingsScreen.tsx
│   │   │   ├── ThreadListScreen.tsx
│   │   │   ├── ThreadScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   └── index.ts
│   ├── navigation/
│   │   ├── RootNavigator.tsx    # Auth vs Main split
│   │   ├── AuthNavigator.tsx    # Login, Register, Verify
│   │   ├── RenterTabs.tsx       # Search, Bookings, Messages, Profile
│   │   ├── OwnerTabs.tsx        # Listings, Bookings, Messages, Profile
│   │   └── types.ts             # Navigation param lists
│   ├── hooks/                   # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useLocation.ts
│   │   └── useAbly.ts
│   └── utils/
│       ├── format.ts            # Currency (₦), distance, dates
│       └── constants.ts         # API URL, resource types, etc.
```

Create every directory and empty placeholder file listed above.

---

## Step 4: Create the design token files

**File: `src/theme/colors.ts`**

```typescript
export const colors = {
  // Foundation surfaces
  abyss: '#0C0C0F',
  surface: '#131318',
  surfaceElevated: '#1A1A22',
  surfaceHigh: '#22222C',
  border: '#2A2A36',
  borderActive: '#3E3E50',

  // Forge accent
  forgeLight: '#FF8C24',
  forge: '#E8750A',
  forgeMid: '#B85A07',
  forgeDim: '#7A3D04',
  amber: '#F5A623',
  amberDim: '#2A1E08',

  // Semantic
  clear: '#16A34A',
  clearSoft: '#4ADE80',
  clearDim: '#0A3D22',
  signal: '#3B82F6',
  signalSoft: '#60A5FA',
  signalDim: '#1E3A6E',
  alert: '#EF4444',
  alertSoft: '#F87171',
  alertDim: '#4A1010',

  // Text
  textPrimary: '#F1F1F8',
  textSecondary: '#8E8EA8',
  textTertiary: '#52526A',
  textOnAccent: '#FFFFFF',

  // Semantic role tokens
  bgApp: '#0C0C0F',
  bgCard: '#131318',
  bgInput: '#1A1A22',
  bgHover: '#22222C',
  bgTintedSuccess: '#0A3D22',
  bgTintedInfo: '#1E3A6E',
  bgTintedWarn: '#2A1E08',
  bgTintedDanger: '#4A1010',
  bgTintedAccent: '#7A3D04',

  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
```

**File: `src/theme/typography.ts`**

```typescript
export const fontFamilies = {
  display: 'BarlowCondensed_700Bold',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemiBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
} as const;

export const typeScale = {
  display1: {
    fontFamily: fontFamilies.display,
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -0.48,
    textTransform: 'uppercase' as const,
  },
  display2: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -0.36,
    textTransform: 'uppercase' as const,
  },
  display3: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.28,
    textTransform: 'uppercase' as const,
  },
  h1: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 22,
    lineHeight: 26,
  },
  h2: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  h3: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.52,
    textTransform: 'uppercase' as const,
  },
  body1: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 24,
  },
  body2: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.66,
    textTransform: 'uppercase' as const,
  },
  mono1: {
    fontFamily: fontFamilies.mono,
    fontSize: 15,
    lineHeight: 21,
  },
  mono2: {
    fontFamily: fontFamilies.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  mono3: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.22,
  },
} as const;
```

**File: `src/theme/spacing.ts`**

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
  '6xl': 80,
  '7xl': 96,
} as const;

export const radii = {
  sharp: 0,
  default: 4,
  card: 8,
  sheet: 12,
  pill: 999,
} as const;

export const screenPadding = {
  horizontal: 20,
  vertical: 16,
} as const;
```

**File: `src/theme/index.ts`**

```typescript
export { colors } from './colors';
export { fontFamilies, typeScale } from './typography';
export { spacing, radii, screenPadding } from './spacing';
```

---

## Step 5: Create the API client

**File: `src/api/client.ts`**

```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../utils/constants';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${API_BASE_URL}/api/v1/auth/token/refresh/`,
          { refresh: refreshToken }
        );

        await SecureStore.setItemAsync('access_token', data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest);
      } catch {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**File: `src/utils/constants.ts`**

```typescript
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000'
  : 'https://your-production-domain.railway.app';

export const RESOURCE_TYPES = [
  { id: 'equipment', label: 'Equipment' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'facility', label: 'Facility' },
] as const;

export const BOOKING_STATUSES = {
  pending: { label: 'PENDING', badge: 'warning' },
  confirmed: { label: 'CONFIRMED', badge: 'info' },
  active: { label: 'ACTIVE', badge: 'success' },
  completed: { label: 'COMPLETED', badge: 'success' },
  declined: { label: 'DECLINED', badge: 'danger' },
  cancelled: { label: 'CANCELLED', badge: 'neutral' },
} as const;

export const DURATION_TYPES = ['daily', 'weekly', 'monthly'] as const;
```

**File: `src/utils/format.ts`**

```typescript
import { format, formatDistanceToNow } from 'date-fns';

export function formatCurrency(amount: number): string {
  return `₦${new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === new Date().getFullYear();
  const fmt = sameYear ? 'MMM d' : 'MMM d, yyyy';
  return `${format(s, fmt)} – ${format(e, fmt)}`;
}

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
```

---

## Step 6: Create the API types

**File: `src/api/types.ts`**

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]> | string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  count: number;
  data: T[];
}

export interface User {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  profile_photo: string | null;
  bio: string;
  is_renter: boolean;
  is_owner: boolean;
  verification_level: number;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  is_id_verified: boolean;
  created_at: string;
  unread_messages?: number;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ListingMedia {
  id: string;
  file_url: string;
  is_primary: boolean;
  display_order: number;
}

export interface ListingOwner {
  id: string;
  full_name: string;
  profile_photo: string | null;
  verification_level: number;
}

export interface Listing {
  id: string;
  owner: ListingOwner;
  resource_type: 'equipment' | 'vehicle' | 'warehouse' | 'terminal' | 'facility';
  title: string;
  description: string;
  category: string;
  price_daily: string | null;
  price_weekly: string | null;
  price_monthly: string | null;
  specs: Record<string, unknown>;
  latitude: number | null;
  longitude: number | null;
  location_address: string;
  location_city: string;
  operator_available: boolean;
  delivery_available: boolean;
  status: 'draft' | 'active' | 'paused' | 'archived';
  is_available: boolean;
  verification_tier: 'basic' | 'verified' | 'inspected';
  view_count: number;
  primary_photo_url: string | null;
  media: ListingMedia[];
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: string;
  resource_type: Listing['resource_type'];
  title: string;
  category: string;
  price_daily: string | null;
  price_weekly: string | null;
  price_monthly: string | null;
  latitude: number;
  longitude: number;
  location_address: string;
  location_city: string;
  is_available: boolean;
  verification_tier: string;
  primary_photo_url: string | null;
  distance_km: number;
  owner_name: string;
  owner_photo: string | null;
}

export interface BookingParty {
  id: string;
  full_name: string;
  profile_photo: string | null;
  phone: string;
}

export interface Booking {
  id: string;
  renter: BookingParty;
  owner: BookingParty;
  listing_id: string;
  listing_title: string;
  start_date: string;
  end_date: string;
  duration_type: 'daily' | 'weekly' | 'monthly';
  duration_days: number;
  gross_amount: string;
  commission_rate: string;
  commission_amount: string;
  owner_payout_amount: string;
  renter_note: string;
  status: 'pending' | 'confirmed' | 'declined' | 'active' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'simulated_paid';
  thread_id: string | null;
  cancellation_reason: string;
  created_at: string;
  updated_at: string;
}

export interface MessageSender {
  id: string;
  full_name: string;
  profile_photo: string | null;
}

export interface Message {
  id: string;
  sender: MessageSender;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Thread {
  id: string;
  is_booking_thread: boolean;
  booking_id: string | null;
  listing_title: string | null;
  other_participant: {
    id: string;
    full_name: string;
    profile_photo: string | null;
  } | null;
  last_message: {
    body: string;
    sender_name: string;
    created_at: string;
  } | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}
```

---

## Step 7: Create the auth store

**File: `src/store/authStore.ts`**

```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, AuthTokens } from '../api/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: true }),

  setTokens: async (tokens) => {
    await SecureStore.setItemAsync('access_token', tokens.access);
    await SecureStore.setItemAsync('refresh_token', tokens.refresh);
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        set({ isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
```

---

## Step 8: Create the root App component

**File: `App.tsx`**

```tsx
import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import * as SplashScreen from 'expo-splash-screen';

import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
  });

  useEffect(() => {
    hydrate();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.forge} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer
            theme={{
              dark: true,
              colors: {
                primary: colors.forge,
                background: colors.abyss,
                card: colors.surface,
                text: colors.textPrimary,
                border: colors.border,
                notification: colors.forge,
              },
            }}
          >
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.abyss },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.abyss },
});
```

---

## Step 9: Create placeholder navigation

**File: `src/navigation/RootNavigator.tsx`**

```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { RenterTabs } from './RenterTabs';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={RenterTabs} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
```

Create placeholder navigator files for `AuthNavigator.tsx`, `RenterTabs.tsx`, and `OwnerTabs.tsx` with empty tab/stack configurations. Each tab should render a placeholder screen with a centered text label.

---

## Step 10: Clone the design system

Clone the design system repo into the project for reference:

```bash
git clone https://github.com/Nwabukin/Terminal-Mobile.git design-system
```

Add `design-system/` to `.gitignore` — it's a reference, not committed to the mobile repo.

---

## Step 11: Verify the setup runs

```bash
npx expo start
```

The app must:
1. Load without errors
2. Display a dark background (`#0C0C0F`)
3. Show placeholder text in the correct TDS fonts (Barlow Condensed for display, IBM Plex Sans for body)
4. Navigate between placeholder tabs

---

## Step 12: Initialize git

```bash
git init
git add .
git commit -m "chore: initial project setup — Mobile Wave 00"
```

---

## Definition of Done

- [ ] Expo project created with TypeScript template
- [ ] All dependencies installed and `npx expo start` runs without errors
- [ ] Directory structure matches spec exactly: `src/api/`, `src/store/`, `src/theme/`, `src/components/`, `src/screens/`, `src/navigation/`, `src/hooks/`, `src/utils/`
- [ ] Design tokens match TDS v1.1 exactly: all colors, type scale, spacing scale, radii
- [ ] Fonts load correctly: `BarlowCondensed_700Bold`, `IBMPlexSans_400Regular/500Medium/600SemiBold`, `IBMPlexMono_400Regular`
- [ ] API client created with JWT interceptor and token refresh logic
- [ ] Auth store created with Zustand + SecureStore
- [ ] API types match the backend API response shapes exactly
- [ ] Navigation shell works: Auth stack vs Main tabs split
- [ ] App background is `#0C0C0F` (abyss), status bar is light
- [ ] `format.ts` has `formatCurrency` producing `₦45,000` format (Naira, comma-separated, no decimal)
- [ ] Design system cloned to `design-system/` for reference
- [ ] Git commit made with message `chore: initial project setup — Mobile Wave 00`
