import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlightsByDate } from '../../hooks/useFlights';
import { useAuth } from '../../hooks/useAuth';
import FlightCard from './FlightCard';
import FlightUploadModal from './FlightUploadModal';

interface FlightsSectionProps {
  date: string;
}

export default function FlightsSection({ date }: FlightsSectionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: flights, isLoading, error } = useFlightsByDate(date);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-[#1e2a3a] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-6 text-center">
        <p className="text-red-400 text-sm">Failed to load flights. Please try again.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header + upload button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">
          Flights
          {flights && flights.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[#6b7fa3]">
              {flights.length} {flights.length === 1 ? 'flight' : 'flights'}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {flights && flights.length > 0 && (
            <button
              onClick={() => navigate(`/flights/formation?date=${date}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] text-sm rounded-lg hover:bg-[#243048] hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              View All
            </button>
          )}
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload GPX
          </button>
        </div>
      </div>

      {/* Flights grid or empty state */}
      {!flights || flights.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#2a3a54] p-10 text-center">
          <div className="flex justify-center mb-3">
            <svg className="w-12 h-12 text-[#2a3a54]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-[#a0b3cc] font-medium mb-1">No GPX flights yet</p>
          <p className="text-sm text-[#6b7fa3] mb-4">Upload a .gpx file to analyze your flights</p>
          <button
            onClick={() => setUploadOpen(true)}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Upload GPX
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flights.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              date={date}
              canDelete={flight.uploaded_by === user?.id}
            />
          ))}
        </div>
      )}

      <FlightUploadModal
        date={date}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  );
}
