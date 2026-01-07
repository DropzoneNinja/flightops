import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { useSites } from '../hooks/useSites';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import SiteMarker from '../components/Site/SiteMarker';
import AddSitePanel from '../components/Site/AddSitePanel';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
});

// Create a custom orange icon for temporary location selection
const TempIcon = L.divIcon({
  className: 'custom-temp-marker',
  html: `<div style="
    width: 30px;
    height: 30px;
    background-color: #ff6b00;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(255, 107, 0, 0.8);
    animation: pulse 1.5s ease-in-out infinite;
  "></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  // Set initial zoom
  useState(() => {
    onZoomChange(map.getZoom());
  });

  return null;
}

export default function MapView() {
  const { sites, isLoading } = useSites();
  const { logout, user } = useAuth();
  const { settingsMap, isLoadingMap } = useSettings();
  const navigate = useNavigate();
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [activeLocationSelection, setActiveLocationSelection] = useState<'takeoff' | 'parking' | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LatLng | null>(null);
  const [pendingLocationType, setPendingLocationType] = useState<'takeoff' | 'parking' | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(6);
  const [showZoomIndicator, setShowZoomIndicator] = useState(true);
  const [parkingIconZoomLevel, setParkingIconZoomLevel] = useState(10);

  // Update state when settings are loaded
  useEffect(() => {
    if (!isLoadingMap && settingsMap) {
      if (settingsMap['map.show_zoom_indicator'] !== undefined) {
        setShowZoomIndicator(settingsMap['map.show_zoom_indicator']);
      }
      if (settingsMap['map.parking_icon_zoom_level'] !== undefined) {
        setParkingIconZoomLevel(settingsMap['map.parking_icon_zoom_level']);
      }
    }
  }, [settingsMap, isLoadingMap]);

  const handleMapClick = (latlng: LatLng) => {
    // Only handle clicks when actively selecting a location
    if (activeLocationSelection) {
      setPendingLocation(latlng);
      setPendingLocationType(activeLocationSelection);
      setActiveLocationSelection(null); // Return to neutral mode after selection
    }
  };

  const handleAddSiteClick = () => {
    setIsAddPanelOpen(true); // Open panel immediately
  };

  const handlePanelClose = () => {
    setIsAddPanelOpen(false);
    setActiveLocationSelection(null);
    setPendingLocation(null);
    setPendingLocationType(null);
  };

  const handleSelectLocation = (type: 'takeoff' | 'parking') => {
    setActiveLocationSelection(type);
  };

  const handleFetchWeather = async () => {
    setIsFetchingWeather(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:3000/weather/fetch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Weather data fetched successfully! Refresh the page to see updated forecasts.');
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Failed to fetch weather: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
      alert('Failed to fetch weather data. Check console for details.');
    } finally {
      setIsFetchingWeather(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Custom styles for crosshair and pulse animation */}
      <style>{`
        .cursor-crosshair,
        .cursor-crosshair * {
          cursor: crosshair !important;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }

        /* Custom crosshair cursor for better visibility */
        .leaflet-container.leaflet-crosshair-cursor-enabled {
          cursor: crosshair !important;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white shadow-sm border-b-2 border-gray-200 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="border-r-2 border-gray-300 pr-6 flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Throttle Junkies"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">FlightOps</h1>
                <p className="text-sm text-gray-600">Paramotor Flight Sites</p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-4 ml-auto">
              <span className="text-sm text-gray-600">{user?.username || user?.email}</span>
              <button
                onClick={handleAddSiteClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Add Site
              </button>
              {user?.is_admin && (
                <>
                  <button
                    onClick={handleFetchWeather}
                    disabled={isFetchingWeather}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingWeather ? 'Fetching...' : 'Fetch Weather'}
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    Settings
                  </button>
                </>
              )}
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading sites...</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={[-37.8136, 144.9631]} // Default center (Melbourne, Australia)
            zoom={6}
            className={`h-full w-full ${activeLocationSelection ? 'cursor-crosshair' : ''}`}
            style={activeLocationSelection ? { cursor: 'crosshair' } : {}}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onMapClick={handleMapClick} />
            <ZoomTracker onZoomChange={setCurrentZoom} />

            {/* Render site markers */}
            {sites.map((site) => (
              <SiteMarker
                key={site.id}
                site={site}
                currentZoom={currentZoom}
                parkingIconZoomLevel={parkingIconZoomLevel}
              />
            ))}

            {/* Temporary marker for location selection */}
            {pendingLocation && (
              <Marker position={pendingLocation} icon={TempIcon}>
                <Popup>
                  <div className="text-sm">
                    <strong>Selected Location</strong>
                    <br />
                    Lat: {pendingLocation.lat.toFixed(6)}
                    <br />
                    Lng: {pendingLocation.lng.toFixed(6)}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}

        {/* Zoom Indicator */}
        {showZoomIndicator && !isLoading && (
          <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg border-2 border-gray-300 z-[500]">
            <div className="text-sm font-semibold text-gray-700">
              Zoom Level: {currentZoom}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Parking icons: {currentZoom >= parkingIconZoomLevel ? 'ON' : 'OFF'}
            </div>
          </div>
        )}
      </div>

      {/* Add Site Panel */}
      <AddSitePanel
        isOpen={isAddPanelOpen}
        onClose={handlePanelClose}
        onSelectLocation={handleSelectLocation}
        activeLocationSelection={activeLocationSelection}
        pendingLocation={pendingLocation}
        pendingLocationType={pendingLocationType}
        onLocationUsed={() => {
          setPendingLocation(null);
          setPendingLocationType(null);
        }}
      />
    </div>
  );
}
