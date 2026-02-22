import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { SiteMediaCount } from '../../services/media.service';
import { useMemo, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

interface MediaSitesMapProps {
  sites: SiteMediaCount[];
  isLoading?: boolean;
}

// Create a custom div icon for site markers with media counts
const createSiteIcon = (imageCount: number, videoCount: number) => {
  return L.divIcon({
    className: 'custom-site-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        gap: 4px;
        background-color: white;
        padding: 6px 10px;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        border: 2px solid #0ea5e9;
        font-family: monospace;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
      ">
        ${imageCount > 0 ? `
          <span style="display: flex; align-items: center; gap: 2px; color: #0ea5e9;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
            </svg>
            ${imageCount}
          </span>
        ` : ''}
        ${videoCount > 0 ? `
          <span style="display: flex; align-items: center; gap: 2px; color: #0ea5e9;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>
            </svg>
            ${videoCount}
          </span>
        ` : ''}
      </div>
    `,
    iconSize: [undefined as any, 30],
    iconAnchor: [0, 15],
    popupAnchor: [0, -15],
  });
};

/**
 * MediaSitesMap Component
 * Displays a map with markers for flight sites that have media
 * Shows image and video counts for each site
 */
export default function MediaSitesMap({ sites, isLoading = false }: MediaSitesMapProps) {
  const navigate = useNavigate();

  console.log('MediaSitesMap - sites:', sites);
  console.log('MediaSitesMap - isLoading:', isLoading);

  // Calculate the center of all sites
  const center: [number, number] = sites.length > 0
    ? [
        sites.reduce((sum, site) => sum + site.takeoff_lat, 0) / sites.length,
        sites.reduce((sum, site) => sum + site.takeoff_lon, 0) / sites.length,
      ]
    : [51.505, -0.09]; // Default to London if no sites

  console.log('MediaSitesMap - center:', center);

  const handleMarkerClick = useCallback((siteId: string) => {
    // Navigate to the site gallery view showing all media for this site
    navigate(`/media/site/${siteId}`);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="w-full h-full bg-sky-midday rounded animate-pulse flex items-center justify-center" style={{ minHeight: '400px' }}>
        <p className="text-sky-dusk">Loading map...</p>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="w-full h-full bg-sky-cloud rounded-lg border-2 border-dashed border-sky-midday flex items-center justify-center" style={{ minHeight: '400px' }}>
        <p className="text-sky-dusk font-body">No sites with media yet</p>
      </div>
    );
  }

  console.log('MediaSitesMap - Rendering map with', sites.length, 'sites');

  // Create a stable key based on site IDs to prevent unnecessary re-renders
  const mapKey = useMemo(() => sites.map(s => s.site_id).join(','), [sites]);

  return (
    <div className="w-full h-full" style={{ minHeight: '500px', height: '100%' }}>
      <MapContainer
        key={mapKey}
        center={center}
        zoom={10}
        style={{ height: '100%', width: '100%', minHeight: '500px' }}
        className="rounded-lg shadow-elevation"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sites.map((site) => (
          <Marker
            key={site.site_id}
            position={[site.takeoff_lat, site.takeoff_lon]}
            icon={createSiteIcon(site.image_count, site.video_count)}
            eventHandlers={{
              click: () => handleMarkerClick(site.site_id),
            }}
          >
            <Popup>
              <div className="font-body">
                <h3 className="font-display font-semibold text-sky-night mb-2">
                  {site.site_name}
                </h3>
                <div className="flex flex-col gap-1 text-sm">
                  {site.image_count > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sky-dusk">Images:</span>
                      <span className="font-semibold text-sky-night">{site.image_count}</span>
                    </div>
                  )}
                  {site.video_count > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sky-dusk">Videos:</span>
                      <span className="font-semibold text-sky-night">{site.video_count}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleMarkerClick(site.site_id)}
                  className="mt-3 px-3 py-1 bg-sky-morning text-white text-xs rounded hover:bg-sky-dusk transition-colors"
                >
                  View Media
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
