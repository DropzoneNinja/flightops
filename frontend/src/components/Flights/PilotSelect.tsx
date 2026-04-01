import { useState, useRef, useEffect } from 'react';
import { usePilots, usePilotCreate } from '../../hooks/useFlights';
import type { Pilot } from '../../services/flights.service';

interface PilotSelectProps {
  value: string | null;
  onChange: (pilotId: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function PilotSelect({
  value,
  onChange,
  label = 'Pilot',
  placeholder = 'Search or create pilot…',
  disabled = false,
}: PilotSelectProps) {
  const { data: pilots = [], isLoading } = usePilots();
  const createPilot = usePilotCreate();

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display name from selected pilot id
  const selectedPilot = pilots.find((p) => p.id === value) ?? null;

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search.trim()
    ? pilots.filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase()))
    : pilots;

  const canCreate =
    search.trim().length > 0 &&
    !pilots.some((p) => p.display_name.toLowerCase() === search.trim().toLowerCase());

  async function handleCreate() {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const created = await createPilot.mutateAsync(search.trim());
      onChange(created.id);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  function handleSelect(pilot: Pilot) {
    onChange(pilot.id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-medium text-sky-night mb-1">{label}</label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-sky-midday/40 bg-white text-left text-sm shadow-sm transition-colors hover:border-sky-midday focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selectedPilot ? 'text-sky-night' : 'text-gray-400'}>
          {isLoading ? 'Loading…' : selectedPilot ? selectedPilot.display_name : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedPilot && (
            <span
              role="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
              aria-label="Clear pilot"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-sky-midday/30 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pilots…"
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) handleCreate();
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && !canCreate && (
              <li className="px-3 py-2 text-sm text-gray-400">No pilots found</li>
            )}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(p)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-sky-50 ${
                    p.id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-sky-night'
                  }`}
                >
                  {p.display_name}
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {creating ? 'Creating…' : `Create "${search.trim()}"`}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
