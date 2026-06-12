/**
 * Native background geolocation adapter.
 * Uses @capacitor-community/background-geolocation when running inside Capacitor
 * (continues tracking with screen locked / app backgrounded).
 * Falls back to navigator.geolocation when running in a regular browser
 * (tracking pauses when the tab is backgrounded — this is a hard browser limit).
 */

type Position = { lat: number; lng: number };
type PositionCallback = (p: Position) => void;

let webWatchId: number | null = null;
let nativeWatcherId: string | null = null;

const isNative = (): boolean => {
  // @ts-ignore — Capacitor global is injected at runtime in native builds
  return typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();
};

export const isRunningNative = isNative;

export async function startDriverTracking(onPosition: PositionCallback): Promise<void> {
  if (isNative()) {
    const { BackgroundGeolocation } = await import(
      "@capacitor-community/background-geolocation"
    );
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
    const { BackgroundGeolocation } = await import(
      "@capacitor-community/background-geolocation"
    );
    await BackgroundGeolocation.removeWatcher({ id: nativeWatcherId });
    nativeWatcherId = null;
    return;
  }
  if (webWatchId != null) {
    navigator.geolocation.clearWatch(webWatchId);
    webWatchId = null;
  }
}
