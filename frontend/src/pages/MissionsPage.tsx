import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import { useSites } from '../hooks/useSites';
import { useMissionsStore } from '../stores/missionsStore';
import { Mission } from '../services/missions.service';

export default function MissionsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const { sites } = useSites();
  const { missions, loading, error, fetchMissions } = useMissionsStore();

  const [search, setSearch] = useState('');
  const [filterSiteId, setFilterSiteId] = useState(searchParams.get('launchSiteId') ?? '');
  const [sort, setSort] = useState<'updated_at' | 'name'>('updated_at');
  const [creating, setCreating] = useState(false);
  const [newMissionName, setNewMissionName] = useState('');
  const [createError, setCreateError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { createMission, deleteMission } = useMissionsStore();

  useEffect(() => {
    fetchMissions({ search, launchSiteId: filterSiteId || undefined, sort, order: 'DESC' });
  }, [search, filterSiteId, sort]);

  async function handleDelete(id: string) {
    await deleteMission(id);
    setConfirmDeleteId(null);
  }

  async function handleCreate() {
    const name = newMissionName.trim();
    if (!name) {
      setCreateError('Mission name is required');
      return;
    }
    setCreateError('');
    const mission = await createMission({
      name,
      launch_site_id: filterSiteId || null,
    });
    navigate(`/missions/${mission.id}`);
  }

  return (
    <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
      {!isMobile && (
        <LeftSidebar
          user={user}
          showAirspace={false}
          onToggleAirspace={() => {}}
          onLogout={logout}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Header — no back button */}
        <div className="border-b border-[#1e2a3a] px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ background: '#0d1421' }}>
          <div>
            <h1 className="text-xl font-bold text-white">Mission Planner</h1>
            <p className="text-xs text-[#6b7fa3]">Plan routes and waypoints</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Mission
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              placeholder="Search missions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#141d2e] border border-[#2a3a54] rounded-lg text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
              className="px-3 py-2 bg-[#141d2e] border border-[#2a3a54] rounded-lg text-sm text-[#a0b3cc] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'updated_at' | 'name')}
              className="px-3 py-2 bg-[#141d2e] border border-[#2a3a54] rounded-lg text-sm text-[#a0b3cc] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="updated_at">Recently Updated</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          {/* Create mission inline form */}
          {creating && (
            <div className="bg-[#141d2e] border border-[#2a3a54] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-2">New Mission</h2>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Mission name"
                  value={newMissionName}
                  onChange={(e) => setNewMissionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  className="flex-1 px-3 py-2 bg-[#0d1421] border border-[#2a3a54] rounded-lg text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => { setCreating(false); setNewMissionName(''); setCreateError(''); }}
                  className="px-3 py-2 border border-[#2a3a54] text-[#a0b3cc] rounded-lg text-sm hover:bg-[#1e2a3a] transition-colors"
                >
                  Cancel
                </button>
              </div>
              {createError && <p className="text-red-400 text-xs mt-1">{createError}</p>}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-12 text-[#6b7fa3] text-sm">Loading missions...</div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-12 text-red-400 text-sm">{error}</div>
          )}

          {/* Empty state */}
          {!loading && !error && missions.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-white font-medium">No missions yet</p>
              <p className="text-[#6b7fa3] text-sm mt-1">Create your first mission to start planning routes</p>
              <button
                onClick={() => setCreating(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                New Mission
              </button>
            </div>
          )}

          {/* Mission list */}
          {!loading && missions.length > 0 && (
            <div className="space-y-2">
              {missions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onClick={() => navigate(`/missions/${mission.id}`)}
                  onDelete={(id) => setConfirmDeleteId(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-white mb-2">Delete Mission?</h3>
            <p className="text-sm text-[#6b7fa3] mb-4">
              This will permanently delete this mission and all its waypoints. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 border border-[#2a3a54] text-[#a0b3cc] rounded-lg text-sm hover:bg-[#1e2a3a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
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

function MissionCard({ mission, onClick, onDelete }: { mission: Mission; onClick: () => void; onDelete: (id: string) => void }) {
  const waypointCount = mission.waypoints?.length ?? 0;
  const updatedAt = new Date(mission.updated_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="relative bg-[#141d2e] rounded-xl border border-[#1e2a3a] hover:border-[#2a3a54] hover:bg-[#1a2234] transition-all group">
      <button
        onClick={onClick}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
              {mission.name}
            </h3>
            {mission.notes && (
              <p className="text-sm text-[#6b7fa3] mt-0.5 line-clamp-2">{mission.notes}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-[#4a5568]">
              {mission.launch_site && (
                <span className="flex items-center gap-1 text-[#6b7fa3]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {mission.launch_site.name}
                </span>
              )}
              <span className="text-[#6b7fa3]">{waypointCount} waypoint{waypointCount !== 1 ? 's' : ''}</span>
              <span className="text-[#4a5568]">Updated {updatedAt}</span>
            </div>
          </div>
          <svg className="w-4 h-4 text-[#4a5568] group-hover:text-blue-400 shrink-0 mt-1 transition-colors"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(mission.id); }}
        className="absolute top-3 right-8 p-1.5 text-[#4a5568] hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Delete mission"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
