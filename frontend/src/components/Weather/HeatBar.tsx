import { HourlyWeatherData } from '../../services/weather.service';
import { scoreToHeatColor } from '../../utils/colorInterpolation';

interface HeatBarProps {
  hourlyData: HourlyWeatherData[];
  type: 'wind' | 'gust' | 'rain';
  label: string;
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
          const color = scoreToHeatColor(score);
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
