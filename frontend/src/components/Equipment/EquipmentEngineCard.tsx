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
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#141d2e] flex items-center justify-center text-[#a0b3cc]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <p className="text-white font-semibold truncate">{engine.name}</p>
          <span className="flex-shrink-0 text-sm font-mono font-semibold text-blue-400">
            {engine.total_hours.toFixed(1)} hrs
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {engine.tank_size_litres != null && (
            <span className="text-xs text-[#6b7fa3]">
              Tank: <span className="text-[#a0b3cc]">{engine.tank_size_litres} L</span>
            </span>
          )}
          {engine.fuel_consumption_lph != null && (
            <span className="text-xs text-[#6b7fa3]">
              Burn: <span className="text-[#a0b3cc]">{engine.fuel_consumption_lph} L/hr</span>
            </span>
          )}
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
