# TERMINAL MOBILE — WAVE 04: OWNER FLOWS & POLISH
> Agent task file. Execute every instruction in order. Do not skip steps.
> Waves 00–03 must be complete before starting this wave.
> This is the final wave. After this, Terminal Mobile is feature-complete for MVP.

---

## Context

You are finishing **Terminal Mobile** — the React Native (Expo) app for a heavy asset leasing marketplace targeting Nigeria. Waves 00–03 built project setup, auth, map + listings, and bookings + messaging. This wave adds the owner experience (dashboard, listing creation, profile) and applies polish across every screen in the app.

**What this wave covers:**
1. Owner dashboard with KPI grid, earnings sparkline, pending requests, and fleet overview
2. Listing creation/edit wizard (multi-step form)
3. Profile screen shared between renter and owner roles
4. Role switching between renter and owner tab navigators
5. App-wide polish: loading skeletons, error states, empty states, pull-to-refresh, haptic feedback, tap animations, keyboard avoidance, deep linking, app icon, splash screen
6. Full end-to-end integration test across all flows

**Backend API:** Django REST at `{API_BASE_URL}/api/v1/`
**Design system:** Forge Dark — `#0C0C0F` abyss, `#E8750A` forge orange, borders not shadows. Refer to `design-system/project/SKILL.md` and `design-system/project/ui_kits/mobile_app/OwnerDashboard.jsx` for reference.

---

## Step 1: Create the app store (`src/store/appStore.ts`)

This store manages role preference and active filters across the app.

**File: `src/store/appStore.ts`**

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ActiveRole = 'renter' | 'owner';

interface AppState {
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => Promise<void>;
  hydrateRole: () => Promise<void>;

  // Booking list filters
  bookingStatusFilter: string | null;
  setBookingStatusFilter: (status: string | null) => void;

  // Search filters (persisted for session)
  searchResourceType: string | null;
  setSearchResourceType: (type: string | null) => void;
  searchRadius: number;
  setSearchRadius: (radius: number) => void;
}

const ROLE_STORAGE_KEY = 'terminal_active_role';

export const useAppStore = create<AppState>((set) => ({
  activeRole: 'renter',

  setActiveRole: async (role) => {
    await AsyncStorage.setItem(ROLE_STORAGE_KEY, role);
    set({ activeRole: role });
  },

  hydrateRole: async () => {
    try {
      const stored = await AsyncStorage.getItem(ROLE_STORAGE_KEY);
      if (stored === 'renter' || stored === 'owner') {
        set({ activeRole: stored });
      }
    } catch {
      // Default to renter on error
    }
  },

  bookingStatusFilter: null,
  setBookingStatusFilter: (status) => set({ bookingStatusFilter: status }),

  searchResourceType: null,
  setSearchResourceType: (type) => set({ searchResourceType: type }),

  searchRadius: 25,
  setSearchRadius: (radius) => set({ searchRadius: radius }),
}));
```

---

## Step 2: Create shared utility components

### 2a: Avatar component (`src/components/Avatar.tsx`)

**File: `src/components/Avatar.tsx`**

```tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, fontFamilies } from '../theme';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 32, md: 48, lg: 80 };
const FONT_SIZES = { sm: 12, md: 16, lg: 28 };

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export function Avatar({ uri, name, size = 'md' }: AvatarProps) {
  const dim = SIZES[size];
  const fontSize = FONT_SIZES[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width: dim, height: dim, borderRadius: dim / 2 },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: dim, height: dim, borderRadius: dim / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceElevated,
  },
  fallback: {
    backgroundColor: colors.forgeDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fontFamilies.bodySemiBold,
    color: colors.forgeLight,
  },
});
```

### 2b: EmptyState component (`src/components/EmptyState.tsx`)

**File: `src/components/EmptyState.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typeScale, spacing } from '../theme';
import { Button } from './Button';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ message, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <View style={styles.buttonWrap}>
          <Button label={actionLabel} onPress={onAction} variant="primary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['4xl'],
  },
  iconWrap: {
    marginBottom: spacing.lg,
  },
  message: {
    ...typeScale.body1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: spacing.xl,
    minWidth: 200,
  },
});
```

### 2c: LoadingSkeleton component (`src/components/LoadingSkeleton.tsx`)

**File: `src/components/LoadingSkeleton.tsx`**

```tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors, radii } from '../theme';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: object;
}

export function LoadingSkeleton({
  width,
  height,
  borderRadius = radii.default,
  style,
}: SkeletonProps) {
  const shimmer = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    shimmer.value = 0;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(shimmer);
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.5 : 0.3 + shimmer.value * 0.4,
  }));

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        styles.base,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonRow({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: lines }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={14}
          style={{ marginBottom: 8 }}
        />
      ))}
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <LoadingSkeleton width="100%" height={120} borderRadius={radii.card} />
      <View style={{ marginTop: 12 }}>
        <LoadingSkeleton width="70%" height={16} />
        <LoadingSkeleton width="40%" height={14} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceHigh,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
});
```

### 2d: Update the components barrel export (`src/components/index.ts`)

Append the following exports to the existing `src/components/index.ts`:

```typescript
export { Avatar } from './Avatar';
export { EmptyState } from './EmptyState';
export { LoadingSkeleton, SkeletonRow, SkeletonCard } from './LoadingSkeleton';
```

---

## Step 3: Create the Owner Dashboard screen (`src/screens/owner/OwnerDashboardScreen.tsx`)

**File: `src/screens/owner/OwnerDashboardScreen.tsx`**

```tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { IconBell } from '@tabler/icons-react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, typeScale, spacing, fontFamilies, screenPadding } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { SkeletonCard, EmptyState } from '../../components';
import apiClient from '../../api/client';

// ── Types ─────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
}

interface PendingRequest {
  id: string;
  renter_name: string;
  listing_title: string;
  start_date: string;
  end_date: string;
  gross_amount: string;
  created_at: string;
  is_new: boolean;
}

interface FleetAsset {
  id: string;
  title: string;
  status: 'active' | 'available' | 'maintenance';
  schedule_info: string;
}

// ── API Calls ─────────────────────────────────────────────────────

async function fetchOwnerDashboard() {
  // Fetch bookings for KPI data
  const [bookingsRes, listingsRes] = await Promise.all([
    apiClient.get('/bookings/', { params: { role: 'owner' } }),
    apiClient.get('/listings/', { params: { own: true } }),
  ]);

  const bookings = bookingsRes.data.data ?? bookingsRes.data.results ?? [];
  const listings = listingsRes.data.data ?? listingsRes.data.results ?? [];

  // Derive KPIs from real data
  const confirmedBookings = bookings.filter(
    (b: any) => b.status === 'confirmed' || b.status === 'active' || b.status === 'completed'
  );
  const pendingBookings = bookings.filter((b: any) => b.status === 'pending');

  const totalEarnings = confirmedBookings.reduce(
    (sum: number, b: any) => sum + parseFloat(b.owner_payout_amount || b.gross_amount || '0'),
    0,
  );

  const activeListings = listings.filter((l: any) => l.status === 'active');
  const utilization =
    activeListings.length > 0
      ? Math.round(
          (activeListings.filter((l: any) => !l.is_available).length /
            activeListings.length) *
            100,
        )
      : 0;

  const kpis: KPI[] = [
    {
      label: 'EARNINGS (MO)',
      value: `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(totalEarnings)}`,
    },
    {
      label: 'UTILIZATION',
      value: `${utilization}%`,
    },
    {
      label: 'OPEN REQUESTS',
      value: `${pendingBookings.length}`,
    },
    {
      label: 'AVG. RESPONSE',
      value: pendingBookings.length > 0 ? '< 2h' : '—',
    },
  ];

  const pendingRequests: PendingRequest[] = pendingBookings
    .slice(0, 5)
    .map((b: any) => ({
      id: b.id,
      renter_name: b.renter?.full_name ?? 'Unknown',
      listing_title: b.listing_title ?? 'Untitled',
      start_date: b.start_date,
      end_date: b.end_date,
      gross_amount: b.gross_amount,
      created_at: b.created_at,
      is_new:
        new Date().getTime() - new Date(b.created_at).getTime() <
        24 * 60 * 60 * 1000,
    }));

  const fleet: FleetAsset[] = listings.map((l: any) => ({
    id: l.id,
    title: l.title,
    status: l.status !== 'active'
      ? 'maintenance'
      : l.is_available
        ? 'available'
        : 'active',
    schedule_info: l.is_available ? 'Available' : 'Booked',
  }));

  return { kpis, pendingRequests, fleet };
}

// ── Sub-components ────────────────────────────────────────────────

function KPICard({ kpi }: { kpi: KPI }) {
  return (
    <View style={kpiStyles.card}>
      <Text style={kpiStyles.label}>{kpi.label}</Text>
      <Text style={kpiStyles.value}>{kpi.value}</Text>
      {kpi.delta && (
        <Text
          style={[
            kpiStyles.delta,
            { color: kpi.deltaPositive ? colors.clear : colors.alert },
          ]}
        >
          {kpi.delta}
        </Text>
      )}
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    minWidth: '46%',
  },
  label: {
    ...typeScale.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  value: {
    fontFamily: fontFamilies.mono,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  delta: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    marginTop: 2,
  },
});

function StatusDot({ status }: { status: FleetAsset['status'] }) {
  const dotColor =
    status === 'active'
      ? colors.forge
      : status === 'available'
        ? colors.clear
        : colors.amber;
  return <View style={[fleetStyles.dot, { backgroundColor: dotColor }]} />;
}

const fleetStyles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
    marginTop: 6,
  },
});

function RequestRow({ request }: { request: PendingRequest }) {
  const navigation = useNavigation<any>();
  const scale = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reduceMotion) {
      scale.value = withTiming(0.97, { duration: 80 });
    }
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 80 });
  };

  const timeAgo = formatRelativeShort(request.created_at);
  const amount = `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(parseFloat(request.gross_amount))}`;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => navigation.navigate('BookingDetail', { bookingId: request.id })}
    >
      <Animated.View
        style={[
          requestStyles.row,
          request.is_new && requestStyles.newRow,
          animatedStyle,
        ]}
      >
        <View style={requestStyles.left}>
          <Text style={requestStyles.name} numberOfLines={1}>
            {request.renter_name}
          </Text>
          <Text style={requestStyles.asset} numberOfLines={1}>
            {request.listing_title}
          </Text>
          <Text style={requestStyles.dates}>
            {request.start_date} – {request.end_date}
          </Text>
        </View>
        <View style={requestStyles.right}>
          <Text style={requestStyles.amount}>{amount}</Text>
          <Text style={requestStyles.time}>{timeAgo}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function formatRelativeShort(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const requestStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: screenPadding.horizontal,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  newRow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.forge,
  },
  left: {
    flex: 1,
    marginRight: spacing.md,
  },
  right: {
    alignItems: 'flex-end',
  },
  name: {
    ...typeScale.body1,
    color: colors.textPrimary,
  },
  asset: {
    ...typeScale.body2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dates: {
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  amount: {
    fontFamily: fontFamilies.mono,
    fontSize: 15,
    color: colors.forgeLight,
  },
  time: {
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
  },
});

// ── Main Screen ───────────────────────────────────────────────────

export default function OwnerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: fetchOwnerDashboard,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.caption}>Loading...</Text>
        </View>
        <View style={styles.skeletonWrap}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          message="Couldn't reach the server. Tap to retry."
          actionLabel="Retry"
          onAction={refetch}
        />
      </View>
    );
  }

  const companyName = user
    ? `${user.first_name} ${user.last_name}`
    : 'Your Company';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.forge}
            colors={[colors.forge]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.caption}>{companyName.toUpperCase()}</Text>
            <Text style={styles.h1}>Yard overview</Text>
          </View>
          <Pressable
            style={styles.bellWrap}
            accessibilityLabel="Notifications"
            onPress={() => {}}
          >
            <IconBell size={24} color={colors.textPrimary} />
            {(user?.unread_messages ?? 0) > 0 && (
              <View style={styles.bellDot} />
            )}
          </Pressable>
        </View>

        {/* KPI Grid (2×2) */}
        <View style={styles.kpiGrid}>
          {data.kpis.map((kpi, i) => (
            <KPICard key={i} kpi={kpi} />
          ))}
        </View>

        {/* Pending Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Pending requests ({data.pendingRequests.length})
            </Text>
            {data.pendingRequests.length > 0 && (
              <Pressable
                onPress={() =>
                  navigation.navigate('Bookings', {
                    screen: 'BookingsList',
                    params: { filter: 'pending' },
                  })
                }
              >
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            )}
          </View>
          {data.pendingRequests.length === 0 ? (
            <EmptyState message="No pending requests." />
          ) : (
            data.pendingRequests.map((req) => (
              <RequestRow key={req.id} request={req} />
            ))
          )}
        </View>

        {/* Your Fleet */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your fleet</Text>
          {data.fleet.length === 0 ? (
            <EmptyState
              message="List your first asset."
              actionLabel="Create listing"
              onAction={() => navigation.navigate('ListingWizard')}
            />
          ) : (
            data.fleet.map((asset) => (
              <Pressable
                key={asset.id}
                onPress={() =>
                  navigation.navigate('ListingDetail', { listingId: asset.id })
                }
              >
                <View style={styles.fleetRow}>
                  <StatusDot status={asset.status} />
                  <View style={styles.fleetInfo}>
                    <Text style={styles.fleetName} numberOfLines={1}>
                      {asset.title}
                    </Text>
                    <Text style={styles.fleetSchedule}>
                      {asset.schedule_info}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  scroll: {
    paddingBottom: 100,
  },
  skeletonWrap: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  caption: {
    ...typeScale.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  h1: {
    ...typeScale.h1,
    color: colors.textPrimary,
  },
  bellWrap: {
    padding: spacing.sm,
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.forge,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: screenPadding.horizontal,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typeScale.h2,
    color: colors.textPrimary,
    paddingHorizontal: screenPadding.horizontal,
    marginBottom: spacing.md,
  },
  viewAll: {
    ...typeScale.body2,
    color: colors.forge,
  },
  fleetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: screenPadding.horizontal,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fleetInfo: {
    flex: 1,
  },
  fleetName: {
    ...typeScale.body1,
    color: colors.textPrimary,
  },
  fleetSchedule: {
    fontFamily: fontFamilies.mono,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
```

---

## Step 4: Create the Listing Wizard screen (`src/screens/owner/ListingWizardScreen.tsx`)

This is a multi-step form for creating or editing a listing. Six steps with a progress indicator at the top. Save-as-draft at any step.

**File: `src/screens/owner/ListingWizardScreen.tsx`**

```tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {
  IconCrane,
  IconTruck,
  IconBuildingWarehouse,
  IconAnchor,
  IconBuildingFactory2,
  IconArrowLeft,
  IconX,
  IconGripVertical,
  IconPhoto,
} from '@tabler/icons-react-native';

import { colors, typeScale, spacing, fontFamilies, screenPadding, radii } from '../../theme';
import { Button } from '../../components/Button';
import apiClient from '../../api/client';

const TOTAL_STEPS = 6;

const RESOURCE_TYPES = [
  { id: 'equipment', label: 'Equipment', Icon: IconCrane },
  { id: 'vehicle', label: 'Vehicle', Icon: IconTruck },
  { id: 'warehouse', label: 'Warehouse', Icon: IconBuildingWarehouse },
  { id: 'terminal', label: 'Terminal', Icon: IconAnchor },
  { id: 'facility', label: 'Facility', Icon: IconBuildingFactory2 },
];

interface WizardState {
  resource_type: string;
  title: string;
  category: string;
  price_daily: string;
  price_weekly: string;
  price_monthly: string;
  location_address: string;
  location_city: string;
  latitude: string;
  longitude: string;
  description: string;
  specs: { key: string; value: string }[];
  photos: { uri: string; isLocal: boolean; id?: string }[];
}

const INITIAL_STATE: WizardState = {
  resource_type: '',
  title: '',
  category: '',
  price_daily: '',
  price_weekly: '',
  price_monthly: '',
  location_address: '',
  location_city: '',
  latitude: '',
  longitude: '',
  description: '',
  specs: [{ key: '', value: '' }],
  photos: [],
};

// ── Progress Indicator ────────────────────────────────────────────

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={progressStyles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            progressStyles.segment,
            i < current && progressStyles.segmentFilled,
            i === current && progressStyles.segmentActive,
          ]}
        />
      ))}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: spacing.md,
  },
  segment: {
    flex: 1,
    height: 3,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 2,
  },
  segmentFilled: {
    backgroundColor: colors.forge,
  },
  segmentActive: {
    backgroundColor: colors.forgeLight,
  },
});

// ── Step Components ───────────────────────────────────────────────

function StepResourceType({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.title}>What are you listing?</Text>
      <Text style={stepStyles.subtitle}>Select the type of resource.</Text>

      <View style={stepStyles.typeGrid}>
        {RESOURCE_TYPES.map(({ id, label, Icon }) => {
          const selected = state.resource_type === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange({ resource_type: id });
              }}
              style={[
                stepStyles.typeCard,
                selected && stepStyles.typeCardSelected,
              ]}
            >
              <Icon
                size={28}
                color={selected ? colors.forge : colors.textSecondary}
              />
              <Text
                style={[
                  stepStyles.typeLabel,
                  selected && stepStyles.typeLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={stepStyles.fieldLabel}>Title</Text>
      <TextInput
        style={stepStyles.input}
        placeholderTextColor={colors.textTertiary}
        placeholder="e.g. 50T Liebherr Mobile Crane"
        value={state.title}
        onChangeText={(v) => onChange({ title: v })}
      />

      <Text style={stepStyles.fieldLabel}>Category</Text>
      <TextInput
        style={stepStyles.input}
        placeholderTextColor={colors.textTertiary}
        placeholder="e.g. Mobile Crane, Excavator, Cold Storage"
        value={state.category}
        onChangeText={(v) => onChange({ category: v })}
      />
    </View>
  );
}

function StepPricing({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.title}>Set your rates</Text>
      <Text style={stepStyles.subtitle}>
        Enter at least one rate. Leave unused rates blank.
      </Text>

      {[
        { key: 'price_daily' as const, label: 'Daily rate' },
        { key: 'price_weekly' as const, label: 'Weekly rate' },
        { key: 'price_monthly' as const, label: 'Monthly rate' },
      ].map(({ key, label }) => (
        <View key={key} style={stepStyles.priceRow}>
          <Text style={stepStyles.fieldLabel}>{label}</Text>
          <View style={stepStyles.priceInput}>
            <Text style={stepStyles.currencyPrefix}>₦</Text>
            <TextInput
              style={stepStyles.priceField}
              placeholderTextColor={colors.textTertiary}
              placeholder="0"
              keyboardType="numeric"
              value={state[key]}
              onChangeText={(v) => onChange({ [key]: v.replace(/[^0-9]/g, '') })}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function StepLocation({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.title}>Where is it located?</Text>
      <Text style={stepStyles.subtitle}>
        Enter the address or use the map to drop a pin.
      </Text>

      <Text style={stepStyles.fieldLabel}>Address</Text>
      <TextInput
        style={stepStyles.input}
        placeholderTextColor={colors.textTertiary}
        placeholder="e.g. 14 Marina Road, Lagos Island"
        value={state.location_address}
        onChangeText={(v) => onChange({ location_address: v })}
      />

      <Text style={stepStyles.fieldLabel}>City</Text>
      <TextInput
        style={stepStyles.input}
        placeholderTextColor={colors.textTertiary}
        placeholder="e.g. Lagos"
        value={state.location_city}
        onChangeText={(v) => onChange({ location_city: v })}
      />

      <View style={stepStyles.coordRow}>
        <View style={stepStyles.coordField}>
          <Text style={stepStyles.fieldLabel}>Latitude</Text>
          <TextInput
            style={stepStyles.input}
            placeholderTextColor={colors.textTertiary}
            placeholder="6.5244"
            keyboardType="decimal-pad"
            value={state.latitude}
            onChangeText={(v) => onChange({ latitude: v })}
          />
        </View>
        <View style={stepStyles.coordField}>
          <Text style={stepStyles.fieldLabel}>Longitude</Text>
          <TextInput
            style={stepStyles.input}
            placeholderTextColor={colors.textTertiary}
            placeholder="3.3792"
            keyboardType="decimal-pad"
            value={state.longitude}
            onChangeText={(v) => onChange({ longitude: v })}
          />
        </View>
      </View>
    </View>
  );
}

function StepDetails({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const addSpec = () => {
    onChange({ specs: [...state.specs, { key: '', value: '' }] });
  };

  const updateSpec = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...state.specs];
    updated[index] = { ...updated[index], [field]: val };
    onChange({ specs: updated });
  };

  const removeSpec = (index: number) => {
    const updated = state.specs.filter((_, i) => i !== index);
    onChange({ specs: updated.length > 0 ? updated : [{ key: '', value: '' }] });
  };

  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.title}>Describe your asset</Text>

      <Text style={stepStyles.fieldLabel}>Description</Text>
      <TextInput
        style={[stepStyles.input, stepStyles.textArea]}
        placeholderTextColor={colors.textTertiary}
        placeholder="Describe the asset, its condition, and what's included..."
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        value={state.description}
        onChangeText={(v) => onChange({ description: v })}
      />

      <Text style={stepStyles.fieldLabel}>Specifications</Text>
      {state.specs.map((spec, i) => (
        <View key={i} style={stepStyles.specRow}>
          <TextInput
            style={[stepStyles.input, stepStyles.specKey]}
            placeholderTextColor={colors.textTertiary}
            placeholder="Key (e.g. Tonnage)"
            value={spec.key}
            onChangeText={(v) => updateSpec(i, 'key', v)}
          />
          <TextInput
            style={[stepStyles.input, stepStyles.specValue]}
            placeholderTextColor={colors.textTertiary}
            placeholder="Value (e.g. 50)"
            value={spec.value}
            onChangeText={(v) => updateSpec(i, 'value', v)}
          />
          <Pressable onPress={() => removeSpec(i)} style={stepStyles.specRemove}>
            <IconX size={16} color={colors.textTertiary} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addSpec}>
        <Text style={stepStyles.addSpec}>+ Add spec</Text>
      </Pressable>
    </View>
  );
}

function StepPhotos({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newPhotos = result.assets.map((a) => ({
        uri: a.uri,
        isLocal: true,
      }));
      onChange({ photos: [...state.photos, ...newPhotos] });
    }
  };

  const removePhoto = (index: number) => {
    const updated = state.photos.filter((_, i) => i !== index);
    onChange({ photos: updated });
  };

  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.title}>Add photos</Text>
      <Text style={stepStyles.subtitle}>
        First photo becomes the primary image. Drag to reorder.
      </Text>

      <View style={stepStyles.photoGrid}>
        {state.photos.map((photo, i) => (
          <View key={i} style={stepStyles.photoWrap}>
            <Image source={{ uri: photo.uri }} style={stepStyles.photo} />
            {i === 0 && (
              <View style={stepStyles.primaryBadge}>
                <Text style={stepStyles.primaryText}>PRIMARY</Text>
              </View>
            )}
            <Pressable
              style={stepStyles.photoRemove}
              onPress={() => removePhoto(i)}
            >
              <IconX size={14} color={colors.textPrimary} />
            </Pressable>
            <View style={stepStyles.photoGrip}>
              <IconGripVertical size={14} color={colors.textTertiary} />
            </View>
          </View>
        ))}

        <Pressable style={stepStyles.photoAdd} onPress={pickImage}>
          <IconPhoto size={24} color={colors.textTertiary} />
          <Text style={stepStyles.photoAddText}>Add photos</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StepReview({ state }: { state: WizardState }) {
  const resourceLabel =
    RESOURCE_TYPES.find((r) => r.id === state.resource_type)?.label ?? '—';

  const specs = state.specs.filter((s) => s.key.trim() && s.value.trim());

  return (
    <View style={stepStyles.container}>
      <Text style={stepStyles.title}>Review your listing</Text>

      <View style={stepStyles.reviewSection}>
        <Text style={stepStyles.reviewLabel}>Type</Text>
        <Text style={stepStyles.reviewValue}>{resourceLabel}</Text>
      </View>

      <View style={stepStyles.reviewSection}>
        <Text style={stepStyles.reviewLabel}>Title</Text>
        <Text style={stepStyles.reviewValue}>{state.title || '—'}</Text>
      </View>

      <View style={stepStyles.reviewSection}>
        <Text style={stepStyles.reviewLabel}>Category</Text>
        <Text style={stepStyles.reviewValue}>{state.category || '—'}</Text>
      </View>

      <View style={stepStyles.reviewSection}>
        <Text style={stepStyles.reviewLabel}>Rates</Text>
        {state.price_daily ? (
          <Text style={stepStyles.reviewMono}>₦{parseInt(state.price_daily).toLocaleString()} / day</Text>
        ) : null}
        {state.price_weekly ? (
          <Text style={stepStyles.reviewMono}>₦{parseInt(state.price_weekly).toLocaleString()} / week</Text>
        ) : null}
        {state.price_monthly ? (
          <Text style={stepStyles.reviewMono}>₦{parseInt(state.price_monthly).toLocaleString()} / month</Text>
        ) : null}
        {!state.price_daily && !state.price_weekly && !state.price_monthly && (
          <Text style={stepStyles.reviewValue}>No rates set</Text>
        )}
      </View>

      <View style={stepStyles.reviewSection}>
        <Text style={stepStyles.reviewLabel}>Location</Text>
        <Text style={stepStyles.reviewValue}>
          {state.location_address || '—'}, {state.location_city || '—'}
        </Text>
      </View>

      <View style={stepStyles.reviewSection}>
        <Text style={stepStyles.reviewLabel}>Description</Text>
        <Text style={stepStyles.reviewValue}>{state.description || '—'}</Text>
      </View>

      {specs.length > 0 && (
        <View style={stepStyles.reviewSection}>
          <Text style={stepStyles.reviewLabel}>Specs</Text>
          {specs.map((s, i) => (
            <Text key={i} style={stepStyles.reviewMono}>
              {s.key}: {s.value}
            </Text>
          ))}
        </View>
      )}

      <View style={stepStyles.reviewSection}>
        <Text style={stepStyles.reviewLabel}>Photos</Text>
        <Text style={stepStyles.reviewValue}>{state.photos.length} photo(s)</Text>
      </View>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: spacing.lg,
  },
  title: {
    ...typeScale.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typeScale.body2,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    ...typeScale.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    marginTop: spacing.base,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  typeCardSelected: {
    borderColor: colors.forge,
    backgroundColor: colors.bgTintedAccent,
  },
  typeLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  typeLabelSelected: {
    color: colors.forge,
  },
  priceRow: {
    marginBottom: spacing.md,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.default,
  },
  currencyPrefix: {
    fontFamily: fontFamilies.mono,
    fontSize: 15,
    color: colors.textTertiary,
    paddingLeft: spacing.md,
  },
  priceField: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 15,
  },
  coordRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coordField: {
    flex: 1,
  },
  specRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  specKey: {
    flex: 2,
  },
  specValue: {
    flex: 3,
  },
  specRemove: {
    padding: spacing.sm,
  },
  addSpec: {
    ...typeScale.body2,
    color: colors.forge,
    marginTop: spacing.xs,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoWrap: {
    width: 100,
    height: 100,
    borderRadius: radii.card,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.forge,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  primaryText: {
    fontFamily: fontFamilies.mono,
    fontSize: 8,
    color: colors.textOnAccent,
    letterSpacing: 0.5,
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 3,
  },
  photoGrip: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  photoAdd: {
    width: 100,
    height: 100,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: {
    ...typeScale.caption,
    color: colors.textTertiary,
    fontSize: 9,
  },
  reviewSection: {
    marginBottom: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewLabel: {
    ...typeScale.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  reviewValue: {
    ...typeScale.body1,
    color: colors.textPrimary,
  },
  reviewMono: {
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
});

// ── Main Component ────────────────────────────────────────────────

export default function ListingWizardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const editListingId = route.params?.listingId;

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isSaving, setIsSaving] = useState(false);

  const onChange = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Mutations ───────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (draft: boolean) => {
      const specsObj: Record<string, string> = {};
      state.specs
        .filter((s) => s.key.trim() && s.value.trim())
        .forEach((s) => {
          specsObj[s.key.trim()] = s.value.trim();
        });

      const payload: Record<string, any> = {
        resource_type: state.resource_type,
        title: state.title,
        category: state.category,
        description: state.description,
        specs: specsObj,
        location_address: state.location_address,
        location_city: state.location_city,
      };

      if (state.price_daily) payload.price_daily = state.price_daily;
      if (state.price_weekly) payload.price_weekly = state.price_weekly;
      if (state.price_monthly) payload.price_monthly = state.price_monthly;
      if (state.latitude) payload.latitude = parseFloat(state.latitude);
      if (state.longitude) payload.longitude = parseFloat(state.longitude);

      let listingId = editListingId;

      if (editListingId) {
        await apiClient.put(`/listings/${editListingId}/`, payload);
      } else {
        const { data } = await apiClient.post('/listings/', payload);
        listingId = data.data?.id ?? data.id;
      }

      // Upload photos
      for (let i = 0; i < state.photos.length; i++) {
        const photo = state.photos[i];
        if (photo.isLocal) {
          const formData = new FormData();
          const filename = photo.uri.split('/').pop() ?? 'photo.jpg';
          formData.append('file', {
            uri: photo.uri,
            name: filename,
            type: 'image/jpeg',
          } as any);
          formData.append('is_primary', i === 0 ? 'true' : 'false');
          formData.append('display_order', String(i));

          await apiClient.post(`/listings/${listingId}/media/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      // Publish or keep as draft
      if (!draft) {
        await apiClient.patch(`/listings/${listingId}/status/`, {
          status: 'active',
        });
      }

      return listingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      navigation.goBack();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.errors ??
        'Failed to save listing.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const saveDraft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createMutation.mutate(true);
  };

  const publish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createMutation.mutate(false);
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return !!(state.resource_type && state.title.trim());
      case 1:
        return !!(state.price_daily || state.price_weekly || state.price_monthly);
      case 2:
        return !!(state.location_address.trim() && state.location_city.trim());
      case 3:
        return !!state.description.trim();
      case 4:
        return true; // photos optional
      case 5:
        return true; // review
      default:
        return false;
    }
  };

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepResourceType state={state} onChange={onChange} />;
      case 1:
        return <StepPricing state={state} onChange={onChange} />;
      case 2:
        return <StepLocation state={state} onChange={onChange} />;
      case 3:
        return <StepDetails state={state} onChange={onChange} />;
      case 4:
        return <StepPhotos state={state} onChange={onChange} />;
      case 5:
        return <StepReview state={state} />;
      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;
  const isSubmitting = createMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={goBack} style={styles.backButton}>
            <IconArrowLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.topTitle}>
            {editListingId ? 'Edit listing' : 'New listing'}
          </Text>
          <Pressable onPress={saveDraft} disabled={isSubmitting}>
            <Text
              style={[
                styles.draftLink,
                isSubmitting && { opacity: 0.4 },
              ]}
            >
              Save draft
            </Text>
          </Pressable>
        </View>

        {/* Progress */}
        <ProgressIndicator current={step} total={TOTAL_STEPS} />

        {/* Step content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>

        {/* Bottom buttons */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {isLastStep ? (
            <View style={styles.bottomRow}>
              <Button
                label="Save as draft"
                onPress={saveDraft}
                variant="secondary"
                disabled={isSubmitting}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                label={isSubmitting ? 'Publishing...' : 'Publish'}
                onPress={publish}
                variant="primary"
                disabled={isSubmitting}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <Button
              label="Continue"
              onPress={goNext}
              variant="primary"
              disabled={!canProceed()}
            />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  topTitle: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  draftLink: {
    ...typeScale.body2,
    color: colors.forge,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  bottomBar: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.abyss,
  },
  bottomRow: {
    flexDirection: 'row',
  },
});
```

---

## Step 5: Create the Profile screen (`src/screens/shared/ProfileScreen.tsx`)

Shared between renter and owner roles. Includes avatar, role toggle, verification status, KYC upload, settings, and app info.

**File: `src/screens/shared/ProfileScreen.tsx`**

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  IconCheck,
  IconClock,
  IconUpload,
  IconChevronRight,
  IconLogout,
} from '@tabler/icons-react-native';

import { colors, typeScale, spacing, fontFamilies, screenPadding, radii } from '../../theme';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import apiClient from '../../api/client';
import { API_BASE_URL } from '../../utils/constants';

// ── Verification Card ─────────────────────────────────────────────

function VerificationRow({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  return (
    <View style={verifyStyles.row}>
      <View style={verifyStyles.left}>
        {verified ? (
          <IconCheck size={16} color={colors.clear} />
        ) : (
          <IconClock size={16} color={colors.textTertiary} />
        )}
        <Text
          style={[
            verifyStyles.label,
            verified && verifyStyles.labelVerified,
          ]}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          verifyStyles.status,
          { color: verified ? colors.clear : colors.textTertiary },
        ]}
      >
        {verified ? 'Verified' : 'Pending'}
      </Text>
    </View>
  );
}

const verifyStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typeScale.body1,
    color: colors.textSecondary,
  },
  labelVerified: {
    color: colors.textPrimary,
  },
  status: {
    ...typeScale.mono2,
  },
});

// ── Main Component ────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const activeRole = useAppStore((s) => s.activeRole);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const queryClient = useQueryClient();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`;
  const isOwner = activeRole === 'owner';

  // ── Role toggle ──────────────────────────────────────────────

  const roleMutation = useMutation({
    mutationFn: async (wantOwner: boolean) => {
      const { data } = await apiClient.patch('/users/me/role/', {
        is_owner: wantOwner,
        is_renter: true,
      });
      return data;
    },
    onSuccess: (data, wantOwner) => {
      if (data.data) setUser(data.data);
      setActiveRole(wantOwner ? 'owner' : 'renter');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      Alert.alert(
        'Error',
        err?.response?.data?.message ?? 'Could not update role.',
      );
    },
  });

  const handleRoleToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    roleMutation.mutate(value);
  };

  // ── KYC upload ───────────────────────────────────────────────

  const kycMutation = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled || result.assets.length === 0) {
        throw new Error('cancelled');
      }

      const asset = result.assets[0];
      const formData = new FormData();
      const filename = asset.uri.split('/').pop() ?? 'document.jpg';
      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type: 'image/jpeg',
      } as any);
      formData.append('document_type', 'id_card');

      const { data } = await apiClient.post('/users/me/documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      Alert.alert('Document uploaded', 'Your document has been submitted for verification.');
    },
    onError: (err: any) => {
      if (err.message === 'cancelled') return;
      Alert.alert(
        'Upload failed',
        err?.response?.data?.message ?? 'Could not upload document.',
      );
    },
  });

  // ── Change password ──────────────────────────────────────────

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/auth/password/change/', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      return data;
    },
    onSuccess: () => {
      Alert.alert('Password changed', 'Your password has been updated.');
      setOldPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
    },
    onError: (err: any) => {
      Alert.alert(
        'Error',
        err?.response?.data?.message ?? 'Could not change password.',
      );
    },
  });

  // ── Logout ───────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post('/auth/logout/');
          } catch {
            // proceed even if server call fails
          }
          await clearAuth();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.scroll}
      >
        {/* Avatar & Name */}
        <View style={styles.avatarSection}>
          <Avatar
            uri={user.profile_photo}
            name={fullName}
            size="lg"
          />
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Role toggle */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>I am an owner</Text>
            <Switch
              value={isOwner}
              onValueChange={handleRoleToggle}
              trackColor={{ false: colors.surfaceHigh, true: colors.forgeDim }}
              thumbColor={isOwner ? colors.forge : colors.textTertiary}
              disabled={roleMutation.isPending}
            />
          </View>
          <Text style={styles.toggleHint}>
            {isOwner
              ? 'You can list assets and manage bookings as an owner.'
              : 'Switch to owner mode to list your assets.'}
          </Text>
        </View>

        {/* Verification */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification</Text>
          <VerificationRow label="Phone" verified={user.is_phone_verified} />
          <VerificationRow label="Email" verified={user.is_email_verified} />
          <VerificationRow label="ID document" verified={user.is_id_verified} />

          {!user.is_id_verified && (
            <Pressable
              style={styles.kycButton}
              onPress={() => kycMutation.mutate()}
              disabled={kycMutation.isPending}
            >
              <IconUpload size={16} color={colors.forge} />
              <Text style={styles.kycButtonText}>
                {kycMutation.isPending ? 'Uploading...' : 'Upload ID document'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>

          <Pressable
            style={styles.settingsRow}
            onPress={() => setShowPasswordForm(!showPasswordForm)}
          >
            <Text style={styles.settingsLabel}>Change password</Text>
            <IconChevronRight size={16} color={colors.textTertiary} />
          </Pressable>

          {showPasswordForm && (
            <View style={styles.passwordForm}>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Button
                label={passwordMutation.isPending ? 'Saving...' : 'Update password'}
                onPress={() => passwordMutation.mutate()}
                variant="primary"
                disabled={
                  !oldPassword || !newPassword || passwordMutation.isPending
                }
              />
            </View>
          )}

          <Pressable style={styles.settingsRow} onPress={handleLogout}>
            <View style={styles.logoutRow}>
              <IconLogout size={16} color={colors.alert} />
              <Text style={styles.logoutText}>Log out</Text>
            </View>
          </Pressable>
        </View>

        {/* App info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>Terminal Mobile v1.0.0</Text>
          <Text style={styles.infoText}>{API_BASE_URL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  scroll: {
    paddingBottom: 120,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  name: {
    ...typeScale.h1,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  email: {
    ...typeScale.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    marginHorizontal: screenPadding.horizontal,
    marginBottom: spacing.base,
    padding: spacing.base,
  },
  cardTitle: {
    ...typeScale.h3,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    ...typeScale.body1,
    color: colors.textPrimary,
  },
  toggleHint: {
    ...typeScale.body2,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  kycButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.forge,
    borderRadius: radii.default,
    alignSelf: 'flex-start',
  },
  kycButtonText: {
    ...typeScale.body2,
    color: colors.forge,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsLabel: {
    ...typeScale.body1,
    color: colors.textPrimary,
  },
  passwordForm: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: 15,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoutText: {
    ...typeScale.body1,
    color: colors.alert,
  },
  infoSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  infoText: {
    ...typeScale.mono3,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});
```

---

## Step 6: Create the Owner Tabs navigator (`src/navigation/OwnerTabs.tsx`)

**File: `src/navigation/OwnerTabs.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconBuildingWarehouse,
  IconCalendar,
  IconMessage,
  IconUser,
} from '@tabler/icons-react-native';

import OwnerDashboardScreen from '../screens/owner/OwnerDashboardScreen';
import BookingsScreen from '../screens/shared/BookingsScreen';
import ThreadListScreen from '../screens/shared/ThreadListScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import { colors, typeScale, spacing, fontFamilies } from '../theme';

const Tab = createBottomTabNavigator();

function TabBarIcon({
  Icon,
  focused,
  label,
}: {
  Icon: any;
  focused: boolean;
  label: string;
}) {
  return (
    <View style={tabIconStyles.container}>
      {focused && <View style={tabIconStyles.indicator} />}
      <Icon
        size={22}
        color={focused ? colors.forge : colors.textTertiary}
        style={{ marginTop: focused ? 0 : 2 }}
      />
      <Text
        style={[
          tabIconStyles.label,
          { color: focused ? colors.forge : colors.textTertiary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  indicator: {
    width: 24,
    height: 2,
    backgroundColor: colors.forge,
    borderRadius: 1,
    position: 'absolute',
    top: -6,
  },
  label: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.3,
  },
});

export function OwnerTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 72 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.forge,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={OwnerDashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              Icon={IconBuildingWarehouse}
              focused={focused}
              label="Listings"
            />
          ),
        }}
      />
      <Tab.Screen
        name="OwnerBookings"
        component={BookingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              Icon={IconCalendar}
              focused={focused}
              label="Bookings"
            />
          ),
        }}
      />
      <Tab.Screen
        name="OwnerMessages"
        component={ThreadListScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              Icon={IconMessage}
              focused={focused}
              label="Messages"
            />
          ),
        }}
      />
      <Tab.Screen
        name="OwnerProfile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              Icon={IconUser}
              focused={focused}
              label="Profile"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
```

---

## Step 7: Update the Root Navigator for role switching

**Update `src/navigation/RootNavigator.tsx`** — Replace the existing content to support switching between renter and owner tab navigators based on the active role from `appStore`.

```tsx
import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { AuthNavigator } from './AuthNavigator';
import { RenterTabs } from './RenterTabs';
import { OwnerTabs } from './OwnerTabs';
import ListingWizardScreen from '../screens/owner/ListingWizardScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeRole = useAppStore((s) => s.activeRole);
  const hydrateRole = useAppStore((s) => s.hydrateRole);

  useEffect(() => {
    hydrateRole();
  }, []);

  const MainTabs = activeRole === 'owner' ? OwnerTabs : RenterTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="ListingWizard"
            component={ListingWizardScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
```

---

## Step 8: Add API modules for owner endpoints

### 8a: Update listings API (`src/api/listings.ts`)

```typescript
import apiClient from './client';
import type { Listing, ApiResponse, PaginatedResponse } from './types';

export async function getMyListings(): Promise<Listing[]> {
  const { data } = await apiClient.get<PaginatedResponse<Listing>>('/listings/', {
    params: { own: true },
  });
  return data.data;
}

export async function createListing(payload: Record<string, any>): Promise<Listing> {
  const { data } = await apiClient.post<ApiResponse<Listing>>('/listings/', payload);
  return data.data!;
}

export async function updateListing(
  id: string,
  payload: Record<string, any>,
): Promise<Listing> {
  const { data } = await apiClient.put<ApiResponse<Listing>>(`/listings/${id}/`, payload);
  return data.data!;
}

export async function patchListing(
  id: string,
  payload: Record<string, any>,
): Promise<Listing> {
  const { data } = await apiClient.patch<ApiResponse<Listing>>(`/listings/${id}/`, payload);
  return data.data!;
}

export async function changeListingStatus(
  id: string,
  status: 'active' | 'paused' | 'archived',
): Promise<void> {
  await apiClient.patch(`/listings/${id}/status/`, { status });
}

export async function uploadListingMedia(
  listingId: string,
  file: { uri: string; name: string; type: string },
  isPrimary: boolean,
  displayOrder: number,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file as any);
  formData.append('is_primary', isPrimary ? 'true' : 'false');
  formData.append('display_order', String(displayOrder));

  await apiClient.post(`/listings/${listingId}/media/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function deleteListingMedia(
  listingId: string,
  mediaId: string,
): Promise<void> {
  await apiClient.delete(`/listings/${listingId}/media/${mediaId}/`);
}
```

### 8b: Update users API (`src/api/users.ts`)

```typescript
import apiClient from './client';
import type { User, ApiResponse } from './types';

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>('/users/me/');
  return data.data!;
}

export async function updateMe(payload: Record<string, any>): Promise<User> {
  const { data } = await apiClient.put<ApiResponse<User>>('/users/me/', payload);
  return data.data!;
}

export async function patchMe(payload: Record<string, any>): Promise<User> {
  const { data } = await apiClient.patch<ApiResponse<User>>('/users/me/', payload);
  return data.data!;
}

export async function updateRole(payload: {
  is_owner?: boolean;
  is_renter?: boolean;
}): Promise<User> {
  const { data } = await apiClient.patch<ApiResponse<User>>('/users/me/role/', payload);
  return data.data!;
}

export async function uploadDocument(
  file: { uri: string; name: string; type: string },
  documentType: string,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file as any);
  formData.append('document_type', documentType);

  await apiClient.post('/users/me/documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
```

---

## Step 9: Apply polish — Loading states, error states, pull-to-refresh

Apply the following patterns to all existing list screens from Waves 02–03. Each pattern below shows the standard approach — apply it consistently.

### 9a: Standard loading/error/empty pattern for list screens

Every list screen (MapScreen, BookingsScreen, ThreadListScreen) must follow this pattern:

```tsx
// At the top of the component
const { data, isLoading, isError, refetch, isRefetching } = useQuery({ ... });

// Loading state
if (isLoading) {
  return (
    <View style={styles.container}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

// Error state
if (isError) {
  return (
    <View style={styles.container}>
      <EmptyState
        message="Couldn't reach the server. Tap to retry."
        actionLabel="Retry"
        onAction={refetch}
      />
    </View>
  );
}

// Empty state (when data array is empty)
if (data && data.length === 0) {
  return (
    <View style={styles.container}>
      <EmptyState
        message="No bookings yet."  // Adjust per screen
        actionLabel="Search listings"  // Adjust per screen
        onAction={() => navigation.navigate('Search')}  // Adjust per screen
      />
    </View>
  );
}
```

### 9b: Pull-to-refresh on all list ScrollViews/FlatLists

Add `RefreshControl` to every scrollable list:

```tsx
import { RefreshControl } from 'react-native';

<FlatList
  // or ScrollView
  refreshControl={
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor={colors.forge}
      colors={[colors.forge]}
      progressBackgroundColor={colors.surface}
    />
  }
/>
```

Apply to: `BookingsScreen`, `ThreadListScreen`, `MapScreen` (if using a list view), `OwnerDashboardScreen` (already done).

### 9c: Empty state messages (imperative command tone)

Use these exact messages per screen — imperative command, no emoji, no exclamation marks beyond the period:

| Screen | Message | CTA Label |
|--------|---------|-----------|
| BookingsScreen | `No bookings yet.` | `Search listings` |
| ThreadListScreen | `Start a conversation.` | `View bookings` |
| MapScreen (no results) | `No listings in this area.` | `Expand search` |
| OwnerDashboardScreen (no requests) | `No pending requests.` | — |
| OwnerDashboardScreen (no fleet) | `List your first asset.` | `Create listing` |

---

## Step 10: Apply polish — Tap animations and haptic feedback

### 10a: Create a `useTapAnimation` hook

**File: `src/hooks/useTapAnimation.ts`**

```typescript
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export function useTapAnimation() {
  const scale = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!reduceMotion) {
      scale.value = withTiming(0.97, { duration: 80 });
    }
  };

  const onPressOut = () => {
    if (!reduceMotion) {
      scale.value = withTiming(1, { duration: 80 });
    }
  };

  return { animatedStyle, onPressIn, onPressOut };
}
```

### 10b: Apply to all interactive cards

Update `ListingCard.tsx`, `BookingRow.tsx`, and all `Card`-based pressable elements. Wrap the card content in `Animated.View` with the tap animation:

```tsx
import Animated from 'react-native-reanimated';
import { useTapAnimation } from '../hooks/useTapAnimation';

// Inside the component:
const { animatedStyle, onPressIn, onPressOut } = useTapAnimation();

<Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
  <Animated.View style={[cardStyle, animatedStyle]}>
    {/* card content */}
  </Animated.View>
</Pressable>
```

### 10c: Apply haptic feedback to all primary buttons

Update `src/components/Button.tsx` to include haptic feedback on press:

```tsx
import * as Haptics from 'expo-haptics';

// In the Button component's onPress handler:
const handlePress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  onPress?.();
};
```

---

## Step 11: Apply polish — Keyboard avoidance

Wrap every screen that contains a `TextInput` in a `KeyboardAvoidingView`:

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  {/* screen content */}
</KeyboardAvoidingView>
```

Apply to:
- `LoginScreen.tsx`
- `RegisterScreen.tsx`
- `VerifyPhoneScreen.tsx`
- `RequestBookingScreen.tsx`
- `ThreadScreen.tsx`
- `ListingWizardScreen.tsx` (already done)
- `ProfileScreen.tsx` (already done)

---

## Step 12: Apply polish — Optimistic updates for messaging

**Update `src/screens/shared/ThreadScreen.tsx`** — when the user sends a message, insert a local copy immediately before the API call resolves.

In the message sending mutation, use React Query's optimistic update pattern:

```tsx
const sendMutation = useMutation({
  mutationFn: async (body: string) => {
    const { data } = await apiClient.post(`/threads/${threadId}/messages/`, { body });
    return data;
  },
  onMutate: async (body) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['messages', threadId] });

    // Snapshot previous data
    const previous = queryClient.getQueryData(['messages', threadId]);

    // Optimistically insert new message
    queryClient.setQueryData(['messages', threadId], (old: any) => {
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        sender: {
          id: user?.id,
          full_name: user ? `${user.first_name} ${user.last_name}` : '',
          profile_photo: user?.profile_photo ?? null,
        },
        body,
        is_read: false,
        created_at: new Date().toISOString(),
        _pending: true,
      };
      const messages = old?.data ?? old ?? [];
      return { ...old, data: [...messages, optimisticMessage] };
    });

    return { previous };
  },
  onError: (_err, _body, context) => {
    // Rollback on error
    if (context?.previous) {
      queryClient.setQueryData(['messages', threadId], context.previous);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
  },
});
```

Pending messages render with `opacity: 0.5` and a small clock icon. When the query invalidates and real data arrives, the optimistic entry is replaced.

---

## Step 13: Apply polish — Reduce motion support

Create a shared hook and apply it to all animations in the app.

**File: `src/hooks/useReduceMotion.ts`**

```typescript
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => subscription.remove();
  }, []);

  return reduceMotion;
}
```

**Rule:** When `useReduceMotion()` returns `true`, set all animation durations to `0ms`. Loading spinners (`ActivityIndicator`) are exempt — they always animate.

Apply in:
- `useTapAnimation.ts` (already done)
- `LoadingSkeleton.tsx` (already done — falls back to static opacity)
- All `withTiming` / `withSpring` calls in custom components
- `OwnerDashboardScreen.tsx` request row animation (already done)

---

## Step 14: Apply polish — Deep linking setup

**Update `app.config.ts`** — add deep linking scheme and path configuration:

```typescript
export default {
  expo: {
    name: 'Terminal',
    slug: 'terminal-mobile',
    scheme: 'terminal',
    // ... existing config
  },
};
```

**Update `App.tsx`** — add linking configuration to `NavigationContainer`:

```tsx
const linking = {
  prefixes: ['terminal://', 'https://terminal.app'],
  config: {
    screens: {
      Main: {
        screens: {
          Search: 'search',
          Bookings: 'bookings',
          Messages: 'messages',
          Profile: 'profile',
          Dashboard: 'dashboard',
        },
      },
      ListingWizard: 'listings/new',
      ListingDetail: 'listings/:listingId',
      BookingDetail: 'bookings/:bookingId',
      Thread: 'messages/:threadId',
    },
  },
};

<NavigationContainer linking={linking} theme={...}>
```

---

## Step 15: Apply polish — App icon and splash screen

### 15a: App icon

Generate an app icon for the Expo project. The icon should be:
- 1024×1024 px
- Forge orange (`#E8750A`) background
- Centered Terminal logo mark (crane/container silhouette in white/abyss)
- No rounded corners in the source file (Expo applies masking per-platform)

Save as `assets/icon.png`.

**Update `app.config.ts`:**

```typescript
icon: './assets/icon.png',
```

### 15b: Splash screen

Configure a native splash screen:
- Abyss (`#0C0C0F`) background
- Centered logo mark (forge orange, smaller than icon)

Save logo as `assets/splash-logo.png` (200×200 px).

**Update `app.config.ts`:**

```typescript
splash: {
  image: './assets/splash-logo.png',
  resizeMode: 'contain',
  backgroundColor: '#0C0C0F',
},
```

---

## Step 16: Install additional polish dependencies

```bash
npx expo install expo-haptics expo-linking
```

`expo-haptics` provides haptic feedback. `expo-linking` is needed for deep link handling.

---

## Step 17: Final integration test flows

Run each flow end-to-end. Every step must pass. If any step fails, fix before proceeding.

### Test 1: Renter registration → Map → Listing → Booking

```
1. Open app → LoginScreen is displayed on abyss background
2. Navigate to RegisterScreen
3. POST /api/v1/auth/register/ with renter fields
   → expect 201, tokens returned
4. POST /api/v1/auth/verify-phone/ with OTP from console
   → expect 200, phone verified
5. Land on MapScreen → Map renders with markers
6. Tap a map pin → Bottom sheet with listing preview
7. Navigate to ListingDetailScreen → Full listing with photos
8. Tap "Request booking" → RequestBookingScreen
9. Fill dates, duration → POST /api/v1/bookings/
   → expect 201, status=pending
10. Navigate to BookingsScreen → New booking appears with PENDING badge
```

### Test 2: Booking list → Filter by status

```
1. BookingsScreen displays list with pull-to-refresh
2. Filter by "pending" → only pending bookings shown
3. Filter by "confirmed" → only confirmed bookings shown
4. Clear filter → all bookings shown
5. Empty state shows when no bookings match filter
```

### Test 3: Toggle to owner → Dashboard → Accept booking

```
1. Navigate to ProfileScreen
2. Toggle "I am an owner" switch → ON
   → PATCH /api/v1/users/me/role/ with { is_owner: true }
   → expect 200
3. Tab navigator switches to OwnerTabs
   → Listings, Bookings, Messages, Profile tabs visible
4. OwnerDashboardScreen renders:
   - Header: user name (caption), "Yard overview" (h1), bell with badge
   - KPI grid: 4 cards with mono font values
   - Pending requests list (if any)
   - Fleet list with status dots
5. Tap a pending request → Navigate to booking detail
6. Accept booking request
   → PATCH /api/v1/bookings/{id}/accept/
   → expect status=confirmed
```

### Test 4: Create listing → Upload photos → Publish

```
1. Navigate to ListingWizardScreen (tap + button or "Create listing" CTA)
2. Step 1: Select "Equipment", enter title "Test Crane", category "Mobile Crane"
   → Continue enabled
3. Step 2: Enter daily rate "85000"
   → ₦ prefix shown, mono font, Continue enabled
4. Step 3: Enter address "14 Marina Rd", city "Lagos"
   → Continue enabled
5. Step 4: Enter description, add spec "Tonnage: 50"
   → Continue enabled
6. Step 5: Pick a photo from library
   → Photo appears with PRIMARY badge on first
7. Step 6: Review screen shows all entered data
8. Tap "Publish"
   → POST /api/v1/listings/ → expect 201
   → POST /api/v1/listings/{id}/media/ → expect 201
   → PATCH /api/v1/listings/{id}/status/ { status: "active" } → expect 200
9. Navigate back to dashboard → new listing in fleet list
10. Verify: "Save as draft" at step 3 → listing created with status=draft
```

### Test 5: Messaging → Send → Optimistic update

```
1. Navigate to ThreadListScreen → List of threads
2. Tap a thread → ThreadScreen with messages
3. Type a message → Tap send
   → Message appears immediately (optimistic, 50% opacity)
   → POST /api/v1/threads/{id}/messages/
   → On success: opacity becomes 100%
4. Pull-to-refresh → messages refetch
5. Console shows [DEV ABLY] output (if no Ably key configured)
```

### Test 6: Change password → Logout → Login

```
1. Navigate to ProfileScreen
2. Tap "Change password"
   → Password form expands
3. Enter current and new password
   → POST /api/v1/auth/password/change/
   → expect 200, success alert
4. Tap "Log out"
   → Confirmation dialog appears
   → Tap "Log out"
   → POST /api/v1/auth/logout/
   → Auth state cleared, navigates to LoginScreen
5. Login with new password
   → POST /api/v1/auth/login/
   → expect 200, lands on main tabs
```

### Test 7: Polish verification

```
1. Loading states: Navigate to BookingsScreen, ThreadListScreen, OwnerDashboardScreen
   → Skeleton shimmers appear during data fetch (1.5s loop)
2. Error states: Disable network, navigate to any list
   → "Couldn't reach the server. Tap to retry." with Retry button
   → Tap Retry → refetch fires
3. Empty states: View empty BookingsScreen, ThreadListScreen
   → Imperative message shown with CTA button
4. Pull-to-refresh: Pull down on any list → refresh indicator in forge orange
5. Tap animation: Tap a listing card → scales to 0.97 over 80ms, returns on release
6. Haptic feedback: Tap primary button → light haptic feedback
7. Keyboard avoidance: Open LoginScreen in iOS → tap input → keyboard pushes content up
8. Tab bar: 72px + safe area height, surface bg, 1px border-top, active = forge + 2px top bar
9. Reduce motion: Enable "Reduce Motion" in OS settings
   → Skeleton becomes static
   → Tap animation becomes instant (0ms)
   → Loading spinner still animates
```

---

## Step 18: Final commit

```bash
git add .
git commit -m "feat: Wave 04 — Owner flows, role switching, and app-wide polish"
```

---

## Definition of Done

All items must pass before this wave is considered complete.

**Owner Dashboard:**
- [ ] OwnerDashboardScreen renders with KPI grid (2×2), mono font values at 22px
- [ ] Pending requests section shows count, "View all" link in forge color
- [ ] New requests have 3px forge left border accent
- [ ] Request rows show name, asset, dates (mono), amount (mono, forge-light), time ago (mono)
- [ ] Fleet section shows assets with status dots: forge=active/out, green=available, amber=maintenance
- [ ] Pull-to-refresh works with forge-orange indicator
- [ ] Error state shows retry button; empty state shows imperative message

**Listing Wizard:**
- [ ] 6-step wizard with progress indicator matching booking flow style
- [ ] Step 1: Resource type selector (5 options with icons), title, category
- [ ] Step 2: Pricing with ₦ prefix, mono font inputs for daily/weekly/monthly
- [ ] Step 3: Location address and city inputs, latitude/longitude fields
- [ ] Step 4: Description textarea, key-value spec pairs with add/remove
- [ ] Step 5: Photo picker, first photo marked PRIMARY, remove button works
- [ ] Step 6: Review shows all data, dual action buttons (Save draft / Publish)
- [ ] "Save as draft" link works at any step (saves with status=draft)
- [ ] Publish creates listing → uploads photos → sets status=active
- [ ] API calls: POST `/api/v1/listings/`, POST `.../media/`, PATCH `.../status/`

**Profile Screen:**
- [ ] Avatar (large, initials fallback if no photo), name, email displayed
- [ ] "I am an owner" toggle switches role via PATCH `/api/v1/users/me/role/`
- [ ] Role toggle switches tab navigator between RenterTabs and OwnerTabs
- [ ] Role preference persisted via AsyncStorage
- [ ] Verification status cards: phone ✓, email ✓, ID status
- [ ] KYC document upload button (multipart POST `/api/v1/users/me/documents/`)
- [ ] Change password form: POST `/api/v1/auth/password/change/`
- [ ] Logout: confirmation dialog → POST `/api/v1/auth/logout/` → clear auth → LoginScreen
- [ ] App info section: version, API endpoint

**Role Switching:**
- [ ] When `activeRole` toggles to `owner`, tabs switch to: Listings, Bookings, Messages, Profile
- [ ] When `activeRole` toggles to `renter`, tabs switch to: Search, Bookings, Messages, Profile
- [ ] Owner tabs use icons: Building, Calendar, Message, User
- [ ] Renter tabs use icons: Map, Calendar, Message, User
- [ ] Active tab: forge color text/icon + 2px top indicator bar
- [ ] Tab bar: 72px height + safe area inset, surface background, 1px border-top

**Loading States:**
- [ ] Skeleton shimmer: gradient surface → surface-high → surface, 1.5s loop
- [ ] Applied to: BookingsScreen, ThreadListScreen, OwnerDashboardScreen, MapScreen (if list mode)

**Error States:**
- [ ] Error message: "Couldn't reach the server. Tap to retry."
- [ ] Retry button fires refetch
- [ ] Applied to all list screens

**Empty States:**
- [ ] Imperative command tone (no emoji, no exclamation)
- [ ] Primary CTA button where applicable
- [ ] BookingsScreen: "No bookings yet." / "Search listings"
- [ ] ThreadListScreen: "Start a conversation." / "View bookings"
- [ ] MapScreen: "No listings in this area." / "Expand search"

**Pull-to-Refresh:**
- [ ] Applied to BookingsScreen, ThreadListScreen, OwnerDashboardScreen
- [ ] Uses forge-orange tint color

**Optimistic Updates:**
- [ ] Message sending shows immediately with pending indicator (opacity 0.5)
- [ ] On API success: message becomes fully opaque
- [ ] On API error: message is rolled back

**Haptic Feedback:**
- [ ] Light haptic on all primary and secondary button presses
- [ ] Light haptic on card taps and resource type selection

**Tap Animation:**
- [ ] Scale to 0.97 over 80ms on press-in, return to 1.0 on release
- [ ] Applied to: ListingCard, BookingRow, RequestRow, all tappable cards

**Keyboard Avoidance:**
- [ ] `KeyboardAvoidingView` wraps: LoginScreen, RegisterScreen, VerifyPhoneScreen, RequestBookingScreen, ThreadScreen, ListingWizardScreen, ProfileScreen

**Deep Linking:**
- [ ] `terminal://` scheme configured in `app.config.ts`
- [ ] Routes configured: listings/:id, bookings/:id, messages/:threadId

**App Icon & Splash:**
- [ ] App icon: forge orange square with terminal logo mark
- [ ] Splash: abyss background, centered logo mark

**Reduce Motion:**
- [ ] When OS prefers reduced motion, all animations → 0ms
- [ ] Loading spinner (`ActivityIndicator`) exempt — always animates

**Voice & Design Consistency:**
- [ ] Dispatch tone maintained — no "Yay!", no emoji, no "We'd love to"
- [ ] All KPI values in mono font, 22px
- [ ] Borders not shadows throughout
- [ ] All colors match Forge Dark tokens exactly

**Integration Tests:**
- [ ] Test 1: Register → Verify → Map → Listing → Booking ✓
- [ ] Test 2: Bookings list → Filter by status ✓
- [ ] Test 3: Toggle to owner → Dashboard → Accept booking ✓
- [ ] Test 4: Create listing → Photos → Publish ✓
- [ ] Test 5: Send message → Optimistic update ✓
- [ ] Test 6: Change password → Logout → Login ✓
- [ ] Test 7: Polish verification (skeletons, errors, empty, pull-to-refresh, haptics, tap anim, keyboard, tab bar, reduce motion) ✓

**Git:**
- [ ] Commit made with message `feat: Wave 04 — Owner flows, role switching, and app-wide polish`

---

## Files Created in This Wave

| File | Purpose |
|------|---------|
| `src/store/appStore.ts` | Role preference, booking filters, search filters |
| `src/components/Avatar.tsx` | Avatar with image or initials fallback |
| `src/components/EmptyState.tsx` | Imperative empty state with optional CTA |
| `src/components/LoadingSkeleton.tsx` | Skeleton shimmer with reduce-motion support |
| `src/screens/owner/OwnerDashboardScreen.tsx` | Owner home: KPIs, requests, fleet |
| `src/screens/owner/ListingWizardScreen.tsx` | 6-step listing creation/edit wizard |
| `src/screens/shared/ProfileScreen.tsx` | Profile, role toggle, verification, settings |
| `src/navigation/OwnerTabs.tsx` | Owner tab navigator (Listings, Bookings, Messages, Profile) |
| `src/hooks/useTapAnimation.ts` | Shared tap scale + haptic hook |
| `src/hooks/useReduceMotion.ts` | OS reduce-motion preference hook |
| `src/api/listings.ts` | Listing CRUD + media API functions |
| `src/api/users.ts` | User profile + role + KYC API functions |

## Files Modified in This Wave

| File | Changes |
|------|---------|
| `src/navigation/RootNavigator.tsx` | Role-based tab switching, ListingWizard modal |
| `src/components/index.ts` | Export Avatar, EmptyState, LoadingSkeleton |
| `src/components/Button.tsx` | Add haptic feedback on press |
| `src/components/ListingCard.tsx` | Add tap animation |
| `src/components/BookingRow.tsx` | Add tap animation |
| `src/screens/auth/LoginScreen.tsx` | Wrap in KeyboardAvoidingView |
| `src/screens/auth/RegisterScreen.tsx` | Wrap in KeyboardAvoidingView |
| `src/screens/auth/VerifyPhoneScreen.tsx` | Wrap in KeyboardAvoidingView |
| `src/screens/renter/RequestBookingScreen.tsx` | Wrap in KeyboardAvoidingView |
| `src/screens/shared/BookingsScreen.tsx` | Add loading/error/empty states, pull-to-refresh |
| `src/screens/shared/ThreadListScreen.tsx` | Add loading/error/empty states, pull-to-refresh |
| `src/screens/shared/ThreadScreen.tsx` | Optimistic message sending, KeyboardAvoidingView |
| `App.tsx` | Add deep linking config, hydrate role on mount |
| `app.config.ts` | Add scheme, icon, splash config |
