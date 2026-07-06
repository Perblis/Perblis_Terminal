/** Valid [lng, lat] for MapLibre — rejects null/NaN coordinates from partial API data. */
export function toLngLat(pair: [number, number] | number[] | null | undefined): [number, number] | null {
  if (!pair || pair.length < 2) return null;
  const lng = pair[0];
  const lat = pair[1];
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}
