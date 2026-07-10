import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// App icon (favicon + PWA) — the ESG Astraa butterfly mark on a white square.
export default function Icon() {
  const logo = readFileSync(join(process.cwd(), "public/icon-mark.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          padding: 56,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} height={384} style={{ objectFit: "contain" }} alt="ESG Astraa" />
      </div>
    ),
    { ...size },
  );
}
