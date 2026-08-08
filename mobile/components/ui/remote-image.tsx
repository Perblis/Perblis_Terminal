import { Image, type ImageContentFit, type ImageStyle } from "expo-image";

/**
 * Every remote image in the app — listing photos, supplier logos, thumbnails.
 *
 * React Native's own `Image` re-fetches on Android whenever a row recycles,
 * which on a scrolling map or search list meant the same photo was pulled over
 * mobile data again and again. `expo-image` keeps a memory + disk cache, so a
 * photo is fetched once per device and afterwards paints instantly.
 *
 * Callers pass a resolved URL (see `lib/media.resolveMediaUrl`) — this component
 * deliberately knows nothing about how a key becomes a URL.
 */
export function RemoteImage({
  uri,
  style,
  contentFit = "cover",
  accessibilityLabel,
  onError,
  recyclingKey,
}: {
  uri: string | null | undefined;
  style: ImageStyle | ImageStyle[];
  contentFit?: ImageContentFit;
  accessibilityLabel?: string;
  onError?: () => void;
  /** Identity of the row this image belongs to, so a recycled cell never shows
   *  the previous row's picture while the new one decodes. */
  recyclingKey?: string;
}) {
  return (
    <Image
      source={uri ? { uri } : undefined}
      style={style}
      contentFit={contentFit}
      // Cached across launches: listing photos are immutable (the object key
      // changes when the photo does), so there is nothing to invalidate.
      cachePolicy="memory-disk"
      // Short cross-fade rather than a hard pop once the bytes land.
      transition={180}
      accessibilityLabel={accessibilityLabel}
      recyclingKey={recyclingKey}
      onError={onError}
    />
  );
}
