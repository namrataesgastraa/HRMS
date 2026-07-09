import { MapPin } from "lucide-react";
import { formatDistance } from "@/lib/geolocation";

interface Props {
  distanceMeters: number;
  radiusMeters: number;
  within: boolean;
}

/**
 * Simple radar-style visual: the ring is the geofence boundary, the center is
 * the office, and the dot is the employee scaled by distance/radius.
 */
export function RadiusIndicator({ distanceMeters, radiusMeters, within }: Props) {
  const ringR = 82;
  const ratio = Math.min(distanceMeters / Math.max(radiusMeters, 1), 1.35);
  const dotR = ratio * ringR;
  // Fixed pleasant angle (no bearing data) — upper-right.
  const angle = -Math.PI / 5;
  const cx = 100 + dotR * Math.cos(angle);
  const cy = 100 + dotR * Math.sin(angle);

  const color = within ? "#22C55E" : "#EF4444";

  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44" role="img" aria-label="Distance to office">
      {/* pulse rings */}
      <circle cx="100" cy="100" r={ringR} fill={within ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)"} />
      <circle cx="100" cy="100" r={ringR} fill="none" stroke={color} strokeOpacity="0.35" strokeDasharray="4 4" />
      <circle cx="100" cy="100" r={ringR * 0.6} fill="none" stroke={color} strokeOpacity="0.12" />

      {/* office center */}
      <circle cx="100" cy="100" r="6" fill="#7516EA" />
      <circle cx="100" cy="100" r="11" fill="none" stroke="#7516EA" strokeOpacity="0.3" />

      {/* employee dot */}
      <circle cx={cx} cy={cy} r="7" fill={color} />
      <circle cx={cx} cy={cy} r="7" fill="none" stroke="white" strokeWidth="2" />

      {/* center label */}
      <text x="100" y="150" textAnchor="middle" className="fill-dark-base" fontSize="20" fontWeight="700">
        {formatDistance(distanceMeters)}
      </text>
    </svg>
  );
}

/** Compact legend row used beside the indicator. */
export function RadiusLegend({ radiusMeters }: { radiusMeters: number }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-electric-violet" />
        <span className="text-gray-500">Office</span>
      </div>
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-500">Geofence radius: {radiusMeters} m</span>
      </div>
    </div>
  );
}
