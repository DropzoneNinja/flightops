import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMissionsStore } from '../stores/missionsStore';
import { useSites } from '../hooks/useSites';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import MissionMap from '../components/Mission/MissionMap';
import WaypointSidebar from '../components/Mission/WaypointSidebar';
import { Mission, MissionWaypoint, missionsService } from '../services/missions.service';

export default function MissionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sites } = useSites();
  const { settingsMap } = useSettings();
  const { user } = useAuth();

  const {
    selectedMission,
    fetchMission,
    updateMission,
    deleteMission,
    duplicateMission,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    reorderWaypoints,
  } = useMissionsStore();

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [launchSiteId, setLaunchSiteId] = useState<string>('');
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [flyToCenter, setFlyToCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showSegTime, setShowSegTime] = useState(false);
  const [showSegDist, setShowSegDist] = useState(true);
  const [showFuel, setShowFuel] = useState(false);
  const [avgSpeed, setAvgSpeed] = useState<number | null>(null);
  const [avgFuelConsumption, setAvgFuelConsumption] = useState<number | null>(null);
  const [fuelTankSize, setFuelTankSize] = useState<number | null>(null);
  const [windDirection, setWindDirection] = useState<number | null>(null);
  const [windSpeed, setWindSpeed] = useState<number | null>(null);
  const [siteMissions, setSiteMissions] = useState<Mission[]>([]);

  const distanceUnit = ((settingsMap as Record<string, unknown>)['units.distance'] as 'km' | 'mi') ?? 'km';
  const settingsSpeed = ((settingsMap as Record<string, unknown>)['plot.average_speed'] as number) ?? 30;
  const fuelReservePercent = ((settingsMap as Record<string, unknown>)['fuel.reserve_percentage'] as number) ?? 10;
  const averageSpeed = avgSpeed ?? settingsSpeed;

  useEffect(() => {
    if (!id) return;
    fetchMission(id)
      .then((m) => {
        setName(m.name);
        setNotes(m.notes ?? '');
        setLaunchSiteId(m.launch_site_id ?? '');
        setAvgSpeed(m.avg_speed);
        setAvgFuelConsumption(m.avg_fuel_consumption);
        setFuelTankSize(m.fuel_tank_size);
        setWindDirection(m.wind_direction);
        setWindSpeed(m.wind_speed);
        setDirty(false);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const siteId = selectedMission?.launch_site_id;
    if (!siteId) {
      setSiteMissions([]);
      return;
    }
    missionsService.getAll({ launchSiteId: siteId, sort: 'updated_at', order: 'DESC' })
      .then(setSiteMissions)
      .catch(() => setSiteMissions([]));
  }, [selectedMission?.launch_site_id]);

  const waypoints: MissionWaypoint[] = (selectedMission?.waypoints ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const launchSite = selectedMission?.launch_site;

  const handleSave = useCallback(async () => {
    if (!id || !name.trim()) {
      setSaveError('Mission name is required');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await updateMission(id, {
        name: name.trim(),
        notes: notes || undefined,
        launch_site_id: launchSiteId || null,
        avg_speed: avgSpeed,
        avg_fuel_consumption: avgFuelConsumption,
        fuel_tank_size: fuelTankSize,
        wind_direction: windDirection,
        wind_speed: windSpeed,
      });
      setDirty(false);
    } catch {
      setSaveError('Failed to save mission');
    } finally {
      setSaving(false);
    }
  }, [id, name, notes, launchSiteId, avgSpeed, avgFuelConsumption, fuelTankSize, windDirection, windSpeed, updateMission]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMission(id);
      navigate('/missions');
    } catch {
      setConfirmDelete(false);
      setSaveError('Failed to delete mission');
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    const copy = await duplicateMission(id);
    navigate(`/missions/${copy.id}`);
  };

  const canEdit =
    user?.is_admin ||
    !selectedMission?.created_by ||
    selectedMission?.created_by === user?.id;

  const handleMapClick = useCallback(async (lat: number, lon: number) => {
    if (!id || !canEdit) return;
    await addWaypoint(id, lat, lon);
  }, [id, canEdit, addWaypoint]);

  const handleWaypointDrag = useCallback(async (wpId: string, lat: number, lon: number) => {
    if (!id || !canEdit) return;
    await updateWaypoint(id, wpId, lat, lon);
  }, [id, canEdit, updateWaypoint]);

  const handleDeleteWaypoint = async (wpId: string) => {
    if (!id) return;
    await deleteWaypoint(id, wpId);
    if (selectedWaypointId === wpId) setSelectedWaypointId(null);
  };

  const handleMoveUp = async (wpId: string) => {
    if (!id) return;
    const idx = waypoints.findIndex((w) => w.id === wpId);
    if (idx <= 0) return;
    const ids = waypoints.map((w) => w.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await reorderWaypoints(id, ids);
  };

  const handleMoveDown = async (wpId: string) => {
    if (!id) return;
    const idx = waypoints.findIndex((w) => w.id === wpId);
    if (idx === -1 || idx >= waypoints.length - 1) return;
    const ids = waypoints.map((w) => w.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    await reorderWaypoints(id, ids);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sky-cloud">
        <p className="text-gray-500 text-sm">Loading mission...</p>
      </div>
    );
  }

  if (!selectedMission) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sky-cloud">
        <div className="text-center">
          <p className="text-gray-600 font-medium">Mission not found</p>
          <button onClick={() => navigate('/missions')} className="mt-3 text-blue-600 text-sm hover:underline">
            Back to missions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-sky-cloud overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-sky-midday/20 shadow-sm shrink-0 z-10">
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/?view=missions')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors shrink-0"
            >
              Back to Map
            </button>
            <input
              type="text"
              value={name}
              readOnly={!canEdit}
              disabled={!canEdit}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              className="font-bold text-sky-night bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none text-base min-w-0 flex-1 py-0.5 disabled:cursor-default"
              placeholder="Mission name"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveError && <p className="text-red-500 text-xs">{saveError}</p>}
            <button
              onClick={handleDuplicate}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50 transition-colors"
            >
              Duplicate
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main: left metadata + center map + right waypoints */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — mission metadata */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {siteMissions.length > 1 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Site Missions</p>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {siteMissions.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/missions/${m.id}`)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate ${
                        m.id === id
                          ? 'bg-blue-100 text-blue-800 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-3">
                Created by {selectedMission.creator?.username ?? 'unknown'}
              </p>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                rows={4}
                readOnly={!canEdit}
                disabled={!canEdit}
                placeholder="Optional notes about this mission..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Launch Site</label>
              <select
                value={launchSiteId}
                disabled={!canEdit}
                onChange={(e) => {
                  const siteId = e.target.value;
                  setLaunchSiteId(siteId);
                  setDirty(true);
                  const site = sites.find((s) => String(s.id) === siteId);
                  if (site) {
                    setFlyToCenter([site.takeoff_lat, site.takeoff_lon]);
                    if (waypoints.length === 0 && id) {
                      addWaypoint(id, Number(site.takeoff_lat), Number(site.takeoff_lon));
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">No site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <p className="text-xs font-medium text-gray-600">Performance</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Average speed (km/h)
                  {avgSpeed === null && (
                    <span className="ml-1 text-gray-400 italic">using settings ({settingsSpeed})</span>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={avgSpeed ?? ''}
                  onChange={(e) => { setAvgSpeed(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                  placeholder={`e.g. ${settingsSpeed}`}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <p className="text-xs font-medium text-gray-600">Fuel Planning</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Avg fuel consumption (L/h)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={avgFuelConsumption ?? ''}
                  onChange={(e) => { setAvgFuelConsumption(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fuel tank size (L)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={fuelTankSize ?? ''}
                  onChange={(e) => { setFuelTankSize(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                  placeholder="e.g. 45"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {fuelTankSize !== null && fuelTankSize > 0 && fuelReservePercent > 0 && (
                  <p className="mt-1 text-xs text-gray-400 italic">
                    {(fuelTankSize * fuelReservePercent / 100).toFixed(1)} L held in reserve
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Wind direction (° from)</label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  step="1"
                  value={windDirection ?? ''}
                  onChange={(e) => { setWindDirection(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                  placeholder="e.g. 270 = westerly"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Wind speed (km/h)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={windSpeed ?? ''}
                  onChange={(e) => { setWindSpeed(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                  placeholder="e.g. 20"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {!canEdit && (
              <p className="text-xs text-amber-600">
                Performance &amp; fuel changes are not saved
              </p>
            )}

            <div className="border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {canEdit
                  ? 'Click the map to add waypoints. Drag markers to reposition them.'
                  : 'Map is read-only. You can adjust performance & fuel values above.'}
              </p>
            </div>
          </div>
        </aside>

        {/* Center — map */}
        <div className="flex-1 relative">
          <MissionMap
            waypoints={waypoints}
            selectedWaypointId={selectedWaypointId}
            launchSite={launchSite}
            onMapClick={handleMapClick}
            onWaypointDrag={handleWaypointDrag}
            onWaypointClick={setSelectedWaypointId}
            flyToCenter={flyToCenter}
            showSegTime={showSegTime}
            showSegDist={showSegDist}
            showFuel={showFuel}
            averageSpeed={averageSpeed}
            distanceUnit={distanceUnit}
            avgFuelConsumption={avgFuelConsumption ?? 0}
            fuelTankSize={fuelTankSize}
            windDirection={windDirection}
            windSpeed={windSpeed ?? 0}
          />
        </div>

        {/* Right panel — waypoints */}
        <aside className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-gray-200 shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Waypoints</h2>
          </div>
          <WaypointSidebar
            waypoints={waypoints}
            selectedWaypointId={selectedWaypointId}
            distanceUnit={distanceUnit}
            averageSpeed={averageSpeed}
            showSegTime={showSegTime}
            showSegDist={showSegDist}
            showFuel={showFuel}
            onToggleTime={() => setShowSegTime(v => !v)}
            onToggleDist={() => setShowSegDist(v => !v)}
            onToggleFuel={() => setShowFuel(v => !v)}
            avgFuelConsumption={avgFuelConsumption ?? 0}
            fuelTankSize={fuelTankSize}
            fuelReservePercent={fuelReservePercent}
            windDirection={windDirection}
            windSpeed={windSpeed ?? 0}
            onSelect={setSelectedWaypointId}
            onDelete={handleDeleteWaypoint}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            canEdit={canEdit}
            missionName={name}
          />
        </aside>
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-2">Delete Mission?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete "{selectedMission.name}" and all its waypoints. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
