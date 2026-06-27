import { useState, useEffect } from 'react';
import { weatherService, WeatherForecast } from '../services/weather.service';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: WeatherForecast[];
  fetchedAt: number;
}

const weatherCache = new Map<string, CacheEntry>();

function getCached(siteId: string): WeatherForecast[] | null {
  const entry = weatherCache.get(siteId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL) {
    weatherCache.delete(siteId);
    return null;
  }
  return entry.data;
}

export function invalidateWeatherCache(siteId: string) {
  weatherCache.delete(siteId);
}

export function useWeather(siteId: string | null) {
  const [forecasts, setForecasts] = useState<WeatherForecast[]>(() =>
    siteId ? (getCached(siteId) ?? []) : []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setForecasts([]);
      return;
    }

    const cached = getCached(siteId);
    if (cached) {
      setForecasts(cached);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);
    weatherService.getForecastBySite(siteId)
      .then((data) => {
        if (!cancelled) {
          weatherCache.set(siteId, { data, fetchedAt: Date.now() });
          setForecasts(data);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to fetch weather data');
          setForecasts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
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
