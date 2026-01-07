import { Marker, Popup, Polyline } from 'react-leaflet';
import { FlightSite } from '../../services/sites.service';
import { useSites } from '../../hooks/useSites';
import { useAuth } from '../../hooks/useAuth';
import { useWeather } from '../../hooks/useWeather';
import { useSettings } from '../../hooks/useSettings';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot, Root } from 'react-dom/client';
import L from 'leaflet';
import HeatBar from '../Weather/HeatBar';
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
}

export default function SiteMarker({ site, currentZoom, parkingIconZoomLevel }: SiteMarkerProps) {
  const { deleteSiteMutation, toggleSiteEnabledMutation } = useSites();
  const { user } = useAuth();
  const { forecasts, isLoading: isLoadingWeather } = useWeather(site.id);
  const { settingsMap } = useSettings();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecast | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const rootRef = useRef<Root | null>(null);

  // Check if heatbar debug mode is enabled
  const isDebugMode = settingsMap['debug.heatbar_debug_mode'] === true;

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
      />
    );

    // Cleanup on unmount only
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, [forecasts, isLoadingWeather, currentZoom, parkingIconZoomLevel]);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${site.name}"?`)) {
      setIsDeleting(true);
      try {
        await deleteSiteMutation.mutateAsync(site.id);
      } catch (error) {
        console.error('Failed to delete site:', error);
        alert('Failed to delete site. Please try again.');
        setIsDeleting(false);
      }
    }
  };

  const handleToggleEnabled = async () => {
    try {
      await toggleSiteEnabledMutation.mutateAsync(site.id);
    } catch (error) {
      console.error('Failed to toggle site status:', error);
      alert('Failed to update site status. Please try again.');
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
        >
          <Popup>
            <div className="min-w-[350px] max-w-[400px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900">{site.name}</h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    site.enabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {site.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

            <div className="space-y-2 mb-3">
              <div>
                <p className="text-xs font-medium text-gray-500">Takeoff</p>
                <p className="text-sm text-gray-700">
                  {takeoffLat.toFixed(6)}, {takeoffLon.toFixed(6)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Parking</p>
                <p className="text-sm text-gray-700">
                  {parkingLat.toFixed(6)}, {parkingLon.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Weather Forecast Section */}
            <div className="border-t pt-3 mb-3">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                3-Day Forecast
              </h4>
              {isLoadingWeather ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-xs text-gray-600">Loading weather...</p>
                </div>
              ) : forecasts.length > 0 ? (
                <div className="space-y-3">
                  {forecasts.map((forecast) => (
                    <div key={forecast.id} className="bg-gray-50 p-2 rounded">
                      <p className="text-xs font-medium text-gray-700 mb-2">
                        {new Date(forecast.date).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <HeatBar
                        hourlyData={forecast.hourlyData}
                        type="wind"
                        label="Wind"
                      />
                      <HeatBar
                        hourlyData={forecast.hourlyData}
                        type="gust"
                        label="Gusts"
                      />
                      <HeatBar
                        hourlyData={forecast.hourlyData}
                        type="rain"
                        label="Rain"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">
                  No forecast data available
                </p>
              )}
            </div>

            {user?.is_admin && (
              <div className="flex gap-2 border-t pt-3">
                <button
                  onClick={handleToggleEnabled}
                  disabled={toggleSiteEnabledMutation.isPending}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                    site.enabled
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {toggleSiteEnabledMutation.isPending
                    ? 'Updating...'
                    : site.enabled
                    ? 'Disable'
                    : 'Enable'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting || deleteSiteMutation.isPending}
                  className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting || deleteSiteMutation.isPending
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </Popup>
        </Marker>
      )}

      {/* Parking marker - only visible when zoomed in */}
      {shouldShowParkingMarker && (
        <Marker
          position={[parkingLat, parkingLon]}
          icon={parkingIcon}
        >
          <Popup>
            <div className="min-w-[200px]">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Parking - {site.name}
              </h4>
              <p className="text-xs text-gray-700">
                {parkingLat.toFixed(6)}, {parkingLon.toFixed(6)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}
