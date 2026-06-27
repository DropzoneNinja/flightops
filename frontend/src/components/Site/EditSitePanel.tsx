import { useState, useEffect } from 'react';
import { LatLng } from 'leaflet';
import { useSites } from '../../hooks/useSites';
import { FlightSite, UpdateSiteData } from '../../services/sites.service';

interface EditSitePanelProps {
  isOpen: boolean;
  site: FlightSite | null;
  onClose: () => void;
  onSelectLocation: (type: 'takeoff' | 'parking') => void;
  activeLocationSelection: 'takeoff' | 'parking' | null;
  pendingLocation: LatLng | null;
  pendingLocationType: 'takeoff' | 'parking' | null;
  onLocationUsed: () => void;
  onZoomToLocation: (lat: number, lon: number, zoom?: number) => void;
}

export default function EditSitePanel({
  isOpen,
  site,
  onClose,
  onSelectLocation,
  activeLocationSelection,
  pendingLocation,
  pendingLocationType,
  onLocationUsed: _onLocationUsed,
  onZoomToLocation,
}: EditSitePanelProps) {
  const { updateSiteMutation } = useSites();
  const [formData, setFormData] = useState({
    name: '',
    takeoff_lat: '' as number | '',
    takeoff_lon: '' as number | '',
    parking_lat: '' as number | '',
    parking_lon: '' as number | '',
    takeoff_notes: '',
    parking_notes: '',
    weather_notes: '',
    elevation_m: '' as number | '',
  });

  // Initialise form when site changes
  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name,
        takeoff_lat: parseFloat(site.takeoff_lat.toString()),
        takeoff_lon: parseFloat(site.takeoff_lon.toString()),
        parking_lat: parseFloat(site.parking_lat.toString()),
        parking_lon: parseFloat(site.parking_lon.toString()),
        takeoff_notes: site.takeoff_notes ?? '',
        parking_notes: site.parking_notes ?? '',
        weather_notes: site.weather_notes ?? '',
        elevation_m: site.elevation_m ?? '',
      });
    }
  }, [site]);

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

    if (!site) return;

    if (formData.takeoff_lat === '' || formData.takeoff_lon === '') {
      alert('Takeoff coordinates are required');
      return;
    }

    try {
      const updateData: UpdateSiteData = {
        name: formData.name,
        takeoff_lat: Number(formData.takeoff_lat),
        takeoff_lon: Number(formData.takeoff_lon),
        parking_lat: formData.parking_lat !== '' ? Number(formData.parking_lat) : Number(formData.takeoff_lat),
        parking_lon: formData.parking_lon !== '' ? Number(formData.parking_lon) : Number(formData.takeoff_lon),
        takeoff_notes: formData.takeoff_notes || undefined,
        parking_notes: formData.parking_notes || undefined,
        weather_notes: formData.weather_notes || undefined,
        elevation_m: formData.elevation_m !== '' ? Number(formData.elevation_m) : undefined,
      };

      await updateSiteMutation.mutateAsync({ id: site.id, data: updateData });
      onClose();
    } catch (error: any) {
      console.error('Failed to update site:', error);
      alert(
        error.response?.data?.message ||
          'Failed to update site. Please check your input and try again.'
      );
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const getBorderColor = (fieldType: 'takeoff' | 'parking') => {
    if (activeLocationSelection === fieldType) {
      return 'border-amber-500 border-2 ring-2 ring-amber-200';
    }
    return 'border-gray-300';
  };

  const handleTakeoffSelectFromMap = () => {
    if (formData.takeoff_lat !== '' && formData.takeoff_lon !== '') {
      onZoomToLocation(Number(formData.takeoff_lat), Number(formData.takeoff_lon), 17);
    }
    onSelectLocation('takeoff');
  };

  const handleParkingSelectFromMap = () => {
    if (formData.parking_lat !== '' && formData.parking_lon !== '') {
      onZoomToLocation(Number(formData.parking_lat), Number(formData.parking_lon), 17);
    }
    onSelectLocation('parking');
  };

  if (!isOpen || !site) return null;

  return (
    <div
      className={`fixed top-[72px] right-0 h-[calc(100vh-72px)] w-96 bg-white shadow-2xl z-[1000] transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } overflow-y-auto`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Edit Flight Site</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={updateSiteMutation.isPending}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Site Name */}
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
              Site Name
            </label>
            <input
              type="text"
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {activeLocationSelection === 'takeoff' ? 'Click Map' : 'Select from Map'}
              </button>
            </div>
            <div className={`grid grid-cols-2 gap-2 p-2 rounded ${getBorderColor('takeoff')}`}>
              <div>
                <label htmlFor="edit-takeoff-lat" className="block text-xs text-gray-500 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  id="edit-takeoff-lat"
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
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-takeoff-lon" className="block text-xs text-gray-500 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  id="edit-takeoff-lon"
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
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Takeoff Notes */}
          <div>
            <label htmlFor="edit-takeoff-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Takeoff Notes
            </label>
            <textarea
              id="edit-takeoff-notes"
              value={formData.takeoff_notes}
              onChange={(e) => setFormData({ ...formData, takeoff_notes: e.target.value })}
              rows={3}
              maxLength={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
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
                onClick={handleParkingSelectFromMap}
                className={`text-xs px-2 py-1 rounded ${
                  activeLocationSelection === 'parking'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {activeLocationSelection === 'parking' ? 'Click Map' : 'Select from Map'}
              </button>
            </div>
            <div className={`grid grid-cols-2 gap-2 p-2 rounded ${getBorderColor('parking')}`}>
              <div>
                <label htmlFor="edit-parking-lat" className="block text-xs text-gray-500 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  id="edit-parking-lat"
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
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-parking-lon" className="block text-xs text-gray-500 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  id="edit-parking-lon"
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
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Parking Notes */}
          <div>
            <label htmlFor="edit-parking-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Parking Notes
            </label>
            <textarea
              id="edit-parking-notes"
              value={formData.parking_notes}
              onChange={(e) => setFormData({ ...formData, parking_notes: e.target.value })}
              rows={3}
              maxLength={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Notes about parking location, accessibility, etc."
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.parking_notes.length}/10000
            </div>
          </div>

          {/* Weather Notes */}
          <div>
            <label htmlFor="edit-weather-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Weather Notes
            </label>
            <textarea
              id="edit-weather-notes"
              value={formData.weather_notes}
              onChange={(e) => setFormData({ ...formData, weather_notes: e.target.value })}
              rows={3}
              maxLength={10000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="Notes about typical weather conditions, seasonal patterns, etc."
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.weather_notes.length}/10000
            </div>
          </div>

          {/* Elevation */}
          <div>
            <label htmlFor="edit-elevation" className="block text-sm font-medium text-gray-700 mb-1">
              Elevation (m above sea level)
            </label>
            <input
              id="edit-elevation"
              type="number"
              value={formData.elevation_m}
              onChange={(e) => setFormData({ ...formData, elevation_m: e.target.value === '' ? '' : Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. 1460"
              min="-500"
              max="9000"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={updateSiteMutation.isPending}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateSiteMutation.isPending}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-md font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateSiteMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
