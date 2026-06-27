import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMissionsStore } from '../stores/missionsStore';
import { useSites } from '../hooks/useSites';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import MissionMap from '../components/Mission/MissionMap';
import WaypointSidebar, { exportGpx } from '../components/Mission/WaypointSidebar';
import { Mission, MissionWaypoint, missionsService } from '../services/missions.service';
import {
  calculateDistance, formatDistance,
  calculateTime, formatTime,
  calculateBearing, windAdjustedSpeed,
} from '../utils/distanceUtils';

export default function MissionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  type NavState = { fromMap?: boolean; siteId?: string; prevMapState?: { lat: number; lng: number; zoom: number }; windOverride?: { dir: number; speed: number } | null } | null;
  const navState = location.state as NavState;
  const fromMapSiteId: string | undefined = navState?.fromMap ? navState.siteId : undefined;
  const handleBack = () =>
    fromMapSiteId
      ? navigate(`/?site=${fromMapSiteId}`, { state: { prevMapState: navState?.prevMapState } })
      : navigate('/missions');
  const { sites } = useSites();
  const { settingsMap } = useSettings();
  const { user, logout } = useAuth();

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

  const isMobile = useIsMobile();

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
        if (navState?.windOverride) {
          setWindDirection(navState.windOverride.dir);
          setWindSpeed(navState.windOverride.speed);
          setDirty(true);
        } else {
          setWindDirection(m.wind_direction);
          setWindSpeed(m.wind_speed);
          setDirty(false);
        }
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
  const allTakeoffZones = sites
    .filter((s) => s.takeoff_lat != null && s.takeoff_lon != null)
    .map((s) => ({ id: s.id, name: s.name, takeoff_lat: s.takeoff_lat, takeoff_lon: s.takeoff_lon }));

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
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1421' }}>
        <p className="text-[#6b7fa3] text-sm">Loading mission...</p>
      </div>
    );
  }

  if (!selectedMission) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1421' }}>
        <div className="text-center">
          <p className="text-white font-medium">Mission not found</p>
          <button onClick={() => navigate('/missions')} className="mt-3 text-blue-400 text-sm hover:underline">
            Back to missions
          </button>
        </div>
      </div>
    );
  }

  if (isMobile) {
    const fuelConfigured = (avgFuelConsumption ?? 0) > 0;
    let mobileTotalDistKm = 0;
    let mobileTotalTimeH = 0;
    let mobileTotalFuelL = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const cur = waypoints[i];
      const dist = calculateDistance(Number(prev.latitude), Number(prev.longitude), Number(cur.latitude), Number(cur.longitude));
      const bearing = calculateBearing(Number(prev.latitude), Number(prev.longitude), Number(cur.latitude), Number(cur.longitude));
      const gndSpeed = (windSpeed ?? 0) > 0 && windDirection !== null
        ? windAdjustedSpeed(averageSpeed, windSpeed ?? 0, windDirection, bearing)
        : averageSpeed;
      const time = calculateTime(dist, gndSpeed);
      mobileTotalDistKm += dist;
      mobileTotalTimeH += time;
      mobileTotalFuelL += fuelConfigured ? time * (avgFuelConsumption ?? 0) : 0;
    }

    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0d1421' }}>
        <header className="border-b border-[#1e2a3a] shrink-0 z-10" style={{ background: '#0d1421', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-3 py-2 flex items-center gap-2">
            <button
              onClick={handleBack}
              className="px-3 py-1.5 bg-[#1e2a3a] border border-[#2a3a54] text-[#a0b3cc] rounded-md text-sm font-medium hover:bg-[#243048] transition-colors shrink-0"
            >
              {fromMapSiteId ? '← Map' : '← Back'}
            </button>
            <span className="font-bold text-white text-sm flex-1 truncate">{name}</span>
            {waypoints.length > 0 && (
              <button
                onClick={() => exportGpx(waypoints, name)}
                className="flex items-center gap-1 px-3 py-1.5 border border-[#2a3a54] bg-[#1e2a3a] rounded-md text-xs text-[#a0b3cc] hover:bg-[#243048] transition-colors shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export GPX
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 relative">
          <MissionMap
            waypoints={waypoints}
            selectedWaypointId={selectedWaypointId}
            launchSite={launchSite}
            allTakeoffZones={allTakeoffZones}
            onMapClick={() => {}}
            onWaypointDrag={() => {}}
            onWaypointClick={setSelectedWaypointId}
            flyToCenter={flyToCenter}
            showSegTime={true}
            showSegDist={true}
            showFuel={true}
            averageSpeed={averageSpeed}
            distanceUnit={distanceUnit}
            avgFuelConsumption={avgFuelConsumption ?? 0}
            fuelTankSize={fuelTankSize}
            windDirection={windDirection}
            windSpeed={windSpeed ?? 0}
          />
        </div>

        {waypoints.length > 0 && (
          <div className="border-t border-[#1e2a3a] px-4 py-3 shrink-0 flex justify-around items-center" style={{ background: '#141d2e' }}>
            <div className="text-center">
              <p className="text-xs text-[#6b7fa3] mb-0.5">Distance</p>
              <p className="text-sm font-semibold text-white">{formatDistance(mobileTotalDistKm, distanceUnit)}</p>
            </div>
            <div className="w-px h-8 bg-[#1e2a3a]" />
            <div className="text-center">
              <p className="text-xs text-[#6b7fa3] mb-0.5">Time</p>
              <p className="text-sm font-semibold text-white">{formatTime(mobileTotalTimeH)}</p>
            </div>
            {fuelConfigured && (
              <>
                <div className="w-px h-8 bg-[#1e2a3a]" />
                <div className="text-center">
                  <p className="text-xs text-[#6b7fa3] mb-0.5">Fuel</p>
                  <p className="text-sm font-semibold text-white">{mobileTotalFuelL.toFixed(1)} L</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-1.5 bg-[#0d1421] border border-[#2a3a54] rounded-lg text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-40 disabled:cursor-default';
  const labelCls = 'block text-xs font-medium text-[#a0b3cc] mb-1';

  return (
    <div className="flex flex-row h-screen overflow-hidden" style={{ background: '#0d1421' }}>
      <LeftSidebar
        user={user}
        showAirspace={false}
        onToggleAirspace={() => {}}
        onLogout={logout}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="border-b border-[#1e2a3a] shrink-0 z-10" style={{ background: '#0d1421', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] rounded-lg text-sm hover:bg-[#243048] transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {fromMapSiteId ? 'Map' : 'Missions'}
              </button>
              <input
                type="text"
                value={name}
                readOnly={!canEdit}
                disabled={!canEdit}
                onChange={(e) => { setName(e.target.value); setDirty(true); }}
                className="font-bold text-white bg-transparent border-b border-transparent hover:border-[#2a3a54] focus:border-blue-500 focus:outline-none text-base min-w-0 flex-1 py-0.5 disabled:cursor-default placeholder-[#4a5568]"
                placeholder="Mission name"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
              <button
                onClick={handleDuplicate}
                className="px-2.5 py-1.5 border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] rounded-lg text-xs hover:bg-[#243048] transition-colors"
              >
                Duplicate
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-2.5 py-1.5 border border-red-900/50 text-red-400 rounded-lg text-xs hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          <aside className="w-64 border-r border-[#1e2a3a] flex flex-col shrink-0 overflow-y-auto" style={{ background: '#141d2e' }}>
            <div className="p-4 space-y-4">
              {siteMissions.length > 1 && (
                <div>
                  <p className="text-xs font-medium text-[#a0b3cc] mb-1">Site Missions</p>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {siteMissions.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => navigate(`/missions/${m.id}`)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate ${
                          m.id === id
                            ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-600/30'
                            : 'text-[#a0b3cc] hover:bg-[#1e2a3a]'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-[#4a5568] mb-3">
                  Created by {selectedMission.creator?.username ?? 'unknown'}
                </p>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                  rows={4}
                  readOnly={!canEdit}
                  disabled={!canEdit}
                  placeholder="Optional notes about this mission..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className={labelCls}>Launch Site</label>
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
                  className={inputCls}
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="">No site</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-[#1e2a3a] space-y-3">
                <p className="text-xs font-medium text-[#a0b3cc]">Performance</p>
                <div>
                  <label className={labelCls}>
                    Average speed (km/h)
                    {avgSpeed === null && (
                      <span className="ml-1 text-[#4a5568] italic">using settings ({settingsSpeed})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={avgSpeed ?? ''}
                    onChange={(e) => { setAvgSpeed(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                    placeholder={`e.g. ${settingsSpeed}`}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#1e2a3a] space-y-3">
                <p className="text-xs font-medium text-[#a0b3cc]">Fuel Planning</p>
                <div>
                  <label className={labelCls}>Avg fuel consumption (L/h)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={avgFuelConsumption ?? ''}
                    onChange={(e) => { setAvgFuelConsumption(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                    placeholder="e.g. 10"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fuel tank size (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={fuelTankSize ?? ''}
                    onChange={(e) => { setFuelTankSize(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                    placeholder="e.g. 45"
                    className={inputCls}
                  />
                  {fuelTankSize !== null && fuelTankSize > 0 && fuelReservePercent > 0 && (
                    <p className="mt-1 text-xs text-[#4a5568] italic">
                      {(fuelTankSize * fuelReservePercent / 100).toFixed(1)} L held in reserve
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Wind direction (° from)</label>
                  <input
                    type="number"
                    min="0"
                    max="360"
                    step="1"
                    value={windDirection ?? ''}
                    onChange={(e) => { setWindDirection(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                    placeholder="e.g. 270 = westerly"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Wind speed (km/h)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={windSpeed ?? ''}
                    onChange={(e) => { setWindSpeed(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }}
                    placeholder="e.g. 20"
                    className={inputCls}
                  />
                </div>
              </div>

              {!canEdit && (
                <p className="text-xs text-amber-500">
                  Performance &amp; fuel changes are not saved
                </p>
              )}

              <div className="border-t border-[#1e2a3a] pt-2">
                <p className="text-xs text-[#4a5568]">
                  {canEdit
                    ? 'Click the map to add waypoints. Drag markers to reposition them.'
                    : 'Map is read-only. You can adjust performance & fuel values above.'}
                </p>
              </div>

              <div className="border-t border-[#1e2a3a] pt-3">
                <button
                  onClick={() => navigate(`/missions/${id}/media`)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#a0b3cc] hover:bg-[#1e2a3a] transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  Media
                </button>
              </div>
            </div>
          </aside>

          {/* Center — map */}
          <div className="flex-1 relative">
            <MissionMap
              waypoints={waypoints}
              selectedWaypointId={selectedWaypointId}
              launchSite={launchSite}
              allTakeoffZones={allTakeoffZones}
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
          <aside className="w-72 border-l border-[#1e2a3a] flex flex-col shrink-0" style={{ background: '#141d2e' }}>
            <div className="px-3 py-2 border-b border-[#1e2a3a] shrink-0">
              <h2 className="text-sm font-semibold text-white">Waypoints</h2>
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
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]">
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-white mb-2">Delete Mission?</h3>
            <p className="text-sm text-[#6b7fa3] mb-4">
              This will permanently delete "{selectedMission.name}" and all its waypoints. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 border border-[#2a3a54] text-[#a0b3cc] rounded-lg text-sm hover:bg-[#1e2a3a] transition-colors"
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
