import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import { useMediaByMission } from '../hooks/useMedia';
import { useMediaStore } from '../stores/mediaStore';
import { missionsService } from '../services/missions.service';
import { useQuery } from '@tanstack/react-query';
import MediaCard from '../components/Media/MediaCard';
import MediaViewer from '../components/Media/MediaViewer';
import UploadModal from '../components/Media/UploadModal';

export default function MissionMediaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { openUploadModal } = useMediaStore();

  const { data: mission, isLoading: missionLoading } = useQuery({
    queryKey: ['mission', id],
    queryFn: () => missionsService.getById(id!),
    enabled: !!id,
  });

  const { data: media, isLoading: mediaLoading } = useMediaByMission(id);

  const canUpload =
    user?.is_admin ||
    !mission?.created_by ||
    mission?.created_by === user?.id;

  const mediaIds = media?.map((m) => m.id) ?? [];

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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-[#1e2a3a] shrink-0" style={{ background: '#0d1421', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/missions/${id}`)}
                className="flex items-center gap-1.5 text-sm text-[#6b7fa3] hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back to Mission
              </button>
              <span className="text-[#2a3a54]">|</span>
              <h1 className="text-sm font-semibold text-white truncate max-w-xs">
                {missionLoading ? 'Loading…' : (mission?.name ?? 'Mission')} — Media
              </h1>
            </div>
            {canUpload && (
              <button
                onClick={openUploadModal}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Media
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {mediaLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-[#1e2a3a] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !media || media.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg className="w-12 h-12 text-[#2a3a54] mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-[#6b7fa3] text-sm">No media yet for this mission.</p>
              {canUpload && (
                <button
                  onClick={openUploadModal}
                  className="mt-3 text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Upload the first photo or video
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {media.map((item, index) => (
                <MediaCard key={item.id} media={item} mediaList={mediaIds} index={index} />
              ))}
            </div>
          )}
        </main>
      </div>

      <MediaViewer />
      <UploadModal
        missionId={id}
        defaultSiteId={mission?.launch_site_id ?? undefined}
      />
    </div>
  );
}
