/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9 / 5) + 32;
}

/**
 * Format temperature with appropriate unit
 * @param celsius Temperature in Celsius
 * @param unit 'celsius' or 'fahrenheit'
 * @param decimals Number of decimal places (default: 0)
 */
export function formatTemperature(
  celsius: number | null | undefined,
  unit: 'celsius' | 'fahrenheit',
  decimals: number = 0
): string {
  if (celsius === null || celsius === undefined) {
    return '--';
  }

  const temp = unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius;
  const symbol = unit === 'fahrenheit' ? '°F' : '°C';

  return `${temp.toFixed(decimals)}${symbol}`;
}
