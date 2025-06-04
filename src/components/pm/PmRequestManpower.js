import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Adjust the path if needed
import '../style/pm_style/Pm_ManpowerRequest.css';

const PmRequestManpower = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const { id } = useParams(); // <--- ID from /edit/:id, undefined on create
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState('');
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(!!id);
  const [formData, setFormData] = useState({
    acquisitionDate: '',
    duration: '',
    project: '',
    manpowers: [{ type: '', quantity: '' }],
    description: '',
  });

  // Fetch the one project for this Project Manager
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user._id) return;

    api.get(`/projects/assigned/projectmanager/${user._id}`)
      .then(res => {
        const data = res.data;
        if (data && data._id) {
          setProject(data);
          setFormData(prev => ({
            ...prev,
            project: data._id
          }));
        }
      })
      .catch(err => console.error('Error fetching project', err));
  }, []);

  // If in edit mode, fetch the existing request and prefill
  useEffect(() => {
    if (id) {
      api.get(`/manpower-requests/${id}`)
        .then(res => {
          const data = res.data;
          if (data) {
            setEditMode(true);
            setFormData({
              acquisitionDate: data.acquisitionDate ? data.acquisitionDate.split('T')[0] : '',
              duration: data.duration || '',
              project: data.project?._id || data.project || '',
              manpowers: data.manpowers && data.manpowers.length > 0 ? data.manpowers : [{ type: '', quantity: '' }],
              description: data.description || '',
            });
            setProject(data.project); // Prefill project if populated
          }
        })
        .finally(() => setLoading(false));
    } else {
      setEditMode(false);
      setLoading(false);
    }
  }, [id]);

  // Dynamic Manpower Handlers
  const handleManpowerChange = (idx, field, value) => {
    setFormData(prev => {
      const newManpowers = prev.manpowers.map((mp, i) =>
        i === idx ? { ...mp, [field]: value } : mp
      );
      return { ...prev, manpowers: newManpowers };
    });
  };

  const addManpowerRow = () => {
    setFormData(prev => ({
      ...prev,
      manpowers: [...prev.manpowers, { type: '', quantity: '' }]
    }));
  };

  const removeManpowerRow = (idx) => {
    setFormData(prev => ({
      ...prev,
      manpowers: prev.manpowers.filter((_, i) => i !== idx)
    }));
  };

  // General Field Change Handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Profile Menu Logic
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  useEffect(() => {
  if (!token || !user) return;
  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects');
      const filtered = data.filter(
        (p) => p.projectManager && (
          (typeof p.projectManager === 'object' && (p.projectManager._id === userId || p.projectManager.id === userId)) ||
          p.projectManager === userId
        )
      );
      setProjects(filtered);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };
  fetchProjects();
}, [token, user, userId]);


  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation (same as before)
    if (!formData.acquisitionDate || !formData.duration || !formData.project || !formData.description) {
      alert('All fields are required.');
      return;
    }
    const validManpowers = formData.manpowers.every(mp =>
      typeof mp.type === "string" &&
      mp.type.trim() !== "" &&
      mp.quantity !== "" &&
      !isNaN(Number(mp.quantity)) &&
      Number(mp.quantity) > 0
    );
    if (!validManpowers) {
      alert('Each manpower must have a type (string) and quantity (number > 0).');
      return;
    }

    const body = {
      acquisitionDate: formData.acquisitionDate,
      duration: Number(formData.duration),
      project: formData.project,
      description: formData.description,
      manpowers: formData.manpowers.map(mp => ({
        type: mp.type.trim(),
        quantity: Number(mp.quantity)
      }))
    };

    try {
      let url = '/manpower-requests';
      let method = 'post';
      if (editMode) {
        url = `/manpower-requests/${id}`;
        method = 'put';
      }

      const response = await api[method](url, body);

      if (response.status === 200 || response.status === 201) {
        alert(editMode ? '✅ Manpower request updated!' : '✅ Manpower request submitted!');
        navigate('/pm/manpower-list');
      } else {
        alert(`❌ Error: ${response.data.message || 'Failed to submit request'}`);
      }
    } catch (error) {
      console.error('❌ Submission error:', error);
      alert('❌ Failed to connect to server.');
    }
  };

  if (loading) return <div>Loading...</div>;

  
  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          {projects.length > 0 && (
            <Link to={`/pm/viewprojects/${projects[0].id || projects[0]._id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>Z</div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>


      <main className="main-content">
        <div className="form-container">
          <h2 className="page-title">{editMode ? "Edit Manpower Request" : "Request Manpower"}</h2>
          <form onSubmit={handleSubmit} className="project-form">
            {/* Acquisition Date & Duration */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="acquisitionDate">Target Acquisition Date</label>
                <input
                  type="date"
                  id="acquisitionDate"
                  name="acquisitionDate"
                  value={formData.acquisitionDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="duration">Duration (days)</label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  min="1"
                  placeholder="How many days?"
                  value={formData.duration}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Project Name (read-only) */}
            {project && (
              <div className="form-row">
                <div className="form-group" style={{ width: '100%' }}>
                  <label>Project</label>
                  <input
                    type="text"
                    value={project.projectName}
                    readOnly
                  />
                </div>
              </div>
            )}

            {/* Dynamic Manpower Rows */}
            <div style={{ marginTop: '18px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Type of Manpower</label>
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                </div>
                <div style={{ width: '80px' }}></div>
              </div>
              {formData.manpowers.map((mp, idx) => (
                <div className="form-row manpower-row" key={idx}>
                  <div className="form-group">
                    <input
                      type="text"
                      name={`manpowerType_${idx}`}
                      placeholder="Type of Manpower"
                      value={mp.type}
                      onChange={e => handleManpowerChange(idx, 'type', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      name={`manpowerQuantity_${idx}`}
                      placeholder="Quantity"
                      min="1"
                      value={mp.quantity}
                      onChange={e => handleManpowerChange(idx, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.manpowers.length > 1) removeManpowerRow(idx);
                    }}
                    className="remove-btn"
                    title={
                      formData.manpowers.length === 1
                        ? "At least one manpower row is required"
                        : "Remove this manpower requirement"
                    }
                    disabled={formData.manpowers.length === 1}
                    style={{
                      opacity: formData.manpowers.length === 1 ? 0.6 : 1,
                      cursor: formData.manpowers.length === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="button-container">
                <button
                  type="button"
                  onClick={addManpowerRow}
                  className="add-btn"
                >
                  <span>+</span> Add Another
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="form-row">
              <div className="form-group" style={{ width: '100%' }}>
                <label htmlFor="description">Request Description</label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Provide a detailed description of your request"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  required
                ></textarea>
              </div>
            </div>
            <div className="form-row submit-row">
              <button type="submit" className="submit-button">
                {editMode ? "Save Changes" : "Submit Manpower Request"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default PmRequestManpower;
