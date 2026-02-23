import { useState, useEffect } from 'react';
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  // Fetch presigned token URL when component mounts
  useEffect(() => {
    const fetchThumbnailUrl = async () => {
      try {
        const url = media.thumbnail_path
          ? await mediaService.getMediaThumbnailUrl(media.id)
          : await mediaService.getMediaFileUrl(media.id);
        setThumbnailUrl(url);
      } catch (error) {
        console.error('Failed to fetch media URL:', error);
        setImageError(true);
      }
    };

    fetchThumbnailUrl();
  }, [media.id, media.thumbnail_path]);

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
        {!imageError && thumbnailUrl && (
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
            <img
              src="/icon-ppg.png"
              alt="Pilot"
              className="w-4 h-4 flex-shrink-0"
            />
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
