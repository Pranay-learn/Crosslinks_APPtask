# NSUT Connect mobile app

The Expo application is in mobile/. It uses React Native, TypeScript, React Navigation bottom tabs, TanStack Query, SQLite for timetable snapshots, SecureStore for native sessions, and Expo Notifications.

## Development

Use Node 24 and npm. Install root dependencies and apply migrations for the backend, then:

```sh
npm install --prefix mobile
cp mobile/.env.example mobile/.env
npm run start --prefix mobile
```

The demo is explicit: EXPO_PUBLIC_DEMO_MODE=true. Student/admin sample roles can only change local fictional data. Set it to false and configure EXPO_PUBLIC_API_URL for the live backend. Android emulators can use http://10.0.2.2:3001 for a local host API; physical devices need a reachable development URL. Production needs HTTPS.

```sh
npm run android --prefix mobile
# macOS with Xcode:
npm run ios --prefix mobile
```

For signed builds, initialize your own EAS project from mobile/ and set EXPO_PUBLIC_EAS_PROJECT_ID, bundle/application identifiers, live API URL and demo mode false. Use eas build --profile development --platform android/ios for development clients and --profile production for release builds. Apple developer enrollment and store accounts are not supplied by this project.

## Google sign-in

Reuse the backend's Google OAuth **web client** and configured Google callback. No client secret is bundled into the app. Native sign-in begins at /api/auth/mobile, returns through Google's registered backend callback and then nsutconnect://auth with an expiring one-time code. /api/auth/mobile/exchange requires the app's PKCE verifier before issuing a session.

Set MOBILE_REDIRECT_URIS to the exact app return URI list. The default is nsutconnect://auth. Add an exact HTTPS app root if you enable live mobile-web sign-in. Arbitrary redirect URIs are rejected. Native bearer tokens and CSRF tokens live together in SecureStore. Web sessions are memory-only.

The backend verifies Google's signature, issuer, audience, expiry, verified email, university domain and nonce. New users are students unless listed in the server's ADMIN_EMAILS. Google credentials and university access policy must be configured manually.

## Push notifications (Android FCM, iOS APNs)

This implementation uses Expo Push Service, a cross-platform provider that delivers through FCM and APNs.

1. Create an EAS project and configure its ID in the mobile environment.
2. Register the Android application ID in Firebase. Keep google-services.json outside source control; set GOOGLE_SERVICES_JSON to its build-input path.
3. Configure FCM V1 credentials through eas credentials.
4. Configure the iOS bundle ID, push entitlement, signing and APNs credentials through your Apple/EAS account.
5. Generate a 32-byte key and store its base64 value as DEVICE_TOKEN_KEY only on the backend.
6. Run the compiled push worker separately: npm run start:worker.

The device permission request appears after sign-in and remains available in Profile. Device tokens are AES-256-GCM encrypted; hashed tokens identify registrations. Durable notification/device delivery records prevent duplicate queue entries, have leases and bounded retries, honor current user ownership/preferences, and check provider receipts. Invalid devices are disabled.

Remote push requires development builds and physical devices. The browser demo provides a notification center; it does not simulate real remote push delivery. Firebase/Apple/Expo credentials and actual campus-account consent remain manual setup.

## Offline timetable and reminders

Native timetable data is stored persistently in SQLite by branch/semester/section. The app reads the last selected schedule immediately on an offline launch, including a previously closed app. Downloaded non-personal schedule data remains accessible after logout. Private profiles are not persisted in plaintext.

On reconnect and foregrounding, the selected timetable synchronizes. Versions and snapshots are persisted by the API. Cancelled classes are retained as cancelled entries and excluded from current/next class and reminders.

Class times are fixed to Asia/Kolkata. Local reminders are scheduled for 5/10/15 minutes before class, for the next three weeks, with a 48-notification cap. Rescheduling cancels stored notification IDs first, responds to preferences/timetable changes and refreshes on foregrounding. Device travel/timezone changes do not change university class times. The app must be opened periodically to extend the scheduling horizon. Fully offline devices cannot receive new cancellations until synchronization.

## API additions

All /api/mobile routes require a session and use the existing CSRF policy. /admin routes additionally require a server-verified admin role.

- GET/PUT /api/mobile/preferences
- POST/DELETE /api/mobile/devices and /api/mobile/devices/:id
- GET /api/mobile/timetable/sync?branch=CSE&semester=5&section=A
- GET /api/mobile/bookmarks
- POST/DELETE /api/mobile/discussions/:id/bookmark
- GET/POST/DELETE /api/mobile/replies/:id/votes
- POST /api/mobile/reports
- GET /api/mobile/admin/reports?page=1
- PATCH /api/mobile/admin/reports/:id with {hide:boolean}
- POST /api/mobile/admin/notifications with {text,branch?,link}

The native app shares backend feed/discussion/announcement/profile routes and polls current community data every 20 seconds. Timetable checks run every 45 seconds. For immediate campus-scale updates, add a shared streaming/event transport; polling currently provides periodic updates.

## Verification

```sh
npm run typecheck --prefix mobile
npm run export:web --prefix mobile
npx playwright test --config playwright.native.config.ts
```

The mobile browser tests exercise the Expo-rendered UI, discussion/reply/bookmark behavior, student admin restrictions, publishing, and closing/reopening a page offline. They complement the real PostgreSQL API tests. The Maestro offline flow in mobile/.maestro/offline.yaml must be run on installed Android/iOS development builds for device-level force-close evidence.

Native binary builds, live Google consent and remote push are not proven by browser tests. Validate those on real configured accounts/devices before a campus release.
