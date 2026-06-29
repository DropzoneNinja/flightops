import { Marker, Polyline } from 'react-leaflet';
import { FlightSite } from '../../services/sites.service';
import { useWeather } from '../../hooks/useWeather';
import { useSettings } from '../../hooks/useSettings';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot, Root } from 'react-dom/client';
import L from 'leaflet';
import { scoreToHeatColor } from '../../utils/colorInterpolation';
import { WeatherForecast } from '../../services/weather.service';
import ParkingAddressModal from './ParkingAddressModal';

const parkingIcon = new L.Icon({
  iconUrl: '/icon-park.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [64, 64],
  iconAnchor: [32, 32],
  popupAnchor: [0, -32],
  shadowSize: [82, 82],
});

const PARKING_Z_INDEX = 0;
const TAKEOFF_Z_INDEX = 1000;
const CARD_Z_INDEX = 1000;

interface SiteMarkerProps {
  site: FlightSite;
  currentZoom: number;
  parkingIconZoomLevel: number;
  onTakeoffClick?: (site: FlightSite) => void;
  isSelected?: boolean;
}

// Wing / paramotor icon SVG string
const WING_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M2 12C2 12 6 4 12 4s10 8 10 8-4 8-10 8S2 12 2 12z"/><circle cx="12" cy="12" r="2"/></svg>`;

interface SiteCardProps {
  siteName: string;
  forecasts: WeatherForecast[];
  isLoading: boolean;
  isSelected: boolean;
  maxDays: number;
  onClick: () => void;
}

function SiteCard({ siteName, forecasts, isLoading, isSelected, maxDays, onClick }: SiteCardProps) {
  const displayForecasts = forecasts.slice(0, maxDays);

  function getPeakScore(forecast: WeatherForecast): number {
    if (!forecast.hourlyData || forecast.hourlyData.length === 0) return 0;
    const sunriseHour = parseInt(forecast.sunrise.split(':')[0]);
    const sunsetHour = parseInt(forecast.sunset.split(':')[0]);
    const GOOD_THRESHOLD = 55;

    const morningHours = forecast.hourlyData.filter(h => {
      const hour = new Date(h.timestamp).getHours();
      return hour >= sunriseHour && hour < 12;
    });
    const afternoonHours = forecast.hourlyData.filter(h => {
      const hour = new Date(h.timestamp).getHours();
      return hour >= 12 && hour <= sunsetHour;
    });

    const isWindowGood = (hours: typeof morningHours) => {
      if (hours.length === 0) return false;
      const goodCount = hours.filter(h => h.overallScore >= GOOD_THRESHOLD).length;
      return goodCount > hours.length / 2;
    };

    const morningGood = isWindowGood(morningHours);
    const afternoonGood = isWindowGood(afternoonHours);

    if (morningGood && afternoonGood) return 85;
    if (morningGood || afternoonGood) return 65;

    const allDaylight = forecast.hourlyData.filter(h => {
      const hour = new Date(h.timestamp).getHours();
      return hour >= sunriseHour && hour <= sunsetHour;
    });
    if (allDaylight.length === 0) return 0;
    return Math.min(Math.max(...allDaylight.map(h => h.overallScore)), 54);
  }

  function shortDay(dateString: string): string {
    const utcDate = new Date(dateString).toISOString().split('T')[0];
    const d = new Date(utcDate + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(17, 24, 39, 0.95)',
        border: isSelected ? '2px solid #3b82f6' : '1.5px solid rgba(30, 42, 58, 0.9)',
        borderRadius: '10px',
        padding: '6px 8px',
        minWidth: '120px',
        maxWidth: '160px',
        cursor: 'pointer',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 2px 12px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Site name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
        <div style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: WING_SVG }}
        />
        <span style={{
          color: '#f1f5f9',
          fontSize: '11px',
          fontWeight: 600,
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '120px',
        }}>
          {siteName}
        </span>
      </div>

      {/* Day score indicators */}
      {isLoading ? (
        <div style={{ height: '10px', background: 'rgba(30,42,58,0.6)', borderRadius: '4px' }} />
      ) : displayForecasts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {displayForecasts.map((forecast, i) => {
            const day = shortDay(forecast.date);
            const hours = forecast.hourlyData ?? [];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  color: '#9ca3af',
                  fontSize: '9px',
                  fontWeight: 600,
                  width: '22px',
                  flexShrink: 0,
                  textAlign: 'right',
                }}>
                  {day}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                  title={`${day}: ${Math.round(getPeakScore(forecast))}`}
                >
                  {hours.length > 0 ? hours.map((h, j) => (
                    <div
                      key={j}
                      style={{ flex: 1, backgroundColor: scoreToHeatColor(h.overallScore) }}
                    />
                  )) : (
                    <div style={{ flex: 1, background: 'rgba(30,42,58,0.6)' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ height: '8px', background: 'rgba(30,42,58,0.6)', borderRadius: '3px' }} />
      )}
    </div>
  );
}

export default function SiteMarker({
  site,
  currentZoom,
  parkingIconZoomLevel,
  onTakeoffClick,
  isSelected = false,
}: SiteMarkerProps) {
  const { forecasts, isLoading: isLoadingWeather } = useWeather(site.enabled ? site.id : null);
  const { settingsMap } = useSettings();
  const isMobile = useIsMobile(900);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);
  const rootRef = useRef<Root | null>(null);
  const rootContainerRef = useRef<Element | null>(null);

  const forecastDays = typeof settingsMap['weather.forecast_days'] === 'number'
    ? settingsMap['weather.forecast_days']
    : 3;

  const takeoffLat = parseFloat(site.takeoff_lat.toString());
  const takeoffLon = parseFloat(site.takeoff_lon.toString());
  const parkingLat = parseFloat(site.parking_lat.toString());
  const parkingLon = parseFloat(site.parking_lon.toString());

  const isHighZoom = currentZoom >= parkingIconZoomLevel;

  // Card DivIcon — shown at low zoom
  const cardDivIcon = useMemo(() => {
    return new L.DivIcon({
      className: 'site-card-marker',
      html: '<div class="site-card-root"></div>',
      iconSize: [160, 80],
      iconAnchor: [80, 80],
      popupAnchor: [0, -80],
    });
  }, []);

  // PPG / question-mark icon — shown at high zoom
  const takeoffIcon = useMemo(() => {
    if (site.name.startsWith('Potential')) {
      return new L.DivIcon({
        html: `<div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:bold;color:#ff6b00;text-shadow:0 0 4px rgba(0,0,0,0.5)">?</div>`,
        iconSize: [64, 64],
        iconAnchor: [32, 32],
        popupAnchor: [0, -32],
      });
    }
    return new L.Icon({
      iconUrl: '/icon-ppg.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [64, 64],
      iconAnchor: [32, 32],
      popupAnchor: [0, -32],
      shadowSize: [82, 82],
    });
  }, [site.name]);

  // Render the React card into the DivIcon (only at low zoom)
  useEffect(() => {
    if (isHighZoom) return;

    const markerElement = markerRef.current?.getElement();
    if (!markerElement) return;

    const container = markerElement.querySelector('.site-card-root');
    if (!container) return;

    if (rootRef.current && rootContainerRef.current !== container) {
      rootRef.current.unmount();
      rootRef.current = null;
    }

    if (!rootRef.current) {
      rootRef.current = createRoot(container);
      rootContainerRef.current = container;
    }

    rootRef.current.render(
      <SiteCard
        siteName={site.name}
        forecasts={forecasts}
        isLoading={isLoadingWeather}
        isSelected={isSelected}
        maxDays={forecastDays}
        onClick={() => {
          if (!isMobile && onTakeoffClick) {
            onTakeoffClick(site);
          }
        }}
      />,
    );

    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
        rootContainerRef.current = null;
      }
    };
  }, [forecasts, isLoadingWeather, isSelected, forecastDays, site.name, isMobile, isHighZoom]);

  const handleParkingClick = async (e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();
    const coordsString = `${parkingLat.toFixed(6)}, ${parkingLon.toFixed(6)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(coordsString);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = coordsString;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {}
    setShowParkingModal(true);
  };

  const positions: [number, number][] = [
    [takeoffLat, takeoffLon],
    [parkingLat, parkingLon],
  ];

  return (
    <>
      {/* Parking Address Modal */}
      <ParkingAddressModal
        lat={parkingLat}
        lon={parkingLon}
        isOpen={showParkingModal}
        onClose={() => setShowParkingModal(false)}
      />

      {/* Takeoff-to-parking line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: site.enabled ? '#22c55e' : '#9ca3af',
          weight: 2,
          opacity: 0.6,
          dashArray: '5, 5',
        }}
      />

      {/* Low zoom: card marker with site name + day score dots */}
      {!isHighZoom && (
        <Marker
          ref={markerRef}
          position={[takeoffLat, takeoffLon]}
          icon={cardDivIcon}
          zIndexOffset={CARD_Z_INDEX}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation();
              if (onTakeoffClick) onTakeoffClick(site);
            },
          }}
        />
      )}

      {/* High zoom: paramotor icon at takeoff point */}
      {isHighZoom && (
        <Marker
          position={[takeoffLat, takeoffLon]}
          icon={takeoffIcon}
          zIndexOffset={TAKEOFF_Z_INDEX}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation();
              if (onTakeoffClick) onTakeoffClick(site);
            },
          }}
        />
      )}

      {/* High zoom: parking marker */}
      {isHighZoom && (
        <Marker
          position={[parkingLat, parkingLon]}
          icon={parkingIcon}
          zIndexOffset={PARKING_Z_INDEX}
          eventHandlers={{ click: handleParkingClick }}
        />
      )}
    </>
  );
}
