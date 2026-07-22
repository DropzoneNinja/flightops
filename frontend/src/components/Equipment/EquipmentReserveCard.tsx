import { useState } from 'react';
import { EquipmentReserve } from '../../services/equipment.service';

interface Props {
  reserve: EquipmentReserve;
  onEdit: (reserve: EquipmentReserve) => void;
  onDelete: (id: string) => void;
}

export default function EquipmentReserveCard({ reserve, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const subtitle = [reserve.manufacturer, reserve.model].filter(Boolean).join(' ');

  return (
    <div className="bg-[#1e2a3a] border border-[#2a3a54] rounded-xl p-4 flex items-start gap-4">
      <img src="/equipment-reserve.png" alt="" className="flex-shrink-0 w-10 h-10 rounded-lg object-cover" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <p className="text-white font-semibold truncate">{reserve.name}</p>
          <span className="flex-shrink-0 text-sm font-mono font-semibold text-blue-400">
            {(reserve.base_hours + reserve.total_hours).toFixed(1)} hrs
          </span>
        </div>
        {subtitle && (
          <p className="text-xs text-[#a0b3cc] truncate">{subtitle}</p>
        )}
        {reserve.size && (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-xs text-[#6b7fa3]">
              Size: <span className="text-[#a0b3cc]">{reserve.size}</span>
            </span>
          </div>
        )}
        {reserve.notes && (
          <p className="mt-1 text-xs text-[#6b7fa3] line-clamp-2">{reserve.notes}</p>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        {confirmDelete ? (
          <>
            <button
              onClick={() => onDelete(reserve.id)}
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
              onClick={() => onEdit(reserve)}
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
