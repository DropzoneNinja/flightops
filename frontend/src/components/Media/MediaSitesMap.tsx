import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { SiteMediaCount } from '../../services/media.service';
import { useCallback, useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface MediaSitesMapProps {
  sites: SiteMediaCount[];
  isLoading?: boolean;
}

/**
 * MediaSitesMap Component
 * Displays a map with markers for flight sites that have media
 * Shows image and video counts for each site
 */
export default function MediaSitesMap({ sites, isLoading = false }: MediaSitesMapProps) {
  const navigate = useNavigate();
  const [mapReady, setMapReady] = useState(false);

  // Ensure Leaflet is ready
  useEffect(() => {
    const timer = setTimeout(() => setMapReady(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Validate and filter sites
  const validSites = (Array.isArray(sites) ? sites : []).filter(site => {
    if (!site || typeof site !== 'object') return false;
    if (!site.site_id || !site.site_name) return false;
    if (typeof site.takeoff_lat !== 'number' || typeof site.takeoff_lon !== 'number') return false;
    if (isNaN(site.takeoff_lat) || isNaN(site.takeoff_lon)) return false;
    return true;
  });

  const handleMarkerClick = useCallback((siteId: string) => {
    navigate(`/media/site/${siteId}`);
  }, [navigate]);

  // Show loading state
  if (isLoading || !mapReady) {
    return (
      <div className="w-full h-full bg-sky-midday rounded animate-pulse flex items-center justify-center" style={{ minHeight: '400px' }}>
        <p className="text-sky-dusk">Loading map...</p>
      </div>
    );
  }

  // Show empty state
  if (validSites.length === 0) {
    return (
      <div className="w-full h-full bg-sky-cloud rounded-lg border-2 border-dashed border-sky-midday flex items-center justify-center" style={{ minHeight: '400px' }}>
        <p className="text-sky-dusk font-body">No sites with media yet</p>
      </div>
    );
  }

  // Calculate center
  const centerLat = validSites.reduce((sum, site) => sum + site.takeoff_lat, 0) / validSites.length;
  const centerLon = validSites.reduce((sum, site) => sum + site.takeoff_lon, 0) / validSites.length;

  return (
    <div className="w-full h-full" style={{ minHeight: '500px', height: '100%' }}>
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={10}
        style={{ height: '100%', width: '100%', minHeight: '500px' }}
        className="rounded-lg shadow-elevation"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {validSites.map((site) => {
          const imageCount = Number(site.image_count) || 0;
          const videoCount = Number(site.video_count) || 0;

          // Create simple marker icon
          const markerIcon = L.divIcon({
            className: 'custom-site-marker',
            html: `
              <div style="
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                padding: 8px 12px;
                border-radius: 20px;
                border: 2px solid white;
                font-weight: 700;
                font-size: 12px;
                color: white;
                white-space: nowrap;
                box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                ${imageCount + videoCount}
              </div>
            `,
            iconAnchor: [25, 25],
          });

          return (
            <Marker
              key={String(site.site_id)}
              position={[site.takeoff_lat, site.takeoff_lon]}
              icon={markerIcon}
              eventHandlers={{
                click: () => handleMarkerClick(String(site.site_id)),
              }}
            >
              <Popup>
                <div className="font-body">
                  <h3 className="font-display font-semibold text-sky-night mb-2">
                    {String(site.site_name)}
                  </h3>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-sky-dusk">Images: {imageCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sky-dusk">Videos: {videoCount}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarkerClick(String(site.site_id))}
                    className="mt-3 px-3 py-1 bg-sky-morning text-white text-xs rounded hover:bg-sky-dusk transition-colors"
                  >
                    View Media
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
