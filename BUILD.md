# ESG Astraa HRMS — Build & Deploy

Two deliverables from one codebase: the **web app** (Next.js, SSR) and an
**Android APK** (Capacitor wrapper that loads the hosted web app).

---

## 1. Prerequisites

- Node 18+ and npm
- A Supabase project with migrations `0001`–`0003` applied
- `.env.local` populated:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
  ```
- For the APK: **Android Studio** (bundles the Android SDK + JDK 17)

---

## 2. Web app

```bash
npm install
npm run dev        # local dev at http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
```

Deploy anywhere that runs a Next.js server (SSR + middleware are required —
this app is **not** a static export):

- **Vercel** — import the repo, set the two `NEXT_PUBLIC_SUPABASE_*` env vars, deploy.
- **AWS EC2 / Docker / nginx** — `npm run build` then `npm run start` behind nginx
  (matches the existing esgastraa.com infra).

Note the deployed URL — the APK points at it.

---

## 3. Android APK

The APK is a Capacitor webview that loads the **hosted** web app, so the native
Camera/Geolocation bridge works while SSR + auth middleware keep running on the
server. (Static export was intentionally not used — see CLAUDE.md §8.)

### 3a. Point the app at your deployment

Edit [capacitor.config.ts](capacitor.config.ts) → `server.url`, **or** set an env var:

```bash
# production
export CAP_SERVER_URL="https://hrms.esgastraa.com"

# local device testing over LAN (same Wi-Fi as your dev machine):
#   set url to http://<your-computer-ip>:3000
#   AND set server.cleartext = true and androidScheme = "http" in capacitor.config.ts
```

### 3b. Sync native project

```bash
npm run cap:sync          # copies config + web fallback, updates plugins
npm run cap:open          # opens the android/ project in Android Studio
```

(If the `android/` folder is ever missing: `npx cap add android`, then sync.)

### 3c. Permissions (already configured)

`android/app/src/main/AndroidManifest.xml` already declares:
`INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`.

### 3d. Build a signed release APK

**One-time — create a keystore** (keep this file + passwords safe; you need the
same key for every future update):

```bash
keytool -genkey -v -keystore esgastraa-release.keystore \
  -alias esgastraa -keyalg RSA -keysize 2048 -validity 10000
```

**In Android Studio:**
1. **Build → Generate Signed Bundle / APK → APK**
2. Choose the `esgastraa-release.keystore`, enter the alias + passwords
3. Select the **release** build variant → **Finish**
4. Output: `android/app/release/app-release.apk`

**Or via Gradle (CLI):** put signing config in
`android/keystore.properties` + reference it in `android/app/build.gradle`, then:
```bash
cd android
./gradlew assembleRelease      # Windows: gradlew.bat assembleRelease
```

### 3e. Install

Share `app-release.apk` for sideloading (enable "Install unknown apps"), or
upload to the Play Console later. There is no Play Store requirement for
internal distribution.

---

## 4. After code changes

- **Web:** redeploy (Vercel auto-deploys, or rebuild your Docker image).
- **APK:** because the app loads the hosted URL, most changes need **no new APK** —
  they ship the moment the web deploy is live. Rebuild the APK only when you
  change `capacitor.config.ts`, native permissions, plugins, or the app icon.

---

## 5. Troubleshooting

- **Blank/dark screen in the app** → `server.url` is wrong or unreachable, or
  it's an `http://` URL without `cleartext: true`. The fallback screen in
  `capacitor-www/index.html` shows when the URL can't be reached.
- **Location/Camera not prompting** → confirm the manifest permissions (3c) and
  that the device granted them in Settings → Apps.
- **Login loops** → the hosted site must have the same `NEXT_PUBLIC_SUPABASE_*`
  env vars set in its deployment environment.
