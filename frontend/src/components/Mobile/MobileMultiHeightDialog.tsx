import { useMemo } from 'react';
import { WeatherForecast } from '../../services/weather.service';
import { useMultiHeightWeather } from '../../hooks/useMultiHeightWeather';
import { formatForecastDate } from '../../utils/dateUtils';
import { useSettings } from '../../hooks/useSettings';
import { SettingKey } from '../../services/settings.service';
import { formatTemperature } from '../../utils/temperatureUtils';
import { scoreToHeatColor } from '../../utils/colorInterpolation';
import WindArrow from '../Weather/WindArrow';
import BottomSheet from './BottomSheet';

/**
 * MobileMultiHeightDialog - Mobile-optimized bottom sheet for multi-height wind data
 *
 * Displays wind data at three different heights (10m, 80m, 120m) in a horizontally
 * scrollable table format. Triggered when users click heat bars on mobile.
 */

interface MobileMultiHeightDialogProps {
  isOpen: boolean;
  onClose: () => void;
  forecast: WeatherForecast | null;
  siteId: string;
}

export default function MobileMultiHeightDialog({
  isOpen,
  onClose,
  forecast,
  siteId,
}: MobileMultiHeightDialogProps) {
  // Extract date from forecast
  const dateString = forecast?.date
    ? new Date(forecast.date).toISOString().split('T')[0]
    : null;

  // Fetch multi-height data
  const { data, isLoading, error } = useMultiHeightWeather(siteId, dateString);

  // Fetch user settings for temperature unit and gust threshold
  const { settingsMap, isLoadingMap } = useSettings();
  const temperatureUnit = (settingsMap[SettingKey.UNITS_TEMPERATURE] as 'celsius' | 'fahrenheit') || 'celsius';
  const gustThreshold = (settingsMap[SettingKey.GUST_SMOOTH_MAX] as number) || 15;

  // Filter hourly data to sunrise-sunset range
  const filteredHours = useMemo(() => {
    if (!data || !forecast) return [];

    const sunriseHour = parseInt(forecast.sunrise.split(':')[0]);
    const sunsetHour = parseInt(forecast.sunset.split(':')[0]);

    return data.hourlyData.filter((hourData) => {
      const hour = new Date(hourData.timestamp).getHours();
      return hour >= sunriseHour && hour <= sunsetHour;
    });
  }, [data, forecast]);

  // Helper function to get heat bar color for a given timestamp
  const getHeatBarColor = (timestamp: string): string => {
    if (!forecast) return 'transparent';

    // Find matching hourly data by timestamp
    const matchingHour = forecast.hourlyData.find(
      (hour) => hour.timestamp === timestamp
    );

    if (!matchingHour) return 'transparent';

    // Use overall score to determine color
    return scoreToHeatColor(matchingHour.overallScore);
  };

  if (!isOpen || !forecast) return null;

  // Calculate daily temperature range and total rain from forecast hourly data
  const temperatures = forecast.hourlyData.map(data => Number(data.temperature));
  const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : 0;
  const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 0;
  const totalRain = forecast.hourlyData.reduce((sum, data) => sum + Number(data.rain), 0);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Multi-Height Wind - ${formatForecastDate(forecast.date)}`}
      height="full"
    >
      <style>{`
        .scroll-container-horizontal {
          overflow-x: auto !important;
          overflow-y: hidden;
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
          -webkit-overflow-scrolling: touch;
        }
        .scroll-container-horizontal::-webkit-scrollbar {
          height: 14px;
          -webkit-appearance: none;
        }
        .scroll-container-horizontal::-webkit-scrollbar-track {
          background-color: #f1f1f1;
          border-radius: 6px;
        }
        .scroll-container-horizontal::-webkit-scrollbar-thumb {
          background-color: #888;
          border-radius: 6px;
          min-width: 30px;
        }
        .scroll-container-horizontal::-webkit-scrollbar-thumb:hover {
          background-color: #555;
        }
      `}</style>

      {/* Info Row */}
      <div className="mb-4 space-y-1">
        <p className="text-sm text-gray-600">
          Sunrise: {forecast.sunrise} | Sunset: {forecast.sunset}
        </p>
        <p className="text-sm text-gray-600">
          Temp: {formatTemperature(minTemp, temperatureUnit)} - {formatTemperature(maxTemp, temperatureUnit)} | Rain: {totalRain.toFixed(1)} mm
        </p>
      </div>

      {/* Loading State */}
      {(isLoading || isLoadingMap) && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading multi-height data...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold">Failed to load multi-height data</p>
          <p className="text-gray-600 mt-2">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
        </div>
      )}

      {/* Data Table */}
      {data && !isLoading && !error && (
        <div className="scroll-container-horizontal -mx-6 px-6">
          <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                <th
                  className="border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 outdoor-text sticky left-0 z-10"
                  style={{ minWidth: '100px' }}
                >
                  Height
                </th>
                {filteredHours.map((hourData, index) => {
                  const time = new Date(hourData.timestamp).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });
                  return (
                    <th
                      key={index}
                      className="border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 outdoor-text whitespace-nowrap"
                      style={{ minWidth: '120px' }}
                    >
                      {time}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* 120m row (394 ft) */}
              <tr>
                <td
                  className="border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 z-10"
                  style={{ minWidth: '100px' }}
                >
                  394 ft
                </td>
                {filteredHours.map((hourData, index) => (
                  <td
                    key={index}
                    className="border border-gray-300 px-4 py-2 text-center text-sm"
                    style={{ minWidth: '120px', height: '60px' }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {/* Line 1: Temperature */}
                      <div className="flex items-center justify-between w-full text-xs">
                        <span className="text-black font-bold">
                          {formatTemperature(hourData.wind_120m.temperature, temperatureUnit)}
                        </span>
                      </div>
                      {/* Line 2: Wind Speed */}
                      <div className="flex items-center justify-center w-full">
                        <span className="font-medium text-gray-900">
                          {Math.round(hourData.wind_120m.speed)} km/h
                        </span>
                      </div>
                      {/* Line 3: Wind Arrow | Fog Icon */}
                      <div className="flex items-center justify-between w-full">
                        <WindArrow direction={hourData.wind_120m.direction} />
                        {hourData.wind_120m.fog && (
                          <img
                            src="/icon-fog.png"
                            alt="Fog/Low clouds at this level"
                            title="Fog/Low clouds at this level"
                            className="w-4 h-4"
                          />
                        )}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>

              {/* 80m row (262 ft) */}
              <tr>
                <td
                  className="border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 z-10"
                  style={{ minWidth: '100px' }}
                >
                  262 ft
                </td>
                {filteredHours.map((hourData, index) => (
                  <td
                    key={index}
                    className="border border-gray-300 px-4 py-2 text-center text-sm"
                    style={{ minWidth: '120px', height: '60px' }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {/* Line 1: Temperature */}
                      <div className="flex items-center justify-between w-full text-xs">
                        <span className="text-black font-bold">
                          {formatTemperature(hourData.wind_80m.temperature, temperatureUnit)}
                        </span>
                      </div>
                      {/* Line 2: Wind Speed */}
                      <div className="flex items-center justify-center w-full">
                        <span className="font-medium text-gray-900">
                          {Math.round(hourData.wind_80m.speed)} km/h
                        </span>
                      </div>
                      {/* Line 3: Wind Arrow | Fog Icon */}
                      <div className="flex items-center justify-between w-full">
                        <WindArrow direction={hourData.wind_80m.direction} />
                        {hourData.wind_80m.fog && (
                          <img
                            src="/icon-fog.png"
                            alt="Fog/Low clouds at this level"
                            title="Fog/Low clouds at this level"
                            className="w-4 h-4"
                          />
                        )}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>

              {/* 10m row (33 ft) - with heat bar colors */}
              <tr>
                <td
                  className="border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 z-10"
                  style={{ minWidth: '100px' }}
                >
                  33 ft
                </td>
                {filteredHours.map((hourData, index) => {
                  const hasRain = hourData.wind_10m.precipitation !== null &&
                                 hourData.wind_10m.precipitation !== undefined &&
                                 hourData.wind_10m.precipitation > 0;
                  const heatColor = getHeatBarColor(hourData.timestamp);
                  return (
                    <td
                      key={index}
                      className="border border-gray-300 px-4 py-2 text-center text-sm"
                      style={{
                        minWidth: '120px',
                        height: '60px',
                        backgroundColor: heatColor,
                        opacity: 0.85
                      }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {/* Line 1: Temperature | Rain Icon */}
                        <div className="flex items-center justify-between w-full text-xs">
                          <span className="text-black font-bold">
                            {formatTemperature(hourData.wind_10m.temperature, temperatureUnit)}
                          </span>
                          {hasRain && (
                            <img
                              src="/rain.webp"
                              alt={`Rain: ${hourData.wind_10m.precipitation!.toFixed(1)} mm`}
                              title={`Rain: ${hourData.wind_10m.precipitation!.toFixed(1)} mm`}
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                        {/* Line 2: Wind Speed */}
                        <div className="flex items-center justify-center w-full">
                          <span className="font-medium text-gray-900">
                            {Math.round(hourData.wind_10m.speed)} km/h
                          </span>
                        </div>
                        {/* Line 3: Wind Arrow | Fog Icon | Gusts Icon */}
                        <div className="flex items-center justify-between w-full">
                          <WindArrow direction={hourData.wind_10m.direction} />
                          {hourData.wind_10m.fog && (
                            <img
                              src="/icon-fog.png"
                              alt="Fog/Low clouds at surface level"
                              title="Fog/Low clouds at surface level"
                              className="w-4 h-4"
                            />
                          )}
                          {hourData.wind_10m.gusts !== null &&
                           hourData.wind_10m.gusts !== undefined &&
                           hourData.wind_10m.gusts > gustThreshold && (
                            <img
                              src="/gusts.webp"
                              alt={`Gusts: ${hourData.wind_10m.gusts.toFixed(1)} km/h`}
                              title={`Gusts: ${hourData.wind_10m.gusts.toFixed(1)} km/h`}
                              className="w-4 h-4"
                            />
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </BottomSheet>
  );
}
