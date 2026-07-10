import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Device connectivity as state. `isConnected === false` is the only value
 * treated as offline — null (unknown, e.g. during startup) stays online so
 * banners never flash before NetInfo settles.
 */
export function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  return offline;
}
