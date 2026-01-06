import { WeatherForecast } from '../../services/weather.service';
import { scoreToHeatColor } from '../../utils/colorInterpolation';

interface DayForecastBarProps {
  forecast: WeatherForecast;
  label: string;
  onClick: () => void;
}

export default function DayForecastBar({ forecast, label, onClick }: DayForecastBarProps) {
  if (!forecast.hourlyData || forecast.hourlyData.length === 0) {
    return (
      <div className="flex items-center gap-1 mb-0.5 last:mb-0">
        <span className="text-xs font-semibold text-gray-700 w-6 text-right">{label}</span>
        <div className="h-4 bg-gray-200 rounded" style={{ width: '96px' }}>
          <span className="text-[10px] text-gray-500">No data</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 mb-0.5 last:mb-0 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
      title={`${forecast.date} - Click for details`}
    >
      <span className="text-xs font-semibold text-gray-700 w-6 text-right">{label}</span>
      <div className="h-4 rounded overflow-hidden flex" style={{ width: '96px' }}>
        {forecast.hourlyData.map((data, index) => {
          const score = data.overallScore;
          const color = scoreToHeatColor(score);
          const width = `${100 / forecast.hourlyData.length}%`;

          return (
            <div
              key={index}
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
