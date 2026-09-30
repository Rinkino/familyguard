# FamilyGuard

Personal safety app: share your location with the people you choose, set zones they should stay inside, and escalate automatically (alert → "Are you OK?" → SOS) when something looks wrong. The full brief is in `Chapter 1.pdf`.

**Status:** frontend only, running on **mock data**. There is no backend yet. Sign-in is simulated.

## Layout

```
Chapter 1.pdf        project brief
apps/mobile/         Expo (React Native) app, SDK 57
```

## Run the app

```bash
cd apps/mobile
npm install
cp .env.example .env     # then add your Mapbox public token
```

**In the browser** (quickest, map is a drawn stand-in):
```bash
npx expo start --web
```

**On a phone** with Expo Go (real map). Sign in with `npx expo login` and in the Expo Go app with the same account first:
```bash
npx expo start --go
```
Scan the QR code. If your phone isn't on the same Wi-Fi, add `--tunnel`.

## How the app is organised

```
apps/mobile/src/
  app/                  screens (Expo Router: every file is a route)
    (tabs)/             Map, People, Circles, You
    person/[id]         one connection: label, sharing, circles
    zone/[id]           create / edit / view a zone
    alert/[id]          watcher's view of a zone alert
    check-in            your "Are you OK?" countdown and SOS
  components/           shared UI; map/FamilyMap is the only map wrapper
  lib/mapbox.ts         the only code that calls Mapbox (search, pin address, directions)
  lib/geo.ts            distance and formatting helpers
  mock/                 sample people, circles, zones, places (demo data)
  state/store.tsx       app state (in memory; resets on reload)
  theme/                colours, type, spacing
```

## Key ideas

- **Connections are two-sided.** Each person picks their own label for the other (e.g. "Mum" / "Daughter") and chooses on their own whether to share location. Labels come from built-in or user-made templates.
- **Circles** are private groups for sharing with several people at once.
- **Zones** are circles someone should stay inside. They can be set for yourself or anyone who shares with you (the person is told). A zone lasts a set number of hours or until turned off.
- **Leaving a zone:** watchers are alerted → after a grace period the person is asked "Are you OK?" → no answer before the countdown ends sends an SOS and starts audio recording (recording is mocked).

## Maps

- The map itself is Apple Maps (iOS) / Google Maps (Android) via `react-native-maps`, so it works in Expo Go.
- Mapbox provides search, dropped-pin addresses and directions (`EXPO_PUBLIC_MAPBOX_TOKEN`). Without a token the app falls back to sample Lagos places.
- Known gap: Mapbox search misses most Nigerian schools and universities. Switching search to an OpenStreetMap-based provider is planned.

## Demo notes

- Timers run fast in the demo: each minute of grace time passes in one second.
- The Map tab has "Try the alerts" buttons to simulate someone leaving a zone.
- The You tab can reset the sample data.

## Not built yet

Journeys (route deviation), real Supabase sign-in (Google, Apple, email), backend and API, push notifications, real audio recording.
