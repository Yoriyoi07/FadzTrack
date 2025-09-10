import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import '../style/am_style/Area_Addproj.css';
import '../style/am_style/Area_Dash.css';
import Papa from 'papaparse';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';

const AreaAddproj = () => {
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const [documents, setDocuments] = useState([]);
  const [budgetFiles, setBudgetFiles] = useState([]); // dedicated budget PDF(s)
  const [userName, setUserName] = useState(user?.name || 'ALECK');
  // Unified header: remove local profile menu/collapse state
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
  const [isBudgetDrag, setIsBudgetDrag] = useState(false); // drag state for budget PDFs
  const [showCsvHelp, setShowCsvHelp] = useState(false); // CSV guide modal

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
  // Formatted display value for budget (with commas) separate from raw budget in formData
  const [budgetDisplay, setBudgetDisplay] = useState('');

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

  // Clear-all helpers (ensure uniqueness when returning to available pools)
  const uniqueById = (arr) => {
    const m = new Map();
    arr.forEach(o => { if(o && o._id) m.set(o._id, o); });
    return Array.from(m.values());
  };
  const handleClearPICs = () => {
    if(!assignedPICs.length) return;
    setAvailablePICs(prev => uniqueById([...prev, ...assignedPICs]));
    setAssignedPICs([]);
    setFormData(prev => ({...prev, pic: []}));
  };
  const handleClearStaffAll = () => {
    if(!assignedStaff.length) return;
    setAvailableStaff(prev => uniqueById([...prev, ...assignedStaff]));
    setAssignedStaff([]);
    setFormData(prev => ({...prev, staff: []}));
  };
  const handleClearHRAll = () => {
    if(!assignedHR.length) return;
    setAvailableHR(prev => uniqueById([...prev, ...assignedHR]));
    setAssignedHR([]);
    setFormData(prev => ({...prev, hrsite: []}));
  };
  const handleClearManpowerAll = () => {
    if(!assignedManpower.length) return;
    setAvailableManpower(prev => uniqueById([...prev, ...assignedManpower]));
    setAssignedManpower([]);
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
    if(name === 'budget') return; // handled by handleBudgetChange
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Budget formatting handler (adds commas, keeps raw numeric in formData.budget)
  const handleBudgetChange = (e) => {
    let val = e.target.value || '';
    // Keep only digits and optional decimal point
    val = val.replace(/[^0-9.]/g,'');
    // If multiple decimals, keep first
    const parts = val.split('.');
    if(parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    const [intPartRaw, decPartRaw] = val.split('.');
  // Limit integer digits to 15 to prevent absurdly long numbers stretching perceived layout
  const intPartLimited = (intPartRaw || '').slice(0,15);
  const intPart = intPartLimited.replace(/^0+(\d)/,'$1');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const decPart = typeof decPartRaw === 'string' ? decPartRaw.slice(0,2) : undefined; // limit to 2 decimals
    const formatted = decPart !== undefined && decPart.length>0 ? `${withCommas}.${decPart}` : withCommas;
    setBudgetDisplay(formatted);
  const rawForState = decPart !== undefined && decPart.length>0 ? `${intPartLimited}.${decPart}` : intPartLimited;
  setFormData(prev => ({ ...prev, budget: rawForState })); // raw numeric (no commas)
  };
  // Initialize display when raw budget changes programmatically
  useEffect(()=>{
    if(formData.budget === ''){ setBudgetDisplay(''); return; }
    const parts = String(formData.budget).split('.');
    const intPart = parts[0] || '0';
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const dec = parts[1] ? '.'+parts[1] : '';
    const nextFormatted = withCommas + dec;
    if(nextFormatted !== budgetDisplay) setBudgetDisplay(nextFormatted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.budget]);

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

  // Budget PDF handlers (single style consistent with others but can take multiple; first parsed)
  const onBudgetSelected = useCallback(files => {
    if (!files) return;
    const list = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!list.length) return;
    setBudgetFiles(prev => {
      // Avoid duplicate names (same size) being added twice
      const existingKeys = new Set(prev.map(f => `${f.name}|${f.size}`));
      const merged = [...prev];
      list.forEach(f => {
        const key = `${f.name}|${f.size}`;
        if (!existingKeys.has(key)) merged.push(f);
      });
      return merged;
    });
  }, []);
  const handleBudgetInput = (e) => { onBudgetSelected(e.target.files); };
  const handleRemoveBudget = (index) => { setBudgetFiles(prev => prev.filter((_,i)=>i!==index)); };
  const handleBudgetDragOver = (e) => { e.preventDefault(); setIsBudgetDrag(true); };
  const handleBudgetDragLeave = (e) => { e.preventDefault(); setIsBudgetDrag(false); };
  const handleBudgetDrop = (e) => { e.preventDefault(); setIsBudgetDrag(false); onBudgetSelected(e.dataTransfer.files); };

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
      complete: async (results) => {
        const csvData = results.data;
        const errors = results.errors;

        if (errors.length > 0) {
          setCsvError(`CSV Upload Error: ${errors[0].message}`);
          return;
        }

        if (csvData.length === 0) {
          setCsvError('No data found in CSV file.');
          return;
        }
        // New behavior: QUICK ASSIGN existing manpower (no creation)
        const notFound = [];
        const duplicatesInCSV = [];
        const alreadyAssigned = [];
        const invalid = [];
        const matched = [];
        const seenKeys = new Set();

        // Build lookup map of available (unassigned) manpower by name|position (case-insensitive)
        const availableMap = new Map();
        availableManpower.forEach(mp => {
          const key = `${mp.name.trim().toLowerCase()}|${mp.position.trim().toLowerCase()}`;
            if(!availableMap.has(key)) availableMap.set(key, mp);
        });

        csvData.forEach((row, idx) => {
          const name = (row['Name'] || row['name'] || '').trim();
          const position = (row['Position'] || row['position'] || '').trim();
          if(!name || !position){
            invalid.push(`Row ${idx+1}`);
            return;
          }
          const key = `${name.toLowerCase()}|${position.toLowerCase()}`;
          if(seenKeys.has(key)){
            duplicatesInCSV.push(`Row ${idx+1}`);
            return;
          }
          seenKeys.add(key);
          // Already assigned in current selection?
          const already = assignedManpower.find(m => m.name.trim().toLowerCase() === name.toLowerCase() && m.position.trim().toLowerCase() === position.toLowerCase());
          if(already){
            alreadyAssigned.push(`${name} - ${position}`);
            return;
          }
          const found = availableMap.get(key);
          if(found){
            matched.push(found);
            // Remove from map so it can't match again (avoid duplicate assignment if CSV contains same)
            availableMap.delete(key);
          } else {
            notFound.push(`${name} - ${position}`);
          }
        });

        if(matched.length){
          setAssignedManpower(prev => [...prev, ...matched]);
          const matchedIds = new Set(matched.map(m=>m._id));
          setAvailableManpower(prev => prev.filter(m => !matchedIds.has(m._id)));
          toast.success(`Quick-assigned ${matched.length} manpower${notFound.length? ` (${notFound.length} not found)`:''}.`);
        } else {
          setCsvError('No matches found in CSV for existing unassigned manpower.');
        }

        // Detailed error summary (non-blocking if matches succeeded)
        const details = [];
        if(invalid.length) details.push(`Invalid rows: ${invalid.join(', ')}`);
        if(duplicatesInCSV.length) details.push(`Duplicate rows: ${duplicatesInCSV.join(', ')}`);
        if(alreadyAssigned.length) details.push(`Already selected: ${alreadyAssigned.slice(0,10).join('; ')}${alreadyAssigned.length>10?'…':''}`);
        if(notFound.length && matched.length) details.push(`Not found: ${notFound.slice(0,10).join('; ')}${notFound.length>10?'…':''}`);
        if(details.length) setCsvError(details.join(' | ')); else if(matched.length) setCsvError('');
      },
      error: (err) => {
        console.error('CSV Parsing Error:', err);
        setCsvError('Error parsing CSV file. Please ensure it is a valid CSV and try again.');
      }
    });
  };

  // Submit handler
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // guard double-click
  // Required field validations
  if (!formData.projectName.trim()) { toast.error('Project name is required.'); return; }
  if (!formData.contractor.trim()) { toast.error('Contractor is required.'); return; }
  if (!formData.budget) { toast.error('Budget is required.'); return; }
  if (!formData.location) { toast.error('Location is required.'); return; }
  if (!formData.startDate || !formData.endDate) { toast.error('Please select both start and end dates.'); return; }
  if (!formData.projectmanager) { toast.error('Project Manager is required.'); return; }
  if (!formData.pic.length) { toast.error('At least one PIC must be assigned.'); return; }
  if (!formData.manpower.length) { toast.error('At least one manpower entry must be assigned.'); return; }
  if (!budgetFiles.length) { toast.error('A Budget PDF is required.'); return; }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error("End date cannot be before start date.");
      return;
    }
    setSubmitting(true);
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
  budgetFiles.forEach(file => form.append('budgetPdf', file));

    try {
      const { data } = await api.post('/projects', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Redirect to newly created project detail with flash state; rely on server response _id
      if (data && data._id) {
        navigate(`/am/projects/${data._id}`, { state: { justCreated: true, projectName: data.projectName } });
      } else {
        navigate('/am');
      }
    } catch (error) {
      const result = error.response?.data;
      toast.error(result?.message || result?.error || 'Failed to add project');
      console.error('❌ Submission error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Unified header: logout handler for AppHeader
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Close CSV help with ESC
  useEffect(()=>{
    if(!showCsvHelp) return;
    const onKey = (e)=> { if(e.key==='Escape') setShowCsvHelp(false); };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  },[showCsvHelp]);

  return (
    <div>
      {/* Unified AppHeader for Area Manager */}
      <AppHeader roleSegment="am" onLogout={handleLogout} />

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
                  <div className="currency-field">
                    <span style={{fontSize:14,color:'#64748b',marginRight:4}}>₱</span>
                    <input
                      type="text"
                      id="budget"
                      name="budget"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={budgetDisplay}
                      onChange={handleBudgetChange}
                      style={{flex:1,border:'none',outline:'none',background:'transparent'}}
                      required
                    />
                  </div>
                  {/* Removed raw value helper per request */}
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
                  <h4 id="pic-heading">Person In Charge <span className="count-chip">{assignedPICs.length}</span></h4>
                  <div className="muted" style={{display:'flex',alignItems:'center',gap:8}}>
                    <span>Select & add</span>
                    {assignedPICs.length>0 && (
                      <button type="button" onClick={handleClearPICs} className="clear-btn" style={{background:'transparent',border:'1px solid #ccc',padding:'2px 6px',borderRadius:4,cursor:'pointer',fontSize:12}}>Clear All</button>
                    )}
                  </div>
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
                  <div className="muted" style={{display:'flex',alignItems:'center',gap:8}}>
                    <span>Support roles</span>
                    {assignedStaff.length>0 && (
                      <button type="button" onClick={handleClearStaffAll} className="clear-btn" style={{background:'transparent',border:'1px solid #ccc',padding:'2px 6px',borderRadius:4,cursor:'pointer',fontSize:12}}>Clear All</button>
                    )}
                  </div>
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
                  <div className="muted" style={{display:'flex',alignItems:'center',gap:8}}>
                    <span>Site HR</span>
                    {assignedHR.length>0 && (
                      <button type="button" onClick={handleClearHRAll} className="clear-btn" style={{background:'transparent',border:'1px solid #ccc',padding:'2px 6px',borderRadius:4,cursor:'pointer',fontSize:12}}>Clear All</button>
                    )}
                  </div>
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
                  {assignedManpower.length>0 && (
                    <button type="button" onClick={handleClearManpowerAll} className="clear-btn" style={{marginLeft:6,background:'transparent',border:'1px solid #ccc',padding:'4px 8px',borderRadius:4,cursor:'pointer',fontSize:12}}>Clear All</button>
                  )}
                  <div className="csv-uploader">
                    <input id="csvUpload" type="file" accept=".csv" style={{display:'none'}} onChange={handleCSVUpload} />
                    <button type="button" onClick={()=>document.getElementById('csvUpload').click()} className="area-addproj-csv-upload-btn small">CSV</button>
                    <button
                      type="button"
                      onClick={()=> setShowCsvHelp(true)}
                      className="area-addproj-csv-upload-btn small"
                      style={{ marginLeft: '5px', backgroundColor: '#17a2b8', borderColor: '#17a2b8', position:'relative' }}
                      title="CSV Format Guide"
                    >?
                    </button>
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
                <div className="uploader-block">
                  <h5>Budget PDF(s)</h5>
                  <div
                    className={`dropzone ${isBudgetDrag? 'drag' : ''}`}
                    onDragOver={handleBudgetDragOver}
                    onDragLeave={handleBudgetDragLeave}
                    onDrop={handleBudgetDrop}
                    onClick={()=>document.getElementById('budgetPdfInput').click()}
                  >
                    <input
                      id="budgetPdfInput"
                      type="file"
                      accept="application/pdf"
                      multiple
                      style={{display:'none'}}
                      onChange={handleBudgetInput}
                    />
                    <p><strong>Click or Drag & Drop</strong> budget PDFs here</p>
                    <span className="hint">PDF only • First file parsed for auto budget deduction</span>
                  </div>
                  {budgetFiles.length>0 && (
                    <ul className="doc-list">
                      {budgetFiles.map((file,i)=>(
                        <li key={file.name + i} className="doc-item">
                          <span className="ext-pill">PDF</span>
                          <span className="doc-name" title={file.name}>{file.name}</span>
                          <span className="size">{formatBytes(file.size)}</span>
                          <button type="button" className="remove" onClick={()=>handleRemoveBudget(i)} aria-label="Remove budget PDF">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <small style={{display:'block',marginTop:4}}>{budgetFiles.length || 0} budget PDF{budgetFiles.length===1?'':'s'} selected</small>
                </div>
              </div>
            </div>

            <div className="area-addproj-form-row area-addproj-submit-row">
              <button type="submit" className="area-addproj-submit-button" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Add Project'}
              </button>
            </div>
          </form>
        </div>
      </main>
      {showCsvHelp && (
        <div className="aa-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="csv-help-title">
          <div className="aa-modal" role="document">
            <div className="aa-modal-header">
              <h3 id="csv-help-title">CSV Quick Assign Format</h3>
            </div>
            <div className="aa-modal-body">
              <p>This will <strong>MATCH</strong> existing unassigned manpower already in the system and add them to this project. It will <strong>NOT</strong> create new manpower.</p>
              <p style={{marginTop:12,marginBottom:4,fontWeight:600,fontSize:13}}>Required columns (case-insensitive):</p>
              <ul style={{marginTop:0,marginLeft:18,fontSize:13}}>
                <li>Name</li>
                <li>Position</li>
              </ul>
              <p style={{marginTop:12,marginBottom:4,fontWeight:600,fontSize:13}}>Rules:</p>
              <ul style={{marginTop:0,marginLeft:18,fontSize:13,lineHeight:1.4}}>
                <li>Each (Name, Position) pair must exactly match an existing <em>unassigned</em> manpower record.</li>
                <li>Duplicates inside the CSV are ignored (first wins).</li>
                <li>Rows with missing name or position are skipped.</li>
                <li>Extra columns are ignored.</li>
              </ul>
              <p style={{marginTop:14,marginBottom:4,fontWeight:600,fontSize:13}}>Example:</p>
<pre style={{background:'#0f172a',color:'#f1f5f9',padding:'10px 12px',borderRadius:8,fontSize:12,overflowX:'auto'}}>Name,Position
John Doe,Engineer
Jane Smith,Manager
Mike Johnson,Technician</pre>
            </div>
            <div className="aa-modal-footer">
              <button type="button" onClick={()=> setShowCsvHelp(false)} className="aa-btn-primary" autoFocus>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AreaAddproj;
