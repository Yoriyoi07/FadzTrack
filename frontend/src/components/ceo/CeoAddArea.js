import React, { useEffect, useState, useMemo } from 'react';
import api from '../../api/axiosInstance';
import { FaSearch, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

// CEO Add Area / Assign Locations modal
// Modernized UI: search, select all, clear, counts, sticky footer
const CeoAddArea = ({ onSuccess, onCancel }) => {
  const [areaManagers, setAreaManagers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [originalAssigned, setOriginalAssigned] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Fetch managers & locations
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [mgrRes, locRes] = await Promise.all([
          api.get('/users/role/Area%20Manager'),
          api.get('/locations')
        ]);
        if(!active) return;
        setAreaManagers(Array.isArray(mgrRes.data)?mgrRes.data:[]);
        setLocations(Array.isArray(locRes.data)?locRes.data:[]);
      } catch (e) { if(active) setError('Failed to load data'); }
      finally { if(active){ setLoadingManagers(false); setLoadingLocations(false);} }
    })();
    return ()=> { active=false; };
  }, []);

  // Fetch assigned locations when manager changes
  useEffect(() => {
    if(!selectedManager){ setAssignedLocations([]); setOriginalAssigned([]); return; }
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/users/${selectedManager}/locations`);
        if(!active) return;
        const ids = Array.isArray(data)? data.map(l=> l._id) : [];
        setAssignedLocations(ids);
        setOriginalAssigned(ids);
      } catch (e) { if(active) setError('Failed to load assigned locations'); }
    })();
    return ()=> { active=false; };
  }, [selectedManager]);

  const toggleLocation = (locId) => {
    setAssignedLocations(prev => prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]);
  };

  const allVisibleIds = useMemo(() => {
    return locations
      .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.region.toLowerCase().includes(search.toLowerCase()))
      .map(l => l._id);
  }, [locations, search]);

  const allSelectedVisible = allVisibleIds.length>0 && allVisibleIds.every(id => assignedLocations.includes(id));
  const partiallySelected = !allSelectedVisible && allVisibleIds.some(id => assignedLocations.includes(id));

  const handleSelectAllVisible = () => {
    if(allSelectedVisible){
      // unselect all visible
      setAssignedLocations(prev => prev.filter(id => !allVisibleIds.includes(id)));
    } else {
      setAssignedLocations(prev => Array.from(new Set([...prev, ...allVisibleIds])));
    }
  };

  const isDirty = useMemo(() => {
    if(assignedLocations.length !== originalAssigned.length) return true;
    const setOrig = new Set(originalAssigned);
    return assignedLocations.some(id => !setOrig.has(id));
  }, [assignedLocations, originalAssigned]);

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => !search || loc.name.toLowerCase().includes(search.toLowerCase()) || loc.region.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b)=> a.name.localeCompare(b.name));
  }, [locations, search]);

  const handleSave = async () => {
    if(!selectedManager) return;
    setSaving(true); setError('');
    try {
      await api.put(`/users/${selectedManager}/locations`, { locations: assignedLocations });
      setOriginalAssigned(assignedLocations);
      if(onSuccess) onSuccess();
    } catch (e) {
      setError('Failed to save locations');
    } finally { setSaving(false); }
  };

  return (
    <div className="ceo-modal-card">
      <div className="modal-header-inline">
        <h2>Assign Locations</h2>
        <button className="btn-text" onClick={onCancel}>✕</button>
      </div>
      <div className="form-row">
        <label className="form-label" htmlFor="managerSelect">Area Manager</label>
        <select id="managerSelect" className="input select w-full" value={selectedManager} onChange={e=> setSelectedManager(e.target.value)} disabled={loadingManagers || saving}>
          <option value="">Select Area Manager...</option>
          {areaManagers.map(am => <option key={am._id} value={am._id}>{am.name}</option>)}
        </select>
      </div>
      {selectedManager && (
        <>
          <div className="locations-toolbar">
            <div className="search-box">
              <FaSearch />
              <input
                type="text"
                placeholder="Search locations..."
                value={search}
                onChange={e=> setSearch(e.target.value)}
              />
            </div>
            <div className="toolbar-actions">
              <button className="btn-chip" onClick={handleSelectAllVisible} disabled={!allVisibleIds.length}>
                {allSelectedVisible ? 'Unselect Visible' : partiallySelected ? 'Select Remaining' : 'Select Visible'}
              </button>
              <button className="btn-chip" onClick={()=> setAssignedLocations([])} disabled={!assignedLocations.length}>Clear All</button>
            </div>
          </div>
          <div className="locations-meta">
            <span className="count">{assignedLocations.length} selected</span>
            <span className="divider" />
            <span className="count subtle">{filteredLocations.length} shown</span>
          </div>
          <div className="location-list" role="group" aria-label="Locations multi select">
            {loadingLocations ? (
              <div className="loading-row">Loading locations...</div>
            ) : filteredLocations.length === 0 ? (
              <div className="empty-row">No locations match your search.</div>
            ) : filteredLocations.map(loc => {
              const checked = assignedLocations.includes(loc._id);
              return (
                <label key={loc._id} className={`location-item ${checked ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={()=> toggleLocation(loc._id)}
                  />
                  <span className="loc-name">{loc.name}</span>
                  <span className="loc-region">{loc.region}</span>
                  {checked ? <FaCheckCircle className="state-icon ok" /> : <FaTimesCircle className="state-icon muted" />}
                </label>
              );
            })}
          </div>
        </>
      )}
      {error && <div className="error-banner">{error}</div>}
      <div className="sticky-actions">
        <button className="btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={!selectedManager || saving || !isDirty}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default CeoAddArea;
