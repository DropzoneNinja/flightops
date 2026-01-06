import { useEffect } from 'react';
import { WeatherForecast } from '../../services/weather.service';
import { formatForecastDate } from '../../utils/dateUtils';

interface HourlyWeatherDialogProps {
  forecast: WeatherForecast | null;
  onClose: () => void;
}

export default function HourlyWeatherDialog({ forecast, onClose }: HourlyWeatherDialogProps) {
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

  const getScoreBadgeClass = (score: number) => {
    if (score >= 76) return 'bg-green-600 text-white';
    if (score >= 51) return 'bg-green-300 text-gray-900';
    if (score >= 26) return 'bg-yellow-300 text-gray-900';
    return 'bg-red-500 text-white';
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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {formatForecastDate(forecast.date)}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Sunrise: {forecast.sunrise} | Sunset: {forecast.sunset}
            </p>
          </div>
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

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-sm font-semibold text-gray-700 pb-2">Time</th>
                <th className="text-center text-sm font-semibold text-gray-700 pb-2">Score</th>
                <th className="text-right text-sm font-semibold text-gray-700 pb-2">Temp</th>
                <th className="text-right text-sm font-semibold text-gray-700 pb-2">Wind</th>
                <th className="text-right text-sm font-semibold text-gray-700 pb-2">Gust</th>
                <th className="text-right text-sm font-semibold text-gray-700 pb-2">Rain</th>
              </tr>
            </thead>
            <tbody>
              {forecast.hourlyData.map((data, index) => {
                const time = new Date(data.timestamp).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

                return (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 text-sm text-gray-900">{time}</td>
                    <td className="py-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded ${getScoreBadgeClass(data.overallScore)}`}
                        style={{ minWidth: '45px' }}
                      >
                        {data.overallScore}
                      </span>
                    </td>
                    <td className="py-2 text-right text-sm text-gray-700">
                      {Number(data.temperature).toFixed(1)}°C
                    </td>
                    <td className="py-2 text-right text-sm text-gray-700">
                      {Number(data.windSpeed).toFixed(1)} km/h
                    </td>
                    <td className="py-2 text-right text-sm text-gray-700">
                      {Number(data.gustSpeed).toFixed(1)} km/h
                    </td>
                    <td className="py-2 text-right text-sm text-gray-700">
                      {Number(data.rain).toFixed(1)} mm
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
