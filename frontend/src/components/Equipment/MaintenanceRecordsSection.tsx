import { useState, FormEvent } from 'react';
import {
  MaintenanceRecordKind,
  MaintenanceRecord,
  useMaintenanceRecords,
  useCreateMaintenanceRecord,
  useUpdateMaintenanceRecord,
  useDeleteMaintenanceRecord,
} from '../../hooks/useEquipment';

interface Config {
  title: string;
  dateField: string;
  dateLabel: string;
  /** Omit for record kinds without a type field (reserve packs). */
  typeField?: string;
  typeLabel?: string;
  typePlaceholder?: string;
}

const CONFIGS: Record<MaintenanceRecordKind, Config> = {
  'engine-services': {
    title: 'Service history',
    dateField: 'service_date',
    dateLabel: 'Service date',
    typeField: 'service_type',
    typeLabel: 'Service type',
    typePlaceholder: 'e.g. Top-end rebuild',
  },
  'wing-inspections': {
    title: 'Inspection history',
    dateField: 'inspection_date',
    dateLabel: 'Inspection date',
    typeField: 'inspection_type',
    typeLabel: 'Inspection type',
    typePlaceholder: 'e.g. Annual trim check',
  },
  'reserve-packs': {
    title: 'Pack history',
    dateField: 'pack_date',
    dateLabel: 'Pack date',
  },
  'reserve-inspections': {
    title: 'Inspection history',
    dateField: 'inspection_date',
    dateLabel: 'Inspection date',
    typeField: 'inspection_type',
    typeLabel: 'Inspection type',
    typePlaceholder: 'e.g. Repack inspection',
  },
};

interface Props {
  kind: MaintenanceRecordKind;
  parentId: string;
}

export default function MaintenanceRecordsSection({ kind, parentId }: Props) {
  const config = CONFIGS[kind];
  const { data: records = [], isLoading } = useMaintenanceRecords(kind, parentId);
  const createRecord = useCreateMaintenanceRecord(kind, parentId);
  const updateRecord = useUpdateMaintenanceRecord(kind, parentId);
  const deleteRecord = useDeleteMaintenanceRecord(kind, parentId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');

  const isSaving = createRecord.isPending || updateRecord.isPending;

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setDate('');
    setType('');
    setNotes('');
  }

  function startEdit(record: MaintenanceRecord) {
    setEditingId(record.id);
    setShowForm(true);
    setDate(String(record[config.dateField] ?? ''));
    setType(config.typeField ? String(record[config.typeField] ?? '') : '');
    setNotes(record.notes ?? '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: Record<string, string | undefined> = {
      [config.dateField]: date,
      notes: notes.trim() || undefined,
    };
    if (config.typeField) payload[config.typeField] = type.trim();
    if (editingId) {
      await updateRecord.mutateAsync({ recordId: editingId, data: payload });
    } else {
      await createRecord.mutateAsync(payload);
    }
    resetForm();
  }

  const inputClass =
    'w-full bg-[#141d2e] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5a74] focus:outline-none focus:border-blue-500';

  return (
    <div className="mt-6 pt-5 border-t border-[#1e2a3a]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wide">{config.title}</h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs px-2.5 py-1 rounded-lg bg-[#243048] text-[#a0b3cc] hover:text-white transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4 p-3 rounded-lg bg-[#141d2e] border border-[#2a3a54]">
          <div>
            <label className="block text-xs text-[#6b7fa3] mb-1">{config.dateLabel} *</label>
            <input
              required
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          {config.typeField && (
            <div>
              <label className="block text-xs text-[#6b7fa3] mb-1">{config.typeLabel} *</label>
              <input
                required
                value={type}
                onChange={e => setType(e.target.value)}
                placeholder={config.typePlaceholder}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-[#6b7fa3] mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving || !date || (!!config.typeField && !type.trim())}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving…' : editingId ? 'Save record' : 'Add record'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-1.5 rounded-lg bg-[#243048] text-[#a0b3cc] text-xs font-medium hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-xs text-[#6b7fa3]">Loading…</p>
      ) : records.length === 0 ? (
        !showForm && <p className="text-xs text-[#6b7fa3]">No records yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map(record => (
            <div
              key={record.id}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-[#141d2e] border border-[#2a3a54]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-mono text-blue-400 flex-shrink-0">
                    {String(record[config.dateField] ?? '')}
                  </span>
                  {config.typeField && (
                    <span className="text-xs text-white truncate">
                      {String(record[config.typeField] ?? '')}
                    </span>
                  )}
                </div>
                {record.notes && (
                  <p className="mt-0.5 text-xs text-[#6b7fa3] line-clamp-2">{record.notes}</p>
                )}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(record)}
                  className="text-[11px] px-2 py-1 rounded bg-[#243048] text-[#a0b3cc] hover:text-white transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteRecord.mutate(record.id)}
                  className="text-[11px] px-2 py-1 rounded bg-[#243048] text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
