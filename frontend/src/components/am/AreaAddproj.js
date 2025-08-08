import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Addproj.css';
import Papa from 'papaparse';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';

const AreaAddproj = () => {
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const [documents, setDocuments] = useState([]);
  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [eligiblePMs, setEligiblePMs] = useState([]);

  // For PIC/Staff/HR panels
  const [picUsers, setPicUsers] = useState([]);
  const [availablePICs, setAvailablePICs] = useState([]);
  const [assignedPICs, setAssignedPICs] = useState([]);
  const [searchPIC, setSearchPIC] = useState('');

  const [staffUsers, setStaffUsers] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [assignedStaff, setAssignedStaff] = useState([]);
  const [searchStaff, setSearchStaff] = useState('');

  const [hrSiteUsers, setHrSiteUsers] = useState([]);
  const [availableHR, setAvailableHR] = useState([]);
  const [assignedHR, setAssignedHR] = useState([]);
  const [searchHR, setSearchHR] = useState('');

  const [assignedLocations, setAssignedLocations] = useState([]);
  const [manpowerList, setManpowerList] = useState([]);
  const [searchManpower, setSearchManpower] = useState('');
  const [availableManpower, setAvailableManpower] = useState([]);
  const [assignedManpower, setAssignedManpower] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [photos, setPhotos] = useState([]);

  const [formData, setFormData] = useState({
    projectName: '',
    pic: [],
    staff: [],
    hrsite: [],
    contractor: '',
    budget: '',
    location: '',
    startDate: '',
    endDate: '',
    manpower: [],
    projectmanager: '',
    areamanager: userId || ''
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      areamanager: userId || ''
    }));
  }, [userId]);

  // Fetch eligible PMs, available PIC/Staff/HR, manpower
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // PMs (change endpoint if you have a dedicated one for PMs)
        const pmRes = await api.get('/users/unassigned-pms');
        setEligiblePMs(Array.isArray(pmRes.data) ? pmRes.data : pmRes.data.data || []);
        // PIC
        const picRes = await api.get('/projects/unassigned-pics');
        setPicUsers(picRes.data || []);
        setAvailablePICs(picRes.data || []);
        // Staff
        const staffRes = await api.get('/projects/unassigned-staff');
        setStaffUsers(staffRes.data || []);
        setAvailableStaff(staffRes.data || []);
        // HR Site
        const hrRes = await api.get('/projects/unassigned-hrsite');
        setHrSiteUsers(hrRes.data || []);
        setAvailableHR(hrRes.data || []);
        // Manpower
        const manpowerRes = await api.get('/manpower/unassigned');
        setManpowerList(manpowerRes.data);
        setAvailableManpower(manpowerRes.data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  // Assign logic (PIC)
  const filteredAvailablePICs = availablePICs.filter(u =>
    !assignedPICs.some(a => a._id === u._id) &&
    u.name.toLowerCase().includes(searchPIC.toLowerCase())
  );
  const handleAssignPIC = (user) => {
    if (!assignedPICs.some(u => u._id === user._id)) {
      setAssignedPICs(prev => [...prev, user]);
      setAvailablePICs(prev => prev.filter(u => u._id !== user._id));
      setFormData(prev => ({
        ...prev,
        pic: [...prev.pic, user._id]
      }));
    }
  };
  const handleRemovePIC = (user) => {
    setAvailablePICs(prev => [...prev, user]);
    setAssignedPICs(prev => prev.filter(u => u._id !== user._id));
    setFormData(prev => ({
      ...prev,
      pic: prev.pic.filter(id => id !== user._id)
    }));
  };

  // Assign logic (Staff)
  const filteredAvailableStaff = availableStaff.filter(u =>
    !assignedStaff.some(a => a._id === u._id) &&
    u.name.toLowerCase().includes(searchStaff.toLowerCase())
  );
  const handleAssignStaff = (user) => {
    if (!assignedStaff.some(u => u._id === user._id)) {
      setAssignedStaff(prev => [...prev, user]);
      setAvailableStaff(prev => prev.filter(u => u._id !== user._id));
      setFormData(prev => ({
        ...prev,
        staff: [...(prev.staff || []), user._id]
      }));
    }
  };
  const handleRemoveStaff = (user) => {
    setAvailableStaff(prev => [...prev, user]);
    setAssignedStaff(prev => prev.filter(u => u._id !== user._id));
    setFormData(prev => ({
      ...prev,
      staff: (prev.staff || []).filter(id => id !== user._id)
    }));
  };

  // Assign logic (HR)
  const filteredAvailableHR = availableHR.filter(u =>
    !assignedHR.some(a => a._id === u._id) &&
    u.name.toLowerCase().includes(searchHR.toLowerCase())
  );
  const handleAssignHR = (user) => {
    if (!assignedHR.some(u => u._id === user._id)) {
      setAssignedHR(prev => [...prev, user]);
      setAvailableHR(prev => prev.filter(u => u._id !== user._id));
      setFormData(prev => ({
        ...prev,
        hrsite: [...(prev.hrsite || []), user._id]
      }));
    }
  };
  const handleRemoveHR = (user) => {
    setAvailableHR(prev => [...prev, user]);
    setAssignedHR(prev => prev.filter(u => u._id !== user._id));
    setFormData(prev => ({
      ...prev,
      hrsite: (prev.hrsite || []).filter(id => id !== user._id)
    }));
  };

  // Fetch locations (if needed)
  useEffect(() => {
    if (userId) {
      api.get(`/users/${userId}/locations`)
        .then(res => setAssignedLocations(res.data))
        .catch(() => setAssignedLocations([]));
    }
  }, [userId]);

  // Keep manpower in formData in sync
  useEffect(() => {
    setFormData(prev => ({ ...prev, manpower: assignedManpower.map(m => m._id) }));
  }, [assignedManpower]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Manpower assign
  const filteredAvailableManpower = availableManpower.filter(mp =>
    !assignedManpower.some(assignedMp => assignedMp._id === mp._id) &&
    (mp.name.toLowerCase().includes(searchManpower.toLowerCase()) ||
      mp.position.toLowerCase().includes(searchManpower.toLowerCase()))
  );
  const handleAssignManpower = (mp) => {
    if (!assignedManpower.some(m => m._id === mp._id)) {
      setAssignedManpower(prev => [...prev, mp]);
      setAvailableManpower(prev => prev.filter(m => m._id !== mp._id));
    }
  };
  const handleRemoveManpower = (mp) => {
    setAvailableManpower(prev => [...prev, mp]);
    setAssignedManpower(prev => prev.filter(m => m._id !== mp._id));
  };

  // CSV upload for manpower
  const handleCSVUpload = (e) => {
    setCsvError('');
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const csvData = results.data;
        let notFound = [];
        let foundList = [];
        csvData.forEach(row => {
          const found = availableManpower.find(mp =>
            mp.name.trim().toLowerCase() === (row.name || '').trim().toLowerCase() &&
            mp.position.trim().toLowerCase() === (row.position || '').trim().toLowerCase()
          );
          if (found) foundList.push(found);
          else notFound.push(`${row.name || ''} (${row.position || ''})`);
        });
        if (notFound.length) setCsvError('Not found: ' + notFound.join(', '));
        setAssignedManpower(prev => [...prev, ...foundList]);
        setAvailableManpower(prev => prev.filter(mp => !foundList.some(f => f._id === mp._id)));
      },
      error: () => setCsvError('Invalid CSV format'),
    });
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!formData.projectmanager || !formData.pic.length || !formData.manpower.length) {
      alert('Please ensure all required fields are selected.');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      alert("End date cannot be before start date.");
      return;
    }
    const stored = localStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    const userId = user?._id;

    const form = new FormData();
    Object.entries({ ...formData, areamanager: userId }).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => form.append(key, v));
      } else {
        form.append(key, value);
      }
    });
    photos.forEach(file => form.append('photos', file));
    documents.forEach(file => form.append('documents', file));

    try {
      await api.post('/projects', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('✅ Project added successfully!');
      setFormData({
        projectName: '',
        pic: [],
        staff: [],
        hrsite: [],
        contractor: '',
        budget: '',
        location: '',
        startDate: '',
        endDate: '',
        manpower: '',
        projectmanager: '',
        areamanager: userId || ''
      });
      setAssignedPICs([]); setAvailablePICs(picUsers);
      setAssignedStaff([]); setAvailableStaff(staffUsers);
      setAssignedHR([]); setAvailableHR(hrSiteUsers);
      setAssignedManpower([]); setAvailableManpower(manpowerList);
      setPhotos([]);
      navigate('/am');
    } catch (error) {
      const result = error.response?.data;
      alert(`❌ Error: ${result?.message || result?.error || 'Failed to add project'}`);
      console.error('❌ Submission error:', error);
    }
  };

  // Logout
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) setProfileMenuOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/chat" className="nav-link">Chat</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName ? userName.charAt(0).toUpperCase() : 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Main Form */}
      <main className="area-addproj-main-content">
        <div className="area-addproj-form-container">
          <h2 className="area-addproj-page-title">Add New Project</h2>
          <form onSubmit={handleSubmit} className="area-addproj-project-form">

            <div className="area-addproj-form-row">
              <div className="area-addproj-form-group">
                <label htmlFor="projectName">Project Name</label>
                <input
                  type="text"
                  id="projectName"
                  name="projectName"
                  placeholder="Enter project name"
                  value={formData.projectName}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* PIC, Staff, HR Panels */}
            <div className="area-addproj-form-row area-addproj-triple-columns">
              {/* PIC */}
              <div className="area-addproj-manpower-box">
                <label>Available PICs</label>
                <input
                  type="text"
                  placeholder="Search PIC"
                  value={searchPIC}
                  onChange={e => setSearchPIC(e.target.value)}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <select
                  multiple
                  size={6}
                  style={{ width: '100%', height: '120px' }}
                  onDoubleClick={e => {
                    const selectedId = e.target.value;
                    const selected = availablePICs.find(u => u._id === selectedId);
                    if (selected) handleAssignPIC(selected);
                  }}
                >
                  {filteredAvailablePICs.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
                <div className="area-addproj-manpower-help">Double click to assign</div>
                <label>Assigned PICs</label>
                <select
                  multiple
                  size={6}
                  style={{ width: '100%', height: '120px' }}
                  onDoubleClick={e => {
                    const selectedId = e.target.value;
                    const selected = assignedPICs.find(u => u._id === selectedId);
                    if (selected) handleRemovePIC(selected);
                  }}
                  value={assignedPICs.map(u => u._id)}
                >
                  {assignedPICs.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {/* Staff */}
              <div className="area-addproj-manpower-box">
                <label>Available Staff</label>
                <input
                  type="text"
                  placeholder="Search Staff"
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <select
                  multiple
                  size={6}
                  style={{ width: '100%', height: '120px' }}
                  onDoubleClick={e => {
                    const selectedId = e.target.value;
                    const selected = availableStaff.find(u => u._id === selectedId);
                    if (selected) handleAssignStaff(selected);
                  }}
                >
                  {filteredAvailableStaff.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
                <div className="area-addproj-manpower-help">Double click to assign</div>
                <label>Assigned Staff</label>
                <select
                  multiple
                  size={6}
                  style={{ width: '100%', height: '120px' }}
                  onDoubleClick={e => {
                    const selectedId = e.target.value;
                    const selected = assignedStaff.find(u => u._id === selectedId);
                    if (selected) handleRemoveStaff(selected);
                  }}
                  value={assignedStaff.map(u => u._id)}
                >
                  {assignedStaff.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {/* HR Site */}
              <div className="area-addproj-manpower-box">
                <label>Available HR - Site</label>
                <input
                  type="text"
                  placeholder="Search HR - Site"
                  value={searchHR}
                  onChange={e => setSearchHR(e.target.value)}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <select
                  multiple
                  size={6}
                  style={{ width: '100%', height: '120px' }}
                  onDoubleClick={e => {
                    const selectedId = e.target.value;
                    const selected = availableHR.find(u => u._id === selectedId);
                    if (selected) handleAssignHR(selected);
                  }}
                >
                  {filteredAvailableHR.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
                <div className="area-addproj-manpower-help">Double click to assign</div>
                <label>Assigned HR - Site</label>
                <select
                  multiple
                  size={6}
                  style={{ width: '100%', height: '120px' }}
                  onDoubleClick={e => {
                    const selectedId = e.target.value;
                    const selected = assignedHR.find(u => u._id === selectedId);
                    if (selected) handleRemoveHR(selected);
                  }}
                  value={assignedHR.map(u => u._id)}
                >
                  {assignedHR.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="area-addproj-form-row">
              <div className="area-addproj-form-group">
                <label htmlFor="contractor">Contractor</label>
                <input
                  type="text"
                  id="contractor"
                  name="contractor"
                  placeholder="Enter contractor details"
                  value={formData.contractor}
                  onChange={handleChange}
                />
              </div>
              <div className="area-addproj-form-group">
                <label htmlFor="projectmanager">Project Manager</label>
                <select
                  id="projectmanager"
                  name="projectmanager"
                  value={formData.projectmanager}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select Project Manager --</option>
                  {eligiblePMs.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="area-addproj-form-group">
                <label htmlFor="Budget">Budget</label>
                <input
                  type="number"
                  id="budget"
                  name="budget"
                  placeholder="Enter Budget Details"
                  value={formData.budget}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="area-addproj-form-row">
              <div className="area-addproj-form-group">
                <label htmlFor="location">Location</label>
                <select
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select Location --</option>
                  {assignedLocations.map(loc => (
                    <option key={loc._id} value={loc._id}>
                      {loc.name} ({loc.region})
                    </option>
                  ))}
                </select>
              </div>
              <div className="area-addproj-form-group">
                <label htmlFor="startDate">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="area-addproj-form-group">
                <label htmlFor="endDate">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  required
                  min={formData.startDate}
                />
              </div>
            </div>

            {/* Manpower/CSV Upload Section */}
            <div className="area-addproj-form-row area-addproj-single-column">
              <div className="area-addproj-manpower-panels">
                <div className="area-addproj-manpower-box">
                  <label>Available Manpower</label>
                  <input
                    type="text"
                    placeholder="Search manpower"
                    value={searchManpower}
                    onChange={e => setSearchManpower(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                  <select
                    multiple
                    size={10}
                    style={{ width: '100%', height: '200px' }}
                    onDoubleClick={e => {
                      const selectedId = e.target.value;
                      const mp = availableManpower.find(m => m._id === selectedId);
                      if (mp) handleAssignManpower(mp);
                    }}
                  >
                    {filteredAvailableManpower.map(mp => (
                      <option key={mp._id} value={mp._id}>
                        {mp.name} — {mp.position}
                      </option>
                    ))}
                  </select>
                  <div className="area-addproj-manpower-help">Double click to assign</div>
                </div>
                <div className="area-addproj-manpower-box">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ marginRight: 8 }}>Assigned Manpower</label>
                    <input
                      type="file"
                      accept=".csv"
                      id="csvUpload"
                      style={{ display: 'none' }}
                      onChange={handleCSVUpload}
                    />
                    <button
                      type="button"
                      className="area-addproj-csv-upload-btn"
                      onClick={() => document.getElementById('csvUpload').click()}
                      style={{ marginLeft: 8 }}
                    >
                      Upload CSV
                    </button>
                  </div>
                  {csvError && <div className="area-addproj-manpower-error">{csvError}</div>}
                  <select
                    multiple
                    size={10}
                    style={{ width: '100%', height: '200px' }}
                    onDoubleClick={e => {
                      const selectedId = e.target.value;
                      const mp = assignedManpower.find(m => m._id === selectedId);
                      if (mp) handleRemoveManpower(mp);
                    }}
                  >
                    {assignedManpower.map(mp => (
                      <option key={mp._id} value={mp._id}>
                        {mp.name} — {mp.position}
                      </option>
                    ))}
                  </select>
                  <div className="area-addproj-manpower-help">Double click to remove</div>
                </div>
              </div>
            </div>

            <div className="area-addproj-form-group">
              <label htmlFor="photos">Project Photos</label>
              <input
                type="file"
                id="photos"
                name="photos"
                multiple
                accept="image/*"
                onChange={e => setPhotos(Array.from(e.target.files))}
              />
            </div>

            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 10, margin: '10px 0' }}>
                {photos.map((file, i) => (
                  <img
                    key={i}
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                  />
                ))}
              </div>
            )}

            <div className="area-addproj-form-group">
              <label htmlFor="documents">Project Documents</label>
              <input
                type="file"
                id="documents"
                name="documents"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                onChange={e => setDocuments(Array.from(e.target.files))}
              />
              <small style={{ color: '#888' }}>You may upload PDF, DOCX, Excel, PowerPoint, text, CSV, or ZIP files.</small>
            </div>

            {documents.length > 0 && (
              <ul style={{ margin: '10px 0', color: '#444', fontSize: 13 }}>
                {documents.map((file, i) => (
                  <li key={i}>{file.name}</li>
                ))}
              </ul>
            )}

            <div className="area-addproj-form-row area-addproj-submit-row">
              <button type="submit" className="area-addproj-submit-button">Add Project</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AreaAddproj;
