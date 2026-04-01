import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup, useMap } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { useSites } from '../hooks/useSites';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useIsMobile } from '../hooks/useIsMobile';
import SiteMarker from '../components/Site/SiteMarker';
import AddSitePanel from '../components/Site/AddSitePanel';
import AirspaceOverlay from '../components/Airspace/AirspaceOverlay';
import AirspaceClassFilter from '../components/Airspace/AirspaceClassFilter';
import AirspaceLayerVisualization from '../components/Airspace/AirspaceLayerVisualization';
import PlotOverlay from '../components/Plot/PlotOverlay';
import TotalDistanceMarker from '../components/Plot/TotalDistanceMarker';
import PlotControls from '../components/Plot/PlotControls';
import BottomNavigationBar from '../components/Mobile/BottomNavigationBar';
import WeatherStatusBanner from '../components/Mobile/WeatherStatusBanner';
import MobileAddSiteSheet from '../components/Mobile/MobileAddSiteSheet';
import MobileToolsSheet from '../components/Mobile/MobileToolsSheet';
import MobileMultiHeightDialog from '../components/Mobile/MobileMultiHeightDialog';
import { useAirspace } from '../hooks/useAirspace';
import { AirspaceClass } from '../services/airspace.service';
import { FlightSite } from '../services/sites.service';
import { api } from '../services/api';
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

function MapController({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  return null;
}

export default function MapView() {
  const { sites, isLoading, updateSiteMutation } = useSites();
  const { logout, user } = useAuth();
  const { settingsMap, isLoadingMap } = useSettings();
  const { airspace } = useAirspace();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [activeLocationSelection, setActiveLocationSelection] = useState<'takeoff' | 'parking' | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LatLng | null>(null);
  const [pendingLocationType, setPendingLocationType] = useState<'takeoff' | 'parking' | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(9);
  const [showZoomIndicator, setShowZoomIndicator] = useState(true);
  const [parkingIconZoomLevel, setParkingIconZoomLevel] = useState(10);
  const [showAirspace, setShowAirspace] = useState(false);
  const [enabledAirspaceClasses, setEnabledAirspaceClasses] = useState<Set<AirspaceClass>>(() => {
    // Try to load from localStorage first
    const stored = localStorage.getItem('enabledAirspaceClasses');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AirspaceClass[];
        return new Set(parsed);
      } catch (e) {
        console.error('Failed to parse stored airspace classes:', e);
      }
    }
    // Default classes: A, C, CTR, D, Q, R (G and RMZ disabled by default)
    return new Set(['A', 'C', 'CTR', 'D', 'Q', 'R']);
  });
  const [selectedSiteForAirspace, setSelectedSiteForAirspace] = useState<FlightSite | null>(null);
  const [selectedPlotNode, setSelectedPlotNode] = useState<{
    nodeIndex: number;
    lat: number;
    lon: number;
  } | null>(null);

  // Plot state
  const [isPlottingMode, setIsPlottingMode] = useState(false);
  const [selectedSiteForPlot, setSelectedSiteForPlot] = useState<FlightSite | null>(null);
  const [currentPlotPoints, setCurrentPlotPoints] = useState<Array<{ lat: number; lon: number }>>([]);
  const [isPlotClosed, setIsPlotClosed] = useState(false);
  const [showPlotLabels, setShowPlotLabels] = useState(true);

  // Mobile state
  const isMobile = useIsMobile(900);
  const [mobileActiveTab, setMobileActiveTab] = useState<'map' | 'sites' | 'media' | 'leaderboards' | 'logout' | 'tools'>('map');
  const [selectedMobileSite, setSelectedMobileSite] = useState<FlightSite | null>(null);
  const [showMobileMultiHeight, setShowMobileMultiHeight] = useState(false);
  const [selectedMobileHeightForecast, setSelectedMobileHeightForecast] = useState<any>(null);

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

  // Persist enabled airspace classes to localStorage
  useEffect(() => {
    const classesArray = Array.from(enabledAirspaceClasses);
    localStorage.setItem('enabledAirspaceClasses', JSON.stringify(classesArray));
  }, [enabledAirspaceClasses]);

  // Handle mobile tab navigation
  useEffect(() => {
    if (mobileActiveTab === 'media') {
      navigate('/media');
    } else if (mobileActiveTab === 'leaderboards') {
      navigate('/leaderboards');
    }
  }, [mobileActiveTab, navigate]);

  const handleMapClick = (latlng: LatLng) => {
    // Plot mode takes priority
    if (isPlottingMode && selectedSiteForPlot && !isPlotClosed) {
      setCurrentPlotPoints((prev) => [...prev, { lat: latlng.lat, lon: latlng.lng }]);
      return;
    }

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

  const handleZoomToLocation = useCallback((lat: number, lon: number, zoom: number = 17) => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lon], zoom);
    }
  }, []);

  const handleFetchWeather = async () => {
    setIsFetchingWeather(true);
    try {
      await api.post('/weather/fetch');
      alert('Weather data fetched successfully! Refresh the page to see updated forecasts.');
      window.location.reload();
    } catch (error: any) {
      console.error('Weather fetch error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch weather data. Please try again.';
      alert(errorMessage);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleToggleAirspaceClass = (airspaceClass: AirspaceClass) => {
    setEnabledAirspaceClasses(prev => {
      const next = new Set(prev);
      if (next.has(airspaceClass)) {
        next.delete(airspaceClass);
      } else {
        next.add(airspaceClass);
      }
      return next;
    });
  };

  const handleTakeoffClick = (site: FlightSite) => {
    // If in plotting mode and switching to different site, cancel current plot
    if (isPlottingMode && selectedSiteForPlot && selectedSiteForPlot.id !== site.id) {
      const hasUnsavedChanges =
        JSON.stringify(currentPlotPoints) !==
        JSON.stringify(selectedSiteForPlot?.plot_data?.points || []);

      if (hasUnsavedChanges && currentPlotPoints.length > 0) {
        if (!confirm('Switching sites will cancel your current plot. Continue?')) {
          return;
        }
      }

      // Cancel plotting
      setIsPlottingMode(false);
      setSelectedSiteForPlot(null);
      setCurrentPlotPoints([]);
      setIsPlotClosed(false);
    }

    // Mobile: Set selected site
    if (isMobile) {
      setSelectedMobileSite(site);
    } else {
      // Desktop: Turn on airspace if not already showing
      if (!showAirspace) {
        setShowAirspace(true);
      }
      // Clear selected plot node when switching sites
      setSelectedPlotNode(null);
      // Set selected site (one visualization at a time)
      setSelectedSiteForAirspace(site);
    }
  };

  const handleCloseAirspaceVisualization = () => {
    setSelectedSiteForAirspace(null);
    setSelectedPlotNode(null);
  };

  // Plot handlers
  const handlePlotClick = () => {
    if (!selectedSiteForAirspace) return;

    setIsPlottingMode(true);
    setSelectedSiteForPlot(selectedSiteForAirspace);
    // Clear selected plot node when entering plotting mode
    setSelectedPlotNode(null);

    // Load existing plot if available
    if (selectedSiteForAirspace.plot_data?.points) {
      setCurrentPlotPoints(selectedSiteForAirspace.plot_data.points);
      setIsPlotClosed(true);
    } else {
      setCurrentPlotPoints([]);
      setIsPlotClosed(false);
    }
  };

  const handleSavePlot = async () => {
    if (!selectedSiteForPlot || currentPlotPoints.length < 2 || !isPlotClosed) return;

    try {
      await updateSiteMutation.mutateAsync({
        id: selectedSiteForPlot.id,
        data: {
          plot_data: { points: currentPlotPoints },
        },
      });

      // Exit plotting mode
      setIsPlottingMode(false);
      setSelectedSiteForPlot(null);
      setCurrentPlotPoints([]);
      setIsPlotClosed(false);
    } catch (error: any) {
      console.error('Failed to save plot:', error);
      alert(error.response?.data?.message || 'Failed to save plot. Please try again.');
    }
  };

  const handleDeleteLastPoint = () => {
    if (currentPlotPoints.length === 0 || isPlotClosed) return;

    setCurrentPlotPoints((prev) => prev.slice(0, -1));
  };

  const handleClearPlot = () => {
    if (confirm('Are you sure you want to clear all points?')) {
      setCurrentPlotPoints([]);
      setIsPlotClosed(false);
    }
  };

  const handleDeletePlot = async () => {
    if (!selectedSiteForPlot) return;

    if (confirm('Are you sure you want to delete this plot?')) {
      try {
        await updateSiteMutation.mutateAsync({
          id: selectedSiteForPlot.id,
          data: {
            plot_data: null,
          },
        });

        // Exit plotting mode
        setIsPlottingMode(false);
        setSelectedSiteForPlot(null);
        setCurrentPlotPoints([]);
        setIsPlotClosed(false);
      } catch (error: any) {
        console.error('Failed to delete plot:', error);
        alert(error.response?.data?.message || 'Failed to delete plot. Please try again.');
      }
    }
  };

  const handleClosePlotControls = () => {
    const hasUnsavedChanges =
      JSON.stringify(currentPlotPoints) !==
      JSON.stringify(selectedSiteForPlot?.plot_data?.points || []);

    if (hasUnsavedChanges && currentPlotPoints.length > 0) {
      if (confirm('You have unsaved changes. Do you want to exit without saving?')) {
        setIsPlottingMode(false);
        setSelectedSiteForPlot(null);
        setCurrentPlotPoints([]);
        setIsPlotClosed(false);
      }
    } else {
      setIsPlottingMode(false);
      setSelectedSiteForPlot(null);
      setCurrentPlotPoints([]);
      setIsPlotClosed(false);
    }
  };

  const handleCompleteClick = () => {
    if (currentPlotPoints.length >= 3 && !isPlotClosed) {
      setIsPlotClosed(true);
    }
  };

  const handlePlotNodeClick = (nodeIndex: number, lat: number, lon: number) => {
    setSelectedPlotNode({ nodeIndex, lat, lon });
  };

  const handleToggleLabels = () => {
    setShowPlotLabels((prev) => !prev);
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

      {/* Desktop Header - Hidden on mobile */}
      {!isMobile && (
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
              <button
                onClick={() => setShowAirspace(!showAirspace)}
                className={`px-4 py-2 text-white rounded-md text-sm font-medium transition-colors ${
                  showAirspace
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {showAirspace ? 'Hide Airspace' : 'Show Airspace'}
              </button>
              <button
                onClick={handlePlotClick}
                disabled={!selectedSiteForAirspace}
                className={`px-4 py-2 text-white rounded-md text-sm font-medium transition-colors ${
                  isPlottingMode
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : selectedSiteForAirspace
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                title={!selectedSiteForAirspace ? 'Select a takeoff icon to enable plotting' : ''}
              >
                {isPlottingMode ? 'Plotting...' : 'Plot'}
              </button>
              <button
                onClick={() => navigate('/media')}
                className="px-4 py-2 bg-sky-morning text-white rounded-md text-sm font-medium hover:bg-sky-dusk transition-colors"
              >
                Album
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
      )}

      {/* Mobile Site Name Banner - Show only on mobile when site is selected */}
      {isMobile && selectedMobileSite && (
        <WeatherStatusBanner site={selectedMobileSite} />
      )}

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
            zoom={9}
            className={`h-full w-full ${
              activeLocationSelection || (isPlottingMode && !isPlotClosed)
                ? 'cursor-crosshair'
                : ''
            }`}
            style={
              activeLocationSelection || (isPlottingMode && !isPlotClosed)
                ? { cursor: 'crosshair' }
                : {}
            }
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onMapClick={handleMapClick} />
            <ZoomTracker onZoomChange={setCurrentZoom} />
            <MapController mapRef={mapRef} />

            {/* Airspace overlay */}
            {showAirspace && airspace && (
              <AirspaceOverlay
                airspace={airspace}
                enabledClasses={enabledAirspaceClasses}
              />
            )}

            {/* Render site markers */}
            {sites.filter(site => site.enabled || user?.is_admin).map((site) => (
              <SiteMarker
                key={site.id}
                site={site}
                currentZoom={currentZoom}
                parkingIconZoomLevel={parkingIconZoomLevel}
                onTakeoffClick={handleTakeoffClick}
                isSelectedForAirspace={selectedSiteForAirspace?.id === site.id}
                onMobileDayClick={isMobile ? (forecast) => {
                  // Set the selected site if not already set
                  if (selectedMobileSite?.id !== site.id) {
                    setSelectedMobileSite(site);
                  }
                  // Open mobile multi-height dialog directly
                  setSelectedMobileHeightForecast(forecast);
                  setShowMobileMultiHeight(true);
                } : undefined}
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

            {/* Plot overlay - show saved plots only for selected site */}
            {sites.filter(site => site.enabled).map((site) => {
              // Skip if no plot data
              if (!site.plot_data?.points || site.plot_data.points.length < 2) return null;

              // Only show plot if this site is selected for airspace (takeoff icon highlighted)
              if (selectedSiteForAirspace?.id !== site.id) return null;

              // Don't render if this is the site being actively edited
              if (isPlottingMode && selectedSiteForPlot?.id === site.id) return null;

              return (
                <>
                  <PlotOverlay
                    key={`plot-${site.id}`}
                    points={site.plot_data.points}
                    isClosed={true}
                    isEditing={false}
                    distanceUnit={(settingsMap['units.distance'] as 'km' | 'mi') || 'km'}
                    averageSpeed={(settingsMap['plot.average_speed'] as number) || 30}
                    showLabels={showPlotLabels}
                    onNodeClick={handlePlotNodeClick}
                  />
                  <TotalDistanceMarker
                    key={`plot-total-${site.id}`}
                    points={site.plot_data.points}
                    distanceUnit={(settingsMap['units.distance'] as 'km' | 'mi') || 'km'}
                    averageSpeed={(settingsMap['plot.average_speed'] as number) || 30}
                  />
                </>
              );
            })}

            {/* Current plot being edited */}
            {isPlottingMode && selectedSiteForPlot && currentPlotPoints.length > 0 && (
              <>
                <PlotOverlay
                  points={currentPlotPoints}
                  isClosed={isPlotClosed}
                  isEditing={true}
                  distanceUnit={(settingsMap['units.distance'] as 'km' | 'mi') || 'km'}
                  averageSpeed={(settingsMap['plot.average_speed'] as number) || 30}
                  showLabels={showPlotLabels}
                />
                {isPlotClosed && (
                  <TotalDistanceMarker
                    points={currentPlotPoints}
                    distanceUnit={(settingsMap['units.distance'] as 'km' | 'mi') || 'km'}
                    averageSpeed={(settingsMap['plot.average_speed'] as number) || 30}
                  />
                )}
              </>
            )}
          </MapContainer>
        )}

        {/* Desktop Overlays - Hidden on mobile */}
        {!isMobile && (
          <>
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

            {/* Airspace class filter */}
            {showAirspace && !isLoading && (
              <AirspaceClassFilter
                enabledClasses={enabledAirspaceClasses}
                onToggleClass={handleToggleAirspaceClass}
              />
            )}

            {/* Airspace layer visualization */}
            {selectedSiteForAirspace && showAirspace && airspace && (
              <AirspaceLayerVisualization
                site={selectedSiteForAirspace}
                airspace={airspace}
                onClose={handleCloseAirspaceVisualization}
                selectedPlotNode={selectedPlotNode}
              />
            )}

            {/* Plot controls */}
            {isPlottingMode && selectedSiteForPlot && (
          <PlotControls
            site={selectedSiteForPlot}
            currentPoints={currentPlotPoints}
            isClosed={isPlotClosed}
            hasUnsavedChanges={
              JSON.stringify(currentPlotPoints) !==
              JSON.stringify(selectedSiteForPlot.plot_data?.points || [])
            }
            showLabels={showPlotLabels}
            onSave={handleSavePlot}
            onComplete={handleCompleteClick}
            onDeleteLastPoint={handleDeleteLastPoint}
            onClear={handleClearPlot}
            onDeletePlot={handleDeletePlot}
            onToggleLabels={handleToggleLabels}
            onClose={handleClosePlotControls}
            isSaving={updateSiteMutation.isPending}
          />
        )}
          </>
        )}
      </div>

      {/* Desktop Add Site Panel - Hidden on mobile */}
      {!isMobile && (
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
        onZoomToLocation={handleZoomToLocation}
      />
      )}

      {/* Mobile Bottom Navigation - Show only on mobile */}
      {isMobile && (
        <BottomNavigationBar
          activeTab={mobileActiveTab}
          onTabChange={setMobileActiveTab}
          onLogout={logout}
        />
      )}

      {/* Mobile Multi-Height Wind Data Dialog */}
      {isMobile && showMobileMultiHeight && selectedMobileSite && (
        <MobileMultiHeightDialog
          isOpen={showMobileMultiHeight}
          onClose={() => {
            setShowMobileMultiHeight(false);
            setSelectedMobileHeightForecast(null);
          }}
          forecast={selectedMobileHeightForecast}
          siteId={selectedMobileSite.id}
        />
      )}

      {/* Mobile Add Site Sheet - Show when Sites tab is active */}
      {isMobile && mobileActiveTab === 'sites' && (
        <MobileAddSiteSheet
          isOpen={true}
          onClose={() => setMobileActiveTab('map')}
          onSelectLocation={handleSelectLocation}
          activeLocationSelection={activeLocationSelection}
          pendingLocation={pendingLocation}
          pendingLocationType={pendingLocationType}
          onLocationUsed={() => {
            setPendingLocation(null);
            setPendingLocationType(null);
          }}
          onZoomToLocation={handleZoomToLocation}
        />
      )}

      {/* Mobile Tools Sheet - Show when Tools tab is active */}
      {isMobile && mobileActiveTab === 'tools' && (
        <MobileToolsSheet
          isOpen={true}
          onClose={() => setMobileActiveTab('map')}
          showAirspace={showAirspace}
          enabledAirspaceClasses={enabledAirspaceClasses}
          onToggleAirspaceClass={handleToggleAirspaceClass}
          onToggleAirspace={() => setShowAirspace(!showAirspace)}
          isPlottingMode={isPlottingMode}
          selectedSiteForPlot={selectedSiteForPlot}
          currentPlotPoints={currentPlotPoints}
          isPlotClosed={isPlotClosed}
          hasUnsavedChanges={
            JSON.stringify(currentPlotPoints) !==
            JSON.stringify(selectedSiteForPlot?.plot_data?.points || [])
          }
          showPlotLabels={showPlotLabels}
          onSavePlot={handleSavePlot}
          onCompletePlot={handleCompleteClick}
          onDeleteLastPoint={handleDeleteLastPoint}
          onClearPlot={handleClearPlot}
          onDeletePlot={handleDeletePlot}
          onToggleLabels={handleToggleLabels}
          onClosePlot={handleClosePlotControls}
          isSavingPlot={updateSiteMutation.isPending}
          isAdmin={user?.is_admin || false}
          onFetchWeather={handleFetchWeather}
          isFetchingWeather={isFetchingWeather}
        />
      )}
    </div>
  );
}
