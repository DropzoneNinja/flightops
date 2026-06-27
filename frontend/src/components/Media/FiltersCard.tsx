import { useState, useEffect, useMemo } from 'react';
import { useMediaPilots } from '../../hooks/useMedia';
import { usersService } from '../../services/users.service';
import { MediaFilters, MediaDateCount } from '../../services/media.service';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface FiltersCardProps {
  onSearch: (filters: MediaFilters) => void;
  allDateCounts: MediaDateCount[];
}

const selectCls = 'w-full px-3 py-2 bg-[#0d1421] border border-[#2a3a54] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed';

export default function FiltersCard({ onSearch, allDateCounts }: FiltersCardProps) {
  const { data: availablePilots = [], isLoading: isLoadingPilots } = useMediaPilots();
  const [usernames, setUsernames] = useState<string[]>([]);

  const [uploadedBy, setUploadedBy] = useState('');
  const [selectedPilots, setSelectedPilots] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');

  useEffect(() => {
    usersService.getUsernames().then(setUsernames).catch(() => {});
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allDateCounts.forEach((d) => {
      const year = parseInt(d.date.slice(0, 4), 10);
      if (!isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allDateCounts]);

  const availableMonths = useMemo(() => {
    if (!selectedYear) return [];
    const months = new Set<number>();
    allDateCounts.forEach((d) => {
      const year = parseInt(d.date.slice(0, 4), 10);
      if (year === selectedYear) {
        const month = parseInt(d.date.slice(5, 7), 10);
        if (!isNaN(month)) months.add(month);
      }
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [allDateCounts, selectedYear]);

  const hasActiveFilters = !!uploadedBy || selectedPilots.length > 0 || !!selectedYear;

  const handlePilotToggle = (pilot: string) => {
    setSelectedPilots((prev) =>
      prev.includes(pilot) ? prev.filter((p) => p !== pilot) : [...prev, pilot],
    );
  };

  const handleSelectAllPilots = () => setSelectedPilots(availablePilots);
  const handleClearPilots = () => setSelectedPilots([]);

  const handleYearChange = (value: string) => {
    setSelectedYear(value ? parseInt(value, 10) : '');
    setSelectedMonth('');
  };

  const handleClearAll = () => {
    setUploadedBy('');
    setSelectedPilots([]);
    setSelectedYear('');
    setSelectedMonth('');
  };

  const handleSearch = () => {
    onSearch({
      uploadedBy: uploadedBy || undefined,
      pilots: selectedPilots.length > 0 ? selectedPilots : undefined,
      year: selectedYear ? (selectedYear as number) : undefined,
      month: selectedMonth ? (selectedMonth as number) : undefined,
    });
  };

  return (
    <div className="w-full bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-white">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-sm text-[#6b9fd4] hover:text-white transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Uploaded By */}
        <div>
          <label className="block text-xs font-medium text-[#a0b3cc] mb-2">Uploaded by</label>
          <select
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
            className={selectCls}
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Any</option>
            {usernames.sort((a, b) => a.localeCompare(b)).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Year / Month */}
        <div>
          <label className="block text-xs font-medium text-[#a0b3cc] mb-2">Year / Month</label>
          <div className="flex gap-2">
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className={selectCls}
              style={{ colorScheme: 'dark' }}
            >
              <option value="">Any year</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value, 10) : '')}
              disabled={!selectedYear}
              className={selectCls}
              style={{ colorScheme: 'dark' }}
            >
              <option value="">Any month</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>{MONTH_NAMES[month - 1]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pilots */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-[#a0b3cc]">Pilots</label>
            {availablePilots.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button onClick={handleSelectAllPilots} className="text-[#6b9fd4] hover:text-white transition-colors">All</button>
                <span className="text-[#2a3a54]">|</span>
                <button onClick={handleClearPilots} className="text-[#6b9fd4] hover:text-white transition-colors">None</button>
              </div>
            )}
          </div>

          {isLoadingPilots ? (
            <div className="text-sm text-[#4a5a74]">Loading pilots...</div>
          ) : availablePilots.length === 0 ? (
            <div className="text-sm text-[#4a5a74] italic">No pilots found</div>
          ) : (
            <div className="max-h-40 overflow-y-auto border border-[#2a3a54] rounded-lg p-2 space-y-1 bg-[#0d1421]">
              {availablePilots.map((pilot) => (
                <label key={pilot} className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:bg-[#1e2a3a]">
                  <input
                    type="checkbox"
                    checked={selectedPilots.includes(pilot)}
                    onChange={() => handlePilotToggle(pilot)}
                    className="rounded accent-blue-500"
                  />
                  <span className="text-sm text-[#a0b3cc]">{pilot}</span>
                </label>
              ))}
            </div>
          )}
          {selectedPilots.length > 0 && (
            <p className="text-xs text-[#4a5a74] mt-1">
              {selectedPilots.length} pilot{selectedPilots.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSearch}
          disabled={!hasActiveFilters}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Search
        </button>
      </div>
    </div>
  );
}
