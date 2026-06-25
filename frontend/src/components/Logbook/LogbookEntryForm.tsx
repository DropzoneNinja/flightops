import { useState } from 'react';
import { CreateLogbookEntryData } from '../../services/logbook.service';
import { useSites } from '../../hooks/useSites';

const CATEGORIES = [
  'Recreational',
  'Training',
  'Cross Country',
  'Competition',
  'Test Flight',
];

interface LogbookEntryFormProps {
  initialValues?: Partial<CreateLogbookEntryData>;
  onSubmit: (data: CreateLogbookEntryData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  /** When true, shows a note that a GPX track overrides the manual stats below. */
  hasGpx?: boolean;
}

const OTHER = '__other__';

function SitePicker({
  value,
  onChange,
  placeholder,
  sites,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  sites: { id: string; name: string }[];
}) {
  const isOther = value !== '' && !sites.some((s) => s.name === value);
  const [mode, setMode] = useState<'select' | 'text'>(isOther ? 'text' : 'select');
  const selectValue = mode === 'text' ? OTHER : (sites.find((s) => s.name === value)?.name ?? '');

  const handleSelect = (v: string) => {
    if (v === OTHER) {
      setMode('text');
      onChange('');
    } else {
      setMode('select');
      onChange(v);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <select
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">Select site…</option>
        {sites.map((s) => (
          <option key={s.id} value={s.name}>{s.name}</option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {mode === 'text' && (
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={255}
          autoFocus
        />
      )}
    </div>
  );
}

export default function LogbookEntryForm({
  initialValues = {},
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save',
  hasGpx = false,
}: LogbookEntryFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [flight_date, setFlightDate] = useState(initialValues.flight_date ?? today);
  const [start_time, setStartTime] = useState(() => {
    if (!initialValues.start_at) return '';
    const d = new Date(initialValues.start_at);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  const [title, setTitle] = useState(initialValues.title ?? '');
  const [launch_site_name, setLaunchSite] = useState(initialValues.launch_site_name ?? '');
  const [landing_site_name, setLandingSite] = useState(initialValues.landing_site_name ?? '');

  const handleLaunchSiteChange = (value: string) => {
    setLaunchSite(value);
    // Auto-fill landing only if it's still in sync with (or empty relative to) the launch site
    setLandingSite((prev) => (prev === '' || prev === launch_site_name ? value : prev));
  };

  const { sites: sitesData } = useSites();
  const sites = sitesData.filter((s) => s.enabled).sort((a, b) => a.name.localeCompare(b.name));
  const [category, setCategory] = useState(initialValues.category ?? '');
  const [wing, setWing] = useState(initialValues.wing ?? '');
  const [engine, setEngine] = useState(initialValues.engine ?? '');
  const [fuel_start_litres, setFuelStart] = useState(initialValues.fuel_start_litres?.toString() ?? '');
  const [fuel_used_litres, setFuelUsed] = useState(initialValues.fuel_used_litres?.toString() ?? '');
  const [rating, setRating] = useState(initialValues.rating?.toString() ?? '');
  const [notes, setNotes] = useState(initialValues.notes ?? '');

  // Flight stats (manual entry; overridden by GPX for display)
  const initDurH = initialValues.duration_seconds != null
    ? String(Math.floor(initialValues.duration_seconds / 3600)) : '';
  const initDurM = initialValues.duration_seconds != null
    ? String(Math.floor((initialValues.duration_seconds % 3600) / 60)) : '';
  const [durHours, setDurHours] = useState(initDurH);
  const [durMins, setDurMins] = useState(initDurM);
  const [max_altitude_ft, setMaxAltitude] = useState(
    initialValues.max_altitude_m != null ? String(Math.round(initialValues.max_altitude_m * 3.28084)) : ''
  );
  const [max_speed_kmh, setMaxSpeed] = useState(
    initialValues.max_speed_mps != null ? String(Math.round(initialValues.max_speed_mps * 3.6)) : ''
  );
  const [distance_km, setDistance] = useState(
    initialValues.distance_m != null ? String((initialValues.distance_m / 1000).toFixed(1)) : ''
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!flight_date) e.flight_date = 'Date is required';
    if (rating && (Number(rating) < 1 || Number(rating) > 5)) e.rating = 'Rating must be 1–5';
    const h = Number(durHours), m = Number(durMins);
    if (durHours && (isNaN(h) || h < 0)) e.duration = 'Invalid hours';
    if (durMins && (isNaN(m) || m < 0 || m > 59)) e.duration = 'Minutes must be 0–59';
    if (max_altitude_ft && (isNaN(Number(max_altitude_ft)) || Number(max_altitude_ft) < 0)) e.max_altitude_ft = 'Invalid altitude';
    if (max_speed_kmh && (isNaN(Number(max_speed_kmh)) || Number(max_speed_kmh) < 0)) e.max_speed_kmh = 'Invalid speed';
    if (distance_km && (isNaN(Number(distance_km)) || Number(distance_km) < 0)) e.distance_km = 'Invalid distance';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const h = durHours ? Number(durHours) : 0;
    const m = durMins ? Number(durMins) : 0;
    const durationSecs = (durHours || durMins) ? h * 3600 + m * 60 : undefined;

    const start_at = start_time
      ? new Date(`${flight_date}T${start_time}`).toISOString()
      : undefined;

    const data: CreateLogbookEntryData = {
      flight_date,
      start_at,
      title: title || undefined,
      launch_site_name: launch_site_name || undefined,
      landing_site_name: landing_site_name || undefined,
      category: category || undefined,
      wing: wing || undefined,
      engine: engine || undefined,
      fuel_start_litres: fuel_start_litres ? Number(fuel_start_litres) : undefined,
      fuel_used_litres: fuel_used_litres ? Number(fuel_used_litres) : undefined,
      rating: rating ? Number(rating) : undefined,
      notes: notes || undefined,
      duration_seconds: durationSecs,
      max_altitude_m: max_altitude_ft ? Number(max_altitude_ft) / 3.28084 : undefined,
      max_speed_mps: max_speed_kmh ? Number(max_speed_kmh) / 3.6 : undefined,
      distance_m: distance_km ? Number(distance_km) * 1000 : undefined,
    };
    await onSubmit(data);
  };

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
  const errorClass = 'text-red-600 text-xs mt-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date *</label>
          <input
            type="date"
            className={inputClass}
            value={flight_date}
            onChange={(e) => setFlightDate(e.target.value)}
            required
          />
          {errors.flight_date && <p className={errorClass}>{errors.flight_date}</p>}
        </div>
        <div>
          <label className={labelClass}>Start time</label>
          <input
            type="time"
            className={inputClass}
            value={start_time}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Title</label>
          <input
            type="text"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunset coastal flight"
            maxLength={255}
          />
        </div>
        <div>
          <label className={labelClass}>Launch site</label>
          <SitePicker
            value={launch_site_name}
            onChange={handleLaunchSiteChange}
            placeholder="Type launch site name"
            sites={sites}
          />
        </div>
        <div>
          <label className={labelClass}>Landing site</label>
          <SitePicker
            value={landing_site_name}
            onChange={setLandingSite}
            placeholder="Type landing site name"
            sites={sites}
          />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Rating (1–5)</label>
          <input
            type="number"
            className={inputClass}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            min={1}
            max={5}
            placeholder="Optional"
          />
          {errors.rating && <p className={errorClass}>{errors.rating}</p>}
        </div>
        <div>
          <label className={labelClass}>Wing / Glider</label>
          <input
            type="text"
            className={inputClass}
            value={wing}
            onChange={(e) => setWing(e.target.value)}
            placeholder="Wing or glider"
            maxLength={255}
          />
        </div>
        <div>
          <label className={labelClass}>Engine / Harness</label>
          <input
            type="text"
            className={inputClass}
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            placeholder="Engine or harness"
            maxLength={255}
          />
        </div>
        <div>
          <label className={labelClass}>Fuel start (L)</label>
          <input
            type="number"
            className={inputClass}
            value={fuel_start_litres}
            onChange={(e) => setFuelStart(e.target.value)}
            min={0}
            step={0.1}
            placeholder="Litres"
          />
        </div>
        <div>
          <label className={labelClass}>Fuel used (L)</label>
          <input
            type="number"
            className={inputClass}
            value={fuel_used_litres}
            onChange={(e) => setFuelUsed(e.target.value)}
            min={0}
            step={0.1}
            placeholder="Litres"
          />
        </div>
      </div>

      {/* Flight stats */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-700">Flight stats</span>
          <span className="text-xs text-gray-400">(optional)</span>
        </div>
        {hasGpx && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            A GPX track is attached — analyzed values take precedence over these manual entries for display.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Duration</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className={`${inputClass} w-full`}
                value={durHours}
                onChange={(e) => setDurHours(e.target.value)}
                min={0}
                placeholder="0"
              />
              <span className="text-sm text-gray-500 shrink-0">h</span>
              <input
                type="number"
                className={`${inputClass} w-full`}
                value={durMins}
                onChange={(e) => setDurMins(e.target.value)}
                min={0}
                max={59}
                placeholder="0"
              />
              <span className="text-sm text-gray-500 shrink-0">min</span>
            </div>
            {errors.duration && <p className={errorClass}>{errors.duration}</p>}
          </div>
          <div>
            <label className={labelClass}>Max altitude (ft)</label>
            <input
              type="number"
              className={inputClass}
              value={max_altitude_ft}
              onChange={(e) => setMaxAltitude(e.target.value)}
              min={0}
              placeholder="Feet"
            />
            {errors.max_altitude_ft && <p className={errorClass}>{errors.max_altitude_ft}</p>}
          </div>
          <div>
            <label className={labelClass}>Max speed (km/h)</label>
            <input
              type="number"
              className={inputClass}
              value={max_speed_kmh}
              onChange={(e) => setMaxSpeed(e.target.value)}
              min={0}
              placeholder="km/h"
            />
            {errors.max_speed_kmh && <p className={errorClass}>{errors.max_speed_kmh}</p>}
          </div>
          <div>
            <label className={labelClass}>Distance (km)</label>
            <input
              type="number"
              className={inputClass}
              value={distance_km}
              onChange={(e) => setDistance(e.target.value)}
              min={0}
              step={0.1}
              placeholder="km"
            />
            {errors.distance_km && <p className={errorClass}>{errors.distance_km}</p>}
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes about this flight…"
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
