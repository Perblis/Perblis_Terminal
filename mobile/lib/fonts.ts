import {
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from "@expo-google-fonts/ibm-plex-mono";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";

/**
 * The Heavy Duty type set (02 §1): Archivo display, Inter body, IBM Plex
 * Mono money. Weight-explicit family names are identical on Android and
 * iOS; the app tailwind config maps font-display/-sans/-mono to them.
 */
export const FONTS = {
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} as const;

export function useAppFonts(): boolean {
  const [loaded] = useFonts(FONTS);
  return loaded;
}
