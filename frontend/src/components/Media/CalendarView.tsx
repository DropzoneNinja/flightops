import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';

interface MediaDateCount {
  date: string;
  image_count: number;
  video_count: number;
}

interface CalendarViewProps {
  mediaDateCounts: MediaDateCount[];
  isLoading?: boolean;
  onUploadClick?: () => void;
}

/**
 * CalendarView Component
 * Displays a monthly calendar with highlighted dates that contain media
 */
export default function CalendarView({
  mediaDateCounts,
  isLoading = false,
  onUploadClick,
}: CalendarViewProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Create a map of date to counts for quick lookup
  const dateCountsMap = useMemo(() => {
    const map = new Map<string, { image_count: number; video_count: number }>();
    mediaDateCounts.forEach((item) => {
      map.set(item.date, {
        image_count: item.image_count,
        video_count: item.video_count,
      });
    });
    return map;
  }, [mediaDateCounts]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get media counts for a specific date
  const getMediaCounts = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dateCountsMap.get(dateStr) || null;
  };

  // Handle date click
  const handleDateClick = (date: Date) => {
    if (!isSameMonth(date, currentMonth)) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/media/${dateStr}`);
  };

  // Navigation handlers
  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="calendar-container">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-sky-midday rounded animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-sky-midday rounded animate-pulse"></div>
            <div className="h-10 w-10 bg-sky-midday rounded animate-pulse"></div>
            <div className="h-10 w-10 bg-sky-midday rounded animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-sky-midday rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-container">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-sky-night">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-body text-sky-dusk hover:text-sky-night border border-sky-midday hover:border-sky-morning rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={handlePreviousMonth}
            className="p-2 text-sky-dusk hover:text-sky-night hover:bg-sky-midday rounded-lg transition-all"
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
            className="p-2 text-sky-dusk hover:text-sky-night hover:bg-sky-midday rounded-lg transition-all"
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

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {/* Week day headers */}
        {weekDays.map((day) => (
          <div
            key={day}
            className="calendar-weekday text-center py-3 text-sm font-mono font-medium text-sky-dusk uppercase tracking-wider"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const mediaCounts = getMediaCounts(day);
          const hasMedia = mediaCounts !== null;
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              disabled={!isCurrentMonth}
              className={`
                calendar-day
                relative p-2 sm:p-3 rounded-lg
                transition-all duration-200
                min-h-[80px] sm:min-h-[100px]
                flex flex-col items-center justify-start
                ${
                  isCurrentMonth
                    ? 'hover:shadow-elevation hover:scale-105 cursor-pointer'
                    : 'opacity-30 cursor-not-allowed'
                }
                ${isTodayDate ? 'ring-2 ring-sky-morning' : ''}
                ${
                  hasMedia && isCurrentMonth
                    ? 'bg-gradient-to-br from-sky-cloud to-sky-midday hover:from-sky-midday hover:to-sky-morning/20'
                    : 'bg-sky-cloud hover:bg-sky-midday'
                }
              `}
              style={{
                animationDelay: `${index * 30}ms`,
              }}
            >
              {/* Day number */}
              <span
                className={`
                  text-base sm:text-lg font-display font-semibold mb-1
                  ${isCurrentMonth ? 'text-sky-night' : 'text-sky-dusk/50'}
                  ${isTodayDate ? 'text-sky-morning' : ''}
                `}
              >
                {format(day, 'd')}
              </span>

              {/* Media counts */}
              {hasMedia && isCurrentMonth && mediaCounts && (
                <div className="flex flex-col gap-1 text-xs sm:text-sm">
                  {mediaCounts.image_count > 0 && (
                    <div className="flex items-center gap-1 text-sky-dusk">
                      <svg
                        className="w-3 h-3 sm:w-4 sm:h-4"
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
                      <span className="font-medium">{mediaCounts.image_count}</span>
                    </div>
                  )}
                  {mediaCounts.video_count > 0 && (
                    <div className="flex items-center gap-1 text-sky-dusk">
                      <svg
                        className="w-3 h-3 sm:w-4 sm:h-4"
                        fill="none"
                        strokeWidth={2}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                      <span className="font-medium">{mediaCounts.video_count}</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty state message */}
      {mediaDateCounts.length === 0 && (
        <div className="mt-8 text-center py-8 bg-sky-cloud rounded-lg border-2 border-dashed border-sky-midday">
          <p className="text-sky-dusk font-body text-lg mb-2">
            No media uploaded yet
          </p>
          <p className="text-sky-dusk/70 font-body text-sm mb-4">
            Start building your sky archive by uploading photos and videos
          </p>
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              className="px-6 py-3 bg-sky-morning text-white font-body rounded-lg hover:bg-sky-dusk transition-colors shadow-elevation"
            >
              Upload First Media
            </button>
          )}
        </div>
      )}
    </div>
  );
}
