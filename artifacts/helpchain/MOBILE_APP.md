# HelpChain mobile app

HelpChain is an Expo / React Native application. Android and iOS are the primary targets; web support remains available for development and is not required to use the mobile app.

## Run on a phone with Expo Go

1. Install the dependencies from the workspace root with `pnpm install`.
2. In `artifacts/helpchain`, copy `.env.example` to `.env` and fill in the Firebase web app configuration values from Firebase Console. Set `EXPO_PUBLIC_API_BASE_URL` to the deployed API server origin (the API deployment's base URL, with no `/api` suffix). If you do not manage that deployment, ask its owner for the URL. Restart Expo after changing `.env`; Expo embeds public environment variables when it starts.
3. Configure and deploy the API server using `artifacts/api-server/.env.example`. The API needs Firebase Admin credentials, a private `EMAIL_OTP_SECRET`, an SMTP account to send real verification codes, and a private `DONATION_EXPIRY_SECRET`.
4. Publish the Firestore rules and query indexes from this directory using `firebase deploy --only firestore:rules,firestore:indexes`.
5. From `artifacts/helpchain`, run `pnpm start`.
6. Install Expo Go on the Android or iOS phone, connect the phone and development computer to the same network, and scan the QR code shown by Expo. On an Android emulator, press `a` or use `pnpm android`.

The app uses native React Native screens, Expo Router navigation, native location permissions, and persistent Firebase Authentication on mobile. Google sign-in is not currently configured in this project.

## Donation accountability and item collection

Donors register physical donations from the Donation screen and can follow their Donation ID and receipt verification in Donation History. A recipient centre must have an administrator-authorized receiver before staff can confirm receipt or collect an approved item. Administrators assign or revoke a user's centre-specific receiver role from **Users**. Receipt confirmation requires the Donation ID and received quantity; staff can attach a proof photo. Donation creation, receipt, distribution, collection and item-request decisions are written by the authenticated API and retained in append-only audit subcollections.

Administrators manage verified donations and publish available inventory from **Admin Dashboard → Donations**. Users can request available items and see their request state at **Donation → Available Donations · My Requests**. Approved request codes are delivered only to the owning user's app through the authenticated API; centre staff must enter the request ID and code to confirm collection.

Reservation expiration and the one-hour reminder are processed by `POST /api/donation-requests/expire`. Configure the host's Cloud Scheduler (or equivalent trusted scheduler) to call `https://<api-origin>/api/donation-requests/expire` at least every five minutes with `Authorization: Bearer <DONATION_EXPIRY_SECRET>`. Keep the secret only in the API and scheduler configuration. The endpoint uses transactions to release expired reservations, update audit history, and notify users; without this scheduled call, expiration is processed only when an administrator opens the request-management panel.

New accounts remain limited until the emailed, expiring 6-digit code is verified. Administrator access is based on the authenticated user's `users/{uid}.isAdmin` Firestore role; new registrations cannot grant themselves that role. To authorize an account, find its UID under Firebase Console → Authentication → Users, open Firestore Database → `users` → the document with that same UID, and set `isAdmin` to the Boolean `true` (not the text string `"true"`). Provision administrators only through a trusted Firebase administrator. Admins use the regular Admin Sign In screen after their role is assigned.

## Build an installable app

Configure EAS Build for the Expo account, then run these commands from `artifacts/helpchain`:

- Android installable test APK: `npx eas-cli build --platform android --profile preview`
- Android Play Store bundle: `npx eas-cli build --platform android --profile production`
- iOS store build: `npx eas-cli build --platform ios --profile production`

Add the six `EXPO_PUBLIC_FIREBASE_*` values and `EXPO_PUBLIC_API_BASE_URL` from `.env.example` to the EAS build environment as well; ignored local `.env` files are not uploaded to cloud builds.
The native application identifiers are `org.helpchain.app` for both Android and iOS. Choose the final production identifiers before publishing; app-store identifiers cannot be changed after release.
