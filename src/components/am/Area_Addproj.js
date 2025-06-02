import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Addproj.css';
import Papa from 'papaparse';
import api from '../../api/axiosInstance'; // ✅ USE THIS FOR ALL API CALLS

const Area_Addproj = () => {
  const navigate = useNavigate();
  // Get logged-in user info from localStorage
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projectManagers, setProjectManagers] = useState([]);
  const [pics, setPics] = useState([]);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [manpowerList, setManpowerList] = useState([]);
  const [searchManpower, setSearchManpower] = useState('');
  const [availableManpower, setAvailableManpower] = useState([]);
  const [assignedManpower, setAssignedManpower] = useState([]);
  const [csvError, setCsvError] = useState('');

  // Initialize formData and include areamanager from the start
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

  // Keep areamanager updated if user changes (edge case)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      areamanager: userId || ''
    }));
  }, [userId]);

  // Handle multiple selection for PICs
  const handleChangeMultiplePics = (e) => {
    const options = e.target.options;
    const selectedPics = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedPics.push(options[i].value);
      }
    }
    setFormData(prevState => ({
      ...prevState,
      pic: selectedPics
    }));
  };

  const handleChangeMultipleManpower = (e) => {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(options[i].value);
      }
    }
    setFormData(prevState => ({
      ...prevState,
      manpower: selected
    }));
  };

  // ALL API CALLS BELOW ARE USING AXIOS INSTANCE

  useEffect(() => {
    api.get('/manpower')
      .then(res => {
        setManpowerList(res.data);
        setAvailableManpower(res.data);
      })
      .catch(err => console.error('Failed to fetch manpower:', err));
  }, []);

  useEffect(() => {
    if (userId) {
      api.get(`/users/${userId}/locations`)
        .then(res => setAssignedLocations(res.data))
        .catch(err => {
          setAssignedLocations([]);
          console.error('Failed to fetch assigned locations:', err);
        });
    }
  }, [userId]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, manpower: assignedManpower.map(m => m._id) }));
  }, [assignedManpower]);

  // Handle input change for text, date, number, etc.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Fetch Project Managers and PICs
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [pmRes, picRes] = await Promise.all([
          api.get('/users/role/Project%20Manager'),
          api.get('/users/role/Person%20in%20Charge')
        ]);
        setProjectManagers(Array.isArray(pmRes.data) ? pmRes.data : pmRes.data.data || []);
        setPics(Array.isArray(picRes.data) ? picRes.data : picRes.data.data || []);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  // Profile menu logic
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

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Submit form and include areamanager in the payload
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Always make sure areamanager is set to the latest userId
    const stored = localStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    const userId = user?._id;
    const submitData = { ...formData, areamanager: userId };

    // Validation
    if (!submitData.startDate || !submitData.endDate) {
      alert("Please select both start and end dates.");
      return;
    }
    if (new Date(submitData.endDate) < new Date(submitData.startDate)) {
      alert("End date cannot be before start date.");
      return;
    }

    try {
      // Use AXIOS for POST, no need to manually add Authorization header
      const response = await api.post('/projects', submitData);
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
      // Redirect or do something
      navigate('/ceo/dash'); // Change to your area dashboard route if needed
    } catch (error) {
      const result = error.response?.data;
      alert(`❌ Error: ${result?.message || result?.error || 'Failed to add project'}`);
      console.error('❌ Submission error:', error);
    }
  };

  // Assign manpower from left to right
  const handleAssignManpower = (mp) => {
    setAssignedManpower(prev => [...prev, mp]);
    setAvailableManpower(prev => prev.filter(m => m._id !== mp._id));
  };

  // Remove manpower from right to left
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
          // By name and position (case-insensitive)
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
    mp.name.toLowerCase().includes(searchManpower.toLowerCase()) ||
    mp.position.toLowerCase().includes(searchManpower.toLowerCase())
  );

  return (
    <div>
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/addproj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div 
            className="profile-circle" 
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            Z
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
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
              <div className="area-addproj-form-group">
                <label htmlFor="pic">PIC</label>
                <select
                  id="pic"
                  name="pic"
                  multiple
                  value={formData.pic}
                  onChange={handleChangeMultiplePics}
                >
                  {pics.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
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
                >
                  <option value="">-- Select Project Manager --</option>
                  {projectManagers.map((user) => (
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

            <div className="area-addproj-form-row area-addproj-submit-row">
              <button type="submit" className="area-addproj-submit-button">Add Project</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Area_Addproj;
