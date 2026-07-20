import { useState, useEffect, FormEvent } from 'react';
import { EquipmentEngine, CreateEngineData } from '../../services/equipment.service';

interface Props {
  initial?: EquipmentEngine;
  onSave: (data: CreateEngineData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function EquipmentEngineForm({ initial, onSave, onCancel, isSaving }: Props) {
  const [name, setName] = useState('');
  const [baseHours, setBaseHours] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setName(initial?.name ?? '');
    setBaseHours(initial?.base_hours != null ? String(initial.base_hours) : '0');
    setTotalHours(initial?.total_hours != null ? String(initial.total_hours) : '0');
    setNotes(initial?.notes ?? '');
  }, [initial]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      name: name.trim(),
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
          placeholder="e.g. Vittorazi Moster 185"
          className="w-full bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5a74] focus:outline-none focus:border-blue-500"
        />
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
          {isSaving ? 'Saving…' : initial ? 'Save changes' : 'Add engine'}
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
