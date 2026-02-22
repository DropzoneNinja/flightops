import { useParams, useNavigate } from 'react-router-dom';
import { useMediaByDate } from '../hooks/useMedia';
import { useMediaStore } from '../stores/mediaStore';
import { useAuth } from '../hooks/useAuth';
import MediaGrid from '../components/Media/MediaGrid';
import MediaViewer from '../components/Media/MediaViewer';
import UploadModal from '../components/Media/UploadModal';
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

  const { data: media, isLoading, error, refetch } = useMediaByDate(date);

  // Format the date for display
  const formattedDate = date
    ? format(parseISO(date), 'EEEE, MMMM d, yyyy')
    : '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sky-midday">
        {/* Header Skeleton */}
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

        {/* Content Skeleton */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-elevation p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 bg-sky-midday rounded-lg animate-pulse"
                ></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
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
                <h1 className="text-2xl font-bold text-gray-900">{formattedDate}</h1>
                {media && media.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {media.length} {media.length === 1 ? 'item' : 'items'}
                  </p>
                )}
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
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Back to Map
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Empty State */}
        {!media || media.length === 0 ? (
          <div className="bg-white rounded-xl shadow-elevation-lg p-12 text-center animate-fade-in">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-sky-midday rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-sky-dusk"
                  fill="none"
                  strokeWidth={2}
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
            </div>
            <h2 className="text-2xl font-display font-bold text-sky-night mb-2">
              No Media Yet
            </h2>
            <p className="text-sky-dusk font-body mb-6 max-w-md mx-auto">
              There are no photos or videos for {formattedDate}. Upload your
              first media to start building this day's archive!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/media')}
                className="px-6 py-3 bg-white text-sky-dusk border border-sky-midday font-body font-medium rounded-lg hover:bg-sky-cloud transition-all inline-flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  strokeWidth={2}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                  />
                </svg>
                Back to Calendar
              </button>
              <button
                onClick={openUploadModal}
                className="px-8 py-4 bg-sky-morning text-white font-body font-medium rounded-lg hover:bg-sky-dusk transition-all shadow-elevation hover:shadow-elevation-lg inline-flex items-center justify-center gap-3"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeWidth={2}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Upload Media
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-elevation-lg p-6 sm:p-8 animate-fade-in">
            <MediaGrid />

            {/* Back to Calendar Button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => navigate('/media')}
                className="px-6 py-3 bg-white text-sky-dusk border border-sky-midday font-body font-medium rounded-lg hover:bg-sky-cloud transition-all inline-flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  strokeWidth={2}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                  />
                </svg>
                Back to Calendar
              </button>
            </div>
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
