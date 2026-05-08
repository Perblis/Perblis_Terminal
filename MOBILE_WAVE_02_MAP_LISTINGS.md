# TERMINAL MOBILE — WAVE 02: MAP SEARCH & LISTING DETAIL
> Agent task file. Execute every instruction in order. Do not skip steps.
> Wave 01 (Auth) must be complete before starting this wave.
> Do not proceed to Wave 03 until the Definition of Done checklist is fully complete.

---

## Context

This wave builds the two core renter screens: **MapScreen** (renter home tab — full-bleed map with search, filter chips, interactive pins, and a bottom peek sheet) and **ListingDetailScreen** (full listing detail with hero carousel, specs, owner card, and sticky booking bar).

**What we're building:**
- A dark-styled map centered on Lagos (6.5244°N, 3.3792°E) with custom pill-shaped pins
- Floating translucent search bar and filter chips over the map
- Bottom peek sheet that slides up when a pin is selected
- Full listing detail screen with swipeable photo carousel, price breakdown, specs grid, and owner card
- API integration with the existing Django REST backend: `GET /api/v1/search/map/` and `GET /api/v1/listings/{id}/`

**Backend API already built (do not modify):**
- `GET /api/v1/search/map/?lat={lat}&lng={lng}&radius={radius}&resource_type={type}` — returns `{ success, count, radius_km, data: SearchResult[] }`
- `GET /api/v1/listings/{id}/` — returns `{ success, data: Listing }` (full detail with media, owner, specs)
- Search results include `distance_km` (float, rounded to 2 decimals), sorted nearest-first
- Listing detail response includes `owner` object with `{ id, full_name, profile_photo, verification_level }`

**Design system:** Forge Dark (TDS v1.1). All visual decisions come from `src/theme/`. Read `MOBILE_WAVE_00_PROJECT_SETUP.md` Step 4 for the exact token definitions.

**Design rules (critical — do not deviate):**
- Map is full-bleed, controls float over it with translucent backgrounds
- Overlay backgrounds: `rgba(19,19,24,0.92)` for search bar, `rgba(12,12,15,0.85)` for chips
- No `backdrop-filter` / blur anywhere
- Borders, not shadows — sole exception: bottom sheet gets `0 -8px 32px rgba(0,0,0,0.4)`
- Colors encode selection state, not category — all resource types use neutral surfaces, icons differentiate
- Selected map pin is always forge orange regardless of resource type
- Prices and distances in IBM Plex Mono
- 4px spacing scale only (xs=4, sm=8, md=12, base=16, lg=20, xl=24)
- Cards: surface bg (`#131318`), 1px border (`#2A2A36`), 8px radius
- Bottom sheet: 12px top radius, surface bg, shadow exception

---

## Step 1: Install map dependencies

Ensure `react-native-maps` and `expo-location` are installed (they were added in Wave 00). If not:

```bash
cd terminal-mobile
npx expo install react-native-maps expo-location
```

Also install `react-native-reanimated` and `react-native-gesture-handler` if not already present (needed for bottom sheet animations):

```bash
npx expo install react-native-reanimated react-native-gesture-handler
```

---

## Step 2: Create the location hook

**File: `src/hooks/useLocation.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const LAGOS_DEFAULT = {
  latitude: 6.5244,
  longitude: 3.3792,
};

export function useLocation(): LocationState {
  const [latitude, setLatitude] = useState(LAGOS_DEFAULT.latitude);
  const [longitude, setLongitude] = useState(LAGOS_DEFAULT.longitude);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setError('Location permission denied');
        setLatitude(LAGOS_DEFAULT.latitude);
        setLongitude(LAGOS_DEFAULT.longitude);
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
    } catch (err) {
      setError('Failed to get location');
      setLatitude(LAGOS_DEFAULT.latitude);
      setLongitude(LAGOS_DEFAULT.longitude);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return { latitude, longitude, loading, error, refresh: fetchLocation };
}
```

---

## Step 3: Create the search API module

**File: `src/api/search.ts`**

```typescript
import apiClient from './client';
import type { SearchResult } from './types';

interface MapSearchParams {
  lat: number;
  lng: number;
  radius?: number;
  resource_type?: string;
  available?: boolean;
}

interface MapSearchResponse {
  success: boolean;
  count: number;
  radius_km: number;
  data: SearchResult[];
}

export async function fetchMapListings(
  params: MapSearchParams
): Promise<MapSearchResponse> {
  const queryParams: Record<string, string> = {
    lat: params.lat.toString(),
    lng: params.lng.toString(),
  };

  if (params.radius !== undefined) {
    queryParams.radius = params.radius.toString();
  }

  if (params.resource_type) {
    queryParams.resource_type = params.resource_type;
  }

  if (params.available !== undefined) {
    queryParams.available = params.available.toString();
  }

  const { data } = await apiClient.get<MapSearchResponse>('/search/map/', {
    params: queryParams,
  });

  return data;
}
```

---

## Step 4: Create the listings API module

**File: `src/api/listings.ts`**

```typescript
import apiClient from './client';
import type { Listing, ApiResponse } from './types';

export async function fetchListingDetail(
  listingId: string
): Promise<Listing> {
  const { data } = await apiClient.get<ApiResponse<Listing>>(
    `/listings/${listingId}/`
  );

  if (!data.success || !data.data) {
    throw new Error(data.message || 'Failed to fetch listing');
  }

  return data.data;
}

export async function fetchMyListings(): Promise<Listing[]> {
  const { data } = await apiClient.get<ApiResponse<Listing[]>>('/listings/');

  if (!data.success || !data.data) {
    throw new Error(data.message || 'Failed to fetch listings');
  }

  return data.data;
}
```

---

## Step 5: Create the ResourceIcon component

This component resolves a `resource_type` string to the appropriate Tabler icon. Each resource type gets a unique glyph so users can distinguish types on the map and in cards without relying on color.

**File: `src/components/ResourceIcon.tsx`**

```tsx
import React from 'react';
import {
  IconCrane,
  IconTruck,
  IconBuildingWarehouse,
  IconContainer,
  IconFence,
} from '@tabler/icons-react-native';
import { colors } from '../theme';

interface ResourceIconProps {
  resourceType: 'equipment' | 'vehicle' | 'warehouse' | 'terminal' | 'facility';
  size?: number;
  color?: string;
}

const ICON_MAP = {
  equipment: IconCrane,
  vehicle: IconTruck,
  warehouse: IconBuildingWarehouse,
  terminal: IconContainer,
  facility: IconFence,
} as const;

export function ResourceIcon({
  resourceType,
  size = 20,
  color = colors.textSecondary,
}: ResourceIconProps) {
  const Icon = ICON_MAP[resourceType] ?? IconCrane;
  return <Icon size={size} color={color} stroke={1.5} />;
}
```

---

## Step 6: Create the MapPin component

Map pins are pill-shaped bubbles rendered as custom markers on the map. Default state: surface bg + 1px border, icon + price. Selected state: forge orange bg, white text, scale 1.1.

**File: `src/components/MapPin.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typeScale, spacing } from '../theme';
import { ResourceIcon } from './ResourceIcon';
import { formatCurrency } from '../utils/format';

interface MapPinProps {
  resourceType: 'equipment' | 'vehicle' | 'warehouse' | 'terminal' | 'facility';
  priceDaily: string | null;
  isSelected: boolean;
}

export function MapPin({ resourceType, priceDaily, isSelected }: MapPinProps) {
  const price = priceDaily ? parseFloat(priceDaily) : null;

  return (
    <View
      style={[
        styles.container,
        isSelected && styles.containerSelected,
      ]}
    >
      <ResourceIcon
        resourceType={resourceType}
        size={14}
        color={isSelected ? colors.white : colors.textSecondary}
      />
      {price !== null && (
        <Text
          style={[
            styles.price,
            isSelected && styles.priceSelected,
          ]}
          numberOfLines={1}
        >
          {formatCurrency(price)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  containerSelected: {
    backgroundColor: colors.forge,
    borderColor: colors.forge,
    transform: [{ scale: 1.1 }],
    zIndex: 10,
  },
  price: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    lineHeight: 14,
    color: colors.textPrimary,
  },
  priceSelected: {
    color: colors.white,
  },
});
```

---

## Step 7: Create the BottomSheet component

A reusable bottom sheet with 12px top radius, surface bg, and the shadow exception. Uses `react-native-gesture-handler` and `react-native-reanimated` for swipe-to-dismiss.

**File: `src/components/BottomSheet.tsx`**

```tsx
import React, { useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { colors, spacing, radii } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 };

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  /** Height of sheet content area. Default: 260 */
  height?: number;
}

export function BottomSheet({
  visible,
  onDismiss,
  children,
  height = 260,
}: BottomSheetProps) {
  const translateY = useSharedValue(height + 40);
  const context = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING_CONFIG);
    } else {
      translateY.value = withSpring(height + 40, SPRING_CONFIG);
    }
  }, [visible, height, translateY]);

  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = context.value + event.translationY;
      translateY.value = Math.max(0, next);
    })
    .onEnd((event) => {
      if (event.translationY > height * 0.3 || event.velocityY > 500) {
        translateY.value = withSpring(height + 40, SPRING_CONFIG);
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, height + 40],
      [1, 0],
      Extrapolation.CLAMP
    ),
    pointerEvents: visible ? ('auto' as const) : ('none' as const),
  }));

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.sheet, { height }, sheetStyle]}>
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderActive,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
});
```

---

## Step 8: Create the ListingCard component

Reusable listing summary card used in the bottom peek sheet on the map. Shows thumbnail, title, location, distance (mono), and price (mono, forge color).

**File: `src/components/ListingCard.tsx`**

```tsx
import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { IconMapPin, IconCircleFilled } from '@tabler/icons-react-native';
import { colors, typeScale, spacing, radii } from '../theme';
import { ResourceIcon } from './ResourceIcon';
import { formatCurrency, formatDistance } from '../utils/format';
import type { SearchResult } from '../api/types';

interface ListingCardProps {
  listing: SearchResult;
  onPress?: () => void;
}

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const dailyPrice = listing.price_daily
    ? parseFloat(listing.price_daily)
    : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {listing.primary_photo_url ? (
          <Image
            source={{ uri: listing.primary_photo_url }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <ResourceIcon
              resourceType={listing.resource_type}
              size={28}
              color={colors.textTertiary}
            />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Resource type chip */}
        <View style={styles.typeRow}>
          <ResourceIcon resourceType={listing.resource_type} size={12} />
          <Text style={styles.typeLabel}>
            {listing.resource_type.toUpperCase()}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>

        {/* Location + distance */}
        <View style={styles.metaRow}>
          <IconMapPin size={12} color={colors.textTertiary} stroke={1.5} />
          <Text style={styles.metaText} numberOfLines={1}>
            {listing.location_city || listing.location_address}
          </Text>
          {listing.distance_km !== null && listing.distance_km !== undefined && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.distanceText}>
                {formatDistance(listing.distance_km)}
              </Text>
            </>
          )}
        </View>

        {/* Availability + Price */}
        <View style={styles.bottomRow}>
          <View style={styles.availableBadge}>
            <IconCircleFilled size={6} color={colors.clear} />
            <Text style={styles.availableText}>Available</Text>
          </View>
          {dailyPrice !== null && (
            <Text style={styles.price}>
              {formatCurrency(dailyPrice)}
              <Text style={styles.pricePeriod}>/day</Text>
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: colors.surfaceElevated,
  },
  thumbnailContainer: {
    width: 88,
    height: 88,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'space-between',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.66,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textTertiary,
    flexShrink: 1,
  },
  metaDot: {
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 12,
    color: colors.textTertiary,
  },
  distanceText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  availableText: {
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 11,
    lineHeight: 14,
    color: colors.clear,
  },
  price: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 14,
    lineHeight: 18,
    color: colors.forge,
  },
  pricePeriod: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
});
```

---

## Step 9: Create the MapScreen

This is the primary renter home tab. Full-bleed dark-styled map with:
- Floating search bar at top (`rgba(19,19,24,0.92)` bg)
- Filter chips below search bar (`rgba(12,12,15,0.85)` bg for inactive, forge-dim bg + forge border for active)
- Custom pill-shaped map pins (MapPin component rendered as markers)
- User location blue dot with pulsing animation
- Bottom peek sheet showing selected listing summary

**File: `src/screens/renter/MapScreen.tsx`**

```tsx
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  IconSearch,
  IconChevronDown,
  IconCircleFilled,
  IconCurrentLocation,
} from '@tabler/icons-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { colors, typeScale, spacing, radii } from '../../theme';
import { fetchMapListings } from '../../api/search';
import { useLocation } from '../../hooks/useLocation';
import { MapPin } from '../../components/MapPin';
import { ListingCard } from '../../components/ListingCard';
import { BottomSheet } from '../../components/BottomSheet';
import { formatDistance } from '../../utils/format';
import type { SearchResult } from '../../api/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RESOURCE_FILTERS = [
  { id: null, label: 'Type' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'facility', label: 'Facility' },
] as const;

const RADIUS_OPTIONS = [10, 20, 50, 100, 200];
const DEFAULT_RADIUS = 50;

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0C0C0F' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8E8EA8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0C0C0F' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#2A2A36' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#131318' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1A1A22' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#22222C' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#22222C' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#131318' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#131318' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#52526A' }],
  },
];

interface MapScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export default function MapScreen({ navigation }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { latitude, longitude, loading: locationLoading, refresh: refreshLocation } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [radiusMenuOpen, setRadiusMenuOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<SearchResult | null>(null);

  // Pulsing animation for user location dot
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      true
    );
  }, [pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: 2 - pulseScale.value,
  }));

  // Fetch map listings
  const {
    data: searchResponse,
    isLoading: searchLoading,
    refetch,
  } = useQuery({
    queryKey: ['mapListings', latitude, longitude, radius, selectedType],
    queryFn: () =>
      fetchMapListings({
        lat: latitude,
        lng: longitude,
        radius,
        resource_type: selectedType ?? undefined,
        available: true,
      }),
    enabled: !locationLoading,
    staleTime: 30_000,
  });

  const listings = searchResponse?.data ?? [];

  // Filter by search query (client-side text filter)
  const filteredListings = useMemo(() => {
    if (!searchQuery.trim()) return listings;
    const q = searchQuery.toLowerCase();
    return listings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.location_city.toLowerCase().includes(q)
    );
  }, [listings, searchQuery]);

  const handleMarkerPress = useCallback((listing: SearchResult) => {
    setSelectedListing(listing);
    mapRef.current?.animateToRegion(
      {
        latitude: listing.latitude,
        longitude: listing.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      300
    );
  }, []);

  const handleDetailPress = useCallback(() => {
    if (selectedListing) {
      navigation.navigate('ListingDetail', { listingId: selectedListing.id });
    }
  }, [selectedListing, navigation]);

  const handleBookingPress = useCallback(() => {
    if (selectedListing) {
      navigation.navigate('RequestBooking', { listingId: selectedListing.id });
    }
  }, [selectedListing, navigation]);

  const handleRecenter = useCallback(() => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      300
    );
  }, [latitude, longitude]);

  const handleTypeFilter = useCallback(
    (typeId: string | null) => {
      setSelectedType((prev) => (prev === typeId ? null : typeId));
      setSelectedListing(null);
    },
    []
  );

  const handleRadiusSelect = useCallback((r: number) => {
    setRadius(r);
    setRadiusMenuOpen(false);
    setSelectedListing(null);
  }, []);

  const initialRegion: Region = {
    latitude,
    longitude,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  return (
    <View style={styles.root}>
      {/* Full-bleed map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapPadding={{ top: insets.top + 120, bottom: 0, left: 0, right: 0 }}
        onPress={() => setSelectedListing(null)}
      >
        {/* User location marker */}
        {!locationLoading && (
          <Marker
            coordinate={{ latitude, longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.userLocationContainer}>
              <Animated.View style={[styles.userLocationPulse, pulseStyle]} />
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}

        {/* Listing markers */}
        {filteredListings.map((listing) => (
          <Marker
            key={listing.id}
            coordinate={{
              latitude: listing.latitude,
              longitude: listing.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => handleMarkerPress(listing)}
            zIndex={selectedListing?.id === listing.id ? 10 : 1}
          >
            <MapPin
              resourceType={listing.resource_type}
              priceDaily={listing.price_daily}
              isSelected={selectedListing?.id === listing.id}
            />
          </Marker>
        ))}
      </MapView>

      {/* Floating search bar */}
      <View style={[styles.searchContainer, { top: insets.top + spacing.sm }]}>
        <View style={styles.searchBar}>
          <IconSearch size={18} color={colors.textTertiary} stroke={1.5} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search assets, locations..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchLoading && (
            <ActivityIndicator size="small" color={colors.forge} />
          )}
        </View>

        {/* Filter chips */}
        <View style={styles.chipsRow}>
          {/* Resource type chips */}
          {RESOURCE_FILTERS.filter((f) => f.id !== null).map((filter) => {
            const isActive = selectedType === filter.id;
            return (
              <Pressable
                key={filter.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => handleTypeFilter(filter.id)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {filter.label}
                </Text>
                {filter.id === null && (
                  <IconChevronDown size={12} color={isActive ? colors.forge : colors.textSecondary} stroke={1.5} />
                )}
              </Pressable>
            );
          })}

          {/* Radius chip */}
          <Pressable
            style={[styles.chip, radiusMenuOpen && styles.chipActive]}
            onPress={() => setRadiusMenuOpen((o) => !o)}
          >
            <Text style={[styles.chipText, radiusMenuOpen && styles.chipTextActive]}>
              {radius} km
            </Text>
            <IconChevronDown size={12} color={radiusMenuOpen ? colors.forge : colors.textSecondary} stroke={1.5} />
          </Pressable>

          {/* Available chip (always active) */}
          <View style={[styles.chip, styles.chipActive]}>
            <IconCircleFilled size={6} color={colors.clear} />
            <Text style={[styles.chipText, styles.chipTextActive]}>Available</Text>
          </View>
        </View>

        {/* Radius dropdown */}
        {radiusMenuOpen && (
          <View style={styles.radiusDropdown}>
            {RADIUS_OPTIONS.map((r) => (
              <Pressable
                key={r}
                style={[
                  styles.radiusOption,
                  r === radius && styles.radiusOptionActive,
                ]}
                onPress={() => handleRadiusSelect(r)}
              >
                <Text
                  style={[
                    styles.radiusOptionText,
                    r === radius && styles.radiusOptionTextActive,
                  ]}
                >
                  {r} km
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Recenter button */}
      <Pressable
        style={[styles.recenterButton, { bottom: selectedListing ? 300 : insets.bottom + spacing.lg }]}
        onPress={handleRecenter}
      >
        <IconCurrentLocation size={20} color={colors.textPrimary} stroke={1.5} />
      </Pressable>

      {/* Result count badge */}
      {!searchLoading && filteredListings.length > 0 && !selectedListing && (
        <View style={[styles.countBadge, { bottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.countText}>
            {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''} nearby
          </Text>
        </View>
      )}

      {/* Bottom peek sheet */}
      <BottomSheet
        visible={selectedListing !== null}
        onDismiss={() => setSelectedListing(null)}
        height={260}
      >
        {selectedListing && (
          <View style={styles.sheetContent}>
            <ListingCard
              listing={selectedListing}
              onPress={handleDetailPress}
            />

            <View style={styles.sheetActions}>
              {/* Secondary: Details */}
              <Pressable
                style={styles.secondaryButton}
                onPress={handleDetailPress}
              >
                <Text style={styles.secondaryButtonText}>Details</Text>
              </Pressable>

              {/* Primary: Request booking */}
              <Pressable
                style={styles.primaryButton}
                onPress={handleBookingPress}
              >
                <Text style={styles.primaryButtonText}>Request booking</Text>
              </Pressable>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },

  // Search bar
  searchContainer: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(19,19,24,0.92)',
    borderRadius: radii.sheet,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    padding: 0,
  },

  // Filter chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(12,12,15,0.85)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.forgeDim,
    borderColor: colors.forge,
  },
  chipText: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.forge,
  },

  // Radius dropdown
  radiusDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    zIndex: 20,
    minWidth: 100,
  },
  radiusOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  radiusOptionActive: {
    backgroundColor: colors.forgeDim,
  },
  radiusOptionText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  radiusOptionTextActive: {
    color: colors.forge,
  },

  // User location
  userLocationContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userLocationPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.25)',
  },
  userLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: colors.white,
  },

  // Recenter button
  recenterButton: {
    position: 'absolute',
    right: spacing.base,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },

  // Count badge
  countBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 5,
  },
  countText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  // Sheet content
  sheetContent: {
    flex: 1,
    gap: spacing.base,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  primaryButton: {
    flex: 1.5,
    backgroundColor: colors.forge,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
  },
});
```

---

## Step 10: Create the ListingDetailScreen

Full listing detail with:
- Hero photo carousel (16:10 aspect ratio, gradient placeholder)
- Back button (circle, translucent dark bg) top-left
- Resource type chip top-right (forge-dim bg)
- Pagination dots
- Title (display3), meta row, price block, about, specs grid, owner card
- Sticky bottom bar: "Message" (secondary) + "Request booking" (primary)

**File: `src/screens/renter/ListingDetailScreen.tsx`**

```tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  IconArrowLeft,
  IconMapPin,
  IconCircleFilled,
  IconShieldCheck,
  IconMessageCircle2,
  IconCalendarEvent,
  IconClock,
} from '@tabler/icons-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, typeScale, spacing, radii } from '../../theme';
import { fetchListingDetail } from '../../api/listings';
import { ResourceIcon } from '../../components/ResourceIcon';
import { formatCurrency, formatDistance } from '../../utils/format';
import type { Listing, ListingMedia } from '../../api/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = (SCREEN_WIDTH * 10) / 16; // 16:10 aspect ratio

interface ListingDetailScreenProps {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ ListingDetail: { listingId: string } }, 'ListingDetail'>;
}

export default function ListingDetailScreen({
  navigation,
  route,
}: ListingDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { listingId } = route.params;
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const {
    data: listing,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => fetchListingDetail(listingId),
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(
        event.nativeEvent.contentOffset.x / SCREEN_WIDTH
      );
      setActivePhotoIndex(index);
    },
    []
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleMessage = useCallback(() => {
    // Will navigate to messaging in Wave 03
    if (listing) {
      navigation.navigate('Thread', {
        listingId: listing.id,
        ownerId: listing.owner.id,
      });
    }
  }, [listing, navigation]);

  const handleRequestBooking = useCallback(() => {
    if (listing) {
      navigation.navigate('RequestBooking', { listingId: listing.id });
    }
  }, [listing, navigation]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.forge} />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load listing</Text>
        <Pressable style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const sortedMedia = [...(listing.media || [])].sort(
    (a, b) => a.display_order - b.display_order
  );
  const hasPhotos = sortedMedia.length > 0;
  const dailyPrice = listing.price_daily ? parseFloat(listing.price_daily) : null;
  const weeklyPrice = listing.price_weekly ? parseFloat(listing.price_weekly) : null;
  const monthlyPrice = listing.price_monthly ? parseFloat(listing.price_monthly) : null;

  const ownerInitials = listing.owner.full_name
    ? listing.owner.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const specs = listing.specs && typeof listing.specs === 'object'
    ? Object.entries(listing.specs)
    : [];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero photo area */}
        <View style={styles.heroContainer}>
          {hasPhotos ? (
            <FlatList
              data={sortedMedia}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.file_url }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              )}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <ResourceIcon
                resourceType={listing.resource_type}
                size={48}
                color={colors.textTertiary}
              />
              <Text style={styles.heroPlaceholderText}>No photos yet</Text>
            </View>
          )}

          {/* Gradient overlay at bottom of hero */}
          <LinearGradient
            colors={['transparent', 'rgba(12,12,15,0.8)']}
            style={styles.heroGradient}
            pointerEvents="none"
          />

          {/* Back button */}
          <Pressable
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={handleBack}
          >
            <IconArrowLeft size={20} color={colors.textPrimary} stroke={1.5} />
          </Pressable>

          {/* Resource type chip */}
          <View style={[styles.typeChip, { top: insets.top + spacing.sm }]}>
            <ResourceIcon
              resourceType={listing.resource_type}
              size={14}
              color={colors.forge}
            />
            <Text style={styles.typeChipText}>
              {listing.resource_type.toUpperCase()}
            </Text>
          </View>

          {/* Pagination dots */}
          {hasPhotos && sortedMedia.length > 1 && (
            <View style={styles.paginationDots}>
              {sortedMedia.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === activePhotoIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <IconMapPin size={14} color={colors.textTertiary} stroke={1.5} />
              <Text style={styles.metaText}>
                {listing.location_city || listing.location_address || 'Unknown'}
              </Text>
            </View>
            {listing.is_available && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <View style={styles.metaItem}>
                  <IconCircleFilled size={6} color={colors.clear} />
                  <Text style={[styles.metaText, { color: colors.clear }]}>
                    Available
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Price block card */}
          <View style={styles.priceCard}>
            <Text style={styles.priceCardTitle}>PRICING</Text>
            {dailyPrice !== null && (
              <View style={styles.priceRow}>
                <View style={styles.priceLabel}>
                  <IconClock size={14} color={colors.textTertiary} stroke={1.5} />
                  <Text style={styles.priceLabelText}>Daily</Text>
                </View>
                <Text style={styles.pricePrimary}>
                  {formatCurrency(dailyPrice)}
                  <Text style={styles.pricePeriod}>/day</Text>
                </Text>
              </View>
            )}
            {weeklyPrice !== null && (
              <View style={styles.priceRow}>
                <View style={styles.priceLabel}>
                  <IconCalendarEvent size={14} color={colors.textTertiary} stroke={1.5} />
                  <Text style={styles.priceLabelText}>Weekly</Text>
                </View>
                <Text style={styles.priceSecondary}>
                  {formatCurrency(weeklyPrice)}
                  <Text style={styles.pricePeriod}>/week</Text>
                </Text>
              </View>
            )}
            {monthlyPrice !== null && (
              <View style={styles.priceRow}>
                <View style={styles.priceLabel}>
                  <IconCalendarEvent size={14} color={colors.textTertiary} stroke={1.5} />
                  <Text style={styles.priceLabelText}>Monthly</Text>
                </View>
                <Text style={styles.priceSecondary}>
                  {formatCurrency(monthlyPrice)}
                  <Text style={styles.pricePeriod}>/month</Text>
                </Text>
              </View>
            )}
            {dailyPrice === null && weeklyPrice === null && monthlyPrice === null && (
              <Text style={styles.noPriceText}>Contact for pricing</Text>
            )}
          </View>

          {/* About section */}
          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ABOUT</Text>
              <Text style={styles.bodyText}>{listing.description}</Text>
            </View>
          ) : null}

          {/* Specs section */}
          {specs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SPECIFICATIONS</Text>
              <View style={styles.specsGrid}>
                {specs.map(([key, value]) => (
                  <View key={key} style={styles.specItem}>
                    <Text style={styles.specLabel}>
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.specValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OPTIONS</Text>
            <View style={styles.optionsRow}>
              <View style={styles.optionItem}>
                <View
                  style={[
                    styles.optionDot,
                    {
                      backgroundColor: listing.operator_available
                        ? colors.clear
                        : colors.textTertiary,
                    },
                  ]}
                />
                <Text style={styles.optionText}>
                  Operator {listing.operator_available ? 'available' : 'not included'}
                </Text>
              </View>
              <View style={styles.optionItem}>
                <View
                  style={[
                    styles.optionDot,
                    {
                      backgroundColor: listing.delivery_available
                        ? colors.clear
                        : colors.textTertiary,
                    },
                  ]}
                />
                <Text style={styles.optionText}>
                  Delivery {listing.delivery_available ? 'available' : 'not available'}
                </Text>
              </View>
            </View>
          </View>

          {/* Owner card */}
          <View style={styles.ownerCard}>
            <View style={styles.ownerRow}>
              {/* Avatar */}
              {listing.owner.profile_photo ? (
                <Image
                  source={{ uri: listing.owner.profile_photo }}
                  style={styles.ownerAvatar}
                />
              ) : (
                <View style={styles.ownerAvatarPlaceholder}>
                  <Text style={styles.ownerInitials}>{ownerInitials}</Text>
                </View>
              )}

              <View style={styles.ownerInfo}>
                <View style={styles.ownerNameRow}>
                  <Text style={styles.ownerName}>{listing.owner.full_name}</Text>
                  {listing.owner.verification_level >= 2 && (
                    <IconShieldCheck
                      size={16}
                      color={colors.signal}
                      stroke={1.5}
                    />
                  )}
                </View>
                <View style={styles.ownerMeta}>
                  <Text style={styles.ownerMetaText}>
                    Member since{' '}
                    {new Date(listing.created_at).getFullYear()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        {/* Message button (secondary) */}
        <Pressable style={styles.messageButton} onPress={handleMessage}>
          <IconMessageCircle2 size={18} color={colors.textPrimary} stroke={1.5} />
          <Text style={styles.messageButtonText}>Message</Text>
        </Pressable>

        {/* Request booking button (primary) */}
        <Pressable style={styles.bookingButton} onPress={handleRequestBooking}>
          <Text style={styles.bookingButtonText}>Request booking</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.abyss,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
  },
  errorText: {
    ...typeScale.body1,
    color: colors.textSecondary,
  },
  retryButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    ...typeScale.body1,
    color: colors.textPrimary,
  },

  // Hero
  heroContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroPlaceholderText: {
    ...typeScale.body2,
    color: colors.textTertiary,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.4,
  },

  // Back button
  backButton: {
    position: 'absolute',
    left: spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(19,19,24,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // Type chip
  typeChip: {
    position: 'absolute',
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.forgeDim,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    zIndex: 10,
  },
  typeChipText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.66,
    color: colors.forge,
  },

  // Pagination dots
  paginationDots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 20,
    borderRadius: 3,
  },

  // Content
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },

  // Title
  title: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typeScale.body2,
    color: colors.textSecondary,
  },
  metaDot: {
    ...typeScale.body2,
    color: colors.textTertiary,
  },

  // Price card
  priceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.md,
  },
  priceCardTitle: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceLabelText: {
    ...typeScale.body2,
    color: colors.textSecondary,
  },
  pricePrimary: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 17,
    lineHeight: 22,
    color: colors.forge,
  },
  priceSecondary: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  pricePeriod: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
  },
  noPriceText: {
    ...typeScale.body1,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  // Section
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  bodyText: {
    ...typeScale.body1,
    color: colors.textSecondary,
  },

  // Specs grid
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  specItem: {
    width: '47%',
    gap: spacing.xs,
  },
  specLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  specValue: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },

  // Options
  optionsRow: {
    gap: spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  optionText: {
    ...typeScale.body2,
    color: colors.textSecondary,
  },

  // Owner card
  ownerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  ownerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.forgeDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerInitials: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 17,
    color: colors.forge,
  },
  ownerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownerName: {
    ...typeScale.h2,
    color: colors.textPrimary,
  },
  ownerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownerMetaText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textTertiary,
  },

  // Sticky bottom bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  messageButtonText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  bookingButton: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forge,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
  },
  bookingButtonText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
  },
});
```

---

## Step 11: Update the navigation to wire up new screens

Update `RenterTabs.tsx` so MapScreen is the first tab, and create a stack navigator that pushes `ListingDetailScreen` on top of the tabs.

**File: `src/navigation/RenterTabs.tsx`** — update this file to include the MapScreen as the first tab:

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  IconMap2,
  IconCalendarEvent,
  IconMessageCircle2,
  IconUser,
} from '@tabler/icons-react-native';

import MapScreen from '../screens/renter/MapScreen';
import ListingDetailScreen from '../screens/renter/ListingDetailScreen';
import { colors, typeScale } from '../theme';

// Placeholder screens for tabs not yet built
function BookingsPlaceholder() {
  return null;
}
function MessagesPlaceholder() {
  return null;
}
function ProfilePlaceholder() {
  return null;
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function RenterTabsInner() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.forge,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: 'IBMPlexSans_500Medium',
          fontSize: 10,
          lineHeight: 14,
        },
      }}
    >
      <Tab.Screen
        name="Search"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconMap2 size={size} color={color} stroke={1.5} />
          ),
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsPlaceholder}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconCalendarEvent size={size} color={color} stroke={1.5} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesPlaceholder}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconMessageCircle2 size={size} color={color} stroke={1.5} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfilePlaceholder}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconUser size={size} color={color} stroke={1.5} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RenterTabs() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.abyss },
      }}
    >
      <Stack.Screen name="RenterHome" component={RenterTabsInner} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen
        name="RequestBooking"
        component={() => null}
        /* Placeholder — implemented in Wave 03 */
      />
    </Stack.Navigator>
  );
}
```

---

## Step 12: Update navigation types

Add the new screen params to the navigation type definitions.

**File: `src/navigation/types.ts`** — add or update:

```typescript
export type RenterStackParamList = {
  RenterHome: undefined;
  ListingDetail: { listingId: string };
  RequestBooking: { listingId: string };
  Thread: { listingId: string; ownerId: string };
};

export type RenterTabParamList = {
  Search: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyPhone: { phone: string };
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
```

---

## Step 13: Install `expo-linear-gradient` (if not already installed)

The ListingDetailScreen hero gradient requires this package:

```bash
cd terminal-mobile
npx expo install expo-linear-gradient
```

---

## Step 14: Verify the build

```bash
cd terminal-mobile
npx expo start
```

The app must:
1. Load without TypeScript or import errors
2. Show the MapScreen as the first tab with a dark-styled map
3. Display the floating search bar with translucent background
4. Show filter chips below the search bar
5. Tapping a map pin shows the bottom peek sheet with listing summary
6. Tapping "Details" in the sheet navigates to ListingDetailScreen
7. ListingDetailScreen shows the hero area, title, price card, specs, and owner card
8. The back button returns to the MapScreen
9. The sticky bottom bar shows "Message" and "Request booking" buttons

---

## Step 15: Commit

```bash
git add .
git commit -m "feat(mobile): Wave 02 — Map Search and Listing Detail screens"
```

---

## Definition of Done

Verify every item before handing back to supervisor.

**Location Hook:**
- [ ] `useLocation` requests foreground permissions via `expo-location`
- [ ] Falls back to Lagos coordinates (6.5244, 3.3792) when permission denied or error
- [ ] Returns `{ latitude, longitude, loading, error, refresh }`
- [ ] `refresh` re-fetches the location on demand

**API Modules:**
- [ ] `src/api/search.ts` exports `fetchMapListings(params)` calling `GET /search/map/`
- [ ] Passes `lat`, `lng`, `radius`, `resource_type`, `available` as query params
- [ ] `src/api/listings.ts` exports `fetchListingDetail(id)` calling `GET /listings/{id}/`
- [ ] Both use the shared `apiClient` with JWT interceptor

**ResourceIcon Component:**
- [ ] Maps exactly 5 resource types to Tabler icons: crane, truck, warehouse, container, fence
- [ ] Accepts `size` and `color` props with sensible defaults
- [ ] Falls back to crane icon for unknown types

**MapPin Component:**
- [ ] Default state: `surface` bg, 1px `border` color, icon + price text
- [ ] Selected state: `forge` bg, white text, `scale: 1.1`, `zIndex: 10`
- [ ] Price displayed in IBM Plex Mono
- [ ] Pill-shaped (borderRadius: 999)
- [ ] Price formatted via `formatCurrency` (₦ symbol, comma-separated)

**BottomSheet Component:**
- [ ] 12px top border radius
- [ ] Surface background
- [ ] Shadow: `0 -8px 32px rgba(0,0,0,0.4)` (only shadow exception in app)
- [ ] Swipe-to-dismiss via `react-native-gesture-handler` + `react-native-reanimated`
- [ ] Drag handle (36px × 4px bar) centered at top
- [ ] Backdrop press dismisses sheet

**ListingCard Component:**
- [ ] Shows thumbnail (88×88), or resource icon placeholder if no photo
- [ ] Resource type label in mono uppercase
- [ ] Title in semibold
- [ ] Location + distance (distance in IBM Plex Mono)
- [ ] Availability dot (green)
- [ ] Daily price in forge color, mono font
- [ ] Surface bg, 1px border, 8px radius

**MapScreen:**
- [ ] Full-bleed map covering entire screen (no margins)
- [ ] Dark map style applied (custom JSON style array)
- [ ] Floating search bar at top: `rgba(19,19,24,0.92)` bg, 12px border-radius, 1px border
- [ ] Search filters results client-side by title, category, or city
- [ ] Filter chips below search: resource types + radius dropdown + "Available" (always active)
- [ ] Active chip: forge-dim bg + forge border
- [ ] Inactive chip: `rgba(12,12,15,0.85)` bg + 1px border
- [ ] Radius dropdown: surface bg card with forge-highlighted active option
- [ ] Map markers use `MapPin` component (pill-shaped bubbles, not default pins)
- [ ] Tapping a marker selects it (forge orange bg, scale 1.1, z-index boost)
- [ ] Tapping the map background deselects the marker
- [ ] User location: blue dot (`#3B82F6`) with pulsing ring animation via reanimated
- [ ] Recenter button (bottom-right, circular, surface bg + border)
- [ ] "X listings nearby" count badge at bottom center when no pin selected
- [ ] Bottom peek sheet appears when pin selected: ListingCard + "Details" + "Request booking" buttons
- [ ] "Details" navigates to `ListingDetailScreen` via stack push
- [ ] "Request booking" navigates to `RequestBookingScreen` placeholder (Wave 03)
- [ ] Data fetched via `@tanstack/react-query` with `queryKey: ['mapListings', lat, lng, radius, type]`
- [ ] Refetches when radius or resource type filter changes

**ListingDetailScreen:**
- [ ] Hero photo area: 16:10 aspect ratio (width × 10/16)
- [ ] Swipeable carousel via horizontal `FlatList` with paging
- [ ] Gradient placeholder when no photos (resource icon + "No photos yet")
- [ ] Bottom gradient overlay on hero (transparent → dark)
- [ ] Back button: 40px circle, `rgba(19,19,24,0.75)` bg, top-left, respects safe area inset
- [ ] Resource type chip: top-right, forge-dim bg, mono uppercase text in forge color
- [ ] Pagination dots: bottom of hero, active dot is 20px wide bar, inactive is 6px circle
- [ ] Title: Barlow Condensed 700, 28px, uppercase (display3)
- [ ] Meta row: location + availability dot
- [ ] Price card: surface bg, 1px border, 8px radius
  - [ ] "PRICING" header in caption style
  - [ ] Daily price in forge color, IBM Plex Mono, 17px
  - [ ] Weekly/monthly in text-primary, IBM Plex Mono, 15px
  - [ ] Period suffix ("/day", "/week", "/month") in 11px tertiary
- [ ] About section: body1 text, secondary color
- [ ] Specs section: 2-column grid, labels in mono 9px uppercase, values in mono 14px
- [ ] Options section: operator available + delivery available with green/grey dots
- [ ] Owner card: surface bg, 1px border, 8px radius
  - [ ] Avatar: 48px circle, profile photo or initials in forge-dim bg
  - [ ] Name in h2 style
  - [ ] Shield icon if `verification_level >= 2` (signal blue color)
  - [ ] "Member since YYYY" in mono 12px tertiary
- [ ] Sticky bottom bar: surface bg, top 1px border, respects safe area
  - [ ] "Message" button: secondary style, flex 1, message icon + text
  - [ ] "Request booking" button: primary forge bg, flex 1.5, white text
- [ ] Data fetched via `@tanstack/react-query` with `queryKey: ['listing', listingId]`
- [ ] Loading state: centered ActivityIndicator in forge color
- [ ] Error state: "Failed to load listing" + "Go back" button

**Navigation:**
- [ ] MapScreen is the first tab in `RenterTabs` (Search tab)
- [ ] Tab bar: surface bg, 1px top border, forge active color, tertiary inactive
- [ ] Tapping a listing pushes `ListingDetailScreen` onto the stack (not tab switch)
- [ ] `ListingDetailScreen` back button pops the stack
- [ ] `RequestBooking` screen is a placeholder (Wave 03)
- [ ] Navigation types exported from `src/navigation/types.ts`

**Design System Compliance:**
- [ ] No backdrop-filter/blur used anywhere
- [ ] All backgrounds use exact TDS colors or specified rgba values
- [ ] Borders, not shadows — except bottom sheet
- [ ] Selected state is forge orange — not category-dependent
- [ ] All prices in IBM Plex Mono
- [ ] All distances in IBM Plex Mono
- [ ] 4px spacing scale only (no 5px, 7px, etc.)
- [ ] Cards: surface bg, 1px border, 8px radius
- [ ] Titles use Barlow Condensed 700 uppercase

**General:**
- [ ] No TypeScript errors — `npx tsc --noEmit` passes
- [ ] No ESLint errors
- [ ] `expo start` runs without errors
- [ ] Git commit made with message `feat(mobile): Wave 02 — Map Search and Listing Detail screens`
