import { useState, useEffect } from 'react';
import { LatLng } from 'leaflet';
import { useSites } from '../../hooks/useSites';
import { CreateSiteData } from '../../services/sites.service';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation: LatLng | null;
}

export default function AddSiteModal({
  isOpen,
  onClose,
  initialLocation,
}: AddSiteModalProps) {
  const { createSiteMutation } = useSites();
  const [formData, setFormData] = useState({
    name: '',
    takeoff_lat: 0,
    takeoff_lon: 0,
    parking_lat: 0,
    parking_lon: 0,
  });
  const [useSameLocation, setUseSameLocation] = useState(true);

  // Update form when initialLocation changes
  useEffect(() => {
    if (initialLocation) {
      setFormData({
        name: '',
        takeoff_lat: initialLocation.lat,
        takeoff_lon: initialLocation.lng,
        parking_lat: initialLocation.lat,
        parking_lon: initialLocation.lng,
      });
      setUseSameLocation(true);
    }
  }, [initialLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const siteData: CreateSiteData = {
        name: formData.name,
        takeoff_lat: formData.takeoff_lat,
        takeoff_lon: formData.takeoff_lon,
        parking_lat: useSameLocation
          ? formData.takeoff_lat
          : formData.parking_lat,
        parking_lon: useSameLocation
          ? formData.takeoff_lon
          : formData.parking_lon,
      };

      await createSiteMutation.mutateAsync(siteData);

      // Reset form and close modal
      setFormData({
        name: '',
        takeoff_lat: 0,
        takeoff_lon: 0,
        parking_lat: 0,
        parking_lon: 0,
      });
      setUseSameLocation(true);
      onClose();
    } catch (error: any) {
      console.error('Failed to create site:', error);
      alert(
        error.response?.data?.message ||
          'Failed to create site. Please check your input and try again.'
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Flight Site</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            {/* Site Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Site Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Sunset Ridge"
              />
            </div>

            {/* Takeoff Coordinates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Takeoff Location *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="takeoff_lat"
                    className="block text-xs text-gray-500 mb-1"
                  >
                    Latitude
                  </label>
                  <input
                    type="number"
                    id="takeoff_lat"
                    required
                    step="any"
                    min="-90"
                    max="90"
                    value={formData.takeoff_lat}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        takeoff_lat: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="takeoff_lon"
                    className="block text-xs text-gray-500 mb-1"
                  >
                    Longitude
                  </label>
                  <input
                    type="number"
                    id="takeoff_lon"
                    required
                    step="any"
                    min="-180"
                    max="180"
                    value={formData.takeoff_lon}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        takeoff_lon: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Parking Location Toggle */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={useSameLocation}
                  onChange={(e) => setUseSameLocation(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Parking at same location as takeoff
                </span>
              </label>
            </div>

            {/* Parking Coordinates (shown only if different location) */}
            {!useSameLocation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parking Location *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="parking_lat"
                      className="block text-xs text-gray-500 mb-1"
                    >
                      Latitude
                    </label>
                    <input
                      type="number"
                      id="parking_lat"
                      required
                      step="any"
                      min="-90"
                      max="90"
                      value={formData.parking_lat}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          parking_lat: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="parking_lon"
                      className="block text-xs text-gray-500 mb-1"
                    >
                      Longitude
                    </label>
                    <input
                      type="number"
                      id="parking_lon"
                      required
                      step="any"
                      min="-180"
                      max="180"
                      value={formData.parking_lon}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          parking_lon: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={createSiteMutation.isPending}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSiteMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createSiteMutation.isPending ? 'Creating...' : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
