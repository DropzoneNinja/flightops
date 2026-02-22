import { useParams } from 'react-router-dom';
import { useMediaByDate } from '../../hooks/useMedia';
import MediaCard from './MediaCard';
import { Virtuoso } from 'react-virtuoso';

/**
 * MediaGrid Component
 * Responsive grid layout for displaying media items with virtualization
 */
export default function MediaGrid() {
  const { date } = useParams<{ date: string }>();
  const { data: media } = useMediaByDate(date);

  if (!media || media.length === 0) {
    return null;
  }

  // Create list of media IDs for viewer navigation
  const mediaIds = media.map((item) => item.id);

  // Decide whether to use virtualization based on number of items
  // Use virtualization if there are more than 30 items
  const useVirtualization = media.length > 30;

  if (useVirtualization) {
    return (
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
    );
  }

  // Regular grid for smaller lists
  return (
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
  );
}
