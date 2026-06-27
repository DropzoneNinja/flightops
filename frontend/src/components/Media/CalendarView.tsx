import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import MonthCalendar from './MonthCalendar';
import { useVisibleMonthCount } from '../../hooks/useVisibleMonthCount';

interface MediaDateCount {
  date: string;
  image_count: number;
  video_count: number;
  flight_count: number;
}

interface CalendarViewProps {
  mediaDateCounts: MediaDateCount[];
  isLoading?: boolean;
  onUploadClick?: () => void;
  referenceMonth: Date;
  setReferenceMonth: (month: Date) => void;
}

/**
 * CalendarView Component
 * Displays a monthly calendar with highlighted dates that contain media
 */
export default function CalendarView({
  mediaDateCounts,
  isLoading = false,
  onUploadClick,
  referenceMonth,
  setReferenceMonth,
}: CalendarViewProps) {
  const navigate = useNavigate();
  const visibleMonthCount = useVisibleMonthCount();

  // Create a map of date to counts for quick lookup
  const dateCountsMap = useMemo(() => {
    const map = new Map<string, { image_count: number; video_count: number; flight_count: number }>();
    mediaDateCounts.forEach((item) => {
      map.set(item.date, {
        image_count: item.image_count,
        video_count: item.video_count,
        flight_count: item.flight_count,
      });
    });
    return map;
  }, [mediaDateCounts]);

  // Calculate visible months based on reference month and count
  const visibleMonths = useMemo(() => {
    const months: Date[] = [];
    for (let i = visibleMonthCount - 1; i >= 0; i--) {
      months.push(subMonths(referenceMonth, i));
    }
    return months;
  }, [referenceMonth, visibleMonthCount]);

  // Check if next button should be disabled
  const isNextDisabled = useMemo(() => {
    const now = new Date();
    return isSameMonth(referenceMonth, now);
  }, [referenceMonth]);

  // Handle date click
  const handleDateClick = (date: Date) => {
    // Allow click on any visible month
    const isVisible = visibleMonths.some((m) => isSameMonth(date, m));
    if (!isVisible) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/media/${dateStr}`);
  };

  // Navigation handlers
  const handlePreviousMonth = () => {
    setReferenceMonth(subMonths(referenceMonth, 1));
  };

  const handleNextMonth = () => {
    const next = addMonths(referenceMonth, 1);
    const now = new Date();
    // Don't go beyond current month
    if (next > startOfMonth(now)) return;
    setReferenceMonth(next);
  };

  const handleToday = () => {
    setReferenceMonth(new Date());
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="calendar-container">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div className="h-8 w-48 bg-[#1e2a3a] rounded animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-[#1e2a3a] rounded animate-pulse"></div>
            <div className="h-10 w-10 bg-[#1e2a3a] rounded animate-pulse"></div>
            <div className="h-10 w-10 bg-[#1e2a3a] rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex gap-8 sm:gap-12">
          {Array.from({ length: visibleMonthCount }).map((_, monthIdx) => (
            <div
              key={monthIdx}
              className="flex-1"
              style={{
                width:
                  visibleMonthCount === 1
                    ? '100%'
                    : 'calc(50% - 1.5rem)',
              }}
            >
              <div className="h-6 w-32 bg-[#1e2a3a] rounded animate-pulse mb-4 mx-auto"></div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="h-20 sm:h-24 bg-[#1e2a3a] rounded animate-pulse"
                  ></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-white">
          {visibleMonthCount === 1
            ? format(referenceMonth, 'MMMM yyyy')
            : `${format(visibleMonths[0], 'MMM yyyy')} - ${format(referenceMonth, 'MMM yyyy')}`}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-body text-[#a0b3cc] hover:text-white border border-[#2a3a54] hover:border-blue-500 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={handlePreviousMonth}
            className="p-2 text-[#a0b3cc] hover:text-white hover:bg-[#1e2a3a] rounded-lg transition-all"
            aria-label="Previous month"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={handleNextMonth}
            disabled={isNextDisabled}
            className="p-2 text-[#a0b3cc] hover:text-white hover:bg-[#1e2a3a] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next month"
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .calendar-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: #2a3a54 #1e2a3a;
          -webkit-overflow-scrolling: touch;
        }
        .calendar-scroll-container::-webkit-scrollbar {
          height: 8px;
        }
        .calendar-scroll-container::-webkit-scrollbar-track {
          background-color: #1e2a3a;
          border-radius: 4px;
        }
        .calendar-scroll-container::-webkit-scrollbar-thumb {
          background-color: #2a3a54;
          border-radius: 4px;
        }
        .calendar-scroll-container::-webkit-scrollbar-thumb:hover {
          background-color: #3a4f6e;
        }
      `}</style>

      {/* Horizontal scroll container for multiple months */}
      <div className="calendar-scroll-container -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-8 sm:gap-12">
          {visibleMonths.map((month, index) => (
            <div
              key={month.toISOString()}
              className="flex-shrink-0"
              style={{
                width:
                  visibleMonthCount === 1
                    ? '100%'
                    : 'calc(50% - 1.5rem)',
                animationDelay: `${index * 100}ms`,
              }}
            >
              <MonthCalendar
                month={month}
                dateCountsMap={dateCountsMap}
                onDateClick={handleDateClick}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Empty state message */}
      {mediaDateCounts.length === 0 && (
        <div className="mt-8 text-center py-8 bg-[#1e2a3a] rounded-xl border-2 border-dashed border-[#2a3a54]">
          <p className="text-[#a0b3cc] text-lg mb-2">
            No media uploaded yet
          </p>
          <p className="text-[#6b7fa3] text-sm mb-4">
            Start building your sky archive by uploading photos and videos
          </p>
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload First Media
            </button>
          )}
        </div>
      )}
    </div>
  );
}
