import { useEffect, useRef, useState } from 'react';
import { useMediaStore } from '../../stores/mediaStore';
import { useMediaById, useMediaDelete } from '../../hooks/useMedia';
import { useAuth } from '../../hooks/useAuth';
import ImageViewer from './ImageViewer';
import VideoPlayer from './VideoPlayer';
import { mediaService } from '../../services/media.service';

/**
 * MediaViewer Component
 * Full-screen overlay for viewing media with navigation and controls
 */
export default function MediaViewer() {
  const {
    viewerOpen,
    currentMediaId,
    currentMediaIndex,
    mediaList,
    closeViewer,
    navigateNext,
    navigatePrevious,
  } = useMediaStore();

  const { data: media, isLoading } = useMediaById(currentMediaId || undefined);
  const { user } = useAuth();
  const deleteMutation = useMediaDelete();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    if (!viewerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeViewer();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (mediaList.length > 1) {
            navigatePrevious();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (mediaList.length > 1) {
            navigateNext();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [viewerOpen, mediaList.length, closeViewer, navigateNext, navigatePrevious]);

  // Focus trap
  useEffect(() => {
    if (viewerOpen && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [viewerOpen]);

  // Increment view count when media is opened
  useEffect(() => {
    if (viewerOpen && currentMediaId) {
      // Fire-and-forget increment
      mediaService.incrementViewCount(currentMediaId).catch((error) => {
        console.error('Failed to increment view count:', error);
        // Don't show error to user - this is non-critical
      });
    }
  }, [viewerOpen, currentMediaId]);

  // Touch gestures for mobile
  useEffect(() => {
    if (!viewerOpen) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          // Swipe left - next
          if (mediaList.length > 1) {
            navigateNext();
          }
        } else {
          // Swipe right - previous
          if (mediaList.length > 1) {
            navigatePrevious();
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [viewerOpen, mediaList.length, navigateNext, navigatePrevious]);

  if (!viewerOpen) {
    return null;
  }

  const handleDownload = async () => {
    if (!media) return;
    try {
      // Increment download counter first
      await mediaService.incrementDownloadCount(media.id).catch((error) => {
        console.error('Failed to increment download count:', error);
        // Continue with download even if counter fails
      });

      // Proceed with download
      const url = await mediaService.getMediaFileUrl(media.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = media.original_filename;
      link.click();
    } catch (error) {
      console.error('Failed to download media:', error);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!media) return;

    try {
      await deleteMutation.mutateAsync(media.id);
      setShowDeleteConfirm(false);
      closeViewer();
    } catch (error: any) {
      console.error('Failed to delete media:', error);
      alert(error.response?.data?.message || 'Failed to delete media. Please try again.');
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  // Check if current user can delete this media
  const canDelete = media && user && (user.is_admin || media.uploaded_by === user.username);

  const hasPrevious = mediaList.length > 1;
  const hasNext = mediaList.length > 1;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1100] bg-black bg-opacity-95 backdrop-blur-sm animate-fade-in"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      {/* Close Button */}
      <button
        onClick={closeViewer}
        className="absolute top-4 right-4 z-50 w-12 h-12 flex items-center justify-center bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full transition-all hover:scale-110 backdrop-blur-sm"
        aria-label="Close viewer"
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Previous Button */}
      {hasPrevious && (
        <button
          onClick={navigatePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 flex items-center justify-center bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full transition-all hover:scale-110 backdrop-blur-sm"
          aria-label="Previous media"
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
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
      )}

      {/* Next Button */}
      {hasNext && (
        <button
          onClick={navigateNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 flex items-center justify-center bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full transition-all hover:scale-110 backdrop-blur-sm"
          aria-label="Next media"
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
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      )}

      {/* Main Content Area */}
      <div className="absolute inset-0 flex flex-col">
        {/* Media Display Area - Fixed height to leave room for metadata */}
        <div className="relative" style={{ height: 'calc(100vh - 220px)', minHeight: '300px' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white font-body">Loading media...</p>
              </div>
            </div>
          )}

          {media && !isLoading && (
            <>
              {media.media_type === 'image' ? (
                <ImageViewer mediaId={media.id} alt={media.original_filename} />
              ) : (
                <VideoPlayer mediaId={media.id} />
              )}
            </>
          )}
        </div>

        {/* Metadata Panel */}
        {media && (
          <div className="bg-gradient-to-t from-black via-black/90 to-transparent p-6 flex-shrink-0">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                {/* Left: Metadata */}
                <div className="flex-1">
                  <h2 className="text-white font-display text-xl md:text-2xl font-semibold mb-3">
                    {media.original_filename}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    {/* Uploaded By */}
                    <div className="flex items-center gap-2 text-gray-300">
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="none"
                        strokeWidth={2}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                      <span className="font-body">
                        <span className="text-gray-400">Uploaded by:</span>{' '}
                        {media.uploaded_by}
                      </span>
                    </div>

                    {/* Pilots */}
                    {media.pilots.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          fill="none"
                          strokeWidth={2}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                          />
                        </svg>
                        <span className="font-body">
                          <span className="text-gray-400">Pilots:</span>{' '}
                          {media.pilots.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-2 text-gray-300">
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="none"
                        strokeWidth={2}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                        />
                      </svg>
                      <span className="font-body font-mono text-gray-300">
                        {new Date(media.flight_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {media.notes && (
                    <div className="mt-3 text-gray-300 font-body text-sm italic">
                      {media.notes}
                    </div>
                  )}
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-3">
                  {/* Counter */}
                  {mediaList.length > 1 && (
                    <div className="text-gray-400 font-mono text-sm">
                      {currentMediaIndex + 1} / {mediaList.length}
                    </div>
                  )}

                  {/* Download Button */}
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-sky-morning hover:bg-sky-dusk text-white font-body font-medium rounded-lg transition-colors flex items-center gap-2"
                    aria-label="Download media"
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
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    <span className="hidden sm:inline">Download</span>
                  </button>

                  {/* Delete Button - Only visible to uploader or admin */}
                  {canDelete && (
                    <button
                      onClick={handleDeleteClick}
                      disabled={deleteMutation.isPending}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-body font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Delete media"
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
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                      <span className="hidden sm:inline">
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Hint - Positioned above metadata panel */}
      {media && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg text-xs font-body backdrop-blur-sm hidden md:block pointer-events-none"
          style={{ bottom: '210px' }}
        >
          <kbd className="px-2 py-1 bg-white bg-opacity-20 rounded">←</kbd>{' '}
          <kbd className="px-2 py-1 bg-white bg-opacity-20 rounded">→</kbd> Navigate
          • <kbd className="px-2 py-1 bg-white bg-opacity-20 rounded">ESC</kbd>{' '}
          Close
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-600"
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
              <div>
                <h3 className="text-lg font-display font-semibold text-gray-900">
                  Delete Media
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete this {media?.media_type}? This action cannot be undone.
                </p>
              </div>
            </div>

            {media && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-body text-gray-700 truncate">
                  {media.original_filename}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-body font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-body font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
