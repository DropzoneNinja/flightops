import L from 'leaflet';

/**
 * Creates a windsock DivIcon for a Leaflet Marker.
 *
 * @param direction - Meteorological wind direction (degrees FROM which the wind blows).
 * @param speed     - Wind speed value to label.
 * @param unit      - Unit label to display next to the speed (default: 'kt').
 */
export function createWindSockIcon(direction: number, speed: number, unit = 'kt'): L.DivIcon {
  // Sock tail points downwind; icon default orientation is pointing right (+x).
  const sockAngle = (direction + 90) % 360;

  // Tapered sock: 48 px long, mouth height 16 px, tail height 8 px.
  // Four alternating orange/white stripes.
  const stripes = [
    { x1: 0,  x2: 12, y1: 16, y2: 14, fill: '#f97316' },
    { x1: 12, x2: 24, y1: 14, y2: 12, fill: 'white'   },
    { x1: 24, x2: 36, y1: 12, y2: 10, fill: '#f97316' },
    { x1: 36, x2: 48, y1: 10, y2: 8,  fill: 'white'   },
  ].map(({ x1, x2, y1, y2, fill }) =>
    `<polygon points="${x1},${-y1} ${x2},${-y2} ${x2},${y2} ${x1},${y1}" fill="${fill}"/>`
  ).join('');

  const html = `<svg width="120" height="130" viewBox="0 0 120 130"
      xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    <ellipse cx="60" cy="112" rx="10" ry="3.5" fill="#9ca3af" opacity="0.45"/>
    <line x1="60" y1="110" x2="60" y2="60" stroke="#374151" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(60,60) rotate(${sockAngle})">
      ${stripes}
      <polygon points="0,-16 48,-8 48,8 0,16"
               fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linejoin="round"/>
      <ellipse cx="0"  cy="0" rx="2.5" ry="16" fill="none" stroke="#9a3412" stroke-width="2.5"/>
      <ellipse cx="48" cy="0" rx="1.5" ry="8"  fill="none" stroke="#9a3412" stroke-width="1.5"/>
    </g>
    <circle cx="60" cy="60" r="5.5" fill="#6b7280"/>
    <circle cx="60" cy="60" r="3.5" fill="#e5e7eb"/>
    <text x="72" y="114" font-size="16" font-weight="700" fill="#111827"
          font-family="sans-serif" stroke="white" stroke-width="5"
          paint-order="stroke">${Math.round(speed)} ${unit}</text>
  </svg>`;

  return L.divIcon({
    className: 'wind-sock-marker',
    html,
    iconSize: [120, 130],
    iconAnchor: [60, 128],
  });
}
