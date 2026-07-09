import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon (Apple masks corners itself, so fill the square).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7516EA 0%, #2E94F3 100%)",
          color: "white",
          fontSize: 92,
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: -4,
        }}
      >
        EA
      </div>
    ),
    { ...size },
  );
}
