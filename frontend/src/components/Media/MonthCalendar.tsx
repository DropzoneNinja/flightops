import { useMemo, memo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns';

interface MonthCalendarProps {
  month: Date;
  dateCountsMap: Map<string, { image_count: number; video_count: number }>;
  onDateClick: (date: Date) => void;
}

/**
 * MonthCalendar Component
 * Renders a single month's calendar grid with media counts
 */
function MonthCalendar({
  month,
  dateCountsMap,
  onDateClick,
}: MonthCalendarProps) {
  // Generate calendar days for the month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [month]);

  // Get media counts for a specific date
  const getMediaCounts = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dateCountsMap.get(dateStr) || null;
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-month-grid">
      {/* Month header */}
      <h3 className="text-lg sm:text-xl font-display font-semibold text-sky-night mb-4 text-center">
        {format(month, 'MMMM yyyy')}
      </h3>

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
          const isCurrentMonth = isSameMonth(day, month);
          const mediaCounts = getMediaCounts(day);
          const hasMedia = mediaCounts !== null;
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
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
                    ? 'bg-green-50 hover:bg-green-100'
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
    </div>
  );
}

export default memo(MonthCalendar);
