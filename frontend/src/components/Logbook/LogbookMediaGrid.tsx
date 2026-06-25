import { useState, useEffect } from 'react';
import { MediaRef } from '../../services/logbook.service';
import { mediaService } from '../../services/media.service';

interface LogbookMediaGridProps {
  media: MediaRef[];
}

function MediaThumb({ m, onOpen }: { m: MediaRef; onOpen: (url: string, isVideo: boolean) => void }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mediaService.getMediaThumbnailUrl(m.id).then((url) => {
      if (!cancelled) setThumbUrl(url);
    }).catch(() => {});
    mediaService.getMediaFileUrl(m.id).then((url) => {
      if (!cancelled) setFileUrl(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [m.id]);

  return (
    <button
      onClick={() => fileUrl && onOpen(fileUrl, m.media_type === 'video')}
      disabled={!fileUrl}
      className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait"
      aria-label={m.original_filename}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={m.original_filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full animate-pulse bg-gray-200" />
      )}
      {m.media_type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/50 rounded-full p-2">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}

export default function LogbookMediaGrid({ media }: LogbookMediaGridProps) {
  const [lightbox, setLightbox] = useState<{ src: string; isVideo: boolean } | null>(null);

  if (!media.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {media.map((m) => (
          <MediaThumb
            key={m.id}
            m={m}
            onOpen={(src, isVideo) => setLightbox({ src, isVideo })}
          />
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ×
          </button>
          {lightbox.isVideo ? (
            <video
              src={lightbox.src}
              controls
              autoPlay
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightbox.src}
              alt="Full size"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}
