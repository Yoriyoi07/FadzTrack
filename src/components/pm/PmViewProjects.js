import React, { useState, useEffect } from 'react';
import "../style/pic_style/Pic_Project.css";
import { Link, useNavigate, useParams } from 'react-router-dom';

const Pm_Project = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [showEditFields, setShowEditFields] = useState(false);
  const [editTasks, setEditTasks] = useState([{ name: '', percent: '' }]);

  useEffect(() => {
    if (!id) return;
    const fetchProject = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/projects/${id}`);
        if (!res.ok) throw new Error('Project not found');
        const data = await res.json();
        setProject(data);
        console.log('Fetched Project:', data);
      } catch (err) {
        setProject(null);
      }
    };
    fetchProject();
  }, [id]);

  useEffect(() => {
    if (!token || !user) return;
    const fetchProjects = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/projects', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        console.log('Fetched projects:', data); 
        // Filter for projects where this user is the Project Manager
        const filtered = data.filter(
    (p) => p.projectManager && (
      (typeof p.projectManager === 'object' && (p.projectManager._id === userId || p.projectManager.id === userId)) ||
      p.projectManager === userId // in case it's just an ID string
    )
  );
        console.log('Filtered projects:', filtered); 
        setProjects(filtered);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, [token, user, userId]);

  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssigned = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/projects/assigned/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        console.log('Assigned project from API:', data);
        setProject(data[0] || null);
      } catch (err) {
        console.error('Failed to fetch assigned project:', err);
        setProject(null);
      }
    };
    fetchAssigned();
  }, [token, userId]);

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

  // ---- TASK PERCENT VALIDATION ----
  // Calculate the total percent of all fields
  const totalPercent = editTasks.reduce(
    (sum, task) => sum + (parseInt(task.percent) || 0),
    0
  );

  // Handler for each task's name or percent field
  const handleEditTaskChange = (idx, field, value) => {
    setEditTasks(tasks =>
      tasks.map((t, i) => {
        if (i !== idx) return t;
        if (field === 'percent') {
          // Calculate sum of all except this task
          const otherTotal = tasks.reduce(
            (sum, task, j) => (j === idx ? sum : sum + (parseInt(task.percent) || 0)),
            0
          );
          let valNum = Number(value);
          if (otherTotal + valNum > 100) {
            valNum = 100 - otherTotal;
          }
          if (valNum < 0) valNum = 0;
          return { ...t, percent: valNum.toString() };
        }
        return { ...t, [field]: value };
      })
    );
  };

  // Add a new empty task field
  const handleAddTaskField = () => {
    setEditTasks(tasks => [...tasks, { name: '', percent: '' }]);
  };

  // Submit logic (placeholder)
  const handleSubmitTasks = () => {
    console.log('Submitting tasks:', editTasks);
    // Optionally reset:
    // setEditTasks([{ name: '', percent: '' }]);
    // setShowEditFields(false);
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div className="app-container">
      {/* Header with Navigation */}
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
              <Link to={`/pm/viewprojects/${projects[0].id || projects[0]._id}`} className="nav-link">View Project</Link>)}
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

      <main className="main">
        <div className="project-detail-container">
          <div className="back-button" onClick={() => navigate('/Pic')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>

          <div className="project-image-container">
            <img 
              alt={project.projectName} 
              className="project-image"
            />
            <button className="favorite-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <h1 className="project-title">{project.projectName}</h1>

          <div className="project-details-grid">
            <div className="details-column">
             <p className="detail-item">
                <span className="detail-label">Location:</span> 
                {typeof project.location === 'object'
                  ? project.location.name 
                  : project.location}
              </p>
              <div className="detail-group">
                <p className="detail-label">Project Manager:</p>
                <p className="detail-value">{project.projectManager?.name || 'N/A'}</p>
              </div>
              <div className="detail-group">
                <p className="detail-label">Contractor:</p>
                <p className="detail-value">{project.contractor}</p>
              </div>
              <div className="detail-group">
                <span className="detail-label">Target Date:</span>
                <span className="detail-value">
                  {project.targetDate || 'N/A'}
                </span>
              </div>
            </div>

            <div className="details-column">
              <div className="budget-container">
                <p className="budget-amount">{project.budget?.toLocaleString() || '0'}</p>
                <p className="budget-label">Estimated Budget</p>
              </div>
              <div className="detail-group">
                <p className="detail-value">
                  <p className="detail-label">PIC:</p>
                  {project.pic && project.pic.length > 0 
                    ? project.pic.map(p => p.name).join(', ') 
                    : 'N/A'}
                </p>
              </div>

              {/* Edit Task Button and Fields */}
              <button
                className="edit-task-btn"
                style={{
                  background: "#2E7D32",
                  color: "white",
                  padding: "10px 28px",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  marginTop: 10
                }}
                onClick={() => setShowEditFields(!showEditFields)}
              >
                Edit Task
              </button>

              {showEditFields && (
                <div style={{ marginTop: 16 }}>
                  {editTasks.map((task, idx) => {
                    // Calc total without current field for max percent input
                    const othersTotal = editTasks.reduce(
                      (sum, t, i) => (i === idx ? sum : sum + (parseInt(t.percent) || 0)), 0
                    );
                    const maxValue = 100 - othersTotal;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <input
                          type="text"
                          value={task.name}
                          onChange={e => handleEditTaskChange(idx, 'name', e.target.value)}
                          placeholder="Enter Task"
                          style={{
                            padding: "10px",
                            borderRadius: "8px",
                            border: "1px solid #ccc",
                            fontSize: "1rem",
                            minWidth: "250px"
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          max={maxValue}
                          value={task.percent}
                          onChange={e => handleEditTaskChange(idx, 'percent', e.target.value)}
                          placeholder="%"
                          style={{
                            padding: "10px",
                            borderRadius: "8px",
                            border: "1px solid #ccc",
                            fontSize: "1rem",
                            width: "80px"
                          }}
                        />
                        {/* Plus button only on last field */}
                        {idx === editTasks.length - 1 && (
                          <button
                            onClick={handleAddTaskField}
                            style={{
                              background: "#1976d2",
                              color: "white",
                              border: "none",
                              borderRadius: "50%",
                              width: 36,
                              height: 36,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.5rem",
                              cursor: totalPercent >= 100 ? "not-allowed" : "pointer",
                              opacity: totalPercent >= 100 ? 0.5 : 1
                            }}
                            type="button"
                            title="Add Task Field"
                            disabled={totalPercent >= 100}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontWeight: 500 }}>
                    Total: {totalPercent}%
                  </div>
                  <button
                    onClick={handleSubmitTasks}
                    style={{
                      marginTop: 8,
                      background: "#388e3c",
                      color: "white",
                      padding: "8px 32px",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      fontSize: "1rem",
                      cursor: "pointer"
                    }}
                  >
                    Submit Task
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="manpower-section">
            <p className="detail-label">Manpower:</p>
            <p className="manpower-list">
              {Array.isArray(project.manpower)
                ? project.manpower.map(m => m.name + (m.position ? ` (${m.position})` : '')).join(', ')
                : (typeof project.manpower === 'object' ? project.manpower.name : project.manpower)}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pm_Project;
