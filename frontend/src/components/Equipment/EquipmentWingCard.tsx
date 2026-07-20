import { useState } from 'react';
import { EquipmentWing } from '../../services/equipment.service';

interface Props {
  wing: EquipmentWing;
  onEdit: (wing: EquipmentWing) => void;
  onDelete: (id: string) => void;
}

export default function EquipmentWingCard({ wing, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const subtitle = [wing.manufacturer, wing.model].filter(Boolean).join(' ');

  return (
    <div className="bg-[#1e2a3a] border border-[#2a3a54] rounded-xl p-4 flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#141d2e] flex items-center justify-center text-[#a0b3cc]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M12 2L2 12h20L12 2z" />
          <path d="M12 12v10" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <p className="text-white font-semibold truncate">{wing.name}</p>
          <span className="flex-shrink-0 text-sm font-mono font-semibold text-blue-400">
            {(wing.base_hours + wing.total_hours).toFixed(1)} hrs
          </span>
        </div>
        {subtitle && (
          <p className="text-xs text-[#a0b3cc] truncate">{subtitle}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {wing.size && (
            <span className="text-xs text-[#6b7fa3]">
              Size: <span className="text-[#a0b3cc]">{wing.size}</span>
            </span>
          )}
          {wing.trim_speed_kmh != null && (
            <span className="text-xs text-[#6b7fa3]">
              Trim: <span className="text-[#a0b3cc]">{wing.trim_speed_kmh} km/h</span>
            </span>
          )}
          {wing.color && (
            <span className="text-xs text-[#6b7fa3]">
              Colour: <span className="text-[#a0b3cc]">{wing.color}</span>
            </span>
          )}
        </div>
        {wing.notes && (
          <p className="mt-1 text-xs text-[#6b7fa3] line-clamp-2">{wing.notes}</p>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        {confirmDelete ? (
          <>
            <button
              onClick={() => onDelete(wing.id)}
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
              onClick={() => onEdit(wing)}
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
