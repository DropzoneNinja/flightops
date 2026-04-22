import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup, useMap } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { useSites } from '../hooks/useSites';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useIsMobile } from '../hooks/useIsMobile';
import SiteMarker from '../components/Site/SiteMarker';
import AddSitePanel from '../components/Site/AddSitePanel';
import EditSitePanel from '../components/Site/EditSitePanel';
import AirspaceOverlay from '../components/Airspace/AirspaceOverlay';
import AirspaceClassFilter from '../components/Airspace/AirspaceClassFilter';
import AirspaceLayerVisualization from '../components/Airspace/AirspaceLayerVisualization';
import BottomNavigationBar from '../components/Mobile/BottomNavigationBar';
import WeatherStatusBanner from '../components/Mobile/WeatherStatusBanner';
import MobileAddSiteSheet from '../components/Mobile/MobileAddSiteSheet';
import MobileToolsSheet from '../components/Mobile/MobileToolsSheet';
import MobileMultiHeightDialog from '../components/Mobile/MobileMultiHeightDialog';
import MissionMarker from '../components/Mission/MissionMarker';
import MissionPlot from '../components/Mission/MissionPlot';
import { useAirspace } from '../hooks/useAirspace';
import { AirspaceClass } from '../services/airspace.service';
import { FlightSite } from '../services/sites.service';
import { MissionWaypoint, missionsService } from '../services/missions.service';
import { useMissionsStore } from '../stores/missionsStore';
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
  const { sites, isLoading } = useSites();
  const { logout, user } = useAuth();
  const { settingsMap, isLoadingMap } = useSettings();
  const { airspace } = useAirspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapRef = useRef<L.Map | null>(null);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [activeLocationSelection, setActiveLocationSelection] = useState<'takeoff' | 'parking' | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LatLng | null>(null);
  const [pendingLocationType, setPendingLocationType] = useState<'takeoff' | 'parking' | null>(null);
  const [isMissionMode, setIsMissionMode] = useState(false);
  const [waypointsByMission, setWaypointsByMission] = useState<Map<string, MissionWaypoint[]>>(new Map());
  const { missions, fetchMissions } = useMissionsStore();
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

  // Fetch waypoints for each mission when in high-zoom mission mode
  useEffect(() => {
    if (!isMissionMode || currentZoom < parkingIconZoomLevel) return;
    missions.forEach(mission => {
      if (!waypointsByMission.has(mission.id)) {
        missionsService.getWaypoints(mission.id).then(wps => {
          setWaypointsByMission(prev => new Map(prev).set(mission.id, wps));
        });
      }
    });
  }, [isMissionMode, currentZoom, parkingIconZoomLevel, missions]);

  // Handle mobile tab navigation
  useEffect(() => {
    if (mobileActiveTab === 'media') {
      navigate('/media');
    } else if (mobileActiveTab === 'leaderboards') {
      navigate('/leaderboards');
    }
  }, [mobileActiveTab, navigate]);

  const handleMapClick = (latlng: LatLng) => {
    // Only handle clicks when actively selecting a location
    if (activeLocationSelection) {
      setPendingLocation(latlng);
      setPendingLocationType(activeLocationSelection);
      setActiveLocationSelection(null); // Return to neutral mode after selection
    }
  };

  const handleAddSiteClick = () => {
    setIsAddPanelOpen(true);
  };

  const handlePanelClose = () => {
    setIsAddPanelOpen(false);
    setActiveLocationSelection(null);
    setPendingLocation(null);
    setPendingLocationType(null);
  };

  const handleEditSiteClick = () => {
    setIsEditPanelOpen(true);
  };

  const handleEditPanelClose = () => {
    setIsEditPanelOpen(false);
    setActiveLocationSelection(null);
    setPendingLocation(null);
    setPendingLocationType(null);
  };

  const canEditSelectedSite =
    selectedSiteForAirspace !== null &&
    (user?.is_admin || selectedSiteForAirspace.user_id === user?.id);

  const handleSelectLocation = (type: 'takeoff' | 'parking') => {
    setActiveLocationSelection(type);
  };

  const handleZoomToLocation = useCallback((lat: number, lon: number, zoom: number = 17) => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lon], zoom);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('view') === 'missions') {
      fetchMissions();
      setIsMissionMode(true);
    }
  }, []);

  const handleToggleMissionMode = useCallback(() => {
    if (!isMissionMode) {
      fetchMissions();
      setIsMissionMode(true);
    } else {
      setIsMissionMode(false);
      setWaypointsByMission(new Map());
    }
  }, [isMissionMode, fetchMissions]);

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
    if (isMobile) {
      setSelectedMobileSite(site);
    } else {
      if (!showAirspace) {
        setShowAirspace(true);
      }
      setSelectedSiteForAirspace(site);
    }
  };

  const handleCloseAirspaceVisualization = () => {
    setSelectedSiteForAirspace(null);
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
                onClick={
                  isMissionMode
                    ? () => navigate('/missions')
                    : canEditSelectedSite
                    ? handleEditSiteClick
                    : handleAddSiteClick
                }
                className={`px-4 py-2 text-white rounded-md text-sm font-medium transition-colors ${
                  isMissionMode
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : canEditSelectedSite
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isMissionMode ? 'Mission List' : canEditSelectedSite ? 'Edit Site' : 'Add Site'}
              </button>
              <button
                onClick={handleToggleMissionMode}
                className={`px-4 py-2 text-white rounded-md text-sm font-medium transition-colors ${
                  isMissionMode ? 'bg-sky-600 hover:bg-sky-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isMissionMode ? 'Weather' : 'Missions'}
              </button>
              <button
                onClick={() => navigate('/media')}
                className="px-4 py-2 bg-sky-morning text-white rounded-md text-sm font-medium hover:bg-sky-dusk transition-colors"
              >
                Album
              </button>
              {user?.is_admin && (
                <button
                  onClick={() => navigate('/settings')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Settings
                </button>
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
              activeLocationSelection ? 'cursor-crosshair' : ''
            }`}
            style={activeLocationSelection ? { cursor: 'crosshair' } : {}}
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
            {!isMissionMode && sites.filter(site => site.enabled || user?.is_admin).map((site) => (
              <SiteMarker
                key={site.id}
                site={site}
                currentZoom={currentZoom}
                parkingIconZoomLevel={parkingIconZoomLevel}
                onTakeoffClick={handleTakeoffClick}
                isSelectedForAirspace={selectedSiteForAirspace?.id === site.id}
                onMobileDayClick={isMobile ? (forecast) => {
                  if (selectedMobileSite?.id !== site.id) {
                    setSelectedMobileSite(site);
                  }
                  setSelectedMobileHeightForecast(forecast);
                  setShowMobileMultiHeight(true);
                } : undefined}
              />
            ))}

            {/* Mission markers — shown in mission mode */}
            {isMissionMode && missions.map((mission) => {
              const lat = mission.launch_site?.takeoff_lat ?? mission.waypoints?.[0]?.latitude;
              const lon = mission.launch_site?.takeoff_lon ?? mission.waypoints?.[0]?.longitude;
              if (lat == null || lon == null) return null;
              const pos: [number, number] = [Number(lat), Number(lon)];
              return (
                <React.Fragment key={mission.id}>
                  {currentZoom < parkingIconZoomLevel && (
                    <MissionMarker
                      mission={mission}
                      position={pos}
                      onClick={() => navigate(`/missions/${mission.id}`)}
                    />
                  )}
                  {currentZoom >= parkingIconZoomLevel && (
                    <MissionPlot
                      mission={mission}
                      position={pos}
                      waypoints={waypointsByMission.get(mission.id) ?? []}
                      onClick={() => navigate(`/missions/${mission.id}`)}
                    />
                  )}
                </React.Fragment>
              );
            })}

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

      {/* Desktop Edit Site Panel - Hidden on mobile */}
      {!isMobile && (
        <EditSitePanel
          isOpen={isEditPanelOpen}
          site={selectedSiteForAirspace}
          onClose={handleEditPanelClose}
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
          isMissionMode={isMissionMode}
          onToggleMissionMode={handleToggleMissionMode}
        />
      )}
    </div>
  );
}
