# TERMINAL MOBILE — WAVE 03: BOOKINGS & MESSAGING
> Agent task file. Execute every instruction in order. Do not skip steps.
> Wave 02 (Map Search + Listing Detail) must be complete before starting this wave.
> Do not proceed to Wave 04 until the Definition of Done checklist is fully complete.

---

## Context

You are building **Wave 03** of **Terminal Mobile** — a React Native (Expo) app for a heavy asset leasing marketplace targeting Africa. This wave builds the full booking request flow, the bookings list/detail screens, and the in-app messaging system with Ably real-time delivery.

After this wave, the complete Terminal core loop is functional on mobile: **find on map → view listing → request booking → owner reviews and accepts → both parties chat**.

**Backend:** Django REST API at `{API_BASE_URL}/api/v1/`. All endpoints from backend Wave 03 are live.

**Design system:** Forge Dark — `#0C0C0F` abyss, `#E8750A` forge orange, borders not shadows, dispatch voice. Read `design-system/project/README.md` and `design-system/project/SKILL.md` for the full specification.

**Reference UI kit:** `design-system/project/ui_kits/mobile_app/` — study `RequestBooking.jsx`, `BookingsScreen.jsx`, `BookingDetail.jsx`, `ThreadScreen.jsx` before writing any screen code.

**Simulation decisions (do not deviate):**
- Payment: Simulated. `PATCH /api/v1/bookings/{id}/pay/` sets `payment_status = 'simulated_paid'`. No Paystack.
- Cancellation: Either party can cancel. No penalty, no refund.
- Real-time: Use Ably with token auth. Fall back to polling every 10 seconds if Ably token is unavailable.
- Voice: Dispatch tone. "Booking confirmed for May 10–13." not "Your booking has been successfully confirmed!"

---

## Step 1: Create the bookings API module

**File: `src/api/bookings.ts`**

```typescript
import apiClient from './client';
import type { Booking, ApiResponse, PaginatedResponse } from './types';

export interface CreateBookingPayload {
  listing_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  duration_type: 'daily' | 'weekly' | 'monthly';
  renter_note?: string;
}

export interface BookingFilters {
  role?: 'renter' | 'owner' | 'both';
  status?: string;
}

export async function createBooking(payload: CreateBookingPayload) {
  const { data } = await apiClient.post<ApiResponse<Booking>>('/bookings/', payload);
  return data;
}

export async function getBookings(filters: BookingFilters = {}) {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);

  const { data } = await apiClient.get<PaginatedResponse<Booking>>(
    `/bookings/?${params.toString()}`
  );
  return data;
}

export async function getBookingDetail(bookingId: string) {
  const { data } = await apiClient.get<ApiResponse<Booking>>(`/bookings/${bookingId}/`);
  return data;
}

export async function acceptBooking(bookingId: string) {
  const { data } = await apiClient.patch<ApiResponse<Booking>>(
    `/bookings/${bookingId}/accept/`
  );
  return data;
}

export async function declineBooking(bookingId: string, reason: string = '') {
  const { data } = await apiClient.patch<ApiResponse<Booking>>(
    `/bookings/${bookingId}/decline/`,
    { reason }
  );
  return data;
}

export async function cancelBooking(bookingId: string, reason: string = '') {
  const { data } = await apiClient.patch<ApiResponse<Booking>>(
    `/bookings/${bookingId}/cancel/`,
    { reason }
  );
  return data;
}

export async function markBookingPaid(bookingId: string) {
  const { data } = await apiClient.patch<ApiResponse<Booking>>(
    `/bookings/${bookingId}/pay/`
  );
  return data;
}
```

---

## Step 2: Create the messaging API module

**File: `src/api/messaging.ts`**

```typescript
import apiClient from './client';
import type { Thread, Message, ApiResponse } from './types';

export interface CreateInquiryPayload {
  listing_id: string;
  initial_message: string;
}

export interface SendMessagePayload {
  body: string;
}

export interface ThreadDetailResponse {
  success: boolean;
  thread: Thread;
  messages: Message[];
}

export async function getThreads() {
  const { data } = await apiClient.get<{ success: boolean; data: Thread[] }>('/threads/');
  return data;
}

export async function createInquiryThread(payload: CreateInquiryPayload) {
  const { data } = await apiClient.post<ApiResponse<Thread>>('/threads/', payload);
  return data;
}

export async function getThreadDetail(threadId: string) {
  const { data } = await apiClient.get<ThreadDetailResponse>(`/threads/${threadId}/`);
  return data;
}

export async function sendMessage(threadId: string, payload: SendMessagePayload) {
  const { data } = await apiClient.post<ApiResponse<Message>>(
    `/threads/${threadId}/messages/`,
    payload
  );
  return data;
}

export async function getAblyToken() {
  const { data } = await apiClient.post<{ success: boolean; token: any }>(
    '/threads/token/'
  );
  return data;
}
```

---

## Step 3: Create the Badge component

**File: `src/components/Badge.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typeScale } from '../theme/typography';

type BadgeVariant = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.clearDim, text: colors.clearSoft },
  info: { bg: colors.signalDim, text: colors.signalSoft },
  warning: { bg: colors.amberDim, text: colors.amber },
  danger: { bg: colors.alertDim, text: colors.alertSoft },
  neutral: { bg: colors.surfaceElevated, text: colors.textSecondary },
  accent: { bg: colors.forgeDim, text: colors.forgeLight },
};

export function Badge({ label, variant = 'neutral', size = 'sm' }: BadgeProps) {
  const variantStyle = variantStyles[variant];

  return (
    <View style={[
      styles.badge,
      { backgroundColor: variantStyle.bg },
      size === 'md' && styles.badgeMd,
    ]}>
      <Text style={[
        styles.label,
        { color: variantStyle.text },
        size === 'md' && styles.labelMd,
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontFamily: typeScale.caption.fontFamily,
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    letterSpacing: typeScale.caption.letterSpacing,
    textTransform: 'uppercase',
  },
  labelMd: {
    fontSize: 13,
    lineHeight: 18,
  },
});
```

---

## Step 4: Create the BookingRow component

**File: `src/components/BookingRow.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { typeScale } from '../theme/typography';
import { spacing, radii } from '../theme/spacing';
import { Badge } from './Badge';
import { formatDateRange, formatCurrency } from '../utils/format';
import { BOOKING_STATUSES } from '../utils/constants';
import type { Booking } from '../api/types';

interface BookingRowProps {
  booking: Booking;
  onPress: (booking: Booking) => void;
}

function getStatusBadgeVariant(status: Booking['status']): string {
  return BOOKING_STATUSES[status]?.badge ?? 'neutral';
}

function getLeftBorderColor(booking: Booking): string | undefined {
  if (booking.status === 'active') return colors.clear;
  if (booking.status === 'pending') return colors.forge;
  return undefined;
}

export function BookingRow({ booking, onPress }: BookingRowProps) {
  const isCancelled = booking.status === 'cancelled';
  const leftBorder = getLeftBorderColor(booking);
  const statusConfig = BOOKING_STATUSES[booking.status];

  return (
    <Pressable
      onPress={() => onPress(booking)}
      style={({ pressed }) => [
        styles.container,
        leftBorder ? { borderLeftWidth: 3, borderLeftColor: leftBorder } : null,
        isCancelled && styles.cancelled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[styles.title, isCancelled && styles.strikethrough]}
          numberOfLines={1}
        >
          {booking.listing_title}
        </Text>
        <Badge
          label={statusConfig?.label ?? booking.status.toUpperCase()}
          variant={getStatusBadgeVariant(booking.status) as any}
        />
      </View>

      <Text style={styles.dates}>
        {formatDateRange(booking.start_date, booking.end_date)}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.amount}>
          {formatCurrency(parseFloat(booking.gross_amount))}
        </Text>

        {booking.status === 'confirmed' && booking.payment_status === 'unpaid' && (
          <View style={styles.paymentIndicator}>
            <View style={[styles.dot, { backgroundColor: colors.amber }]} />
            <Text style={styles.paymentText}>Awaiting payment</Text>
          </View>
        )}

        {booking.payment_status === 'simulated_paid' && (
          <View style={styles.paymentIndicator}>
            <Text style={styles.paidText}>✓ Paid</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceElevated,
  },
  cancelled: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typeScale.h2,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  dates: {
    ...typeScale.mono2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    ...typeScale.mono1,
    color: colors.textPrimary,
  },
  paymentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paymentText: {
    ...typeScale.mono3,
    color: colors.amber,
  },
  paidText: {
    ...typeScale.mono3,
    color: colors.clear,
  },
});
```

---

## Step 5: Build RequestBookingScreen — 3-step bottom sheet flow

**File: `src/screens/renter/RequestBookingScreen.tsx`**

This is a modal screen presented as a bottom sheet from the listing detail screen. It contains a 3-step flow with back/continue navigation, a progress bar, and a semi-transparent backdrop.

```tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  isSameDay,
  startOfDay,
  differenceInDays,
} from 'date-fns';
import { useMutation } from '@tanstack/react-query';

import { colors } from '../../theme/colors';
import { typeScale } from '../../theme/typography';
import { spacing, radii } from '../../theme/spacing';
import { formatCurrency } from '../../utils/format';
import { createBooking, type CreateBookingPayload } from '../../api/bookings';
import type { Listing } from '../../api/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DurationType = 'daily' | 'weekly' | 'monthly';

interface RouteParams {
  listing: Listing;
}

// ---------------------------------------------------------------------------
// Step 1: Calendar — "Pick your dates"
// ---------------------------------------------------------------------------

interface CalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onSelectDate: (date: Date) => void;
}

function Calendar({ startDate, endDate, onSelectDate }: CalendarProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = startOfDay(new Date());

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0 = Sunday

  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function isInRange(date: Date) {
    if (!startDate || !endDate) return false;
    return isAfter(date, startDate) && isBefore(date, endDate);
  }

  function isSelected(date: Date) {
    if (startDate && isSameDay(date, startDate)) return true;
    if (endDate && isSameDay(date, endDate)) return true;
    return false;
  }

  function isPast(date: Date) {
    return isBefore(date, today);
  }

  function isRangeStart(date: Date) {
    return startDate ? isSameDay(date, startDate) : false;
  }

  function isRangeEnd(date: Date) {
    return endDate ? isSameDay(date, endDate) : false;
  }

  return (
    <View>
      {/* Month navigation */}
      <View style={calStyles.monthNav}>
        <Pressable onPress={() => setViewDate(subMonths(viewDate, 1))}>
          <Text style={calStyles.navArrow}>‹</Text>
        </Pressable>
        <Text style={calStyles.monthLabel}>
          {format(viewDate, 'MMMM yyyy')}
        </Text>
        <Pressable onPress={() => setViewDate(addMonths(viewDate, 1))}>
          <Text style={calStyles.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Day labels */}
      <View style={calStyles.dayLabelsRow}>
        {dayLabels.map((label) => (
          <Text key={label} style={calStyles.dayLabel}>{label}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.grid}>
        {/* Empty cells for offset */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <View key={`empty-${i}`} style={calStyles.dayCell} />
        ))}

        {days.map((day) => {
          const past = isPast(day);
          const selected = isSelected(day);
          const inRange = isInRange(day);
          const rangeStart = isRangeStart(day);
          const rangeEnd = isRangeEnd(day);

          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => !past && onSelectDate(day)}
              style={[
                calStyles.dayCell,
                inRange && calStyles.inRange,
                selected && calStyles.selected,
                rangeStart && calStyles.rangeStart,
                rangeEnd && calStyles.rangeEnd,
              ]}
              disabled={past}
            >
              <Text style={[
                calStyles.dayText,
                past && calStyles.pastDay,
                selected && calStyles.selectedDayText,
                inRange && calStyles.inRangeText,
              ]}>
                {format(day, 'd')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
    paddingHorizontal: spacing.xs,
  },
  navArrow: {
    ...typeScale.h1,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
  },
  monthLabel: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  dayLabel: {
    ...typeScale.mono3,
    color: colors.textTertiary,
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    ...typeScale.mono2,
    color: colors.textPrimary,
  },
  pastDay: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  selected: {
    backgroundColor: colors.forge,
    borderRadius: 4,
  },
  rangeStart: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  rangeEnd: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  selectedDayText: {
    color: colors.textOnAccent,
    fontFamily: typeScale.mono1.fontFamily,
  },
  inRange: {
    backgroundColor: colors.forgeDim,
  },
  inRangeText: {
    color: colors.forgeLight,
  },
});

// ---------------------------------------------------------------------------
// Step 2: Duration type selector
// ---------------------------------------------------------------------------

interface DurationOption {
  type: DurationType;
  label: string;
  unitLabel: string;
  price: number | null;
  total: number | null;
  units: number;
  disabled: boolean;
}

interface DurationSelectorProps {
  options: DurationOption[];
  selected: DurationType;
  onSelect: (type: DurationType) => void;
}

function DurationSelector({ options, selected, onSelect }: DurationSelectorProps) {
  return (
    <View style={durStyles.container}>
      {options.map((opt) => {
        const isSelected = selected === opt.type;
        return (
          <Pressable
            key={opt.type}
            onPress={() => !opt.disabled && onSelect(opt.type)}
            style={[
              durStyles.card,
              isSelected && durStyles.cardSelected,
              opt.disabled && durStyles.cardDisabled,
            ]}
            disabled={opt.disabled}
          >
            <View style={durStyles.cardHeader}>
              <View style={[
                durStyles.radio,
                isSelected && durStyles.radioSelected,
              ]}>
                {isSelected && <View style={durStyles.radioInner} />}
              </View>
              <Text style={[
                durStyles.label,
                opt.disabled && durStyles.disabledText,
              ]}>
                {opt.label}
              </Text>
            </View>
            {opt.price !== null && (
              <Text style={[
                durStyles.price,
                opt.disabled && durStyles.disabledText,
              ]}>
                {formatCurrency(opt.price)} / {opt.unitLabel}
              </Text>
            )}
            {opt.total !== null && !opt.disabled && (
              <Text style={durStyles.total}>
                {formatCurrency(opt.total)} total · {opt.units} {opt.unitLabel}{opt.units !== 1 ? 's' : ''}
              </Text>
            )}
            {opt.disabled && (
              <Text style={durStyles.disabledNote}>
                Dates too short for monthly rate
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const durStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.base,
  },
  cardSelected: {
    backgroundColor: colors.forgeDim,
    borderColor: colors.forge,
  },
  cardDisabled: {
    opacity: 0.4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  radioSelected: {
    borderColor: colors.forge,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.forge,
  },
  label: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  price: {
    ...typeScale.mono2,
    color: colors.textSecondary,
    marginLeft: 28,
  },
  total: {
    ...typeScale.mono2,
    color: colors.forgeLight,
    marginLeft: 28,
    marginTop: 4,
  },
  disabledText: {
    color: colors.textTertiary,
  },
  disabledNote: {
    ...typeScale.mono3,
    color: colors.textTertiary,
    marginLeft: 28,
    marginTop: 4,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function RequestBookingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const listing = route.params.listing;

  const [step, setStep] = useState(1);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [durationType, setDurationType] = useState<DurationType>('daily');
  const [renterNote, setRenterNote] = useState('');

  // Date selection logic: first tap = start, second tap = end (must be after start)
  const handleSelectDate = useCallback((date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else if (isBefore(date, startDate) || isSameDay(date, startDate)) {
      setStartDate(date);
      setEndDate(null);
    } else {
      setEndDate(date);
    }
  }, [startDate, endDate]);

  // Calculate duration and amounts
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(endDate, startDate);
  }, [startDate, endDate]);

  const durationOptions: DurationOption[] = useMemo(() => {
    const pDaily = listing.price_daily ? parseFloat(listing.price_daily) : null;
    const pWeekly = listing.price_weekly ? parseFloat(listing.price_weekly) : null;
    const pMonthly = listing.price_monthly ? parseFloat(listing.price_monthly) : null;

    const weeks = Math.max(1, Math.floor(totalDays / 7));
    const months = Math.max(1, Math.floor(totalDays / 30));
    const monthlyDisabled = totalDays < 30;

    return [
      {
        type: 'daily' as DurationType,
        label: 'Daily',
        unitLabel: 'day',
        price: pDaily,
        total: pDaily ? pDaily * totalDays : null,
        units: totalDays,
        disabled: !pDaily,
      },
      {
        type: 'weekly' as DurationType,
        label: 'Weekly',
        unitLabel: 'week',
        price: pWeekly,
        total: pWeekly ? pWeekly * weeks : null,
        units: weeks,
        disabled: !pWeekly,
      },
      {
        type: 'monthly' as DurationType,
        label: 'Monthly',
        unitLabel: 'month',
        price: pMonthly,
        total: pMonthly && !monthlyDisabled ? pMonthly * months : null,
        units: months,
        disabled: !pMonthly || monthlyDisabled,
      },
    ];
  }, [listing, totalDays]);

  const selectedOption = durationOptions.find((o) => o.type === durationType);
  const totalAmount = selectedOption?.total ?? 0;

  // Submit booking
  const mutation = useMutation({
    mutationFn: (payload: CreateBookingPayload) => createBooking(payload),
    onSuccess: (data) => {
      if (data.success) {
        Alert.alert(
          'Request sent',
          `Booking request for ${listing.title} submitted.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.errors
        ? JSON.stringify(error.response.data.errors)
        : 'Failed to send request. Try again.';
      Alert.alert('Error', message);
    },
  });

  const handleSubmit = () => {
    if (!startDate || !endDate) return;
    mutation.mutate({
      listing_id: listing.id,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      duration_type: durationType,
      renter_note: renterNote,
    });
  };

  const canContinueStep1 = startDate && endDate;
  const canContinueStep2 = selectedOption && !selectedOption.disabled;

  // Step titles
  const stepTitles = ['Pick your dates', 'Duration', 'Review & send'];

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={() => navigation.goBack()} />

      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
          </View>
          <Text style={styles.stepCounter}>Step {step} of 3</Text>
        </View>

        {/* Title */}
        <Text style={styles.stepTitle}>{stepTitles[step - 1]}</Text>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Calendar */}
          {step === 1 && (
            <View>
              <Calendar
                startDate={startDate}
                endDate={endDate}
                onSelectDate={handleSelectDate}
              />
              {startDate && endDate && (
                <View style={styles.summaryBar}>
                  <Text style={styles.summaryText}>
                    {format(startDate, 'MMM d')} – {format(endDate, 'MMM d')} · {totalDays} day{totalDays !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Step 2: Duration selector */}
          {step === 2 && (
            <DurationSelector
              options={durationOptions}
              selected={durationType}
              onSelect={setDurationType}
            />
          )}

          {/* Step 3: Review & send */}
          {step === 3 && (
            <View>
              {/* Summary card */}
              <View style={styles.reviewCard}>
                {listing.primary_photo_url && (
                  <Image
                    source={{ uri: listing.primary_photo_url }}
                    style={styles.reviewThumb}
                  />
                )}
                <View style={styles.reviewInfo}>
                  <Text style={styles.reviewTitle} numberOfLines={2}>
                    {listing.title}
                  </Text>
                  <Text style={styles.reviewDates}>
                    {startDate && endDate
                      ? `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')} · ${totalDays} days`
                      : ''}
                  </Text>
                  <Text style={styles.reviewDuration}>
                    {durationType.charAt(0).toUpperCase() + durationType.slice(1)} rate
                  </Text>
                </View>
              </View>

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
              </View>

              {/* Optional note */}
              <Text style={styles.noteLabel}>Note for owner (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add details about your project, site, or requirements..."
                placeholderTextColor={colors.textTertiary}
                value={renterNote}
                onChangeText={setRenterNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>

        {/* Bottom navigation */}
        <View style={styles.bottomBar}>
          {step > 1 && (
            <Pressable
              style={styles.backButton}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          )}

          {step < 3 ? (
            <Pressable
              style={[
                styles.continueButton,
                step === 1 && !canContinueStep1 && styles.disabledButton,
                step === 2 && !canContinueStep2 && styles.disabledButton,
              ]}
              onPress={() => setStep(step + 1)}
              disabled={
                (step === 1 && !canContinueStep1) ||
                (step === 2 && !canContinueStep2)
              }
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.submitButton, mutation.isPending && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={styles.submitButtonText}>Send request</Text>
              )}
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: colors.abyss,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '90%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
  },
  progressContainer: {
    marginBottom: spacing.base,
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.forge,
    borderRadius: 1,
  },
  stepCounter: {
    ...typeScale.caption,
    color: colors.textTertiary,
  },
  stepTitle: {
    ...typeScale.h1,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  scrollContent: {
    flexGrow: 0,
  },
  summaryBar: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.default,
    padding: spacing.md,
    marginTop: spacing.base,
    alignItems: 'center',
  },
  summaryText: {
    ...typeScale.mono1,
    color: colors.textPrimary,
  },
  // Review step
  reviewCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  reviewThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.default,
    marginRight: spacing.md,
    backgroundColor: colors.surfaceElevated,
  },
  reviewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  reviewTitle: {
    ...typeScale.h2,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  reviewDates: {
    ...typeScale.mono2,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  reviewDuration: {
    ...typeScale.body2,
    color: colors.textTertiary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.base,
  },
  totalLabel: {
    ...typeScale.h2,
    color: colors.textSecondary,
  },
  totalAmount: {
    ...typeScale.mono1,
    fontSize: 22,
    color: colors.forge,
  },
  noteLabel: {
    ...typeScale.caption,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  noteInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.default,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typeScale.body1,
    minHeight: 80,
    marginBottom: spacing.base,
  },
  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.default,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  continueButton: {
    flex: 2,
    backgroundColor: colors.forge,
    borderRadius: radii.default,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    ...typeScale.h2,
    color: colors.textOnAccent,
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.forge,
    borderRadius: radii.default,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    ...typeScale.h2,
    color: colors.textOnAccent,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
```

---

## Step 6: Build BookingsScreen — shared list for renter and owner

**File: `src/screens/shared/BookingsScreen.tsx`**

```tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../../theme/colors';
import { typeScale } from '../../theme/typography';
import { spacing, screenPadding } from '../../theme/spacing';
import { BookingRow } from '../../components/BookingRow';
import { EmptyState } from '../../components/EmptyState';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { getBookings, type BookingFilters } from '../../api/bookings';
import { useAuthStore } from '../../store/authStore';
import type { Booking } from '../../api/types';

type FilterChip = 'all' | 'active' | 'pending' | 'past';

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'past', label: 'Past' },
];

function chipToStatusFilter(chip: FilterChip): string | undefined {
  switch (chip) {
    case 'active':
      return 'active';
    case 'pending':
      return 'pending';
    case 'past':
      return 'completed';
    default:
      return undefined;
  }
}

export function BookingsScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const [activeChip, setActiveChip] = useState<FilterChip>('all');

  const role: BookingFilters['role'] = user?.is_owner && !user?.is_renter
    ? 'owner'
    : user?.is_owner && user?.is_renter
      ? 'both'
      : 'renter';

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['bookings', role, activeChip],
    queryFn: () =>
      getBookings({
        role,
        status: chipToStatusFilter(activeChip),
      }),
  });

  const bookings = data?.data ?? [];

  const handleBookingPress = useCallback((booking: Booking) => {
    // Navigate to detail — owner sees owner detail, renter sees renter detail
    if (booking.owner.id === user?.id) {
      navigation.navigate('BookingDetail' as never, { bookingId: booking.id } as never);
    } else {
      navigation.navigate('BookingDetail' as never, { bookingId: booking.id } as never);
    }
  }, [navigation, user]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>My bookings</Text>

      {/* Filter chips */}
      <View style={styles.chipRow}>
        {FILTER_CHIPS.map((chip) => (
          <Pressable
            key={chip.key}
            style={[
              styles.chip,
              activeChip === chip.key && styles.chipActive,
            ]}
            onPress={() => setActiveChip(chip.key)}
          >
            <Text style={[
              styles.chipText,
              activeChip === chip.key && styles.chipTextActive,
            ]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Booking list */}
      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Find your first listing."
          actionLabel="Search listings"
          onAction={() => navigation.navigate('Search' as never)}
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookingRow booking={item} onPress={handleBookingPress} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.forge}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
    paddingHorizontal: screenPadding.horizontal,
  },
  heading: {
    ...typeScale.h1,
    color: colors.textPrimary,
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.forgeDim,
    borderColor: colors.forge,
  },
  chipText: {
    ...typeScale.body2,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.forgeLight,
  },
  listContent: {
    paddingBottom: spacing['3xl'],
  },
});
```

---

## Step 7: Build BookingDetailScreen — owner-side request review

**File: `src/screens/owner/BookingDetailScreen.tsx`**

```tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { colors } from '../../theme/colors';
import { typeScale } from '../../theme/typography';
import { spacing, radii, screenPadding } from '../../theme/spacing';
import { Badge } from '../../components/Badge';
import { formatCurrency } from '../../utils/format';
import { BOOKING_STATUSES } from '../../utils/constants';
import {
  getBookingDetail,
  acceptBooking,
  declineBooking,
} from '../../api/bookings';
import { useAuthStore } from '../../store/authStore';

interface RouteParams {
  bookingId: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function BookingDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { bookingId } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => getBookingDetail(bookingId),
  });

  const booking = data?.data;
  const isOwner = booking?.owner.id === user?.id;

  const acceptMutation = useMutation({
    mutationFn: () => acceptBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      Alert.alert('Accepted', 'Booking confirmed.');
    },
    onError: () => Alert.alert('Error', 'Failed to accept booking.'),
  });

  const declineMutation = useMutation({
    mutationFn: (reason: string) => declineBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      Alert.alert('Declined', 'Booking declined.');
    },
    onError: () => Alert.alert('Error', 'Failed to decline booking.'),
  });

  const handleDecline = () => {
    Alert.prompt(
      'Decline booking',
      'Optionally add a reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: (reason) => declineMutation.mutate(reason ?? ''),
        },
      ],
      'plain-text'
    );
  };

  if (isLoading || !booking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.forge} />
      </View>
    );
  }

  const statusConfig = BOOKING_STATUSES[booking.status];
  const renter = booking.renter;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header bar */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.bookingId}>Request · BK-{booking.id.slice(0, 8)}</Text>
          <Text style={styles.renterCompany}>{renter.full_name}</Text>
        </View>
        <Badge
          label={statusConfig?.label ?? booking.status.toUpperCase()}
          variant={(statusConfig?.badge ?? 'neutral') as any}
          size="md"
        />
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        {/* Asset summary card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ASSET</Text>
          <View style={styles.assetRow}>
            <View style={styles.assetInfo}>
              <Text style={styles.assetTitle}>{booking.listing_title}</Text>
            </View>
          </View>
        </View>

        {/* Schedule card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SCHEDULE</Text>
          <View style={styles.scheduleGrid}>
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleLabel}>Start</Text>
              <Text style={styles.scheduleValue}>
                {format(new Date(booking.start_date), 'MMM d, yyyy')}
              </Text>
            </View>
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleLabel}>End</Text>
              <Text style={styles.scheduleValue}>
                {format(new Date(booking.end_date), 'MMM d, yyyy')}
              </Text>
            </View>
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleLabel}>Duration</Text>
              <Text style={styles.scheduleValue}>
                {booking.duration_days} day{booking.duration_days !== 1 ? 's' : ''} ({booking.duration_type})
              </Text>
            </View>
          </View>
        </View>

        {/* Renter note */}
        {booking.renter_note ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>NOTE FROM RENTER</Text>
            <View style={styles.noteQuote}>
              <View style={styles.quoteLine} />
              <Text style={styles.noteText}>{booking.renter_note}</Text>
            </View>
          </View>
        ) : null}

        {/* Money card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>FINANCIALS</Text>

          <View style={styles.moneyRow}>
            <Text style={styles.moneyLabel}>
              {booking.duration_type === 'daily'
                ? `Rate × ${booking.duration_days} days`
                : booking.duration_type === 'weekly'
                  ? `Weekly rate`
                  : `Monthly rate`}
            </Text>
            <Text style={styles.moneyValue}>
              {formatCurrency(parseFloat(booking.gross_amount))}
            </Text>
          </View>

          <View style={styles.moneyRow}>
            <Text style={styles.moneyLabel}>Platform fee (10%)</Text>
            <Text style={styles.moneyValue}>
              −{formatCurrency(parseFloat(booking.commission_amount))}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.moneyRow}>
            <Text style={styles.payoutLabel}>Your payout</Text>
            <Text style={styles.payoutAmount}>
              {formatCurrency(parseFloat(booking.owner_payout_amount))}
            </Text>
          </View>
        </View>

        {/* Renter card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RENTER</Text>
          <View style={styles.renterRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(renter.full_name)}</Text>
            </View>
            <View style={styles.renterInfo}>
              <View style={styles.renterNameRow}>
                <Text style={styles.renterName}>{renter.full_name}</Text>
                <Text style={styles.shieldIcon}>🛡</Text>
              </View>
              <Text style={styles.renterPhone}>{renter.phone}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom — only for pending bookings and owner */}
      {booking.status === 'pending' && isOwner && (
        <View style={styles.stickyBottom}>
          <Pressable
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={declineMutation.isPending}
          >
            {declineMutation.isPending ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.declineButtonText}>Decline</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.acceptButton}
            onPress={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={styles.acceptButtonText}>Accept request</Text>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.abyss,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  backArrow: {
    ...typeScale.h1,
    color: colors.textPrimary,
  },
  headerInfo: {
    flex: 1,
  },
  bookingId: {
    ...typeScale.mono3,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  renterCompany: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  // Content
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: screenPadding.horizontal,
    paddingBottom: 120,
  },
  // Cards
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  cardLabel: {
    ...typeScale.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  // Asset
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetInfo: {
    flex: 1,
  },
  assetTitle: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  // Schedule
  scheduleGrid: {
    gap: spacing.md,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scheduleLabel: {
    ...typeScale.body2,
    color: colors.textSecondary,
  },
  scheduleValue: {
    ...typeScale.mono2,
    color: colors.textPrimary,
  },
  // Note
  noteQuote: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  quoteLine: {
    width: 3,
    backgroundColor: colors.forge,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  noteText: {
    ...typeScale.body1,
    color: colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
  // Money
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moneyLabel: {
    ...typeScale.body2,
    color: colors.textSecondary,
  },
  moneyValue: {
    ...typeScale.mono2,
    color: colors.textPrimary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  payoutLabel: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  payoutAmount: {
    ...typeScale.mono1,
    fontSize: 20,
    color: colors.forge,
  },
  // Renter
  renterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.forgeDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typeScale.h2,
    color: colors.forgeLight,
  },
  renterInfo: {
    flex: 1,
  },
  renterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  renterName: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  shieldIcon: {
    fontSize: 14,
  },
  renterPhone: {
    ...typeScale.mono3,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Sticky bottom
  stickyBottom: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.abyss,
  },
  declineButton: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.default,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineButtonText: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  acceptButton: {
    flex: 2,
    backgroundColor: colors.forge,
    borderRadius: radii.default,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptButtonText: {
    ...typeScale.h2,
    color: colors.textOnAccent,
  },
});
```

---

## Step 8: Build ThreadListScreen — Messages tab

**File: `src/screens/shared/ThreadListScreen.tsx`**

```tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';

import { colors } from '../../theme/colors';
import { typeScale } from '../../theme/typography';
import { spacing, radii, screenPadding } from '../../theme/spacing';
import { getThreads } from '../../api/messaging';
import { EmptyState } from '../../components/EmptyState';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import type { Thread } from '../../api/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface ThreadRowProps {
  thread: Thread;
  onPress: (thread: Thread) => void;
}

function ThreadRow({ thread, onPress }: ThreadRowProps) {
  const participant = thread.other_participant;
  const lastMsg = thread.last_message;
  const hasUnread = thread.unread_count > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        threadStyles.row,
        pressed && threadStyles.pressed,
      ]}
      onPress={() => onPress(thread)}
    >
      {/* Avatar */}
      <View style={threadStyles.avatar}>
        <Text style={threadStyles.avatarText}>
          {participant ? getInitials(participant.full_name) : '??'}
        </Text>
      </View>

      {/* Content */}
      <View style={threadStyles.content}>
        <View style={threadStyles.topRow}>
          <Text style={[threadStyles.name, hasUnread && threadStyles.nameBold]} numberOfLines={1}>
            {participant?.full_name ?? 'Unknown'}
          </Text>
          {lastMsg && (
            <Text style={threadStyles.timestamp}>
              {formatDistanceToNow(new Date(lastMsg.created_at), { addSuffix: false })}
            </Text>
          )}
        </View>

        {/* Booking banner */}
        {thread.is_booking_thread && thread.listing_title && (
          <View style={threadStyles.bookingBanner}>
            <Text style={threadStyles.bookingBannerText} numberOfLines={1}>
              📅 {thread.listing_title}
            </Text>
          </View>
        )}

        <View style={threadStyles.bottomRow}>
          <Text style={threadStyles.preview} numberOfLines={1}>
            {lastMsg
              ? `${lastMsg.sender_name.split(' ')[0]}: ${lastMsg.body}`
              : 'No messages yet'}
          </Text>
          {hasUnread && (
            <View style={threadStyles.unreadBadge}>
              <Text style={threadStyles.unreadCount}>{thread.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const threadStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: screenPadding.horizontal,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.surfaceElevated,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.forgeDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typeScale.h2,
    color: colors.forgeLight,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    ...typeScale.body1,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  nameBold: {
    fontFamily: typeScale.bodySemiBold || typeScale.h2.fontFamily,
  },
  timestamp: {
    ...typeScale.mono3,
    color: colors.textTertiary,
  },
  bookingBanner: {
    backgroundColor: colors.signalDim,
    borderRadius: radii.default,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  bookingBannerText: {
    ...typeScale.mono3,
    color: colors.signalSoft,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    ...typeScale.body2,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadBadge: {
    backgroundColor: colors.forge,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    ...typeScale.mono3,
    color: colors.textOnAccent,
    fontWeight: '600',
  },
});

export function ThreadListScreen() {
  const navigation = useNavigation();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['threads'],
    queryFn: getThreads,
    refetchInterval: 15_000, // Poll every 15s for new threads
  });

  const threads = data?.data ?? [];

  const handleThreadPress = (thread: Thread) => {
    navigation.navigate('Thread' as never, { threadId: thread.id } as never);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>Messages</Text>

      {isLoading ? (
        <LoadingSkeleton count={5} />
      ) : threads.length === 0 ? (
        <EmptyState
          title="No conversations"
          description="Messages will appear here when you inquire about a listing or receive a booking request."
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadRow thread={item} onPress={handleThreadPress} />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.forge}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  heading: {
    ...typeScale.h1,
    color: colors.textPrimary,
    paddingHorizontal: screenPadding.horizontal,
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
});
```

---

## Step 9: Build ThreadScreen — Chat

**File: `src/screens/shared/ThreadScreen.tsx`**

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';

import { colors } from '../../theme/colors';
import { typeScale } from '../../theme/typography';
import { spacing, radii, screenPadding } from '../../theme/spacing';
import { Badge } from '../../components/Badge';
import { formatCurrency } from '../../utils/format';
import { getThreadDetail, sendMessage as sendMessageApi } from '../../api/messaging';
import { useAbly } from '../../hooks/useAbly';
import { useAuthStore } from '../../store/authStore';
import type { Message } from '../../api/types';

interface RouteParams {
  threadId: string;
}

// ---------------------------------------------------------------------------
// Date separator
// ---------------------------------------------------------------------------

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return `Today · ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `Yesterday · ${format(date, 'HH:mm')}`;
  return format(date, 'MMM d · HH:mm');
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at);
  const curr = new Date(messages[index].created_at);
  return (
    prev.getDate() !== curr.getDate() ||
    prev.getMonth() !== curr.getMonth() ||
    prev.getFullYear() !== curr.getFullYear()
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <View style={[
      bubbleStyles.wrapper,
      isOwn ? bubbleStyles.wrapperOwn : bubbleStyles.wrapperOther,
    ]}>
      <View style={[
        bubbleStyles.bubble,
        isOwn ? bubbleStyles.bubbleOwn : bubbleStyles.bubbleOther,
      ]}>
        <Text style={[
          bubbleStyles.body,
          isOwn ? bubbleStyles.bodyOwn : bubbleStyles.bodyOther,
        ]}>
          {message.body}
        </Text>
        <View style={bubbleStyles.meta}>
          <Text style={bubbleStyles.time}>
            {format(new Date(message.created_at), 'HH:mm')}
          </Text>
          {isOwn && message.is_read && (
            <Text style={bubbleStyles.readReceipt}>✓✓</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
    paddingHorizontal: screenPadding.horizontal,
  },
  wrapperOwn: {
    alignItems: 'flex-end',
  },
  wrapperOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    padding: spacing.md,
  },
  bubbleOwn: {
    backgroundColor: colors.forgeDim,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 12,
  },
  body: {
    ...typeScale.body1,
    marginBottom: 4,
  },
  bodyOwn: {
    color: colors.forgeLight,
  },
  bodyOther: {
    color: colors.textPrimary,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    ...typeScale.mono3,
    color: colors.textTertiary,
  },
  readReceipt: {
    ...typeScale.mono3,
    color: colors.signalSoft,
  },
});

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  onSend: (text: string) => void;
  isSending: boolean;
}

function Composer({ onSend, isSending }: ComposerProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={composerStyles.container}>
      <TextInput
        style={composerStyles.input}
        placeholder="Type a message..."
        placeholderTextColor={colors.textTertiary}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
      />
      <Pressable
        style={[
          composerStyles.sendButton,
          (!text.trim() || isSending) && composerStyles.sendDisabled,
        ]}
        onPress={handleSend}
        disabled={!text.trim() || isSending}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={colors.textOnAccent} />
        ) : (
          <Text style={composerStyles.sendIcon}>↑</Text>
        )}
      </Pressable>
    </View>
  );
}

const composerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.abyss,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sheet,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typeScale.body1,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.forge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: colors.textOnAccent,
    fontSize: 18,
    fontWeight: '700',
  },
});

// ---------------------------------------------------------------------------
// Main ThreadScreen
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ThreadScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const flatListRef = useRef<FlatList>(null);
  const { threadId } = route.params;

  // Fetch thread + messages
  const { data, isLoading } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => getThreadDetail(threadId),
  });

  const thread = data?.thread;
  const [messages, setMessages] = useState<Message[]>([]);

  // Sync messages from query
  useEffect(() => {
    if (data?.messages) {
      setMessages(data.messages);
    }
  }, [data?.messages]);

  // Ably real-time subscription
  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      // Deduplicate
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  useAbly(threadId, handleNewMessage);

  // Send message
  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessageApi(threadId, { body }),
    onSuccess: (result) => {
      if (result.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.data!.id)) return prev;
          return [...prev, result.data!];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const participant = thread?.other_participant;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.forge} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {participant ? getInitials(participant.full_name) : '??'}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.headerNameRow}>
            <Text style={styles.headerName}>{participant?.full_name ?? 'Unknown'}</Text>
            <Text style={styles.shieldIcon}>🛡</Text>
          </View>
          <Text style={styles.headerSubtitle}>typically replies in &lt;1h</Text>
        </View>
      </View>

      {/* Booking banner */}
      {thread?.is_booking_thread && thread?.booking_id && (
        <View style={styles.bookingBanner}>
          <Text style={styles.bookingBannerIcon}>📅</Text>
          <View style={styles.bookingBannerContent}>
            <Text style={styles.bookingBannerTitle}>Pending request</Text>
            <Text style={styles.bookingBannerDetail}>
              {thread.listing_title ?? 'Booking thread'}
            </Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View>
              {shouldShowDateSeparator(messages, index) && (
                <View style={styles.dateSeparator}>
                  <Text style={styles.dateSeparatorText}>
                    {formatDateSeparator(item.created_at)}
                  </Text>
                </View>
              )}
              <MessageBubble
                message={item}
                isOwn={item.sender.id === user?.id}
              />
            </View>
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />

        {/* Composer */}
        <Composer
          onSend={(text) => sendMutation.mutate(text)}
          isSending={sendMutation.isPending}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.abyss,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  backArrow: {
    ...typeScale.h1,
    color: colors.textPrimary,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.forgeDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerAvatarText: {
    ...typeScale.h2,
    color: colors.forgeLight,
  },
  headerInfo: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerName: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  shieldIcon: {
    fontSize: 14,
  },
  headerSubtitle: {
    ...typeScale.mono3,
    color: colors.textTertiary,
  },
  // Booking banner
  bookingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.signalDim,
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  bookingBannerIcon: {
    fontSize: 16,
  },
  bookingBannerContent: {
    flex: 1,
  },
  bookingBannerTitle: {
    ...typeScale.caption,
    color: colors.signalSoft,
  },
  bookingBannerDetail: {
    ...typeScale.mono3,
    color: colors.textSecondary,
  },
  // Chat area
  chatArea: {
    flex: 1,
  },
  messagesList: {
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  // Date separator
  dateSeparator: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateSeparatorText: {
    ...typeScale.mono3,
    color: colors.textTertiary,
  },
});
```

---

## Step 10: Create the useAbly hook

**File: `src/hooks/useAbly.ts`**

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAblyToken } from '../api/messaging';
import type { Message } from '../api/types';

let Ably: any = null;

try {
  Ably = require('ably');
} catch {
  // Ably not installed — will use polling fallback
}

export function useAbly(
  threadId: string,
  onMessage: (message: Message) => void,
) {
  const clientRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Ably token
  const { data: tokenData } = useQuery({
    queryKey: ['ablyToken'],
    queryFn: getAblyToken,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: false,
  });

  const setupAbly = useCallback(async () => {
    if (!Ably || !tokenData?.success || !tokenData.token) {
      return false;
    }

    try {
      const realtime = new Ably.Realtime({
        token: tokenData.token,
        autoConnect: true,
      });

      const channel = realtime.channels.get(`thread:${threadId}`);

      channel.subscribe('new_message', (msg: any) => {
        if (msg.data) {
          const messageData: Message = {
            id: msg.data.id,
            sender: {
              id: msg.data.sender_id,
              full_name: msg.data.sender_name,
              profile_photo: null,
            },
            body: msg.data.body,
            is_read: false,
            created_at: msg.data.created_at,
          };
          onMessage(messageData);
        }
      });

      clientRef.current = realtime;
      channelRef.current = channel;
      return true;
    } catch (error) {
      console.warn('[useAbly] Failed to connect:', error);
      return false;
    }
  }, [threadId, tokenData, onMessage]);

  // Polling fallback
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      try {
        const { getThreadDetail } = await import('../api/messaging');
        const result = await getThreadDetail(threadId);
        if (result.messages) {
          result.messages.forEach((msg: Message) => {
            onMessage(msg);
          });
        }
      } catch {
        // Silently fail polling
      }
    }, 10_000);
  }, [threadId, onMessage]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const connected = await setupAbly();
      if (!connected && mounted) {
        startPolling();
      }
    };

    init();

    return () => {
      mounted = false;

      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [setupAbly, startPolling]);
}
```

---

## Step 11: Register screens in navigation

Update the navigation files to include the new screens.

**Update `src/navigation/types.ts`** — add these to the param lists:

```typescript
export type RenterStackParamList = {
  // ... existing params
  RequestBooking: { listing: Listing };
  BookingDetail: { bookingId: string };
  Thread: { threadId: string };
};

export type OwnerStackParamList = {
  // ... existing params
  BookingDetail: { bookingId: string };
  Thread: { threadId: string };
};

export type SharedStackParamList = {
  Bookings: undefined;
  BookingDetail: { bookingId: string };
  ThreadList: undefined;
  Thread: { threadId: string };
};
```

**Update `src/navigation/RenterTabs.tsx`** — add the Bookings tab and Messages tab:

```tsx
// In the bottom tab navigator, add:
<Tab.Screen
  name="Bookings"
  component={BookingsScreen}
  options={{
    tabBarLabel: 'Bookings',
    headerShown: false,
  }}
/>
<Tab.Screen
  name="Messages"
  component={ThreadListScreen}
  options={{
    tabBarLabel: 'Messages',
    headerShown: false,
  }}
/>
```

**Register modal screens in the root stack** (or a nested stack inside each tab):

```tsx
// RequestBookingScreen should be a modal:
<Stack.Screen
  name="RequestBooking"
  component={RequestBookingScreen}
  options={{
    presentation: 'transparentModal',
    headerShown: false,
    animation: 'slide_from_bottom',
  }}
/>

// BookingDetailScreen as a standard push:
<Stack.Screen
  name="BookingDetail"
  component={BookingDetailScreen}
  options={{ headerShown: false }}
/>

// ThreadScreen as a standard push:
<Stack.Screen
  name="Thread"
  component={ThreadScreen}
  options={{ headerShown: false }}
/>
```

---

## Step 12: Wire up listing detail → booking flow

In `ListingDetailScreen.tsx`, add a "Request booking" button that navigates to the RequestBookingScreen:

```tsx
// At the bottom of the listing detail screen, add a sticky footer:
<View style={styles.stickyFooter}>
  <Pressable
    style={styles.requestButton}
    onPress={() => navigation.navigate('RequestBooking', { listing })}
  >
    <Text style={styles.requestButtonText}>Request booking</Text>
  </Pressable>
</View>
```

Styles for the footer:

```typescript
stickyFooter: {
  paddingHorizontal: screenPadding.horizontal,
  paddingVertical: spacing.base,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  backgroundColor: colors.abyss,
},
requestButton: {
  backgroundColor: colors.forge,
  borderRadius: radii.default,
  paddingVertical: 14,
  alignItems: 'center',
},
requestButtonText: {
  ...typeScale.h2,
  color: colors.textOnAccent,
},
```

---

## Step 13: Verify all screens render

Start the app:

```bash
npx expo start
```

Verify:
1. Bottom tabs include **Bookings** and **Messages**
2. **BookingsScreen** loads with filter chips and shows empty state
3. **ThreadListScreen** loads and shows empty state
4. Navigate to a listing detail → tap "Request booking" → **RequestBookingScreen** slides up as bottom sheet
5. Step through the 3-step booking flow: calendar → duration → review
6. After submitting a booking request, the booking appears in **BookingsScreen**
7. The booking creates a thread that appears in **ThreadListScreen**
8. Tapping a thread opens **ThreadScreen** with composer
9. Sending a message appears in the chat with correct bubble styling
10. Owner view: tapping a pending booking shows **BookingDetailScreen** with Accept/Decline buttons

---

## Step 14: Commit

```bash
git add .
git commit -m "feat(bookings,messaging): Mobile Wave 03 — Bookings and Messaging screens"
```

---

## Definition of Done

Verify every item before proceeding to Wave 04.

### API Layer
- [ ] `src/api/bookings.ts` exports: `createBooking`, `getBookings`, `getBookingDetail`, `acceptBooking`, `declineBooking`, `cancelBooking`, `markBookingPaid`
- [ ] `src/api/messaging.ts` exports: `getThreads`, `createInquiryThread`, `getThreadDetail`, `sendMessage`, `getAblyToken`
- [ ] All functions use the shared `apiClient` with JWT interceptor

### Components
- [ ] `Badge` component renders 6 variants: success, info, warning, danger, neutral, accent
- [ ] `Badge` uses caption font style with uppercase text
- [ ] `BookingRow` renders listing title, date range (mono font), amount (mono font), and status badge
- [ ] `BookingRow` shows 3px left green border for active bookings
- [ ] `BookingRow` shows 3px left forge border for pending bookings
- [ ] `BookingRow` shows strike-through title + 0.6 opacity for cancelled bookings
- [ ] `BookingRow` shows amber dot + "Awaiting payment" for unpaid confirmed bookings
- [ ] `BookingRow` shows green check + "Paid" for simulated_paid bookings

### RequestBookingScreen (3-step bottom sheet)
- [ ] Sheet slides up over `rgba(0,0,0,0.7)` backdrop with 12px top radius
- [ ] Tapping backdrop dismisses the sheet
- [ ] Progress bar: 2px height, forge fill color, animates per step
- [ ] Step counter: "Step X of 3" in caption style
- [ ] **Step 1 "Pick your dates"**: Calendar with date range selection
- [ ] Past dates have strike-through and 0.5 opacity
- [ ] Selected range highlighted in forge orange with 4px radius on start/end caps
- [ ] Summary bar below calendar: "{date} – {date} · {N} days" in mono font
- [ ] **Step 2 "Duration"**: Cards with radio selection for daily/weekly/monthly
- [ ] Selected card has forge-dim bg + forge border
- [ ] Price per unit and total shown in mono font
- [ ] Monthly disabled (opacity 0.4) when date range < 30 days
- [ ] **Step 3 "Review & send"**: Summary card with listing thumbnail, dates, duration
- [ ] Total amount in large forge-colored mono text
- [ ] Optional note text field
- [ ] "Send request" primary button (forge bg)
- [ ] Back/Continue navigation between steps
- [ ] Continue button disabled until valid selection
- [ ] Calls `POST /api/v1/bookings/` on submit with correct payload
- [ ] Shows loading spinner during submission

### BookingsScreen (shared)
- [ ] Header: "My bookings" in h1 style
- [ ] Filter chips: All, Active, Pending, Past — pill-shaped, selected = forge-dim bg + forge border
- [ ] Booking rows rendered via `BookingRow` component
- [ ] Empty state: "Find your first listing." with action button
- [ ] Pull-to-refresh updates the list
- [ ] Fetches with `role=renter|owner|both` based on user roles

### BookingDetailScreen (owner review)
- [ ] Header: "Request · BK-{id}" in mono/caption, renter name, PENDING badge
- [ ] Asset summary card with listing title
- [ ] Schedule card: start, end, duration — all values in mono font
- [ ] Renter note card with forge-colored left quote line
- [ ] Money card: line items, separator, "Your payout" in forge-colored large mono
- [ ] Renter card: initials avatar (forge-dim bg), name, shield icon, phone
- [ ] Sticky bottom: "Decline" (secondary) + "Accept request" (primary)
- [ ] Accept calls `PATCH /api/v1/bookings/{id}/accept/`
- [ ] Decline prompts for optional reason, calls `PATCH /api/v1/bookings/{id}/decline/`
- [ ] Buttons hidden when booking is not pending or user is not owner

### ThreadListScreen (Messages tab)
- [ ] Lists conversation threads with avatar, participant name, last message preview
- [ ] Timestamp in mono font
- [ ] Unread count badge (forge bg, rounded)
- [ ] Booking threads show a booking banner with signal-dim bg
- [ ] Empty state for no conversations
- [ ] Pull-to-refresh and background polling (15s)

### ThreadScreen (Chat)
- [ ] Header: back arrow, avatar (initials, forge-dim bg), name, shield icon, "typically replies in <1h" (mono)
- [ ] Booking banner: signal-dim bg, calendar icon, "Pending request", listing details
- [ ] Own messages: forge-dim bg, forge-light text, right-aligned, border radius 12/12/2/12
- [ ] Other messages: surface-elevated bg, primary text, left-aligned, border radius 12/12/12/2
- [ ] Timestamps in mono3, right-aligned within bubble
- [ ] Own messages show "✓✓" read receipt when `is_read = true`
- [ ] Date separator: "Today · 14:30" in mono, centered
- [ ] Composer: text input + circular send button (forge bg)
- [ ] Send button disabled when input is empty or sending
- [ ] Calls `POST /api/v1/threads/{id}/messages/` on send
- [ ] Messages deduplicated (no duplicates from Ably + API response)

### Ably Integration
- [ ] `useAbly` hook subscribes to `thread:{thread_id}` channel
- [ ] Listens for `new_message` events and appends to state
- [ ] Requests Ably token via `POST /api/v1/threads/token/`
- [ ] Falls back to polling every 10s if Ably token unavailable
- [ ] Cleans up subscription and connection on unmount

### Navigation
- [ ] RequestBookingScreen presented as transparent modal (slides from bottom)
- [ ] BookingDetailScreen accessible from BookingsScreen tap
- [ ] ThreadScreen accessible from ThreadListScreen tap
- [ ] Bottom tabs include Bookings and Messages tabs
- [ ] Listing detail screen has "Request booking" button linking to RequestBookingScreen

### Design Compliance
- [ ] All backgrounds use abyss (`#0C0C0F`)
- [ ] Cards use surface bg with 1px border, no shadows
- [ ] All amounts rendered in mono font family
- [ ] All dates rendered in mono font family
- [ ] Forge orange (`#E8750A`) used for primary actions, accents, selected states
- [ ] Voice is dispatch tone — concise, confident, no exclamation marks

### General
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] App runs without crashes on iOS simulator and Android emulator
- [ ] All new screens render correctly with Forge Dark theme
- [ ] Git commit made with message `feat(bookings,messaging): Mobile Wave 03 — Bookings and Messaging screens`
