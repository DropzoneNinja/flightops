import { useState } from 'react';
import { Media } from '../../services/media.service';
import { mediaService } from '../../services/media.service';
import { useMediaStore } from '../../stores/mediaStore';

interface MediaCardProps {
  media: Media;
  mediaList: string[];
  index: number;
}

/**
 * MediaCard Component
 * Individual media thumbnail card with metadata preview
 */
export default function MediaCard({ media, mediaList, index }: MediaCardProps) {
  const { openViewer } = useMediaStore();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const thumbnailUrl = media.thumbnail_path
    ? mediaService.getMediaThumbnailUrl(media.id)
    : mediaService.getMediaFileUrl(media.id);

  const handleCardClick = () => {
    openViewer(media.id, mediaList, index);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer bg-white rounded-lg shadow-elevation hover:shadow-elevation-lg transition-all duration-300 overflow-hidden animate-fade-in hover:scale-[1.02]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-[4/3] bg-sky-midday overflow-hidden">
        {/* Loading Skeleton */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-r from-sky-midday via-sky-cloud to-sky-midday animate-pulse" />
        )}

        {/* Thumbnail Image */}
        {!imageError && (
          <img
            src={thumbnailUrl}
            alt={media.original_filename}
            loading="lazy"
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`w-full h-full object-cover transition-all duration-500 ${
              imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
        )}

        {/* Error State */}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-sky-midday">
            <div className="text-center">
              <svg
                className="w-12 h-12 text-sky-dusk mx-auto mb-2"
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
              <p className="text-xs text-sky-dusk font-body">Failed to load</p>
            </div>
          </div>
        )}

        {/* Video Play Icon Overlay */}
        {media.media_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300">
            <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-8 h-8 text-sky-morning ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Media Type Badge */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 bg-black bg-opacity-60 text-white text-xs font-mono rounded backdrop-blur-sm">
            {media.media_type === 'video' ? 'VIDEO' : 'PHOTO'}
          </span>
        </div>
      </div>

      {/* Metadata Section */}
      <div className="p-4">
        {/* Filename */}
        <h3 className="font-body font-medium text-sky-night text-sm mb-2 truncate group-hover:text-sky-morning transition-colors">
          {media.original_filename}
        </h3>

        {/* Uploaded By */}
        <div className="flex items-center gap-2 text-xs text-sky-dusk mb-1">
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
          <span className="truncate">{media.uploaded_by}</span>
        </div>

        {/* Pilots */}
        {media.pilots.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-sky-dusk">
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
            <span className="truncate">
              {media.pilots.join(', ')}
            </span>
          </div>
        )}

        {/* Notes Preview */}
        {media.notes && (
          <div className="mt-2 pt-2 border-t border-sky-midday">
            <p className="text-xs text-sky-dusk italic line-clamp-2">
              {media.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
