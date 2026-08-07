// Stand-ins for @maplibre/maplibre-react-native under jest (native module).
// Wired up in jest-setup.ts via jest.mock(..., () => require("./maplibre-mock")).
import { forwardRef } from "react";
import { View, type ViewProps } from "react-native";

function passthrough(name: string) {
  const C = forwardRef<View, ViewProps>((props, ref) => (
    <View {...props} ref={ref} testID={name} />
  ));
  C.displayName = name;
  return C;
}

export const Map = passthrough("Map");
export const Camera = passthrough("Camera");
export const Marker = passthrough("Marker");
export const UserLocation = passthrough("UserLocation");
