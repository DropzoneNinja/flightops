import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WeatherForecast } from '../../services/weather.service';
import { useMultiHeightWeather } from '../../hooks/useMultiHeightWeather';
import { formatForecastDate } from '../../utils/dateUtils';
import { useSettings } from '../../hooks/useSettings';
import { SettingKey } from '../../services/settings.service';
import { formatTemperature } from '../../utils/temperatureUtils';
import { scoreToHeatColor } from '../../utils/colorInterpolation';
import WindArrow from './WindArrow';

interface HeatbarDebugDialogProps {
  forecast: WeatherForecast | null;
  siteId: string;
  onClose: () => void;
}

export default function HeatbarDebugDialog({
  forecast,
  siteId,
  onClose,
}: HeatbarDebugDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Handle Escape key and prevent body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (forecast) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll and interaction when dialog is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [forecast, onClose]);

  // Prevent wheel events from reaching the map (non-passive listener)
  // But only when scrolling on the backdrop itself, not the dialog content
  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop || !forecast) return;

    const handleWheel = (e: WheelEvent) => {
      // Only prevent if the target is the backdrop itself (not a child element)
      if (e.target === backdrop) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    backdrop.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      backdrop.removeEventListener('wheel', handleWheel);
    };
  }, [forecast]);

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

  if (!forecast) return null;

  // Calculate daily temperature range and total rain from forecast hourly data
  const temperatures = forecast.hourlyData.map(data => Number(data.temperature));
  const minTemp = temperatures.length > 0 ? Math.min(...temperatures) : 0;
  const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 0;
  const totalRain = forecast.hourlyData.reduce((sum, data) => sum + Number(data.rain), 0);

  const modalContent = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{ isolation: 'isolate', pointerEvents: 'auto' }}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col relative z-10"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Multi-Height Wind Data - {formatForecastDate(forecast.date)}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-600">
              Sunrise: {forecast.sunrise} | Sunset: {forecast.sunset}
            </p>
            <p className="text-sm text-gray-600">
              Temp: {minTemp.toFixed(1)}°C - {maxTemp.toFixed(1)}°C | Rain: {totalRain.toFixed(1)} mm
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {(isLoading || isLoadingMap) && (
            <div className="text-center py-12 px-6">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading multi-height data...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12 px-6">
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

          {data && !isLoading && !error && (
            <div className="px-6 py-4">
              <style>{`
                .scroll-container-horizontal {
                  overflow-x: scroll !important;
                  overflow-y: auto;
                  scrollbar-width: thin;
                  scrollbar-color: #888 #f1f1f1;
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
              <div
                className="scroll-container-horizontal"
                style={{ maxHeight: '400px' }}
              >
                <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 sticky left-0 z-10 bg-gray-100" style={{ minWidth: '80px' }}>
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
                          className="border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap"
                          style={{ minWidth: '100px' }}
                        >
                          {time}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* 120m row */}
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 z-10" style={{ minWidth: '80px' }}>
                      394 ft
                    </td>
                    {filteredHours.map((hourData, index) => (
                      <td
                        key={index}
                        className="border border-gray-300 px-4 py-2 text-center text-sm"
                        style={{ minWidth: '100px' }}
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

                  {/* 80m row */}
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 z-10" style={{ minWidth: '80px' }}>
                      262 ft
                    </td>
                    {filteredHours.map((hourData, index) => (
                      <td
                        key={index}
                        className="border border-gray-300 px-4 py-2 text-center text-sm"
                        style={{ minWidth: '100px' }}
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

                  {/* 10m row */}
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 z-10" style={{ minWidth: '80px' }}>
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
                            minWidth: '100px',
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
