import { LatLng } from 'leaflet';
import BottomSheet from './BottomSheet';
import AddSitePanel from '../Site/AddSitePanel';

/**
 * MobileAddSiteSheet - Mobile bottom sheet for adding flight sites
 *
 * Wraps the AddSitePanel component in a mobile-friendly bottom sheet.
 * Provides the same functionality as desktop but optimized for touch interaction.
 */

interface MobileAddSiteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (type: 'takeoff' | 'parking') => void;
  activeLocationSelection: 'takeoff' | 'parking' | null;
  pendingLocation: LatLng | null;
  pendingLocationType: 'takeoff' | 'parking' | null;
  onLocationUsed: () => void;
  onZoomToLocation: (lat: number, lon: number, zoom?: number) => void;
}

export default function MobileAddSiteSheet({
  isOpen,
  onClose,
  onSelectLocation,
  activeLocationSelection,
  pendingLocation,
  pendingLocationType,
  onLocationUsed,
  onZoomToLocation,
}: MobileAddSiteSheetProps) {
  if (!isOpen) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Flight Site"
      height="full"
    >
      {/* Render AddSitePanel but it will handle its own display */}
      <div className="h-full overflow-y-auto">
        <AddSitePanel
          isOpen={true}
          onClose={onClose}
          onSelectLocation={onSelectLocation}
          activeLocationSelection={activeLocationSelection}
          pendingLocation={pendingLocation}
          pendingLocationType={pendingLocationType}
          onLocationUsed={onLocationUsed}
          onZoomToLocation={onZoomToLocation}
        />
      </div>
    </BottomSheet>
  );
}
