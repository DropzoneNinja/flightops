interface WindCompassProps {
  direction: number; // meteorological: degrees wind comes FROM
  speed: number;     // km/h
}

export default function WindCompass({ direction, speed }: WindCompassProps) {
  const r = 38;
  const cx = 44;
  const cy = 44;
  const arrowLen = 26;

  // Arrow points toward the wind-from direction (rotated from north)
  const rad = (direction * Math.PI) / 180;
  const ax = cx + arrowLen * Math.sin(rad);
  const ay = cy - arrowLen * Math.cos(rad);

  return (
    <div className="pointer-events-none select-none flex flex-col items-center gap-1">
      <div className="bg-white/85 backdrop-blur-sm rounded-full shadow-md border border-gray-200 p-1">
        <svg width="88" height="88" viewBox="0 0 88 88">
          {/* Outer ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#d1d5db" strokeWidth="1" />

          {/* Tick marks at every 45° */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const isCardinal = deg % 90 === 0;
            const inner = isCardinal ? r - 7 : r - 4;
            return (
              <line
                key={deg}
                x1={cx + inner * Math.sin(a)}
                y1={cy - inner * Math.cos(a)}
                x2={cx + r * Math.sin(a)}
                y2={cy - r * Math.cos(a)}
                stroke={isCardinal ? '#6b7280' : '#d1d5db'}
                strokeWidth={isCardinal ? 1.5 : 1}
              />
            );
          })}

          {/* Cardinal labels */}
          {[
            { label: 'N', x: cx, y: cy - r + 12 },
            { label: 'S', x: cx, y: cy + r - 5 },
            { label: 'E', x: cx + r - 5, y: cy + 4 },
            { label: 'W', x: cx - r + 5, y: cy + 4 },
          ].map(({ label, x, y }) => (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill={label === 'N' ? '#ef4444' : '#6b7280'}
              fontFamily="sans-serif"
            >
              {label}
            </text>
          ))}

          {/* Wind arrow shaft */}
          <line
            x1={cx}
            y1={cy}
            x2={ax}
            y2={ay}
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Arrowhead */}
          <circle cx={ax} cy={ay} r="4" fill="#2563eb" />

          {/* Origin dot */}
          <circle cx={cx} cy={cy} r="3" fill="#2563eb" />
        </svg>
      </div>
      <div className="bg-white/85 backdrop-blur-sm rounded-md shadow-sm border border-gray-200 px-2 py-0.5">
        <span className="text-xs font-semibold text-blue-700 tabular-nums">
          {speed} km/h
        </span>
      </div>
    </div>
  );
}
