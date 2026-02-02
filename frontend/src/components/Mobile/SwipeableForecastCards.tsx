import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { WeatherForecast } from '../../services/weather.service';
import { formatForecastDate } from '../../utils/dateUtils';

/**
 * SwipeableForecastCards - Full-screen swipeable weather forecast view
 *
 * Replaces the desktop HourlyWeatherDialog on mobile with:
 * - Horizontal swipe navigation between forecast days
 * - Touch-friendly hourly data rows (60px height)
 * - Swipe indicators showing current day
 * - Large close button for easy one-handed use
 */

interface SwipeableForecastCardsProps {
  forecasts: WeatherForecast[];
  initialDayIndex: number;
  onClose: () => void;
}

export default function SwipeableForecastCards({
  forecasts,
  initialDayIndex,
  onClose,
}: SwipeableForecastCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(initialDayIndex);

  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentIndex(Math.min(currentIndex + 1, forecasts.length - 1)),
    onSwipedRight: () => setCurrentIndex(Math.max(currentIndex - 1, 0)),
    preventScrollOnSwipe: true,
    trackMouse: true, // Also works on desktop for testing
  });

  if (!forecasts || forecasts.length === 0) return null;

  const forecast = forecasts[currentIndex];

  const getScoreBadgeClass = (score: number) => {
    if (score >= 76) return 'bg-green-600 text-white';
    if (score >= 51) return 'bg-green-300 text-gray-900';
    if (score >= 26) return 'bg-yellow-300 text-gray-900';
    return 'bg-red-500 text-white';
  };

  const getWindDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees % 360) / 22.5)) % 16;
    return directions[index];
  };

  // Calculate daily stats
  const temperatures = forecast.hourlyData.map(data => Number(data.temperature));
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const totalRain = forecast.hourlyData.reduce((sum, data) => sum + Number(data.rain), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end">
      <div
        {...handlers}
        className="bg-white w-full h-[90vh] rounded-t-2xl overflow-hidden flex flex-col no-select"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold outdoor-text">
              {formatForecastDate(forecast.date)}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {minTemp.toFixed(1)}°C - {maxTemp.toFixed(1)}°C | Rain: {totalRain.toFixed(1)}mm
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 touch-target-lg rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Swipe Indicators */}
        <div className="flex justify-center gap-2 py-3 bg-white">
          {forecasts.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className="touch-target"
              aria-label={`Go to day ${i + 1}`}
            >
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Hourly Data - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {forecast.hourlyData.map((data, index) => {
            const time = new Date(data.timestamp).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            // Cloud ceiling display
            const cloudBase = data.cloudBase;
            let ceilingDisplay = '-';
            let ceilingClass = 'text-gray-700';

            if (cloudBase !== null && cloudBase !== undefined) {
              ceilingDisplay = `${Math.round(cloudBase)}ft`;
              if (cloudBase < 500) {
                ceilingClass = 'text-red-600 font-semibold';
              } else if (cloudBase < 1000) {
                ceilingClass = 'text-orange-600 font-semibold';
              } else if (cloudBase < 2000) {
                ceilingClass = 'text-yellow-600';
              } else {
                ceilingClass = 'text-green-600';
              }
            }

            return (
              <div
                key={index}
                className="border-b border-gray-100 px-4 py-4 flex items-center justify-between min-h-[60px] active:bg-gray-50 transition-colors"
              >
                {/* Time */}
                <div className="w-20">
                  <span className="text-lg font-semibold outdoor-text">{time}</span>
                </div>

                {/* Score Badge */}
                <div className={`px-3 py-2 rounded-lg ${getScoreBadgeClass(data.overallScore)} min-w-[50px] text-center`}>
                  <span className="text-lg font-bold">{data.overallScore}</span>
                </div>

                {/* Weather Details */}
                <div className="flex-1 ml-4 text-right">
                  <div className="text-base outdoor-text">
                    {Number(data.temperature).toFixed(1)}°C
                  </div>
                  <div className="text-sm text-gray-600">
                    {Number(data.windSpeed).toFixed(1)} km/h {getWindDirection(Number(data.windDirection))}
                  </div>
                  <div className={`text-sm ${ceilingClass}`}>
                    {ceilingDisplay}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sunrise/Sunset Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 py-3 text-center">
          <p className="text-sm text-gray-600">
            Sunrise: {forecast.sunrise} | Sunset: {forecast.sunset}
          </p>
        </div>
      </div>
    </div>
  );
}
