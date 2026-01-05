import { useState, useEffect } from 'react';
import { weatherService, WeatherForecast } from '../services/weather.service';

export function useWeather(siteId: string | null) {
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setForecasts([]);
      return;
    }

    const fetchForecasts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await weatherService.getForecastBySite(siteId);
        setForecasts(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch weather data');
        setForecasts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForecasts();
  }, [siteId]);

  return { forecasts, isLoading, error };
}

export function useWeatherByDate(siteId: string | null, date: string | null) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId || !date) {
      setForecast(null);
      return;
    }

    const fetchForecast = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await weatherService.getForecastByDate(siteId, date);
        setForecast(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch weather data');
        setForecast(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForecast();
  }, [siteId, date]);

  return { forecast, isLoading, error };
}
