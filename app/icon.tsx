import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// App icon (favicon + PWA). Brand gradient with "EA" monogram.
export default function Icon() {
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
          fontSize: 260,
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: -10,
        }}
      >
        EA
      </div>
    ),
    { ...size },
  );
}
