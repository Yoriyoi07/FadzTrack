import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Addproj.css';
import '../style/am_style/Area_Dash.css';
import Papa from 'papaparse';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';

// React Icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaProjectDiagram, FaClipboardList, FaChartBar } from 'react-icons/fa';

const AreaAddproj = () => {
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const [documents, setDocuments] = useState([]);
  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
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
  const [isPhotoDrag, setIsPhotoDrag] = useState(false);
  const [isDocDrag, setIsDocDrag] = useState(false);

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

  // Helpers formatting
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes)/Math.log(1024));
    return `${(bytes/Math.pow(1024,i)).toFixed( (i===0)?0:1 )} ${sizes[i]}`;
  };

  // Photo handlers
  const onPhotosSelected = useCallback(files => {
    if (!files) return;
    const list = Array.from(files); // basic validation could be added
    setPhotos(prev => [...prev, ...list]);
  },[]);
  const handlePhotoInput = (e) => {
    onPhotosSelected(e.target.files);
  };
  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_,i)=>i!==index));
  };
  const handlePhotoDragOver = (e) => { e.preventDefault(); setIsPhotoDrag(true); };
  const handlePhotoDragLeave = (e) => { e.preventDefault(); setIsPhotoDrag(false); };
  const handlePhotoDrop = (e) => { e.preventDefault(); setIsPhotoDrag(false); onPhotosSelected(e.dataTransfer.files); };

  // Document handlers
  const onDocsSelected = useCallback(files => {
    if (!files) return;
    const list = Array.from(files);
    setDocuments(prev => [...prev, ...list]);
  },[]);
  const handleDocInput = (e) => { onDocsSelected(e.target.files); };
  const handleRemoveDoc = (index) => { setDocuments(prev => prev.filter((_,i)=>i!==index)); };
  const handleDocDragOver = (e) => { e.preventDefault(); setIsDocDrag(true); };
  const handleDocDragLeave = (e) => { e.preventDefault(); setIsDocDrag(false); };
  const handleDocDrop = (e) => { e.preventDefault(); setIsDocDrag(false); onDocsSelected(e.dataTransfer.files); };

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
  // Required field validations
  if (!formData.projectName.trim()) { alert('Project name is required.'); return; }
  if (!formData.contractor.trim()) { alert('Contractor is required.'); return; }
  if (!formData.budget) { alert('Budget is required.'); return; }
  if (!formData.location) { alert('Location is required.'); return; }
  if (!formData.startDate || !formData.endDate) { alert('Please select both start and end dates.'); return; }
  if (!formData.projectmanager) { alert('Project Manager is required.'); return; }
  if (!formData.pic.length) { alert('At least one PIC must be assigned.'); return; }
  if (!formData.manpower.length) { alert('At least one manpower entry must be assigned.'); return; }
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

  // Collapse header on scroll (reuse dashboard behavior)
  useEffect(()=>{
    const onScroll = () => {
      const st = window.pageYOffset || document.documentElement.scrollTop;
      setIsHeaderCollapsed(st>50);
    };
    window.addEventListener('scroll', onScroll, { passive:true });
    return () => window.removeEventListener('scroll', onScroll);
  },[]);

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
      {/* Modern Unified Header (matching dashboard) */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="header-logo"
            />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile profile-menu-container" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'A'}</div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{userName}</span>
              <span className="profile-role">Area Manager</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn">
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/am" className="nav-item"><FaTachometerAlt /><span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span></Link>
            <Link to="/am/chat" className="nav-item"><FaComments /><span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span></Link>
            <Link to="/am/matreq" className="nav-item"><FaBoxes /><span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span></Link>
            <Link to="/am/manpower-requests" className="nav-item"><FaUsers /><span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span></Link>
            <Link to="/am/viewproj" className="nav-item"><FaProjectDiagram /><span className={isHeaderCollapsed ? 'hidden' : ''}>Projects</span></Link>
            <Link to="/logs" className="nav-item"><FaClipboardList /><span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span></Link>
            <Link to="/reports" className="nav-item"><FaChartBar /><span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span></Link>
          </nav>
          <NotificationBell />
        </div>
      </header>


      {/* Main Form */}
      <main className="area-addproj-main-content">
        <div className="area-addproj-form-container">
          <h2 className="area-addproj-page-title">Add New Project</h2>
          <form onSubmit={handleSubmit} className="area-addproj-project-form">

            {/* Project Details Card */}
            <div className="section-card meta-card">
              <div className="section-card-header"><h3>Project Details</h3><span className="section-hint">Core information</span></div>
              <div className="area-addproj-field-grid">
              <div className="area-addproj-form-group grid-span-2">
                <label htmlFor="projectName">Project Name</label>
                <input
                  type="text"
                  id="projectName"
                  name="projectName"
                  placeholder="Enter project name"
                  value={formData.projectName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="area-addproj-form-group">
                <label htmlFor="contractor">Contractor</label>
                <input
                  type="text"
                  id="contractor"
                  name="contractor"
                  placeholder="Enter contractor details"
                  value={formData.contractor}
                  onChange={handleChange}
                  required
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
                    <option key={user._id} value={user._id}>{user.name}</option>
                  ))}
                </select>
              </div>
              <div className="area-addproj-form-group">
                <label htmlFor="budget">Budget</label>
                <input
                  type="number"
                  id="budget"
                  name="budget"
                  placeholder="Enter Budget Details"
                  value={formData.budget}
                  onChange={handleChange}
                  required
                />
              </div>
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
                    <option key={loc._id} value={loc._id}>{loc.name} ({loc.region})</option>
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
            </div>

            {/* Assignment Panels (PIC / Staff / HR) */}
            <div className="section-card assignments-wrapper" role="group" aria-label="Assign PIC, Staff and HR">
              <div className="section-card-header"><h3>Team Roles</h3><span className="section-hint">Assign PIC / Staff / HR</span></div>
              <div className="assign-sections-grid">
              {/* PIC */}
              <section className="assign-card" aria-labelledby="pic-heading">
                <header className="assign-card-header">
                  <h4 id="pic-heading">PICs <span className="count-chip">{assignedPICs.length}</span></h4>
                  <span className="muted">Select & add</span>
                </header>
                <div className="assign-body">
                  <div className="search-row">
                    <input placeholder="Search PIC" value={searchPIC} onChange={e=>setSearchPIC(e.target.value)} />
                  </div>
                  <ul className="available-list" aria-label="Available PICs">
                    {filteredAvailablePICs.slice(0,30).map(u => (
                      <li key={u._id}>
                        <button type="button" onClick={()=>handleAssignPIC(u)} title="Add PIC">
                          <span className="avatar-sm">{u.name.charAt(0)}</span>
                          <span className="label-text">{u.name}</span>
                          <span className="plus">+</span>
                        </button>
                      </li>
                    ))}
                    {filteredAvailablePICs.length===0 && <li className="empty">No matches</li>}
                  </ul>
                  <div className="chips-row" aria-label="Assigned PICs">
                    {assignedPICs.length===0 && <span className="placeholder">None assigned</span>}
                    {assignedPICs.map(u => (
                      <span key={u._id} className="chip">
                        {u.name}
                        <button type="button" className="remove" onClick={()=>handleRemovePIC(u)} aria-label={`Remove ${u.name}`}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
              {/* Staff */}
              <section className="assign-card" aria-labelledby="staff-heading">
                <header className="assign-card-header">
                  <h4 id="staff-heading">Staff <span className="count-chip">{assignedStaff.length}</span></h4>
                  <span className="muted">Support roles</span>
                </header>
                <div className="assign-body">
                  <div className="search-row">
                    <input placeholder="Search Staff" value={searchStaff} onChange={e=>setSearchStaff(e.target.value)} />
                  </div>
                  <ul className="available-list" aria-label="Available Staff">
                    {filteredAvailableStaff.slice(0,30).map(u => (
                      <li key={u._id}>
                        <button type="button" onClick={()=>handleAssignStaff(u)}>
                          <span className="avatar-sm">{u.name.charAt(0)}</span>
                          <span className="label-text">{u.name}</span>
                          <span className="plus">+</span>
                        </button>
                      </li>
                    ))}
                    {filteredAvailableStaff.length===0 && <li className="empty">No matches</li>}
                  </ul>
                  <div className="chips-row" aria-label="Assigned Staff">
                    {assignedStaff.length===0 && <span className="placeholder">None assigned</span>}
                    {assignedStaff.map(u => (
                      <span key={u._id} className="chip">
                        {u.name}
                        <button type="button" className="remove" onClick={()=>handleRemoveStaff(u)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
              {/* HR */}
              <section className="assign-card" aria-labelledby="hr-heading">
                <header className="assign-card-header">
                  <h4 id="hr-heading">HR - Site <span className="count-chip">{assignedHR.length}</span></h4>
                  <span className="muted">Site HR</span>
                </header>
                <div className="assign-body">
                  <div className="search-row">
                    <input placeholder="Search HR - Site" value={searchHR} onChange={e=>setSearchHR(e.target.value)} />
                  </div>
                  <ul className="available-list" aria-label="Available HR">
                    {filteredAvailableHR.slice(0,30).map(u => (
                      <li key={u._id}>
                        <button type="button" onClick={()=>handleAssignHR(u)}>
                          <span className="avatar-sm">{u.name.charAt(0)}</span>
                          <span className="label-text">{u.name}</span>
                          <span className="plus">+</span>
                        </button>
                      </li>
                    ))}
                    {filteredAvailableHR.length===0 && <li className="empty">No matches</li>}
                  </ul>
                  <div className="chips-row" aria-label="Assigned HR">
                    {assignedHR.length===0 && <span className="placeholder">None assigned</span>}
                    {assignedHR.map(u => (
                      <span key={u._id} className="chip">
                        {u.name}
                        <button type="button" className="remove" onClick={()=>handleRemoveHR(u)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
              </div>{/* end inner grid */}
              {/* Summary Panel */}
              <aside className="summary-panel" aria-label="Selection Summary">
                <h4>Summary</h4>
                <ul className="summary-list">
                  <li><strong>PICs:</strong> {assignedPICs.length}</li>
                  <li><strong>Staff:</strong> {assignedStaff.length}</li>
                  <li><strong>HR:</strong> {assignedHR.length}</li>
                  <li><strong>Manpower:</strong> {assignedManpower.length}</li>
                </ul>
                <div className="summary-mini">
                  {[...assignedPICs, ...assignedStaff, ...assignedHR].slice(0,9).map(u => (
                    <span key={u._id} className="mini-avatar" title={u.name}>{u.name.charAt(0)}</span>
                  ))}
                  {assignedManpower.slice(0,6).map(m => (
                    <span key={m._id} className="mini-avatar alt" title={m.name}>{m.name.charAt(0)}</span>
                  ))}
                </div>
                <p className="summary-note">Review assigned people before submitting.</p>
              </aside>
            </div>


            {/* Manpower Section */}
            <section className="manpower-section section-card" aria-labelledby="manpower-heading">
              <header className="assign-card-header compact">
                <h4 id="manpower-heading">Manpower <span className="count-chip">{assignedManpower.length}</span></h4>
                <div className="manpower-tools">
                  <input
                    type="text"
                    placeholder="Search manpower by name or position"
                    value={searchManpower}
                    onChange={e=>setSearchManpower(e.target.value)}
                  />
                  <div className="csv-uploader">
                    <input id="csvUpload" type="file" accept=".csv" style={{display:'none'}} onChange={handleCSVUpload} />
                    <button type="button" onClick={()=>document.getElementById('csvUpload').click()} className="area-addproj-csv-upload-btn small">CSV</button>
                  </div>
                </div>
              </header>
              {csvError && <div className="area-addproj-manpower-error" style={{marginTop:4}}>{csvError}</div>}
              <div className="manpower-grid">
                <ul className="available-list tall" aria-label="Available Manpower">
                  {filteredAvailableManpower.slice(0,150).map(mp => (
                    <li key={mp._id}>
                      <button type="button" onClick={()=>handleAssignManpower(mp)}>
                        <span className="avatar-sm">{mp.name.charAt(0)}</span>
                        <span className="label-text">{mp.name} <em>{mp.position}</em></span>
                        <span className="plus">+</span>
                      </button>
                    </li>
                  ))}
                  {filteredAvailableManpower.length===0 && <li className="empty">No manpower found</li>}
                </ul>
                <div className="chips-column" aria-label="Assigned Manpower">
                  {assignedManpower.length===0 && <div className="placeholder">None assigned yet</div>}
                  <div className="chips-scroller">
                    {assignedManpower.map(mp => (
                      <span key={mp._id} className="chip large">
                        {mp.name} — {mp.position}
                        <button type="button" className="remove" onClick={()=>handleRemoveManpower(mp)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Media Upload Section */}
            <div className="section-card media-card">
              <div className="section-card-header"><h3>Assets</h3><span className="section-hint">Photos & Documents</span></div>
              <div className="upload-grid">
                <div className="uploader-block">
                  <h5>Project Photos</h5>
                  <div
                    className={`dropzone ${isPhotoDrag? 'drag' : ''}`}
                    onDragOver={handlePhotoDragOver}
                    onDragLeave={handlePhotoDragLeave}
                    onDrop={handlePhotoDrop}
                    onClick={()=>document.getElementById('photoInput').click()}
                  >
                    <input id="photoInput" type="file" accept="image/*" multiple style={{display:'none'}} onChange={handlePhotoInput} />
                    <p><strong>Click or Drag & Drop</strong> images here</p>
                    <span className="hint">PNG, JPG up to 5MB each</span>
                  </div>
                  {photos.length>0 && (
                    <div className="thumbs-grid">
                      {photos.map((file,i)=>(
                        <div key={i} className="thumb">
                          <img src={URL.createObjectURL(file)} alt={file.name} />
                          <button type="button" className="remove" onClick={()=>handleRemovePhoto(i)} aria-label="Remove photo">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="uploader-block">
                  <h5>Project Documents</h5>
                  <div
                    className={`dropzone ${isDocDrag? 'drag' : ''}`}
                    onDragOver={handleDocDragOver}
                    onDragLeave={handleDocDragLeave}
                    onDrop={handleDocDrop}
                    onClick={()=>document.getElementById('docInput').click()}
                  >
                    <input id="docInput" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" multiple style={{display:'none'}} onChange={handleDocInput} />
                    <p><strong>Click or Drag & Drop</strong> files here</p>
                    <span className="hint">Docs, Sheets, Slides, PDF, CSV, ZIP</span>
                  </div>
                  {documents.length>0 && (
                    <ul className="doc-list">
                      {documents.map((file,i)=>(
                        <li key={i} className="doc-item">
                          <span className="ext-pill">{(file.name.split('.').pop()||'').substring(0,4).toUpperCase()}</span>
                          <span className="doc-name" title={file.name}>{file.name}</span>
                          <span className="size">{formatBytes(file.size)}</span>
                          <button type="button" className="remove" onClick={()=>handleRemoveDoc(i)} aria-label="Remove document">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

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
