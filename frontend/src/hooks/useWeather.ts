import { useState, useEffect, useCallback } from 'react';
import { weatherService, WeatherForecast } from '../services/weather.service';

export function useWeather(siteId: string | null) {
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize fetch function so it can be used in multiple effects
  const fetchForecasts = useCallback(async () => {
    if (!siteId) {
      setForecasts([]);
      return;
    }

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
  }, [siteId]);

  // Initial fetch
  useEffect(() => {
    fetchForecasts();
  }, [fetchForecasts]);

  // Connect to real-time updates via SSE
  useEffect(() => {
    if (!siteId) return;

    const eventSource = weatherService.connectToWeatherUpdates((updatedSiteId) => {
      // Only refetch if update is for current site
      if (updatedSiteId === siteId) {
        console.log(`Weather updated for site ${siteId}, refreshing...`);
        fetchForecasts();
      }
    });

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [siteId, fetchForecasts]);

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
