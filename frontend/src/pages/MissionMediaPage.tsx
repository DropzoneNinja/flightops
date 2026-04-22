import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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
  const { user } = useAuth();
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/missions/${id}`)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back to Mission
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-sm font-semibold text-gray-800 truncate max-w-xs">
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

      <main className="flex-1 p-4">
        {mediaLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !media || media.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-gray-500 text-sm">No media yet for this mission.</p>
            {canUpload && (
              <button
                onClick={openUploadModal}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
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

      <MediaViewer />
      <UploadModal
        missionId={id}
        defaultSiteId={mission?.launch_site_id ?? undefined}
      />
    </div>
  );
}
