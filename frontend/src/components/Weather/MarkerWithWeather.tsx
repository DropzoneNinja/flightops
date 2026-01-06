import { WeatherForecast } from '../../services/weather.service';
import WeatherForecastBars from './WeatherForecastBars';

interface MarkerWithWeatherProps {
  forecasts: WeatherForecast[];
  isLoading: boolean;
  onDayClick: (forecast: WeatherForecast) => void;
  shouldShowIcon: boolean;
}

export default function MarkerWithWeather({ forecasts, isLoading, onDayClick, shouldShowIcon }: MarkerWithWeatherProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: shouldShowIcon ? '64px' : 'auto' }}>
      {shouldShowIcon ? (
        <img src="/icon-ppg.png" width="64" height="64" alt="Takeoff" />
      ) : (
        <WeatherForecastBars
          forecasts={forecasts}
          isLoading={isLoading}
          onDayClick={onDayClick}
        />
      )}
    </div>
  );
}
