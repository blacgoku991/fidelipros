/**
 * Native background geolocation adapter.
 * Uses @capacitor-community/background-geolocation when running inside Capacitor
 * (continues tracking with screen locked / app backgrounded).
 * Falls back to navigator.geolocation when running in a regular browser
 * (tracking pauses when the tab is backgrounded — this is a hard browser limit).
 *
 * The plugin ships no JavaScript at all (native iOS/Android sources + type definitions only),
 * so it cannot be imported as a module — doing so breaks the Vite dependency scan and thus
 * `npm run dev` / `npm run build`. Its documented entry point is registerPlugin(), which talks
 * to the native implementation at runtime; the type import below is erased at compile time.
 */

import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

type Position = { lat: number; lng: number };
type PositionCallback = (p: Position) => void;

let webWatchId: number | null = null;
let nativeWatcherId: string | null = null;

const isNative = (): boolean => {
  // Capacitor global is injected at runtime in native builds
  return typeof window !== "undefined" &&
    !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.();
};

export const isRunningNative = isNative;

export async function startDriverTracking(onPosition: PositionCallback): Promise<void> {
  if (isNative()) {
    nativeWatcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage:
          "Position partagée pour notifier vos clients à proximité",
        backgroundTitle: "FidéliPro Driver — en course",
        requestPermissions: true,
        stale: false,
        distanceFilter: 50, // meters between callbacks
      },
      (location, error) => {
        if (error) {
          console.error("[bg-geo] error", error);
          return;
        }
        if (location) {
          onPosition({ lat: location.latitude, lng: location.longitude });
        }
      },
    );
    return;
  }

  if (!("geolocation" in navigator)) {
    throw new Error("Géolocalisation non supportée");
  }
  webWatchId = navigator.geolocation.watchPosition(
    (pos) => onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => console.error("[geo]", err),
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 60_000 },
  );
}

export async function stopDriverTracking(): Promise<void> {
  if (isNative() && nativeWatcherId) {
    await BackgroundGeolocation.removeWatcher({ id: nativeWatcherId });
    nativeWatcherId = null;
    return;
  }
  if (webWatchId != null) {
    navigator.geolocation.clearWatch(webWatchId);
    webWatchId = null;
  }
}
