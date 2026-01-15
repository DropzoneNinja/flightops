import { Marker, Polyline } from 'react-leaflet';
import { FlightSite } from '../../services/sites.service';
import { useWeather } from '../../hooks/useWeather';
import { useSettings } from '../../hooks/useSettings';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot, Root } from 'react-dom/client';
import L from 'leaflet';
import WeatherForecastBars from '../Weather/WeatherForecastBars';
import HourlyWeatherDialog from '../Weather/HourlyWeatherDialog';
import HeatbarDebugDialog from '../Weather/HeatbarDebugDialog';
import { WeatherForecast } from '../../services/weather.service';

// Custom marker icons for takeoff and parking
const takeoffIcon = new L.Icon({
  iconUrl: '/icon-ppg.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [64, 64],
  iconAnchor: [32, 32],  // Center of the takeoff icon (64x64)
  popupAnchor: [0, -32],
  shadowSize: [82, 82],
});

const parkingIcon = new L.Icon({
  iconUrl: '/icon-park.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [64, 64],
  iconAnchor: [32, 32],  // Center of the parking icon (64x64)
  popupAnchor: [0, -32],
  shadowSize: [82, 82],
});

interface SiteMarkerProps {
  site: FlightSite;
  currentZoom: number;
  parkingIconZoomLevel: number;
  onTakeoffClick?: (site: FlightSite) => void;
}

export default function SiteMarker({ site, currentZoom, parkingIconZoomLevel, onTakeoffClick }: SiteMarkerProps) {
  const { forecasts, isLoading: isLoadingWeather } = useWeather(site.id);
  const { settingsMap } = useSettings();
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecast | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const rootRef = useRef<Root | null>(null);

  // Check if heatbar debug mode is enabled
  const isDebugMode = settingsMap['debug.heatbar_debug_mode'] === true;

  // Get weather forecast days setting (default to 3)
  const forecastDays = typeof settingsMap['weather.forecast_days'] === 'number'
    ? settingsMap['weather.forecast_days']
    : 3;

  // Debug logging for settings
  useEffect(() => {
    console.log('🔧 [SiteMarker]', site.name, '- settingsMap:', settingsMap);
    console.log('  - debug.heatbar_debug_mode:', settingsMap['debug.heatbar_debug_mode'], typeof settingsMap['debug.heatbar_debug_mode']);
    console.log('  - isDebugMode:', isDebugMode);
  }, [settingsMap, site.name, isDebugMode]);

  // Convert coordinates to numbers (they come as strings from PostgreSQL decimal type)
  const takeoffLat = parseFloat(site.takeoff_lat.toString());
  const takeoffLon = parseFloat(site.takeoff_lon.toString());
  const parkingLat = parseFloat(site.parking_lat.toString());
  const parkingLon = parseFloat(site.parking_lon.toString());

  // Create DivIcon for weather bars marker
  // Below parkingIconZoomLevel: Centered on takeoff location
  // At parkingIconZoomLevel+: Positioned to the right of takeoff icon
  const weatherBarsDivIcon = useMemo(() => {
    const showIcon = currentZoom >= parkingIconZoomLevel;
    const iconSize: [number, number] = [120, 60]; // Weather bars size
    const iconAnchor: [number, number] = showIcon
      ? [-56, 30]  // Position to the right of takeoff icon (32px icon half + 24px spacing = -56)
      : [60, 30];  // Center of the weather bars when icon not visible
    const popupAnchor: [number, number] = [60, -30]; // Above bars

    return new L.DivIcon({
      className: 'custom-marker-with-weather',
      html: '<div class="weather-bars-container"></div>',
      iconSize,
      iconAnchor,
      popupAnchor,
    });
  }, [currentZoom, parkingIconZoomLevel]);

  // Render React content into the weather bars DivIcon
  useEffect(() => {
    const markerElement = markerRef.current?.getElement();
    if (!markerElement) return;

    const container = markerElement.querySelector('.weather-bars-container');
    if (!container) return;

    // Create root only once
    if (!rootRef.current) {
      rootRef.current = createRoot(container);
    }

    // Always render weather bars
    rootRef.current.render(
      <WeatherForecastBars
        forecasts={forecasts}
        isLoading={isLoadingWeather}
        onDayClick={setSelectedForecast}
        maxDays={forecastDays}
      />
    );

    // Cleanup on unmount only
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, [forecasts, isLoadingWeather, currentZoom, parkingIconZoomLevel, forecastDays]);

  const handleMarkerClick = (e: L.LeafletMouseEvent) => {
    // Prevent default popup behavior
    e.originalEvent.stopPropagation();

    if (onTakeoffClick) {
      onTakeoffClick(site);
    }
  };

  // Line connecting takeoff and parking
  const positions: [number, number][] = [
    [takeoffLat, takeoffLon],
    [parkingLat, parkingLon],
  ];

  // Determine if parking marker should be visible based on zoom level
  const shouldShowParkingMarker = currentZoom >= parkingIconZoomLevel;

  return (
    <>
      {/* Weather Dialog */}
      {isDebugMode ? (
        <HeatbarDebugDialog
          forecast={selectedForecast}
          siteId={site.id}
          onClose={() => setSelectedForecast(null)}
        />
      ) : (
        <HourlyWeatherDialog
          forecast={selectedForecast}
          onClose={() => setSelectedForecast(null)}
        />
      )}

      {/* Line connecting takeoff to parking */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: site.enabled ? '#22c55e' : '#9ca3af',
          weight: 2,
          opacity: 0.6,
          dashArray: '5, 5',
        }}
      />

      {/* Weather bars marker - always visible, position changes based on zoom */}
      <Marker
        ref={markerRef}
        position={[takeoffLat, takeoffLon]}
        icon={weatherBarsDivIcon}
      />

      {/* Takeoff icon marker - only visible at high zoom */}
      {currentZoom >= parkingIconZoomLevel && (
        <Marker
          position={[takeoffLat, takeoffLon]}
          icon={takeoffIcon}
          eventHandlers={{
            click: handleMarkerClick,
          }}
        />
      )}

      {/* Parking marker - only visible when zoomed in */}
      {shouldShowParkingMarker && (
        <Marker
          position={[parkingLat, parkingLon]}
          icon={parkingIcon}
        />
      )}
    </>
  );
}
