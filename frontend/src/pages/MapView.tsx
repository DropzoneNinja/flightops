import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents, Marker, Popup, useMap } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { useSites } from '../hooks/useSites';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { SettingKey } from '../services/settings.service';
import { useIsMobile } from '../hooks/useIsMobile';
import SiteMarker from '../components/Site/SiteMarker';
import SiteInspectionPanel from '../components/Site/SiteInspectionPanel';
import EditSitePanel from '../components/Site/EditSitePanel';
import { createWindSockIcon } from '../utils/windsockIcon';
import { convertWindSpeed, windSpeedUnitLabel } from '../utils/windSpeed';
import LeftSidebar from '../components/Layout/LeftSidebar';
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

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
});

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
    click: (e) => { onMapClick(e.latlng); },
  });
  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => { onZoomChange(map.getZoom()); },
  });
  useState(() => { onZoomChange(map.getZoom()); });
  return null;
}

function MapController({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function FlyToSite({ sites, siteId }: { sites: FlightSite[]; siteId: string | null }) {
  const map = useMap();
  const flown = useRef(false);

  useEffect(() => {
    if (!siteId) {
      flown.current = false;
      return;
    }
    if (flown.current) return;
    const site = sites.find(s => s.id === siteId);
    if (site) {
      map.setView([site.takeoff_lat, site.takeoff_lon], 16);
      flown.current = true;
    }
  }, [map, sites, siteId]);

  return null;
}

export default function MapView() {
  const { sites, isLoading } = useSites();
  const { logout, user } = useAuth();
  const { settingsMap, isLoadingMap } = useSettings();
  const { airspace } = useAirspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const mapRef = useRef<L.Map | null>(null);
  const prevMapStateRef = useRef<{ lat: number; lng: number; zoom: number } | null>(
    (location.state as { prevMapState?: { lat: number; lng: number; zoom: number } } | null)?.prevMapState ?? null,
  );
  const [isMissionMode, setIsMissionMode] = useState(false);
  const [waypointsByMission, setWaypointsByMission] = useState<Map<string, MissionWaypoint[]>>(new Map());
  const { missions, fetchMissions } = useMissionsStore();
  const [currentZoom, setCurrentZoom] = useState(9);
  const [showZoomIndicator, setShowZoomIndicator] = useState(true);
  const [parkingIconZoomLevel, setParkingIconZoomLevel] = useState(10);
  const [showAirspace, setShowAirspace] = useState(false);
  const [enabledAirspaceClasses, setEnabledAirspaceClasses] = useState<Set<AirspaceClass>>(() => {
    const stored = localStorage.getItem('enabledAirspaceClasses');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AirspaceClass[];
        return new Set(parsed);
      } catch (e) {
        console.error('Failed to parse stored airspace classes:', e);
      }
    }
    return new Set(['A', 'C', 'CTR', 'D', 'Q', 'R']);
  });

  // Selected site drives both the inspection panel and the airspace visualization
  const [selectedSite, setSelectedSite] = useState<FlightSite | null>(null);
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [windsockWind, setWindsockWind] = useState<{ dir: number; speed: number } | null>(null);

  // Keep selectedSite in sync with the React Query cache (picks up updates after a save)
  useEffect(() => {
    if (!selectedSite) return;
    const updated = sites.find(s => s.id === selectedSite.id);
    if (updated && updated !== selectedSite) setSelectedSite(updated);
  }, [sites]); // eslint-disable-line react-hooks/exhaustive-deps
  const windUnit = (settingsMap[SettingKey.UNITS_WIND_SPEED] as string) || 'kmh';

  // Mobile state
  const isMobile = useIsMobile(900);
  const [mobileActiveTab, setMobileActiveTab] = useState<'map' | 'sites' | 'media' | 'logout' | 'tools' | 'logbook'>('map');
  const [selectedMobileSite, setSelectedMobileSite] = useState<FlightSite | null>(null);
  const [showMobileMultiHeight, setShowMobileMultiHeight] = useState(false);
  const [selectedMobileHeightForecast, setSelectedMobileHeightForecast] = useState<any>(null);

  // Mobile location selection state (used by MobileAddSiteSheet)
  const [activeLocationSelection, setActiveLocationSelection] = useState<'takeoff' | 'parking' | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LatLng | null>(null);
  const [pendingLocationType, setPendingLocationType] = useState<'takeoff' | 'parking' | null>(null);

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

  useEffect(() => {
    const classesArray = Array.from(enabledAirspaceClasses);
    localStorage.setItem('enabledAirspaceClasses', JSON.stringify(classesArray));
  }, [enabledAirspaceClasses]);

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

  useEffect(() => {
    if (mobileActiveTab === 'media') navigate('/media');
    else if (mobileActiveTab === 'logbook') navigate('/logbook');
  }, [mobileActiveTab, navigate]);

  const handleMapClick = (latlng: LatLng) => {
    if (activeLocationSelection) {
      setPendingLocation(latlng);
      setPendingLocationType(activeLocationSelection);
      setActiveLocationSelection(null);
    }
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
      if (next.has(airspaceClass)) next.delete(airspaceClass);
      else next.add(airspaceClass);
      return next;
    });
  };

  const handleTakeoffClick = (site: FlightSite) => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      prevMapStateRef.current = { lat: center.lat, lng: center.lng, zoom: mapRef.current.getZoom() };
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('site', site.id);
      return next;
    });
    if (isMobile) {
      setSelectedMobileSite(site);
    } else {
      setSelectedSite(site);
    }
  };

  const handleForecastSelect = (windDir: number, windSpeed: number) => {
    setWindsockWind({ dir: windDir, speed: windSpeed });
  };

  const handleCloseInspectionPanel = () => {
    setSelectedSite(null);
    setIsEditingSite(false);
    setWindsockWind(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('site');
      return next;
    });
    if (mapRef.current && prevMapStateRef.current) {
      const { lat, lng, zoom } = prevMapStateRef.current;
      mapRef.current.setView([lat, lng], zoom);
      prevMapStateRef.current = null;
    }
  };

  const handleOpenEditSite = () => {
    setIsEditingSite(true);
  };

  const handleCloseEditSite = () => {
    setIsEditingSite(false);
    setPendingLocation(null);
    setPendingLocationType(null);
    setActiveLocationSelection(null);
  };

  const handleSelectLocation = (type: 'takeoff' | 'parking') => {
    setActiveLocationSelection(type);
  };

  // On initial load, open site panel if URL has ?site=
  useEffect(() => {
    if (isLoading) return;
    const siteId = searchParams.get('site');
    if (!siteId) return;
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    if (isMobile) {
      setSelectedMobileSite(site);
    } else {
      setSelectedSite(site);
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`h-screen flex ${isMobile ? 'flex-col' : 'flex-row'} overflow-hidden`}
      style={{ background: '#0d1421' }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        .site-card-marker { background: transparent !important; border: none !important; }
        .leaflet-container { background: #1a2234; }
      `}</style>

      {/* Desktop left sidebar */}
      {!isMobile && (
        <LeftSidebar
          user={user}
          showAirspace={showAirspace}
          onToggleAirspace={() => setShowAirspace(v => !v)}
          onLogout={logout}
        />
      )}

      {/* Mobile site name banner */}
      {isMobile && selectedMobileSite && (
        <WeatherStatusBanner site={selectedMobileSite} />
      )}

      {/* Map area */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1421]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              <p className="mt-4 text-[#6b7fa3]">Loading sites...</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={[-37.8136, 144.9631]}
            zoom={9}
            className={`h-full w-full ${activeLocationSelection ? 'cursor-crosshair' : ''}`}
            style={activeLocationSelection ? { cursor: 'crosshair' } : {}}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onMapClick={handleMapClick} />
            <ZoomTracker onZoomChange={setCurrentZoom} />
            <MapController mapRef={mapRef} />
            <FlyToSite sites={sites} siteId={searchParams.get('site')} />

            {showAirspace && airspace && (
              <AirspaceOverlay
                airspace={airspace}
                enabledClasses={enabledAirspaceClasses}
              />
            )}

            {!isMissionMode && sites.filter(site => site.enabled || user?.is_admin).map(site => (
              <SiteMarker
                key={site.id}
                site={site}
                currentZoom={currentZoom}
                parkingIconZoomLevel={parkingIconZoomLevel}
                onTakeoffClick={handleTakeoffClick}
                isSelected={selectedSite?.id === site.id}
              />
            ))}

            {isMissionMode && missions.map(mission => {
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
                      onClick={() => navigate(`/missions/${mission.id}`, { state: { windOverride: windsockWind ?? null } })}
                    />
                  )}
                  {currentZoom >= parkingIconZoomLevel && (
                    <MissionPlot
                      mission={mission}
                      position={pos}
                      waypoints={waypointsByMission.get(mission.id) ?? []}
                      onClick={() => navigate(`/missions/${mission.id}`, { state: { windOverride: windsockWind ?? null } })}
                    />
                  )}
                </React.Fragment>
              );
            })}

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

            {windsockWind && selectedSite && (
              <Marker
                position={[
                  parseFloat(selectedSite.takeoff_lat.toString()),
                  parseFloat(selectedSite.takeoff_lon.toString()),
                ]}
                icon={createWindSockIcon(
                    windsockWind.dir,
                    convertWindSpeed(windsockWind.speed, windUnit),
                    windSpeedUnitLabel(windUnit),
                  )}
                interactive={false}
                zIndexOffset={750}
              />
            )}
          </MapContainer>
        )}

        {/* Desktop overlays */}
        {!isMobile && (
          <>
            {showZoomIndicator && !isLoading && (
              <div className="absolute bottom-4 left-4 bg-[#1a2234] border border-[#2a3a54] px-4 py-2 rounded-lg shadow-lg z-[500]">
                <div className="text-sm font-semibold text-[#a0b3cc]">
                  Zoom Level: {currentZoom}
                </div>
                <div className="text-xs text-[#6b7fa3] mt-1">
                  Parking icons: {currentZoom >= parkingIconZoomLevel ? 'ON' : 'OFF'}
                </div>
              </div>
            )}

            {showAirspace && !isLoading && (
              <AirspaceClassFilter
                enabledClasses={enabledAirspaceClasses}
                onToggleClass={handleToggleAirspaceClass}
              />
            )}

            {selectedSite && showAirspace && airspace && (
              <AirspaceLayerVisualization
                site={selectedSite}
                airspace={airspace}
                onClose={handleCloseInspectionPanel}
              />
            )}
          </>
        )}
      </div>

      {/* Desktop site inspection panel */}
      {!isMobile && selectedSite && !isEditingSite && (
        <SiteInspectionPanel
          site={selectedSite}
          onClose={handleCloseInspectionPanel}
          onForecastSelect={handleForecastSelect}
          prevMapState={prevMapStateRef.current}
          windOverride={windsockWind}
          canEdit={!!(user && (user.id === selectedSite.user_id || user.is_admin))}
          onEdit={handleOpenEditSite}
        />
      )}

      {/* Desktop site edit panel */}
      {!isMobile && (
        <EditSitePanel
          isOpen={isEditingSite && !!selectedSite}
          site={selectedSite}
          onClose={handleCloseEditSite}
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

      {/* Mobile bottom nav */}
      {isMobile && (
        <BottomNavigationBar
          activeTab={mobileActiveTab}
          onTabChange={setMobileActiveTab}
          onLogout={logout}
          isMissionMode={isMissionMode}
          onToggleMissionMode={handleToggleMissionMode}
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

      {/* Mobile Add Site Sheet */}
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

      {/* Mobile Tools Sheet */}
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
