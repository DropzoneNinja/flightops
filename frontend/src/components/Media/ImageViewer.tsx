import { useState, useRef, useEffect } from 'react';
import { mediaService } from '../../services/media.service';

interface ImageViewerProps {
  mediaId: string;
  alt: string;
}

/**
 * ImageViewer Component
 * Zoomable image viewer with pan functionality
 */
export default function ImageViewer({ mediaId, alt }: ImageViewerProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const imageUrl = mediaService.getMediaFileUrl(mediaId);

  useEffect(() => {
    // Reset zoom and position when mediaId changes
    setIsZoomed(false);
    setPosition({ x: 0, y: 0 });
    setImageLoaded(false);
    setImageError(false);
  }, [mediaId]);

  const handleImageClick = () => {
    if (!isZoomed) {
      setIsZoomed(true);
    } else {
      setIsZoomed(false);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isZoomed) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && isZoomed) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isZoomed && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && isZoomed && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Loading State */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white font-body">Loading image...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <svg
              className="w-20 h-20 text-white mx-auto mb-4"
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
            <p className="text-white font-body text-lg">Failed to load image</p>
            <p className="text-gray-400 font-body text-sm mt-2">
              The image could not be loaded. Please try again.
            </p>
          </div>
        </div>
      )}

      {/* Image */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt={alt}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        onClick={handleImageClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`max-w-full max-h-full object-contain transition-all duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        } ${isZoomed ? 'cursor-move scale-150' : 'cursor-zoom-in'} ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
        style={
          isZoomed
            ? {
                transform: `scale(2.5) translate(${position.x / 2.5}px, ${
                  position.y / 2.5
                }px)`,
              }
            : undefined
        }
        draggable={false}
      />

      {/* Zoom Instructions */}
      {imageLoaded && !imageError && !isZoomed && (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg text-sm font-body backdrop-blur-sm pointer-events-none">
          Click to zoom
        </div>
      )}

      {/* Zoom Reset Instructions */}
      {isZoomed && (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg text-sm font-body backdrop-blur-sm pointer-events-none">
          Click to zoom out • Drag to pan
        </div>
      )}
    </div>
  );
}
