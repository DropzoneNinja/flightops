import { useState, useEffect, FormEvent } from 'react';
import { EquipmentParamotor, EquipmentEngine, CreateParamotorData } from '../../services/equipment.service';

interface Props {
  initial?: EquipmentParamotor;
  engines: EquipmentEngine[];
  onSave: (data: CreateParamotorData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function EquipmentParamotorForm({ initial, engines, onSave, onCancel, isSaving }: Props) {
  const [name, setName] = useState('');
  const [engineId, setEngineId] = useState('');
  const [baseHours, setBaseHours] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setName(initial?.name ?? '');
    setEngineId(initial?.engine_id ?? '');
    setBaseHours(initial?.base_hours != null ? String(initial.base_hours) : '0');
    setTotalHours(initial?.total_hours != null ? String(initial.total_hours) : '0');
    setNotes(initial?.notes ?? '');
  }, [initial]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      name: name.trim(),
      engine_id: engineId || undefined,
      base_hours: baseHours !== '' ? Number(baseHours) : 0,
      total_hours: totalHours !== '' ? Number(totalHours) : 0,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-[#6b7fa3] mb-1">Name *</label>
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. My Paramotor"
          className="w-full bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5a74] focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-[#6b7fa3] mb-1">Engine</label>
        <select
          value={engineId}
          onChange={e => setEngineId(e.target.value)}
          className="w-full bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none"
        >
          <option value="">— No engine —</option>
          {engines.map(eng => (
            <option key={eng.id} value={eng.id}>
              {eng.name}
              {eng.tank_size_litres != null ? ` (${eng.tank_size_litres} L)` : ''}
            </option>
          ))}
        </select>
        {engines.length === 0 && (
          <p className="mt-1 text-xs text-[#6b7fa3]">Add an engine first to link it here.</p>
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
            className="w-full bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5a74] focus:outline-none focus:border-blue-500"
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
            className="w-full bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5a74] focus:outline-none focus:border-blue-500"
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
          className="w-full bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5a74] focus:outline-none focus:border-blue-500 resize-none"
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
