import React, { useEffect, useState } from 'react';
import api from '../../api/axiosInstance';

const CeoAddArea = ({ onSuccess, onCancel }) => {
  const [areaManagers, setAreaManagers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    api.get('/users/role/Area%20Manager')
      .then(res => setAreaManagers(res.data))
      .catch(console.error);

    api.get('/locations')
      .then(res => setLocations(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedManager) {
      api.get(`/users/${selectedManager}/locations`)
        .then(res => setAssignedLocations(res.data.map(l => l._id)))
        .catch(console.error);
      setEditMode(true);
    } else {
      setEditMode(false);
      setAssignedLocations([]);
    }
  }, [selectedManager]);

  const toggleLocation = (locId) => {
    setAssignedLocations((prev) =>
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    );
  };

  const handleSave = async () => {
    try {
      await api.put(`/users/${selectedManager}/locations`, {
        locations: assignedLocations,
      });
      alert('Locations updated!');
      if (onSuccess) onSuccess();
    } catch (err) {
      alert('Failed to update locations.');
      console.error(err);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', background: '#fff', padding: 24, borderRadius: 12, position: 'relative' }}>
      <h2>Assign Locations to Area Manager</h2>
      <div style={{ margin: '16px 0' }}>
        <label>
          <b>Area Manager:</b>
          <select
            value={selectedManager}
            onChange={e => setSelectedManager(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="">Select Area Manager</option>
            {areaManagers.map((am) => (
              <option key={am._id} value={am._id}>{am.name}</option>
            ))}
          </select>
        </label>
      </div>
      {editMode && (
        <>
          <div>
            <b>Assigned Locations:</b>
            <div style={{
              maxHeight: 200, overflowY: 'auto', border: '1px solid #ccc', padding: 10, marginTop: 8, borderRadius: 4
            }}>
              {locations.map(loc => (
                <label key={loc._id} style={{ display: 'block', margin: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={assignedLocations.includes(loc._id)}
                    onChange={() => toggleLocation(loc._id)}
                  />
                  {loc.name} <span style={{ color: '#888' }}>({loc.region})</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleSave} style={{ marginRight: 12 }}>Save</button>
            <button onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
};

export default CeoAddArea;
