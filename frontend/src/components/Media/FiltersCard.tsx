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
  allDateCounts: MediaDateCount[]; // unfiltered, for year/month dropdown population
}

export default function FiltersCard({ onSearch, allDateCounts }: FiltersCardProps) {
  const { data: availablePilots = [], isLoading: isLoadingPilots } = useMediaPilots();
  const [usernames, setUsernames] = useState<string[]>([]);

  const [uploadedBy, setUploadedBy] = useState('');
  const [selectedPilots, setSelectedPilots] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');

  // Fetch usernames once on mount
  useEffect(() => {
    usersService.getUsernames().then(setUsernames).catch(() => {});
  }, []);

  // Derive available years from unfiltered date counts
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allDateCounts.forEach((d) => {
      const year = parseInt(d.date.slice(0, 4), 10);
      if (!isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [allDateCounts]);

  // Derive available months for selected year
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

  const hasActiveFilters =
    !!uploadedBy ||
    selectedPilots.length > 0 ||
    !!selectedYear;

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
    <div className="w-full bg-white rounded-xl shadow-elevation-lg p-6 sm:p-8 animate-fade-in">
      {/* Card header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-display font-semibold text-sky-night">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-sm text-sky-morning hover:text-sky-dusk font-medium transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Uploaded By */}
        <div>
          <label className="block text-sm font-medium text-sky-dusk mb-2">Uploaded by</label>
          <select
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-morning focus:border-sky-morning bg-white"
          >
            <option value="">Any</option>
            {usernames.sort((a, b) => a.localeCompare(b)).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Year / Month */}
        <div>
          <label className="block text-sm font-medium text-sky-dusk mb-2">Year / Month</label>
          <div className="flex gap-2">
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-morning focus:border-sky-morning bg-white"
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-morning focus:border-sky-morning bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
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
            <label className="block text-sm font-medium text-sky-dusk">Pilots</label>
            {availablePilots.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button onClick={handleSelectAllPilots} className="text-sky-morning hover:text-sky-dusk transition-colors">All</button>
                <span className="text-gray-300">|</span>
                <button onClick={handleClearPilots} className="text-sky-morning hover:text-sky-dusk transition-colors">None</button>
              </div>
            )}
          </div>

          {isLoadingPilots ? (
            <div className="text-sm text-gray-400">Loading pilots...</div>
          ) : availablePilots.length === 0 ? (
            <div className="text-sm text-gray-400 italic">No pilots found</div>
          ) : (
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
              {availablePilots.map((pilot) => (
                <label key={pilot} className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedPilots.includes(pilot)}
                    onChange={() => handlePilotToggle(pilot)}
                    className="rounded text-sky-morning focus:ring-sky-morning"
                  />
                  <span className="text-sm text-gray-700">{pilot}</span>
                </label>
              ))}
            </div>
          )}
          {selectedPilots.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {selectedPilots.length} pilot{selectedPilots.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </div>

      {/* Search button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSearch}
          disabled={!hasActiveFilters}
          className="px-6 py-2.5 bg-sky-morning text-white text-sm font-medium rounded-lg hover:bg-sky-dusk transition-colors shadow-elevation disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Search
        </button>
      </div>
    </div>
  );
}
