import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaByDate } from '../hooks/useMedia';
import { useMediaStore } from '../stores/mediaStore';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import MediaGrid from '../components/Media/MediaGrid';
import MediaViewer from '../components/Media/MediaViewer';
import UploadModal from '../components/Media/UploadModal';
import FlightUploadModal from '../components/Flights/FlightUploadModal';
import MobilePageLayout from '../components/Mobile/MobilePageLayout';
import FlightsSection from '../components/Flights/FlightsSection';
import { format, parseISO } from 'date-fns';

type GalleryTab = 'media' | 'flights';

export default function DailyGallery() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { openUploadModal } = useMediaStore();
  const [activeTab, setActiveTab] = useState<GalleryTab>('media');
  const [flightUploadOpen, setFlightUploadOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: media, isLoading, error, refetch } = useMediaByDate(date);

  const formattedDate = date ? format(parseISO(date), 'EEEE, MMMM d, yyyy') : '';

  const siteName = media && media.length > 0
    ? (() => {
        const firstSite = media[0].site;
        const allSameSite = media.every(m => m.site?.id === firstSite?.id);
        return allSameSite && firstSite ? firstSite.name : null;
      })()
    : null;

  if (isLoading) {
    if (isMobile) {
      return (
        <MobilePageLayout activeTab="media" showBackButton backLabel="Calendar" onBack={() => navigate('/media')}>
          <div className="p-4">
            <div className="bg-white rounded-lg shadow-elevation p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 bg-sky-midday rounded-lg animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
        </MobilePageLayout>
      );
    }
    return (
      <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
        <LeftSidebar user={user} showAirspace={false} onToggleAirspace={() => {}} onLogout={logout} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="border-b border-[#1e2a3a] px-6 py-4 shrink-0" style={{ background: '#0d1421' }}>
            <div className="h-4 w-56 bg-[#1e2a3a] rounded animate-pulse mb-1"></div>
            <div className="h-3 w-32 bg-[#1e2a3a] rounded animate-pulse"></div>
          </header>
          <main className="flex-1 overflow-y-auto px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-[#1e2a3a] rounded-xl animate-pulse"></div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    const errorContent = (
      <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-8 text-center max-w-lg w-full">
        <div className="w-14 h-14 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Unable to Load Media</h2>
        <p className="text-[#6b7fa3] text-sm mb-6">
          {error instanceof Error ? error.message : 'An unexpected error occurred while loading media for this date.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/media')}
            className="px-5 py-2.5 border border-[#2a3a54] text-[#a0b3cc] rounded-lg text-sm font-medium hover:bg-[#1e2a3a] transition-colors"
          >
            Back to Calendar
          </button>
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <MobilePageLayout activeTab="media" showBackButton backLabel="Calendar" onBack={() => navigate('/media')}>
          <div className="px-4 py-8">
            <div className="bg-white rounded-xl shadow-elevation-lg p-8">
              <h2 className="text-xl font-bold text-sky-night text-center mb-2">Unable to Load Media</h2>
              <p className="text-sky-dusk text-center mb-6">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => refetch()} className="px-6 py-3 bg-sky-morning text-white font-medium rounded-lg hover:bg-sky-dusk transition-all">Try Again</button>
                <button onClick={() => navigate('/media')} className="px-6 py-3 bg-white text-sky-dusk border border-sky-midday font-medium rounded-lg hover:bg-sky-cloud transition-all">Back to Calendar</button>
              </div>
            </div>
          </div>
        </MobilePageLayout>
      );
    }

    return (
      <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
        <LeftSidebar user={user} showAirspace={false} onToggleAirspace={() => {}} onLogout={logout} />
        <div className="flex-1 flex items-center justify-center p-8">
          {errorContent}
        </div>
      </div>
    );
  }

  // Mobile layout — unchanged
  if (isMobile) {
    return (
      <MobilePageLayout
        activeTab="media"
        showBackButton
        backLabel="Calendar"
        onBack={() => navigate('/media')}
        headerRight={
          <button onClick={openUploadModal} className="touch-target p-2 text-sky-morning" aria-label="Upload media">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        }
      >
        <div className="px-4 py-4">
          {siteName && <h2 className="text-xl font-bold text-sky-night mb-3">{siteName}</h2>}
          <div className="flex gap-1 mb-4 bg-white rounded-xl shadow-elevation p-1">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'media' ? 'bg-sky-morning text-white' : 'text-sky-dusk'}`}
            >
              Photos / Videos
            </button>
            <button
              onClick={() => setActiveTab('flights')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'flights' ? 'bg-sky-morning text-white' : 'text-sky-dusk'}`}
            >
              Flights
            </button>
          </div>
          {activeTab === 'flights' ? (
            <div className="bg-white rounded-xl shadow-elevation-lg p-4 animate-fade-in">
              <FlightsSection date={date!} />
            </div>
          ) : !media || media.length === 0 ? (
            <div className="bg-white rounded-xl shadow-elevation-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-sky-night mb-2">No Media Yet</h3>
              <p className="text-sky-dusk mb-4">No photos or videos for {formattedDate}</p>
              <button onClick={openUploadModal} className="px-6 py-3 bg-sky-morning text-white rounded-lg hover:bg-sky-dusk transition-colors">Upload Media</button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-elevation-lg p-4 animate-fade-in">
              <div className="mb-4 pb-3 border-b border-sky-midday">
                <h2 className="text-lg font-bold text-sky-night">{formattedDate}</h2>
                <p className="text-sm text-sky-dusk">{media.length} {media.length === 1 ? 'item' : 'items'}</p>
              </div>
              <MediaGrid />
            </div>
          )}
        </div>
        <MediaViewer />
        <UploadModal defaultDate={date} />
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/media')}
                className="flex items-center gap-1.5 text-sm text-[#6b7fa3] hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Calendar
              </button>
              <span className="text-[#2a3a54]">|</span>
              <div>
                {siteName && <p className="text-xs text-[#6b7fa3]">{siteName}</p>}
                <h1 className="text-sm font-semibold text-white">{formattedDate}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openUploadModal}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Upload Media
              </button>
              <button
                onClick={() => setFlightUploadOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] text-sm font-medium rounded-lg hover:bg-[#243048] transition-colors"
              >
                Upload Flight
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          {/* Tab navigation */}
          <div className="mb-6 inline-flex bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-1">
            <button
              onClick={() => setActiveTab('media')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'media'
                  ? 'bg-blue-600 text-white'
                  : 'text-[#6b7fa3] hover:text-white hover:bg-[#1e2a3a]'
              }`}
            >
              Photos / Videos
            </button>
            <button
              onClick={() => setActiveTab('flights')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'flights'
                  ? 'bg-blue-600 text-white'
                  : 'text-[#6b7fa3] hover:text-white hover:bg-[#1e2a3a]'
              }`}
            >
              Flights
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'flights' ? (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-6">
              <FlightsSection date={date!} />
            </div>
          ) : !media || media.length === 0 ? (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-8 text-center py-16">
              <svg className="mx-auto h-14 w-14 text-[#2a3a54] mb-4" fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <h3 className="text-base font-semibold text-white mb-2">No Media Yet</h3>
              <p className="text-[#6b7fa3] text-sm mb-5">There are no photos or videos for {formattedDate}</p>
              <button
                onClick={openUploadModal}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Upload Media
              </button>
            </div>
          ) : (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-6">
              <div className="mb-6 pb-4 border-b border-[#1e2a3a]">
                <h2 className="text-lg font-bold text-white">{formattedDate}</h2>
                <p className="text-sm text-[#6b7fa3] mt-0.5">
                  {media.length} {media.length === 1 ? 'item' : 'items'}
                </p>
              </div>
              <MediaGrid />
            </div>
          )}
        </main>
      </div>

      <MediaViewer />
      <UploadModal defaultDate={date} />
      <FlightUploadModal
        date={date ?? new Date().toISOString().split('T')[0]}
        open={flightUploadOpen}
        onClose={() => setFlightUploadOpen(false)}
      />
    </div>
  );
}
