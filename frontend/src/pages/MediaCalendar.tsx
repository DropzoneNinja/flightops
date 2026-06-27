import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaDatesWithCounts, useSitesWithMediaCounts } from '../hooks/useMedia';
import { useMediaStore } from '../stores/mediaStore';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import { MediaFilters } from '../services/media.service';
import CalendarView from '../components/Media/CalendarView';
import FiltersCard from '../components/Media/FiltersCard';
import UploadModal from '../components/Media/UploadModal';
import MediaSitesMap from '../components/Media/MediaSitesMap';
import MobilePageLayout from '../components/Mobile/MobilePageLayout';
import FlightUploadModal from '../components/Flights/FlightUploadModal';

export default function MediaCalendar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { openUploadModal } = useMediaStore();
  const isMobile = useIsMobile();
  const [flightUploadOpen, setFlightUploadOpen] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const [referenceMonth, setReferenceMonth] = useState(new Date());

  const { data: mediaDateCounts, isLoading, error, refetch } = useMediaDatesWithCounts();
  const { data: sitesWithMediaCounts, isLoading: isLoadingSites, error: sitesError } =
    useSitesWithMediaCounts();

  const handleSearch = useCallback((filters: MediaFilters) => {
    const params = new URLSearchParams();
    if (filters.uploadedBy) params.set('uploaded_by', filters.uploadedBy);
    if (filters.pilots?.length) params.set('pilots', filters.pilots.join(','));
    if (filters.year) params.set('year', String(filters.year));
    if (filters.month) params.set('month', String(filters.month));
    navigate(`/media/search?${params.toString()}`);
  }, [navigate]);

  if (error) {
    return (
      <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
        {!isMobile && (
          <LeftSidebar user={user} showAirspace={false} onToggleAirspace={() => {}} onLogout={logout} />
        )}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-8 max-w-lg w-full text-center">
            <div className="w-14 h-14 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Unable to Load Media Calendar</h2>
            <p className="text-[#6b7fa3] text-sm mb-6">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout — unchanged
  if (isMobile) {
    return (
      <MobilePageLayout
        activeTab="media"
        headerRight={
          <button
            onClick={openUploadModal}
            disabled={isLoading}
            className="touch-target p-2 text-sky-morning disabled:opacity-50"
            aria-label="Upload media"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        }
      >
        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-elevation-lg p-4 animate-fade-in">
            <CalendarView
              mediaDateCounts={mediaDateCounts || []}
              isLoading={isLoading}
              onUploadClick={openUploadModal}
              referenceMonth={referenceMonth}
              setReferenceMonth={setReferenceMonth}
            />
          </div>
          <FiltersCard onSearch={handleSearch} allDateCounts={mediaDateCounts || []} />
        </div>
        <UploadModal />
      </MobilePageLayout>
    );
  }

  return (
    <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
      <LeftSidebar user={user} showAirspace={false} onToggleAirspace={() => {}} onLogout={logout} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-[#1e2a3a] shrink-0 sticky top-0 z-10" style={{ background: '#0d1421' }}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Flight Memories</h1>
              <p className="text-xs text-[#6b7fa3]">Media Gallery</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openUploadModal}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Upload Media
              </button>
              <button
                onClick={() => setFlightUploadOpen(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] text-sm font-medium rounded-lg hover:bg-[#243048] transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload Flight
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          {/* Calendar card */}
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-6">
            <CalendarView
              mediaDateCounts={mediaDateCounts || []}
              isLoading={isLoading}
              onUploadClick={openUploadModal}
              referenceMonth={referenceMonth}
              setReferenceMonth={setReferenceMonth}
            />
          </div>

          {/* Map section */}
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] overflow-hidden flex flex-col" style={{ minHeight: '750px' }}>
            <div className="px-6 py-4 border-b border-[#1e2a3a] shrink-0">
              <h2 className="text-base font-semibold text-white">Media by Site</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              {sitesError ? (
                <div className="w-full h-full flex items-center justify-center py-16 text-center">
                  <div>
                    <p className="text-[#6b7fa3] text-sm mb-3">Unable to load map data</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              ) : (
                <MediaSitesMap
                  sites={Array.isArray(sitesWithMediaCounts) ? sitesWithMediaCounts : []}
                  isLoading={isLoadingSites}
                />
              )}
            </div>
          </div>

          {/* Filters card */}
          <FiltersCard onSearch={handleSearch} allDateCounts={mediaDateCounts || []} />
        </main>
      </div>

      <UploadModal />
      <FlightUploadModal
        date={today}
        open={flightUploadOpen}
        onClose={() => setFlightUploadOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}
