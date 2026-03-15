import { useParams, useNavigate } from 'react-router-dom';
import { useMediaByDate } from '../hooks/useMedia';
import { useMediaStore } from '../stores/mediaStore';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import MediaGrid from '../components/Media/MediaGrid';
import MediaViewer from '../components/Media/MediaViewer';
import UploadModal from '../components/Media/UploadModal';
import MobilePageLayout from '../components/Mobile/MobilePageLayout';
import { format, parseISO } from 'date-fns';

/**
 * DailyGallery Page
 * Shows all media for a specific date with grid layout
 */
export default function DailyGallery() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openUploadModal } = useMediaStore();

  const isMobile = useIsMobile();
  const { data: media, isLoading, error, refetch } = useMediaByDate(date);

  // Format the date for display
  const formattedDate = date
    ? format(parseISO(date), 'EEEE, MMMM d, yyyy')
    : '';

  // Get site name if all media is from the same site
  const siteName = media && media.length > 0
    ? (() => {
        const firstSite = media[0].site;
        const allSameSite = media.every(m => m.site?.id === firstSite?.id);
        return allSameSite && firstSite ? firstSite.name : null;
      })()
    : null;

  if (isLoading) {
    const skeleton = (
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-elevation p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-sky-midday rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <MobilePageLayout activeTab="media" showBackButton backLabel="Calendar" onBack={() => navigate('/media')}>
          {skeleton}
        </MobilePageLayout>
      );
    }

    return (
      <div className="min-h-screen bg-sky-midday">
        <header className="bg-white shadow-elevation">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-6 w-32 bg-sky-midday rounded animate-pulse mb-2"></div>
                <div className="h-8 w-64 bg-sky-midday rounded animate-pulse"></div>
              </div>
              <div className="h-10 w-24 bg-sky-midday rounded animate-pulse"></div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-elevation p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-sky-midday rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    const errorContent = (
      <main className="px-4 py-8">
        <div className="bg-white rounded-xl shadow-elevation-lg p-8 animate-scale-in">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold text-sky-night text-center mb-2">Unable to Load Media</h2>
          <p className="text-sky-dusk text-center mb-6">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={() => refetch()} className="px-6 py-3 bg-sky-morning text-white font-medium rounded-lg hover:bg-sky-dusk transition-all">Try Again</button>
            <button onClick={() => navigate('/media')} className="px-6 py-3 bg-white text-sky-dusk border border-sky-midday font-medium rounded-lg hover:bg-sky-cloud transition-all">Back to Calendar</button>
          </div>
        </div>
      </main>
    );

    if (isMobile) {
      return (
        <MobilePageLayout activeTab="media" showBackButton backLabel="Calendar" onBack={() => navigate('/media')}>
          {errorContent}
        </MobilePageLayout>
      );
    }

    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b-2 border-gray-200 z-10">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="border-r-2 border-gray-300 pr-6 flex items-center gap-4">
                <img
                  src="/logo.png"
                  alt="Throttle Junkies"
                  className="h-16 w-auto"
                />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Flight Memories</h1>
                  <p className="text-sm text-gray-600">Media Gallery</p>
                </div>
              </div>
              <div className="flex items-center justify-end space-x-4 ml-auto">
                <span className="text-sm text-gray-600">{user?.username || user?.email}</span>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Back to Map
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Error Content */}
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-xl shadow-elevation-lg p-8 animate-scale-in">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  strokeWidth={2}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h2 className="text-2xl font-display font-bold text-sky-night text-center mb-2">
              Unable to Load Media
            </h2>
            <p className="text-sky-dusk font-body text-center mb-6">
              {error instanceof Error
                ? error.message
                : 'An unexpected error occurred while loading media for this date.'}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => refetch()}
                className="px-6 py-3 bg-sky-morning text-white font-body font-medium rounded-lg hover:bg-sky-dusk transition-all shadow-elevation hover:shadow-elevation-lg"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-white text-sky-dusk border border-sky-midday font-body font-medium rounded-lg hover:bg-sky-cloud transition-all"
              >
                Back to Map
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Mobile layout
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
          {!media || media.length === 0 ? (
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-gray-200 z-10 sticky top-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="border-r-2 border-gray-300 pr-6 flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Throttle Junkies"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Flight Memories</h1>
                <p className="text-sm text-gray-600">Media Gallery</p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-4 ml-auto">
              <span className="text-sm text-gray-600">{user?.username || user?.email}</span>
              <button
                onClick={openUploadModal}
                className="px-4 py-2 bg-sky-morning text-white rounded-md text-sm font-medium hover:bg-sky-dusk transition-colors"
              >
                Upload Media
              </button>
              <button
                onClick={() => navigate('/media')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Back to Calendar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Site Name Header (if all media from same site) */}
        {siteName && (
          <div className="mb-6">
            <h1 className="text-3xl font-display font-bold text-sky-night mb-2">
              {siteName}
            </h1>
          </div>
        )}

        {/* Media for the day */}
        {!media || media.length === 0 ? (
          <div className="bg-white rounded-xl shadow-elevation-lg p-6 sm:p-8">
            <div className="text-center py-12">
              <div className="mb-4">
                <svg
                  className="mx-auto h-16 w-16 text-sky-dusk/50"
                  fill="none"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-display font-semibold text-sky-night mb-2">
                No Media Yet
              </h3>
              <p className="text-sky-dusk font-body mb-4">
                There are no photos or videos for {formattedDate}
              </p>
              <button
                onClick={openUploadModal}
                className="px-6 py-3 bg-sky-morning text-white font-body rounded-lg hover:bg-sky-dusk transition-colors shadow-elevation"
              >
                Upload Media
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-elevation-lg p-6 sm:p-8 animate-fade-in">
            {/* Date Header */}
            <div className="mb-6 pb-4 border-b-2 border-sky-midday">
              <h2 className="text-2xl font-display font-bold text-sky-night">
                {formattedDate}
              </h2>
              <p className="text-sm text-sky-dusk font-body mt-1">
                {media.length} {media.length === 1 ? 'item' : 'items'}
              </p>
            </div>

            {/* Media Grid */}
            <MediaGrid />
          </div>
        )}
      </main>

      {/* Media Viewer Modal */}
      <MediaViewer />

      {/* Upload Modal */}
      <UploadModal defaultDate={date} />
    </div>
  );
}
