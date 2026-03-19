import { useState, useEffect } from 'react';
import { useSites } from '../../hooks/useSites';
import { useMediaUpdate } from '../../hooks/useMedia';
import { useToastContext } from '../../contexts/ToastContext';
import { usersService } from '../../services/users.service';
import { Media } from '../../services/media.service';

interface EditMediaModalProps {
  media: Media;
  onClose: () => void;
  onSuccess: (updated: Media) => void;
}

export default function EditMediaModal({ media, onClose, onSuccess }: EditMediaModalProps) {
  const { sites, isLoading: isLoadingSites } = useSites();
  const updateMutation = useMediaUpdate();
  const toast = useToastContext();

  // Form state — pre-populated from media
  const [flightDate, setFlightDate] = useState(
    new Date(media.flight_date).toISOString().split('T')[0]
  );
  const [selectedSiteId, setSelectedSiteId] = useState(media.site_id || '');
  const [notes, setNotes] = useState(media.notes || '');

  // Pilots state
  const [availableUsernames, setAvailableUsernames] = useState<string[]>([]);
  const [isLoadingUsernames, setIsLoadingUsernames] = useState(false);
  const [selectedPilots, setSelectedPilots] = useState<string[]>([]);
  const [otherPilots, setOtherPilots] = useState<string[]>(['']);
  const [showOtherInput, setShowOtherInput] = useState(false);

  // Initialise pilots from existing media data
  useEffect(() => {
    const fetchUsernames = async () => {
      setIsLoadingUsernames(true);
      try {
        const usernames = await usersService.getUsernames();
        setAvailableUsernames(usernames);

        // Split existing pilots into "known" (from system) and "other" (custom)
        const known = media.pilots.filter(p => usernames.includes(p));
        const other = media.pilots.filter(p => !usernames.includes(p));

        setSelectedPilots(known);
        if (other.length > 0) {
          setOtherPilots(other);
          setShowOtherInput(true);
        }
      } catch (error) {
        console.error('Failed to fetch usernames:', error);
      } finally {
        setIsLoadingUsernames(false);
      }
    };
    fetchUsernames();
  }, [media.pilots]);

  const handlePilotCheckboxChange = (username: string, checked: boolean) => {
    if (checked) {
      setSelectedPilots([...selectedPilots, username]);
    } else {
      setSelectedPilots(selectedPilots.filter(p => p !== username));
    }
  };

  const handleOtherCheckboxChange = (checked: boolean) => {
    setShowOtherInput(checked);
    if (!checked) {
      setOtherPilots(['']);
    }
  };

  const handleOtherPilotChange = (index: number, value: string) => {
    const next = [...otherPilots];
    next[index] = value;
    setOtherPilots(next);
  };

  const handleAddOtherPilot = () => {
    setOtherPilots([...otherPilots, '']);
  };

  const handleRemoveOtherPilot = (index: number) => {
    if (otherPilots.length > 1) {
      setOtherPilots(otherPilots.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validOtherPilots = showOtherInput
      ? otherPilots.filter(p => p.trim() !== '')
      : [];
    const allPilots = [...selectedPilots, ...validOtherPilots];

    try {
      const updated = await updateMutation.mutateAsync({
        id: media.id,
        data: {
          flight_date: flightDate,
          pilots: allPilots,
          notes: notes.trim() || undefined,
          site_id: selectedSiteId || null,
        },
      });
      toast.success('Media updated successfully!');
      onSuccess(updated);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update media. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black bg-opacity-70 animate-fade-in">
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-sky-night">Edit Media</h2>
          <p className="text-sm text-sky-dusk mt-1 truncate">{media.original_filename}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Flight Date */}
          <div>
            <label htmlFor="edit-flight-date" className="block text-sm font-medium text-sky-dusk mb-2">
              Flight Date
            </label>
            <input
              type="date"
              id="edit-flight-date"
              value={flightDate}
              onChange={e => setFlightDate(e.target.value)}
              disabled={updateMutation.isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning"
            />
          </div>

          {/* Site Selection */}
          <div>
            <label htmlFor="edit-site" className="block text-sm font-medium text-sky-dusk mb-2">
              Flying Site (Optional)
            </label>
            {isLoadingSites ? (
              <div className="text-sm text-gray-500">Loading sites...</div>
            ) : (
              <select
                id="edit-site"
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                disabled={updateMutation.isPending}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning"
              >
                <option value="">No site</option>
                {sites
                  .filter(site => site.enabled)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Pilots */}
          <div>
            <label className="block text-sm font-medium text-sky-dusk mb-2">
              Pilots (Optional)
            </label>
            {isLoadingUsernames ? (
              <div className="text-sm text-gray-500">Loading pilots...</div>
            ) : (
              <div className="space-y-2">
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {availableUsernames.length === 0 ? (
                    <p className="text-sm text-gray-500">No pilots available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableUsernames.sort((a, b) => a.localeCompare(b)).map(username => (
                        <label
                          key={username}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPilots.includes(username)}
                            onChange={e => handlePilotCheckboxChange(username, e.target.checked)}
                            disabled={updateMutation.isPending}
                            className="rounded text-sky-morning focus:ring-sky-morning"
                          />
                          <span className="text-sm text-gray-700">{username}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={showOtherInput}
                    onChange={e => handleOtherCheckboxChange(e.target.checked)}
                    disabled={updateMutation.isPending}
                    className="rounded text-sky-morning focus:ring-sky-morning"
                  />
                  <span className="text-sm font-medium text-sky-dusk">Other (enter custom name)</span>
                </label>

                {showOtherInput && (
                  <div className="pl-6 space-y-2 border-l-2 border-sky-morning">
                    {otherPilots.map((pilot, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={pilot}
                          onChange={e => handleOtherPilotChange(index, e.target.value)}
                          disabled={updateMutation.isPending}
                          placeholder={`Pilot name ${index + 1}`}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning"
                        />
                        {otherPilots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOtherPilot(index)}
                            disabled={updateMutation.isPending}
                            className="px-3 py-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddOtherPilot}
                      disabled={updateMutation.isPending}
                      className="text-sm text-sky-morning hover:text-sky-night disabled:opacity-50"
                    >
                      + Add another pilot
                    </button>
                  </div>
                )}

                {(selectedPilots.length > 0 || (showOtherInput && otherPilots.some(p => p.trim()))) && (
                  <div className="text-xs text-gray-600">
                    Selected: {[...selectedPilots, ...otherPilots.filter(p => p.trim())].join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="edit-notes" className="block text-sm font-medium text-sky-dusk mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={updateMutation.isPending}
              placeholder="Add any notes about this flight..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-sky-morning text-white rounded-lg hover:bg-sky-night disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
