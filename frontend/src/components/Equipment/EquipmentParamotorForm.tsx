import { useState, useEffect, FormEvent } from 'react';
import {
  EquipmentParamotor,
  EquipmentEngine,
  EquipmentWing,
  EquipmentReserve,
  CreateParamotorData,
} from '../../services/equipment.service';

interface WingLinkRow {
  wing_id: string;
  fuel_burn_lph: string;
}

interface Props {
  initial?: EquipmentParamotor;
  engines: EquipmentEngine[];
  wings: EquipmentWing[];
  reserves: EquipmentReserve[];
  onSave: (data: CreateParamotorData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function EquipmentParamotorForm({ initial, engines, wings, reserves, onSave, onCancel, isSaving }: Props) {
  const [name, setName] = useState('');
  const [engineId, setEngineId] = useState('');
  const [reserveId, setReserveId] = useState('');
  const [tankSize, setTankSize] = useState('');
  const [wingLinks, setWingLinks] = useState<WingLinkRow[]>([]);
  const [baseHours, setBaseHours] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setName(initial?.name ?? '');
    setEngineId(initial?.engine_id ?? '');
    setReserveId(initial?.reserve_id ?? '');
    setTankSize(initial?.tank_size_litres != null ? String(initial.tank_size_litres) : '');
    setWingLinks(
      (initial?.wing_links ?? []).map(link => ({
        wing_id: link.wing_id,
        fuel_burn_lph: link.fuel_burn_lph != null ? String(link.fuel_burn_lph) : '',
      })),
    );
    setBaseHours(initial?.base_hours != null ? String(initial.base_hours) : '0');
    setTotalHours(initial?.total_hours != null ? String(initial.total_hours) : '0');
    setNotes(initial?.notes ?? '');
  }, [initial]);

  const usedWingIds = new Set(wingLinks.map(l => l.wing_id).filter(Boolean));
  const canAddWing = wings.some(w => !usedWingIds.has(w.id));

  function updateWingLink(index: number, patch: Partial<WingLinkRow>) {
    setWingLinks(links => links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      name: name.trim(),
      engine_id: engineId || undefined,
      reserve_id: reserveId || undefined,
      tank_size_litres: tankSize !== '' ? Number(tankSize) : undefined,
      // Always send the full set — the API replaces the links with it
      wings: wingLinks
        .filter(l => l.wing_id)
        .map(l => ({
          wing_id: l.wing_id,
          fuel_burn_lph: l.fuel_burn_lph !== '' ? Number(l.fuel_burn_lph) : null,
        })),
      base_hours: baseHours !== '' ? Number(baseHours) : 0,
      total_hours: totalHours !== '' ? Number(totalHours) : 0,
      notes: notes.trim() || undefined,
    });
  }

  // Width lives on the consumer, not this base — combining it with a fixed
  // w-20 elsewhere would silently lose to w-full (Tailwind emits .w-full
  // after .w-20 in its generated CSS, so same-specificity cascade order wins
  // over class-string order).
  const fieldClass =
    'bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5a74] focus:outline-none focus:border-blue-500';
  const inputClass = `w-full ${fieldClass}`;
  const selectClass = `w-full ${fieldClass} appearance-none`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-[#6b7fa3] mb-1">Name *</label>
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. My Paramotor"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs text-[#6b7fa3] mb-1">Engine</label>
        <select value={engineId} onChange={e => setEngineId(e.target.value)} className={selectClass}>
          <option value="">— No engine —</option>
          {engines.map(eng => (
            <option key={eng.id} value={eng.id}>{eng.name}</option>
          ))}
        </select>
        {engines.length === 0 && (
          <p className="mt-1 text-xs text-[#6b7fa3]">Add an engine first to link it here.</p>
        )}
      </div>

      <div>
        <label className="block text-xs text-[#6b7fa3] mb-1">Tank size (L)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          value={tankSize}
          onChange={e => setTankSize(e.target.value)}
          placeholder="e.g. 10"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs text-[#6b7fa3] mb-1">Reserve</label>
        <select value={reserveId} onChange={e => setReserveId(e.target.value)} className={selectClass}>
          <option value="">— No reserve —</option>
          {reserves.map(res => (
            <option key={res.id} value={res.id}>{res.name}</option>
          ))}
        </select>
        {reserves.length === 0 && (
          <p className="mt-1 text-xs text-[#6b7fa3]">Add a reserve first to link it here.</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-[#6b7fa3]">Wings & burn rates</label>
          <button
            type="button"
            disabled={!canAddWing}
            onClick={() => setWingLinks(links => [...links, { wing_id: '', fuel_burn_lph: '' }])}
            className="text-xs px-2 py-0.5 rounded bg-[#243048] text-[#a0b3cc] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + Add wing
          </button>
        </div>
        {wingLinks.length === 0 ? (
          <p className="text-xs text-[#6b7fa3]">
            {wings.length === 0 ? 'Add a wing first to link it here.' : 'No wings linked yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {wingLinks.map((link, index) => (
              <div key={index} className="flex items-center gap-2">
                {/* Wrap the select: WebKit ignores flex-grow on <select> itself
                    and shrinks it to its content, so the flex sizing goes on
                    this div instead and the select just fills it. */}
                <div className="flex-1 min-w-0">
                  <select
                    value={link.wing_id}
                    onChange={e => updateWingLink(index, { wing_id: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">— Select wing —</option>
                    {wings
                      .filter(w => w.id === link.wing_id || !usedWingIds.has(w.id))
                      .map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                  </select>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={link.fuel_burn_lph}
                  onChange={e => updateWingLink(index, { fuel_burn_lph: e.target.value })}
                  placeholder="L/hr"
                  className={`w-20 flex-shrink-0 ${fieldClass}`}
                />
                <button
                  type="button"
                  onClick={() => setWingLinks(links => links.filter((_, i) => i !== index))}
                  className="flex-shrink-0 text-[#6b7fa3] hover:text-red-400 transition-colors"
                  aria-label="Remove wing link"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <p className="text-[11px] text-[#4a5a74]">Burn rate is per wing/motor combination (L/hr).</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#6b7fa3] mb-1">Base hours (hrs)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={baseHours}
            onChange={e => setBaseHours(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-[#6b7fa3] mb-1">Logged hours (hrs)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={totalHours}
            onChange={e => setTotalHours(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#6b7fa3] mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional notes..."
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving…' : initial ? 'Save changes' : 'Add paramotor'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-[#243048] text-[#a0b3cc] text-sm font-medium hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
