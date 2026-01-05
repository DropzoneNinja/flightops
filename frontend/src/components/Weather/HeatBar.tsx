import { HourlyWeatherData } from '../../services/weather.service';

interface HeatBarProps {
  hourlyData: HourlyWeatherData[];
  type: 'wind' | 'gust' | 'rain';
  label: string;
}

/**
 * Get color based on score (0-100)
 * 80-100: Green
 * 60-79: Yellow
 * 40-59: Orange
 * 0-39: Red
 */
function getColorFromScore(score: number): string {
  if (score >= 80) return '#22c55e'; // green-500
  if (score >= 60) return '#eab308'; // yellow-500
  if (score >= 40) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

export default function HeatBar({ hourlyData, type, label }: HeatBarProps) {
  if (!hourlyData || hourlyData.length === 0) {
    return (
      <div className="mb-2">
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <div className="h-4 bg-gray-200 rounded flex items-center justify-center">
          <span className="text-xs text-gray-500">No data</span>
        </div>
      </div>
    );
  }

  const getScoreForType = (data: HourlyWeatherData) => {
    switch (type) {
      case 'wind':
        return data.windScore;
      case 'gust':
        return data.gustScore;
      case 'rain':
        return data.rainScore;
      default:
        return 0;
    }
  };

  return (
    <div className="mb-2">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="h-4 rounded overflow-hidden flex">
        {hourlyData.map((data, index) => {
          const score = getScoreForType(data);
          const color = getColorFromScore(score);
          const width = `${100 / hourlyData.length}%`;

          return (
            <div
              key={index}
              className="transition-all hover:opacity-80"
              style={{
                backgroundColor: color,
                width,
              }}
              title={`${new Date(data.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}: Score ${score}`}
            />
          );
        })}
      </div>
    </div>
  );
}
