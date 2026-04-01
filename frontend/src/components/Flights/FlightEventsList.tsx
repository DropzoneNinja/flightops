import type { FlightEvent } from '../../services/flights.service';
import { formatFlightTimestamp } from '../../utils/flight-time';

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const EVENT_ICONS: Record<string, string> = {
  takeoff:          '🛫',
  landing:          '🛬',
  max_altitude:     '⬆',
  max_climb_rate:   '↑',
  max_descent_rate: '↓',
  max_groundspeed:  '⚡',
  longest_level:    '➡',
  largest_turn:     '↩',
  abrupt_change:    '⚠',
};

export interface FlightEventsListProps {
  events: FlightEvent[];
  /** Index of the event that is currently highlighted */
  activeEventId?: string | null;
  onEventClick?: (event: FlightEvent) => void;
  /** flight.timezone — 'UTC' or 'local'. See utils/flight-time.ts. */
  timezone?: string;
}

export default function FlightEventsList({
  events,
  activeEventId,
  onEventClick,
  timezone,
}: FlightEventsListProps) {
  if (events.length === 0) {
    return <p className="text-sm text-sky-dusk text-center py-4">No events detected.</p>;
  }

  return (
    <ul className="divide-y divide-sky-midday/20">
      {events.map((evt) => {
        const isActive = evt.id === activeEventId;
        return (
          <li
            key={evt.id}
            onClick={() => onEventClick?.(evt)}
            className={`flex items-start gap-3 py-2.5 px-1 text-sm rounded transition-colors ${
              onEventClick ? 'cursor-pointer hover:bg-sky-cloud' : ''
            } ${isActive ? 'bg-sky-cloud' : ''}`}
          >
            {/* Icon */}
            <span className="text-base shrink-0 w-5 text-center leading-none mt-0.5">
              {EVENT_ICONS[evt.event_type] ?? '●'}
            </span>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sky-night leading-tight">
                {formatEventType(evt.event_type)}
              </p>
              {evt.payload_json && Object.keys(evt.payload_json).length > 0 && (
                <p className="text-xs text-sky-dusk mt-0.5">
                  {Object.entries(evt.payload_json)
                    .map(([k, v]) => {
                      const label = k.replace(/_/g, ' ');
                      const val = typeof v === 'number' ? (v as number).toFixed(1) : String(v);
                      return `${label}: ${val}`;
                    })
                    .join(' · ')}
                </p>
              )}
              {evt.lat !== null && evt.lon !== null && (
                <p className="text-xs text-sky-dusk/70 mt-0.5">
                  {evt.lat.toFixed(4)}, {evt.lon.toFixed(4)}
                  {evt.elevation_m !== null && ` · ${Math.round(evt.elevation_m * 3.28084)} ft`}
                </p>
              )}
            </div>

            {/* Time + confidence */}
            <div className="text-right shrink-0 space-y-0.5">
              <p className="text-xs text-sky-dusk">{formatFlightTimestamp(evt.timestamp, timezone)}</p>
              {evt.confidence < 0.7 && (
                <p className="text-xs text-yellow-600 font-medium">estimated</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
