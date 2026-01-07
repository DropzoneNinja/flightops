interface WindArrowProps {
  direction: number; // Wind direction in degrees (0-360)
}

/**
 * Wind direction arrow component
 * Displays an arrow pointing in the wind direction
 * @param direction Wind direction in degrees (0° = N, 90° = E, 180° = S, 270° = W)
 */
export default function WindArrow({ direction }: WindArrowProps) {
  // Convert degrees to 8-direction compass
  // Add 22.5 to center the ranges, then divide by 45 to get 0-7 index
  const index = Math.round(((direction % 360) + 22.5) / 45) % 8;

  // Map to 8 compass directions with corresponding arrows
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return (
    <span className="inline-flex items-center justify-center" title={`${directions[index]} (${Math.round(direction)}°)`}>
      <span className="text-lg font-bold">{arrows[index]}</span>
    </span>
  );
}
