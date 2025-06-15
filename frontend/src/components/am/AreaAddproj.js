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
    const [userName, setUserName] = useState(user?.name || 'ALECK');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [eligiblePMs, setEligiblePMs] = useState([]);
  const [pics, setPics] = useState([]);
  const [availablePics, setAvailablePics] = useState([]);
  const [assignedPics, setAssignedPics] = useState([]);
  const [searchPIC, setSearchPIC] = useState(''); // <--- NEW
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [manpowerList, setManpowerList] = useState([]);
  const [searchManpower, setSearchManpower] = useState('');
  const [availableManpower, setAvailableManpower] = useState([]);
  const [assignedManpower, setAssignedManpower] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [photos, setPhotos] = useState([]);

  console.log('Assigned Pics:', assignedPics);
console.log('Available Pics:', availablePics);
  console.log('Assigned Pics:', manpowerList);
  console.log('Available Manpower:', availableManpower);
  console.log('Assigned Locations:', assignedLocations);
  console.log('Assigned Manpower:', assignedManpower);
  console.log('Eligible PMs:', eligiblePMs);


  const [formData, setFormData] = useState({
    projectName: '',
    pic: [],
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

  useEffect(() => {
  console.log('Assigned Locations:', assignedLocations);
}, [assignedLocations]);

  useEffect(() => {
  const fetchUsers = async () => {
    try {
      const pmRes = await api.get('/users/unassigned-pms'); // Fetch eligible PMs
      setEligiblePMs(Array.isArray(pmRes.data) ? pmRes.data : pmRes.data.data || []);
      
      const picRes = await api.get('/users/unassigned-pics'); // Fetch available PICs
      setPics(Array.isArray(picRes.data) ? picRes.data : picRes.data.data || []);
      setAvailablePics(Array.isArray(picRes.data) ? picRes.data : picRes.data.data || []);
      
      const manpowerRes = await api.get('/manpower/unassigned'); // Fetch unassigned manpower
      setManpowerList(manpowerRes.data); 
      setAvailableManpower(manpowerRes.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };
  fetchUsers();
}, []);



  // --- SEARCH LOGIC FOR PIC ---
 const filteredAvailablePics = availablePics.filter(pic =>
  !assignedPics.some(assignedPic => assignedPic._id === pic._id) &&
  pic.name.toLowerCase().includes(searchPIC.toLowerCase())
);


 const handleAssignPic = (pic) => {
  // Ensure the PIC is not already assigned
  if (!assignedPics.some(p => p._id === pic._id)) {
    setAssignedPics(prev => [...prev, pic]);
    setAvailablePics(prev => prev.filter(p => p._id !== pic._id));
    setFormData(prev => ({
      ...prev,
      pic: [...prev.pic, pic._id]
    }));
  }
};

  const handleRemovePic = (pic) => {
    setAvailablePics(prev => [...prev, pic]);
    setAssignedPics(prev => prev.filter(p => p._id !== pic._id));
    setFormData(prev => ({
      ...prev,
      pic: prev.pic.filter(id => id !== pic._id)
    }));
  };

  useEffect(() => {
    api.get('/manpower/unassigned')
      .then(res => {
        setManpowerList(res.data);
        setAvailableManpower(res.data);
      })
      .catch(err => console.error('Failed to fetch manpower:', err));
  }, []);

useEffect(() => {
  if (userId) {
    api.get(`/users/${userId}/locations`)
      .then(res => {
        console.log('Fetched locations:', res.data);
        setAssignedLocations(res.data);
      })
      .catch(err => {
        console.error('Failed to fetch assigned locations:', err);
        setAssignedLocations([]);
      });
  }
}, [userId]);



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

 const handleAssignManpower = (mp) => {
  // Ensure the manpower is not already assigned
  if (!assignedManpower.some(m => m._id === mp._id)) {
    setAssignedManpower(prev => [...prev, mp]);
    setAvailableManpower(prev => prev.filter(m => m._id !== mp._id));
  }
};

  const handleRemoveManpower = (mp) => {
    setAvailableManpower(prev => [...prev, mp]);
    setAssignedManpower(prev => prev.filter(m => m._id !== mp._id));
  };

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

  const filteredAvailableManpower = availableManpower.filter(mp =>
  !assignedManpower.some(assignedMp => assignedMp._id === mp._id) &&
  (mp.name.toLowerCase().includes(searchManpower.toLowerCase()) ||
  mp.position.toLowerCase().includes(searchManpower.toLowerCase()))
);


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
    photos.forEach(file => {
      form.append('photos', file);
    });

    try {
      await api.post('/projects', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('✅ Project added successfully!');
      setFormData({
        projectName: '',
        pic: [],
        contractor: '',
        budget: '',
        location: '',
        startDate: '',
        endDate: '',
        manpower: '',
        projectmanager: '',
        areamanager: userId || ''
      });
      setAssignedPics([]);
      setAvailablePics(pics);
      setAssignedManpower([]);
      setAvailableManpower(manpowerList);
      setPhotos([]);
      navigate('/am');
    } catch (error) {
      const result = error.response?.data;
      alert(`❌ Error: ${result?.message || result?.error || 'Failed to add project'}`);
      console.error('❌ Submission error:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div>
      {/* Header remains the same */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
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
              {/* --- PIC selection like Manpower, now with SEARCH --- */}
              <div className="area-addproj-form-group">
                <div className="area-addproj-manpower-panels">
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
                        const selected = availablePics.find(p => p._id === selectedId);
                        if (selected) handleAssignPic(selected);
                      }}
                    >
                      {filteredAvailablePics.map(pic => (
                        <option key={pic._id} value={pic._id}>
                          {pic.name}
                        </option>
                      ))}
                    </select>
                    <div className="area-addproj-manpower-help">Double click to assign</div>
                  </div>
                  <div className="area-addproj-manpower-box">
                    <label>Assigned PICs</label>
                    <select
                      multiple
                      size={6}
                      style={{ width: '100%', height: '120px' }}
                      onDoubleClick={e => {
                        const selectedId = e.target.value;
                        const selected = assignedPics.find(p => p._id === selectedId);
                        if (selected) handleRemovePic(selected);
                      }}
                      value={assignedPics.map(p => p._id)}
                    >
                      {assignedPics.map(pic => (
                        <option key={pic._id} value={pic._id}>
                          {pic.name}
                        </option>
                      ))}
                    </select>
                    <div className="area-addproj-manpower-help">Double click to remove</div>
                  </div>
                </div>
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
