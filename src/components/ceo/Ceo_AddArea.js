import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Ceo_AddArea = () => {
  const [areaManagers, setAreaManagers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const navigate = useNavigate();

  // Fetch area managers and locations
  useEffect(() => {
  fetch('http://localhost:5000/api/users/role/Area%20Manager')
    .then(res => res.json())
    .then(setAreaManagers);

  fetch('http://localhost:5000/api/locations')
    .then(res => res.json())
    .then(setLocations);
}, []);


  // When manager changes, load assigned locations
 useEffect(() => {
  if (selectedManager) {
    fetch(`http://localhost:5000/api/users/${selectedManager}/locations`)
      .then(res => res.json())
      .then(data => setAssignedLocations(data.map(l => l._id)));
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
  await fetch(`http://localhost:5000/api/users/${selectedManager}/locations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: assignedLocations }),
  });
  alert('Locations updated!');
  navigate('/ceo/dash');
};

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', background: '#fff', padding: 24, borderRadius: 12 }}>
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
            <button onClick={() => navigate('/ceo/dash')}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Ceo_AddArea;
