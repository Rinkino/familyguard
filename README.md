# FamilyGuard

Personal safety app: share your location with the people you choose, set zones they should stay inside, and escalate automatically (alert → "Are you OK?" → SOS with audio recording) when something looks wrong. The full brief is in `Chapter 1.pdf`.

**Status:** working test version. Expo (React Native) app on Supabase for sign-in, data, live updates, scheduled jobs and file storage. Tested through Expo Go; no store builds yet.

## Layout

```
Chapter 1.pdf          project brief
apps/mobile/           Expo app, SDK 57
supabase/migrations/   database schema, security rules and server logic (run in order)
```

## Run the app

```bash
cd apps/mobile
npm install
cp .env.example .env     # add your Mapbox token and Supabase URL + publishable key
npx expo start --go      # scan the QR code with Expo Go
```

Add `--tunnel` if your phone isn't on the same network, or `--web` for a browser preview (the map there is a drawn stand-in).

Testers can use the published version without running anything: see the tester guide shared by the team.

## Set up Supabase

1. Create a project and run the files in `supabase/migrations/` in order in the SQL Editor.
2. Authentication → Providers: enable Email, and Google with a Google Cloud OAuth client (Web application) whose redirect URI is `https://<project>.supabase.co/auth/v1/callback`.
3. Authentication → URL Configuration → Redirect URLs: `exp://**` and `familyguard://**`.

## How it works

- **Connections are two-sided.** Each person picks their own private label for the other and chooses on their own whether to share location. Invite codes connect people.
- **Parent and child agreement.** Both must accept. The guardian always sees the child, sets their zones and gets their alerts; the child can ask to be released.
- **Zones** are circles someone should stay inside, for set hours or until turned off. The server checks every location against active zones.
- **Escalation runs on the server** (pg_cron every 10 s): left zone → watchers alerted → "Are you OK?" countdown → SOS. An SOS still goes out if the phone dies mid-countdown.
- **SOS recording** uploads audio in 30-second chunks to a private bucket; watchers can play, and the person (or their guardian) can rename, save or delete.
- **Location history** keeps 7 days, visible only to the person and their guardians. Points recorded offline upload when the phone reconnects.
- **Privacy:** every table has row-level security; people only see what is shared with them.

## Code map

```
apps/mobile/src/
  app/                  screens (Expo Router)
  components/           shared UI; map/FamilyMap is the only map wrapper
  lib/                  supabase, auth, mapbox, recorder, location queue, history
  state/store.tsx       data from Supabase, realtime refresh, location sharing
  theme/                colours, type, spacing
apps/mobile/assets/brand/make.sh   regenerates the logo SVGs
```

## Not built yet

Background tracking and push notifications (need a development build), Apple sign-in (needs an Apple Developer account), better place search for Nigeria, journey route monitoring.
