import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import {
  useEngines, useCreateEngine, useUpdateEngine, useDeleteEngine,
  useWings, useCreateWing, useUpdateWing, useDeleteWing,
  useReserves, useCreateReserve, useUpdateReserve, useDeleteReserve,
  useParamotors, useCreateParamotor, useUpdateParamotor, useDeleteParamotor,
} from '../hooks/useEquipment';
import {
  EquipmentEngine, EquipmentWing, EquipmentReserve, EquipmentParamotor,
  CreateEngineData, CreateWingData, CreateReserveData, CreateParamotorData,
} from '../services/equipment.service';
import EquipmentEngineCard from '../components/Equipment/EquipmentEngineCard';
import EquipmentWingCard from '../components/Equipment/EquipmentWingCard';
import EquipmentReserveCard from '../components/Equipment/EquipmentReserveCard';
import EquipmentParamotorCard from '../components/Equipment/EquipmentParamotorCard';
import EquipmentEngineForm from '../components/Equipment/EquipmentEngineForm';
import EquipmentWingForm from '../components/Equipment/EquipmentWingForm';
import EquipmentReserveForm from '../components/Equipment/EquipmentReserveForm';
import EquipmentParamotorForm from '../components/Equipment/EquipmentParamotorForm';
import MaintenanceRecordsSection from '../components/Equipment/MaintenanceRecordsSection';

type Tab = 'paramotors' | 'engines' | 'wings' | 'reserves';

type Panel =
  | { type: 'add-engine' }
  | { type: 'edit-engine'; item: EquipmentEngine }
  | { type: 'add-wing' }
  | { type: 'edit-wing'; item: EquipmentWing }
  | { type: 'add-reserve' }
  | { type: 'edit-reserve'; item: EquipmentReserve }
  | { type: 'add-paramotor' }
  | { type: 'edit-paramotor'; item: EquipmentParamotor }
  | null;

export default function EquipmentPage() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [showAirspace] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('paramotors');
  const [panel, setPanel] = useState<Panel>(null);

  // Queries
  const { data: engines = [], isLoading: enginesLoading } = useEngines();
  const { data: wings = [], isLoading: wingsLoading } = useWings();
  const { data: reserves = [], isLoading: reservesLoading } = useReserves();
  const { data: paramotors = [], isLoading: paramotorsLoading } = useParamotors();

  // Engine mutations
  const createEngine = useCreateEngine();
  const updateEngine = useUpdateEngine();
  const deleteEngine = useDeleteEngine();

  // Wing mutations
  const createWing = useCreateWing();
  const updateWing = useUpdateWing();
  const deleteWing = useDeleteWing();

  // Reserve mutations
  const createReserve = useCreateReserve();
  const updateReserve = useUpdateReserve();
  const deleteReserve = useDeleteReserve();

  // Paramotor mutations
  const createParamotor = useCreateParamotor();
  const updateParamotor = useUpdateParamotor();
  const deleteParamotor = useDeleteParamotor();

  const closePanel = () => setPanel(null);

  async function handleSaveEngine(data: CreateEngineData) {
    if (panel?.type === 'edit-engine') {
      await updateEngine.mutateAsync({ id: panel.item.id, data });
    } else {
      await createEngine.mutateAsync(data);
    }
    closePanel();
  }

  async function handleSaveWing(data: CreateWingData) {
    if (panel?.type === 'edit-wing') {
      await updateWing.mutateAsync({ id: panel.item.id, data });
    } else {
      await createWing.mutateAsync(data);
    }
    closePanel();
  }

  async function handleSaveReserve(data: CreateReserveData) {
    if (panel?.type === 'edit-reserve') {
      await updateReserve.mutateAsync({ id: panel.item.id, data });
    } else {
      await createReserve.mutateAsync(data);
    }
    closePanel();
  }

  async function handleSaveParamotor(data: CreateParamotorData) {
    if (panel?.type === 'edit-paramotor') {
      await updateParamotor.mutateAsync({ id: panel.item.id, data });
    } else {
      await createParamotor.mutateAsync(data);
    }
    closePanel();
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'paramotors', label: 'Paramotors', count: paramotors.length },
    { id: 'engines', label: 'Engines', count: engines.length },
    { id: 'wings', label: 'Wings', count: wings.length },
    { id: 'reserves', label: 'Reserves', count: reserves.length },
  ];

  const isLoading = enginesLoading || wingsLoading || reservesLoading || paramotorsLoading;

  const panelTitle =
    panel?.type === 'add-engine' ? 'Add Engine' :
    panel?.type === 'edit-engine' ? 'Edit Engine' :
    panel?.type === 'add-wing' ? 'Add Wing' :
    panel?.type === 'edit-wing' ? 'Edit Wing' :
    panel?.type === 'add-reserve' ? 'Add Reserve' :
    panel?.type === 'edit-reserve' ? 'Edit Reserve' :
    panel?.type === 'add-paramotor' ? 'Add Paramotor' :
    panel?.type === 'edit-paramotor' ? 'Edit Paramotor' : '';

  const isSavingAny =
    createEngine.isPending || updateEngine.isPending ||
    createWing.isPending || updateWing.isPending ||
    createReserve.isPending || updateReserve.isPending ||
    createParamotor.isPending || updateParamotor.isPending;

  const addLabel =
    activeTab === 'engines' ? 'Engine' :
    activeTab === 'wings' ? 'Wing' :
    activeTab === 'reserves' ? 'Reserve' : 'Paramotor';

  return (
    <div className="flex h-screen bg-[#0d1421] overflow-hidden">
      {!isMobile && (
        <LeftSidebar
          user={user}
          showAirspace={showAirspace}
          onToggleAirspace={() => {}}
          onLogout={logout}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-[#1e2a3a] flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Equipment</h1>
                <p className="text-xs text-[#6b7fa3] mt-0.5">Manage your paramotors, engines, wings, and reserves</p>
              </div>
              <button
                onClick={() => {
                  if (activeTab === 'engines') setPanel({ type: 'add-engine' });
                  else if (activeTab === 'wings') setPanel({ type: 'add-wing' });
                  else if (activeTab === 'reserves') setPanel({ type: 'add-reserve' });
                  else setPanel({ type: 'add-paramotor' });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add {addLabel}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-[#6b7fa3] hover:text-white hover:bg-[#1e2a3a]'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-[#1e2a3a] text-[#6b7fa3]'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeTab === 'engines' ? (
              engines.length === 0 ? (
                <EmptyState label="No engines yet" sub="Add your first engine to get started." />
              ) : (
                <div className="flex flex-col gap-3 max-w-2xl">
                  {engines.map(engine => (
                    <EquipmentEngineCard
                      key={engine.id}
                      engine={engine}
                      onEdit={item => setPanel({ type: 'edit-engine', item })}
                      onDelete={id => deleteEngine.mutate(id)}
                    />
                  ))}
                </div>
              )
            ) : activeTab === 'wings' ? (
              wings.length === 0 ? (
                <EmptyState label="No wings yet" sub="Add your first wing to get started." />
              ) : (
                <div className="flex flex-col gap-3 max-w-2xl">
                  {wings.map(wing => (
                    <EquipmentWingCard
                      key={wing.id}
                      wing={wing}
                      onEdit={item => setPanel({ type: 'edit-wing', item })}
                      onDelete={id => deleteWing.mutate(id)}
                    />
                  ))}
                </div>
              )
            ) : activeTab === 'reserves' ? (
              reserves.length === 0 ? (
                <EmptyState label="No reserves yet" sub="Add your first reserve to get started." />
              ) : (
                <div className="flex flex-col gap-3 max-w-2xl">
                  {reserves.map(reserve => (
                    <EquipmentReserveCard
                      key={reserve.id}
                      reserve={reserve}
                      onEdit={item => setPanel({ type: 'edit-reserve', item })}
                      onDelete={id => deleteReserve.mutate(id)}
                    />
                  ))}
                </div>
              )
            ) : (
              paramotors.length === 0 ? (
                <EmptyState label="No paramotors yet" sub="Add your first paramotor to get started." />
              ) : (
                <div className="flex flex-col gap-3 max-w-2xl">
                  {paramotors.map(paramotor => (
                    <EquipmentParamotorCard
                      key={paramotor.id}
                      paramotor={paramotor}
                      onEdit={item => setPanel({ type: 'edit-paramotor', item })}
                      onDelete={id => deleteParamotor.mutate(id)}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Side panel */}
        {panel && (
          <div className="w-96 border-l border-[#1e2a3a] bg-[#111827] flex flex-col overflow-hidden flex-shrink-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a]">
              <h2 className="text-sm font-semibold text-white">{panelTitle}</h2>
              <button
                onClick={closePanel}
                className="text-[#6b7fa3] hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {(panel.type === 'add-engine' || panel.type === 'edit-engine') && (
                <>
                  <EquipmentEngineForm
                    initial={panel.type === 'edit-engine' ? panel.item : undefined}
                    onSave={handleSaveEngine}
                    onCancel={closePanel}
                    isSaving={isSavingAny}
                  />
                  {panel.type === 'edit-engine' && (
                    <MaintenanceRecordsSection kind="engine-services" parentId={panel.item.id} />
                  )}
                </>
              )}
              {(panel.type === 'add-wing' || panel.type === 'edit-wing') && (
                <>
                  <EquipmentWingForm
                    initial={panel.type === 'edit-wing' ? panel.item : undefined}
                    onSave={handleSaveWing}
                    onCancel={closePanel}
                    isSaving={isSavingAny}
                  />
                  {panel.type === 'edit-wing' && (
                    <MaintenanceRecordsSection kind="wing-inspections" parentId={panel.item.id} />
                  )}
                </>
              )}
              {(panel.type === 'add-reserve' || panel.type === 'edit-reserve') && (
                <>
                  <EquipmentReserveForm
                    initial={panel.type === 'edit-reserve' ? panel.item : undefined}
                    onSave={handleSaveReserve}
                    onCancel={closePanel}
                    isSaving={isSavingAny}
                  />
                  {panel.type === 'edit-reserve' && (
                    <>
                      <MaintenanceRecordsSection kind="reserve-packs" parentId={panel.item.id} />
                      <MaintenanceRecordsSection kind="reserve-inspections" parentId={panel.item.id} />
                    </>
                  )}
                </>
              )}
              {(panel.type === 'add-paramotor' || panel.type === 'edit-paramotor') && (
                <EquipmentParamotorForm
                  initial={panel.type === 'edit-paramotor' ? panel.item : undefined}
                  engines={engines}
                  wings={wings}
                  reserves={reserves}
                  onSave={handleSaveParamotor}
                  onCancel={closePanel}
                  isSaving={isSavingAny}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-[#1e2a3a] flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-[#4a5a74]">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <p className="text-white font-medium">{label}</p>
      <p className="text-sm text-[#6b7fa3] mt-1">{sub}</p>
    </div>
  );
}
