# Mobile release runbook (011)

## One-time setup (owner, under Artoholic's accounts — Q11)
1. **Accounts**: create a Google Play Console developer account and an Apple Developer Program membership in Artoholic's name.
2. **Expo**: create the project and set the repository variables `EAS_PROJECT_ID` and `EAS_ENABLED=true`, plus the secret
   `EXPO_TOKEN`. Set `EAS_PROJECT_ID` on the web server too (push tokens).
3. **Identifiers**: confirm the app name "Artoholic" and the id `in.artoholic.ops` (`apps/mobile/app.config.ts`) before the first build.
4. **Push credentials** (never in the repo):
   - Android: in Firebase, create the project, generate an FCM v1 service-account key, and upload it with `eas credentials` → Android → FCM V1.
   - iOS: create an APNs auth key (.p8) in the Apple Developer portal and upload it with `eas credentials` → iOS → Push key.
   - On the web server set `PUSH_PROVIDER=expo` (the production default).
5. **Store listings**: use `apps/mobile/store/listing.md` and `privacy.md`; the privacy policy URL is `/privacy`.
6. **Production API URL**: set `EXPO_PUBLIC_API_URL` in `eas.json` → production.

## Every release
1. Bump `apps/mobile/package.json` version (MAJOR.MINOR.PATCH) and write release notes.
2. Tag and push: `git tag mobile-vX.Y.Z && git push origin mobile-vX.Y.Z`. CI builds both apps (the build number
   increases automatically) and submits them to Play internal testing and TestFlight.
3. In Admin console → App releases, record the release per platform (version, build number, notes).
4. Testers run the checklist on real devices (Android 9 and iOS 15 at least) and tick each check with the device:
   sign-in, menu, a dispatch, a receipt with photo, a damage approval, a count entry, push received, update prompt.
5. When the checklist is complete, promote the build in each store console and set the status to "In store review".
   - If Apple or Google rejects it, set "Rejected" with the reason, fix it, and release a new build. Don't change the minimum version.
6. When a store shows it live, set that platform's release to "Live".
7. Only then, if old apps must stop working, raise the minimum version for **that platform** in Platform status.
   The server refuses a minimum that isn't live on that store (`VERSION_NOT_LIVE`).

## Verifying push in production (011 US4)
On production builds, create a damage report. Check that an Admin's phone receives the push within 30 seconds on each
platform, then tick "Push notification received" for that build.
