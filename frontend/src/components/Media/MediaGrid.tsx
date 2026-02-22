import { useParams } from 'react-router-dom';
import { useMediaByDate } from '../../hooks/useMedia';
import { useSites } from '../../hooks/useSites';
import MediaCard from './MediaCard';
import { Virtuoso } from 'react-virtuoso';

/**
 * MediaGrid Component
 * Responsive grid layout for displaying media items with virtualization
 */
export default function MediaGrid() {
  const { date } = useParams<{ date: string }>();
  const { data: media } = useMediaByDate(date);
  const { sites } = useSites();

  if (!media || media.length === 0) {
    return null;
  }

  // Create list of media IDs for viewer navigation
  const mediaIds = media.map((item) => item.id);

  // Get site name from the first media item's site_id
  const firstMediaSiteId = media[0]?.site_id;
  const siteName = firstMediaSiteId
    ? sites.find(site => site.id === firstMediaSiteId)?.name
    : null;

  // Decide whether to use virtualization based on number of items
  // Use virtualization if there are more than 30 items
  const useVirtualization = media.length > 30;

  if (useVirtualization) {
    return (
      <div>
        {/* Site Name Title */}
        {siteName && (
          <div className="mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-sky-morning"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
              <h2 className="text-2xl font-display font-semibold text-sky-night">
                {siteName}
              </h2>
            </div>
          </div>
        )}

        <div className="h-[calc(100vh-300px)] min-h-[600px]">
          <Virtuoso
            data={media}
            itemContent={(index, mediaItem) => (
              <div className="p-2">
                <MediaCard
                  media={mediaItem}
                  mediaList={mediaIds}
                  index={index}
                />
              </div>
            )}
            components={{
              List: ({ style, children }) => (
                <div
                  style={style}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4"
                >
                  {children}
                </div>
              ),
            }}
          />
        </div>
      </div>
    );
  }

  // Regular grid for smaller lists
  return (
    <div>
      {/* Site Name Title */}
      {siteName && (
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-sky-morning"
              fill="none"
              strokeWidth={2}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
            <h2 className="text-2xl font-display font-semibold text-sky-night">
              {siteName}
            </h2>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {media.map((mediaItem, index) => (
          <MediaCard
            key={mediaItem.id}
            media={mediaItem}
            mediaList={mediaIds}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
