import { WeatherForecast } from '../../services/weather.service';
import { getDayAbbreviation } from '../../utils/dateUtils';
import DayForecastBar from './DayForecastBar';

interface WeatherForecastBarsProps {
  forecasts: WeatherForecast[];
  onDayClick: (forecast: WeatherForecast) => void;
  isLoading: boolean;
}

export default function WeatherForecastBars({ forecasts, onDayClick, isLoading }: WeatherForecastBarsProps) {
  if (isLoading) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded shadow-lg p-1.5 ml-6 border-2 border-black" style={{ width: '120px' }}>
        <div className="flex items-center justify-center py-2">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded shadow-lg p-1.5 ml-6 border-2 border-black" style={{ width: '120px' }}>
        <span className="text-[10px] text-gray-500">No data</span>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded shadow-lg p-1.5 ml-6 border-2 border-black" style={{ width: '120px' }}>
      {forecasts.map((forecast) => (
        <DayForecastBar
          key={forecast.id}
          forecast={forecast}
          label={getDayAbbreviation(forecast.date)}
          onClick={() => onDayClick(forecast)}
        />
      ))}
    </div>
  );
}
