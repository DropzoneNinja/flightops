import { useState, useEffect } from 'react';
import { LatLng } from 'leaflet';
import { format } from 'date-fns';
import { useSites } from '../../hooks/useSites';
import { CreateSiteData } from '../../services/sites.service';

interface AddSitePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (type: 'takeoff' | 'parking') => void;
  activeLocationSelection: 'takeoff' | 'parking' | null;
  pendingLocation: LatLng | null;
  pendingLocationType: 'takeoff' | 'parking' | null;
  onLocationUsed: () => void;
  onZoomToLocation: (lat: number, lon: number, zoom?: number) => void;
}

export default function AddSitePanel({
  isOpen,
  onClose,
  onSelectLocation,
  activeLocationSelection,
  pendingLocation,
  pendingLocationType,
  onLocationUsed: _onLocationUsed,
  onZoomToLocation,
}: AddSitePanelProps) {
  const { createSiteMutation } = useSites();
  const [formData, setFormData] = useState({
    name: '',
    takeoff_lat: '' as number | '',
    takeoff_lon: '' as number | '',
    parking_lat: '' as number | '',
    parking_lon: '' as number | '',
    takeoff_notes: '',
    parking_notes: '',
    weather_notes: '',
  });

  // Handle pendingLocation updates from map clicks
  useEffect(() => {
    if (pendingLocation && pendingLocationType) {
      if (pendingLocationType === 'takeoff') {
        setFormData((prev) => ({
          ...prev,
          takeoff_lat: pendingLocation.lat,
          takeoff_lon: pendingLocation.lng,
        }));
      } else if (pendingLocationType === 'parking') {
        setFormData((prev) => ({
          ...prev,
          parking_lat: pendingLocation.lat,
          parking_lon: pendingLocation.lng,
        }));
      }
    }
  }, [pendingLocation, pendingLocationType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: Only takeoff coordinates are required
    if (formData.takeoff_lat === '' || formData.takeoff_lon === '') {
      alert('Takeoff coordinates are required');
      return;
    }

    try {
      const siteData: CreateSiteData = {
        name: formData.name,
        takeoff_lat: Number(formData.takeoff_lat),
        takeoff_lon: Number(formData.takeoff_lon),
        // Default parking to takeoff if not specified
        parking_lat: formData.parking_lat !== '' ? Number(formData.parking_lat) : Number(formData.takeoff_lat),
        parking_lon: formData.parking_lon !== '' ? Number(formData.parking_lon) : Number(formData.takeoff_lon),
        takeoff_notes: formData.takeoff_notes || undefined,
        parking_notes: formData.parking_notes || undefined,
        weather_notes: formData.weather_notes || undefined,
      };

      await createSiteMutation.mutateAsync(siteData);

      // Reset form and close panel
      setFormData({
        name: '',
        takeoff_lat: '',
        takeoff_lon: '',
        parking_lat: '',
        parking_lon: '',
        takeoff_notes: '',
        parking_notes: '',
        weather_notes: '',
      });
      onClose();
    } catch (error: any) {
      console.error('Failed to create site:', error);
      alert(
        error.response?.data?.message ||
          'Failed to create site. Please check your input and try again.'
      );
    }
  };

  const handleCancel = () => {
    // Reset form
    setFormData({
      name: '',
      takeoff_lat: '',
      takeoff_lon: '',
      parking_lat: '',
      parking_lon: '',
      takeoff_notes: '',
      parking_notes: '',
      weather_notes: '',
    });
    onClose();
  };

  const getBorderColor = (fieldType: 'takeoff' | 'parking') => {
    if (activeLocationSelection === fieldType) {
      return 'border-blue-500 border-2 ring-2 ring-blue-200';
    }
    return 'border-gray-300';
  };

  const handleTakeoffSelectFromMap = () => {
    // If there are coordinates in the takeoff fields, zoom to them first
    if (formData.takeoff_lat !== '' && formData.takeoff_lon !== '') {
      onZoomToLocation(Number(formData.takeoff_lat), Number(formData.takeoff_lon), 17);
    }
    onSelectLocation('takeoff');
  };

  if (!isOpen) return null;

  const currentDate = format(new Date(), 'PPP');

  return (
    <div
      className={`fixed top-[72px] right-0 h-[calc(100vh-72px)] w-96 bg-white shadow-2xl z-[1000] transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } overflow-y-auto`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Add Flight Site</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={createSiteMutation.isPending}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Site Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Site Name
            </label>
            <input
              type="text"
              id="name"
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Takeoff Location *
              </label>
              <button
                type="button"
                onClick={handleTakeoffSelectFromMap}
                className={`text-xs px-2 py-1 rounded ${
                  activeLocationSelection === 'takeoff'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {activeLocationSelection === 'takeoff' ? 'Click Map' : 'Select from Map'}
              </button>
            </div>
            <div className={`grid grid-cols-2 gap-2 p-2 rounded ${getBorderColor('takeoff')}`}>
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
                  step="any"
                  min="-90"
                  max="90"
                  value={formData.takeoff_lat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      takeoff_lat: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="51.5074"
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
                  step="any"
                  min="-180"
                  max="180"
                  value={formData.takeoff_lon}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      takeoff_lon: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="-0.1278"
                />
              </div>
            </div>
          </div>

          {/* Takeoff Notes */}
          <div>
            <label
              htmlFor="takeoff_notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Takeoff Notes
            </label>
            <textarea
              id="takeoff_notes"
              value={formData.takeoff_notes}
              onChange={(e) =>
                setFormData({ ...formData, takeoff_notes: e.target.value })
              }
              rows={3}
              maxLength={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Notes about takeoff conditions, terrain, etc."
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.takeoff_notes.length}/10000
            </div>
          </div>

          {/* Parking Coordinates */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Parking Location
              </label>
              <button
                type="button"
                onClick={() => onSelectLocation('parking')}
                className={`text-xs px-2 py-1 rounded ${
                  activeLocationSelection === 'parking'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {activeLocationSelection === 'parking' ? 'Click Map' : 'Select from Map'}
              </button>
            </div>
            <div className={`grid grid-cols-2 gap-2 p-2 rounded ${getBorderColor('parking')}`}>
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
                  step="any"
                  min="-90"
                  max="90"
                  value={formData.parking_lat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      parking_lat: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Defaults to takeoff"
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
                  step="any"
                  min="-180"
                  max="180"
                  value={formData.parking_lon}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      parking_lon: e.target.value === '' ? '' : parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Defaults to takeoff"
                />
              </div>
            </div>
          </div>

          {/* Parking Notes */}
          <div>
            <label
              htmlFor="parking_notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Parking Notes
            </label>
            <textarea
              id="parking_notes"
              value={formData.parking_notes}
              onChange={(e) =>
                setFormData({ ...formData, parking_notes: e.target.value })
              }
              rows={3}
              maxLength={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Notes about parking location, accessibility, etc."
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.parking_notes.length}/10000
            </div>
          </div>

          {/* Weather Notes */}
          <div>
            <label
              htmlFor="weather_notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Weather Notes
            </label>
            <textarea
              id="weather_notes"
              value={formData.weather_notes}
              onChange={(e) =>
                setFormData({ ...formData, weather_notes: e.target.value })
              }
              rows={3}
              maxLength={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Notes about typical weather conditions, seasonal patterns, etc."
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.weather_notes.length}/10000
            </div>
          </div>

          {/* Date Created (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Created
            </label>
            <input
              type="text"
              value={currentDate}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
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
