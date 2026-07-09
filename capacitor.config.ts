import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ESG Astraa HRMS — Capacitor config.
 *
 * This app keeps Next.js SSR + middleware (auth routing, signed URLs), so the
 * APK loads the HOSTED web app in a Capacitor webview rather than bundling a
 * static export. The native bridge is still injected, so @capacitor/camera and
 * @capacitor/geolocation work.
 *
 * Set `server.url` to your deployed URL:
 *   - Production: your real domain (e.g. https://hrms.esgastraa.com)
 *   - Local device testing over LAN: http://<your-computer-ip>:3000
 *       (then also set server.cleartext = true and androidScheme = "http")
 * Override without editing this file via the CAP_SERVER_URL env var.
 */
const SERVER_URL =
  process.env.CAP_SERVER_URL || "https://esg-astraa-hrms.vercel.app";

const config: CapacitorConfig = {
  appId: "com.esgastraa.hrms",
  appName: "ESG Astraa HRMS",
  // Fallback assets shown if the hosted URL can't be reached.
  webDir: "capacitor-www",
  server: {
    url: SERVER_URL,
    androidScheme: "https",
    // Set to true ONLY when pointing at an http:// LAN URL for local testing.
    cleartext: false,
  },
};

export default config;
