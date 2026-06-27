import { useEffect } from 'react';
import { WeatherForecast } from '../../services/weather.service';
import { formatForecastDate } from '../../utils/dateUtils';
import { useSettings } from '../../hooks/useSettings';
import { SettingKey } from '../../services/settings.service';
import { convertWindSpeed, windSpeedUnitLabel } from '../../utils/windSpeed';

interface HourlyWeatherDialogProps {
  forecast: WeatherForecast | null;
  onClose: () => void;
}

export default function HourlyWeatherDialog({ forecast, onClose }: HourlyWeatherDialogProps) {
  const { settingsMap } = useSettings();
  const windUnit = (settingsMap[SettingKey.UNITS_WIND_SPEED] as string) || 'kmh';

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (forecast) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [forecast, onClose]);

  if (!forecast) return null;

  // Calculate daily temperature range
  const temperatures = forecast.hourlyData.map(data => Number(data.temperature));
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);

  // Calculate total rain
  const totalRain = forecast.hourlyData.reduce((sum, data) => sum + Number(data.rain), 0);

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

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {formatForecastDate(forecast.date)}
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
        <div className="px-6 py-4 overflow-auto max-h-[60vh]">
          <style>{`
            .hourly-weather-table-container {
              scrollbar-width: thin;
              scrollbar-color: #888 #f1f1f1;
            }
            .hourly-weather-table-container::-webkit-scrollbar {
              width: 14px;
              height: 14px;
              -webkit-appearance: none;
            }
            .hourly-weather-table-container::-webkit-scrollbar-track {
              background-color: #f1f1f1;
              border-radius: 6px;
            }
            .hourly-weather-table-container::-webkit-scrollbar-thumb {
              background-color: #888;
              border-radius: 6px;
              min-width: 30px;
              min-height: 30px;
            }
            .hourly-weather-table-container::-webkit-scrollbar-thumb:hover {
              background-color: #555;
            }
          `}</style>
          <div className="hourly-weather-table-container">
            <table className="w-full" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-sm font-semibold text-gray-700 pb-2 pr-4 whitespace-nowrap">Time</th>
                  <th className="text-center text-sm font-semibold text-gray-700 pb-2 px-2 whitespace-nowrap">Score</th>
                  <th className="text-right text-sm font-semibold text-gray-700 pb-2 px-2 whitespace-nowrap">Temp</th>
                  <th className="text-right text-sm font-semibold text-gray-700 pb-2 px-2 whitespace-nowrap">Wind</th>
                  <th className="text-center text-sm font-semibold text-gray-700 pb-2 px-2 whitespace-nowrap">Dir</th>
                  <th className="text-right text-sm font-semibold text-gray-700 pb-2 px-2 whitespace-nowrap">Gust</th>
                  <th className="text-right text-sm font-semibold text-gray-700 pb-2 px-2 whitespace-nowrap">Rain</th>
                  <th className="text-right text-sm font-semibold text-gray-700 pb-2 px-2 whitespace-nowrap">Ceiling</th>
                  <th className="text-right text-sm font-semibold text-gray-700 pb-2 pl-2 whitespace-nowrap">Cover %</th>
                </tr>
              </thead>
              <tbody>
                {forecast.hourlyData.map((data, index) => {
                  const time = new Date(data.timestamp).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });

                  // Determine cloud ceiling display
                  const cloudBase = data.cloudBase;
                  const cloudCover = data.cloudCover;
                  let ceilingDisplay = '-';
                  let ceilingClass = 'text-gray-700';
                  let coverDisplay = '-';
                  let coverClass = 'text-gray-700';

                  if (cloudBase !== null && cloudBase !== undefined) {
                    if (cloudBase < 500) {
                      ceilingDisplay = `${Math.round(cloudBase)}ft 🌫️`;
                      ceilingClass = 'text-red-600 font-medium';
                    } else if (cloudBase < 1000) {
                      ceilingDisplay = `${Math.round(cloudBase)}ft`;
                      ceilingClass = 'text-orange-600 font-medium';
                    } else if (cloudBase < 2000) {
                      ceilingDisplay = `${Math.round(cloudBase)}ft`;
                      ceilingClass = 'text-yellow-600';
                    } else {
                      ceilingDisplay = `${Math.round(cloudBase)}ft`;
                      ceilingClass = 'text-green-600';
                    }
                  }

                  // Cloud cover percentage display
                  if (cloudCover !== null && cloudCover !== undefined) {
                    coverDisplay = `${Math.round(cloudCover)}%`;
                    // Color code based on cover percentage
                    if (cloudCover >= 75) {
                      coverClass = 'text-red-600 font-medium';
                    } else if (cloudCover >= 50) {
                      coverClass = 'text-orange-600 font-medium';
                    } else if (cloudCover >= 25) {
                      coverClass = 'text-yellow-600';
                    } else {
                      coverClass = 'text-green-600';
                    }
                  }

                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 text-sm text-gray-900 pr-4 whitespace-nowrap">{time}</td>
                      <td className="py-2 text-center px-2">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded ${getScoreBadgeClass(data.overallScore)}`}
                          style={{ minWidth: '45px' }}
                        >
                          {data.overallScore}
                        </span>
                      </td>
                      <td className="py-2 text-right text-sm text-gray-700 px-2 whitespace-nowrap">
                        {Number(data.temperature).toFixed(1)}°C
                      </td>
                      <td className="py-2 text-right text-sm text-gray-700 px-2 whitespace-nowrap">
                        {convertWindSpeed(Number(data.windSpeed), windUnit).toFixed(1)} {windSpeedUnitLabel(windUnit)}
                      </td>
                      <td className="py-2 text-center text-sm font-medium text-gray-900 px-2 whitespace-nowrap">
                        {getWindDirection(Number(data.windDirection))}
                      </td>
                      <td className="py-2 text-right text-sm text-gray-700 px-2 whitespace-nowrap">
                        {convertWindSpeed(Number(data.gustSpeed), windUnit).toFixed(1)} {windSpeedUnitLabel(windUnit)}
                      </td>
                      <td className="py-2 text-right text-sm text-gray-700 px-2 whitespace-nowrap">
                        {Number(data.rain).toFixed(1)} mm
                      </td>
                      <td className={`py-2 text-right text-sm px-2 whitespace-nowrap ${ceilingClass}`}>
                        {ceilingDisplay}
                      </td>
                      <td className={`py-2 text-right text-sm pl-2 whitespace-nowrap ${coverClass}`}>
                        {coverDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
