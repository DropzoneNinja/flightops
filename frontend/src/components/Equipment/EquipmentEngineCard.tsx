import { useState } from 'react';
import { EquipmentEngine } from '../../services/equipment.service';

interface Props {
  engine: EquipmentEngine;
  onEdit: (engine: EquipmentEngine) => void;
  onDelete: (id: string) => void;
}

export default function EquipmentEngineCard({ engine, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-[#1e2a3a] border border-[#2a3a54] rounded-xl p-4 flex items-start gap-4">
      <img src="/equipment-engine.png" alt="" className="flex-shrink-0 w-10 h-10 rounded-lg object-cover" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <p className="text-white font-semibold truncate">{engine.name}</p>
          <span className="flex-shrink-0 text-sm font-mono font-semibold text-blue-400">
            {(engine.base_hours + engine.total_hours).toFixed(1)} hrs
          </span>
        </div>
        {engine.notes && (
          <p className="mt-1 text-xs text-[#6b7fa3] line-clamp-2">{engine.notes}</p>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        {confirmDelete ? (
          <>
            <button
              onClick={() => onDelete(engine.id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#243048] text-[#a0b3cc] hover:text-white transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEdit(engine)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#243048] text-[#a0b3cc] hover:text-white transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#243048] text-red-400 hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
