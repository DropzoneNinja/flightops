import { useState } from 'react';
import { EquipmentParamotor } from '../../services/equipment.service';

interface Props {
  paramotor: EquipmentParamotor;
  onEdit: (paramotor: EquipmentParamotor) => void;
  onDelete: (id: string) => void;
}

export default function EquipmentParamotorCard({ paramotor, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-[#1e2a3a] border border-[#2a3a54] rounded-xl p-4 flex items-start gap-4">
      <img src="/equipment-trike.png" alt="" className="flex-shrink-0 w-10 h-10 rounded-lg object-cover" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <p className="text-white font-semibold truncate">{paramotor.name}</p>
          <span className="flex-shrink-0 text-sm font-mono font-semibold text-blue-400">
            {(paramotor.base_hours + paramotor.total_hours).toFixed(1)} hrs
          </span>
        </div>
        {paramotor.engine ? (
          <p className="text-xs text-[#a0b3cc] truncate">
            Engine: {paramotor.engine.name}
            {paramotor.tank_size_litres != null && (
              <span className="text-[#6b7fa3]"> · {paramotor.tank_size_litres} L tank</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-[#6b7fa3]">
            No engine assigned
            {paramotor.tank_size_litres != null && (
              <span> · {paramotor.tank_size_litres} L tank</span>
            )}
          </p>
        )}
        {paramotor.reserve && (
          <p className="text-xs text-[#a0b3cc] truncate">Reserve: {paramotor.reserve.name}</p>
        )}
        {paramotor.wing_links.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {paramotor.wing_links.map(link => (
              <span key={link.id} className="text-xs text-[#6b7fa3]">
                {link.wing.name}
                {link.fuel_burn_lph != null && (
                  <span className="text-[#a0b3cc]"> · {link.fuel_burn_lph} L/hr</span>
                )}
              </span>
            ))}
          </div>
        )}
        {paramotor.notes && (
          <p className="mt-1 text-xs text-[#6b7fa3] line-clamp-2">{paramotor.notes}</p>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        {confirmDelete ? (
          <>
            <button
              onClick={() => onDelete(paramotor.id)}
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
              onClick={() => onEdit(paramotor)}
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
