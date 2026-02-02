import { FlightSite } from '../../services/sites.service';

/**
 * WeatherStatusBanner - Simple top banner showing selected site name
 *
 * Displays at top of map on mobile devices showing:
 * - Site name only (48px height)
 */

interface WeatherStatusBannerProps {
  site: FlightSite | null;
}

export default function WeatherStatusBanner({
  site,
}: WeatherStatusBannerProps) {
  if (!site) return null;

  return (
    <div className="absolute top-0 left-0 right-0 bg-white/95 backdrop-blur shadow-lg z-[900] h-12">
      <div className="h-12 flex items-center px-4">
        <h3 className="text-lg font-bold outdoor-text truncate">{site.name}</h3>
      </div>
    </div>
  );
}
