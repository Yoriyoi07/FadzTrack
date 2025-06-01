import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Adjust path as needed!
import '../style/pm_style/Pm_DailyLogs.css';

const PM_DailyLogs = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Get logged-in user info from localStorage
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  // State for project data
  const [currentProject, setCurrentProject] = useState(null);
  const [projectManpower, setProjectManpower] = useState([]);
  const [materialDeliveries, setMaterialDeliveries] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);

  // Form states
  const [formData, setFormData] = useState({
    siteAttendance: [],
    materialDeliveries: [],
    workPerformed: [],
    weatherCondition: 'Sunny',
    remarks: ''
  });

  // Fetch project data
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        console.log('Fetching project for user:', userId);

        // Get project assigned to the project manager
        const projectResponse = await api.get(`/projects/assigned/projectmanager/${userId}`);
        const projectData = projectResponse.data;
        setCurrentProject(projectData);

        if (projectData._id) {
          console.log('Fetching additional project data for:', projectData._id);

          // Fetch manpower
          const manpowerResponse = await api.get(`/daily-reports/project/${projectData._id}/manpower`);
          setProjectManpower(manpowerResponse.data);

          // Fetch material deliveries (approved only)
          const deliveriesResponse = await api.get(`/daily-reports/project/${projectData._id}/material-deliveries`);
          setMaterialDeliveries(deliveriesResponse.data);

          // Fetch project tasks
          const tasksResponse = await api.get(`/daily-reports/project/${projectData._id}/tasks`);
          setProjectTasks(tasksResponse.data);
        }
      } catch (error) {
        console.error('Error details:', {
          message: error?.message,
          userId: userId,
          hasToken: !!localStorage.getItem('token')
        });
        alert(`Error loading project data: ${error?.response?.data?.message || error.message}`);
      }
    };

    if (userId) {
      fetchProjectData();
    } else {
      console.error('No user ID found');
      alert('User ID not found. Please log in again.');
    }
  }, [userId]);

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle site attendance change
  const handleAttendanceChange = (manpowerId, status) => {
    setFormData(prev => {
      const attendance = [...prev.siteAttendance];
      const index = attendance.findIndex(a => a.manpower === manpowerId);

      if (index >= 0) {
        attendance[index].status = status;
      } else {
        attendance.push({ manpower: manpowerId, status });
      }

      return { ...prev, siteAttendance: attendance };
    });
  };

  // Handle material delivery change
  const handleMaterialDeliveryChange = (deliveryId, status) => {
    setFormData(prev => {
      const deliveries = [...prev.materialDeliveries];
      const index = deliveries.findIndex(d => d.delivery === deliveryId);

      if (index >= 0) {
        deliveries[index].status = status;
      } else {
        deliveries.push({ delivery: deliveryId, status });
      }

      return { ...prev, materialDeliveries: deliveries };
    });
  };

  // Handle work performed change
  const handleWorkPerformedChange = (index, field, value) => {
    setFormData(prev => {
      const work = [...prev.workPerformed];
      if (!work[index]) {
        work[index] = { task: '', status: '', remarks: '' };
      }
      work[index][field] = value;
      return { ...prev, workPerformed: work };
    });
  };

  // Add new work performed entry
  const addWorkPerformed = () => {
    setFormData(prev => ({
      ...prev,
      workPerformed: [...prev.workPerformed, { task: '', status: '', remarks: '' }]
    }));
  };

  // Remove work performed entry
  const removeWorkPerformed = (index) => {
    setFormData(prev => ({
      ...prev,
      workPerformed: prev.workPerformed.filter((_, i) => i !== index)
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/daily-reports', {
        ...formData,
        project: currentProject._id,
        submittedBy: userId,
        date: new Date()
      });
      alert('Daily report submitted successfully!');
      setFormData({
        siteAttendance: [],
        materialDeliveries: [],
        workPerformed: [],
        weatherCondition: 'Sunny',
        remarks: ''
      });
    } catch (error) {
      console.error('Error submitting daily report:', error);
      alert('Error submitting daily report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Submitting daily report...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm/dash" className="nav-link">Dashboard</Link>
          <Link to="/requests" className="nav-link">Requests</Link>
          <Link to="/pm/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
          <div className="profile-menu-container">
            <div
              className="profile-circle"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content-dailylogs">
        <h1 className="page-title-dailylogs">Daily Logs</h1>
        <form onSubmit={handleSubmit} className="daily-logs-grid grid-flow">
          <div className="log-section">
            <h2 className="section-title">Site Attendance Log</h2>
            {projectManpower.length > 0 ? (
              projectManpower.map(manpower => (
                <div key={manpower._id} className="attendance-entry">
                  <span>{manpower.name}</span>
                  <select
                    className="form-input"
                    value={formData.siteAttendance.find(a => a.manpower === manpower._id)?.status || ''}
                    onChange={(e) => handleAttendanceChange(manpower._id, e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Late">Late</option>
                  </select>
                </div>
              ))
            ) : (
              <p>No manpower assigned to this project</p>
            )}
          </div>

          <div className="log-section">
            <h2 className="section-title">Material Deliveries</h2>
            {materialDeliveries.length > 0 ? (
              materialDeliveries.map(delivery => (
                <div key={delivery._id || delivery.requestId} className="delivery-entry">
                  <span>{delivery.materialName || delivery.name}</span>
                  <select
                    className="form-input"
                    value={formData.materialDeliveries.find(d => d.delivery === (delivery._id || delivery.requestId))?.status || ''}
                    onChange={(e) => handleMaterialDeliveryChange(delivery._id || delivery.requestId, e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="Received">Received</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              ))
            ) : (
              <p>No approved material deliveries for this project</p>
            )}
          </div>

          <div className="log-section">
            <h2 className="section-title">Work Performed Today</h2>
            {formData.workPerformed.map((work, index) => (
              <div key={index} className="work-entry">
                <select
                  className="form-input"
                  value={work.task}
                  onChange={(e) => handleWorkPerformedChange(index, 'task', e.target.value)}
                >
                  <option value="">Select Task</option>
                  {projectTasks.map((task, i) =>
                    typeof task === 'string'
                      ? <option key={i} value={task}>{task}</option>
                      : <option key={i} value={task.name}>{task.name}</option>
                  )}
                </select>
                <select
                  className="form-input"
                  value={work.status}
                  onChange={(e) => handleWorkPerformedChange(index, 'status', e.target.value)}
                >
                  <option value="">Select Status</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Not Started">Not Started</option>
                </select>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Remarks"
                  value={work.remarks || ''}
                  onChange={(e) => handleWorkPerformedChange(index, 'remarks', e.target.value)}
                />
                {formData.workPerformed.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeWorkPerformed(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-btn" onClick={addWorkPerformed}>
              Add Work Entry
            </button>
          </div>

          <div className="log-section">
            <h2 className="section-title">Weather Conditions</h2>
            <select
              className="form-input"
              value={formData.weatherCondition}
              onChange={(e) => handleFieldChange('weatherCondition', e.target.value)}
            >
              <option value="Sunny">Sunny</option>
              <option value="Cloudy">Cloudy</option>
              <option value="Rainy">Rainy</option>
              <option value="Stormy">Stormy</option>
              <option value="Overcast">Overcast</option>
            </select>
          </div>

          <div className="log-section">
            <h2 className="section-title">Additional Remarks</h2>
            <textarea
              className="form-textarea"
              value={formData.remarks}
              onChange={(e) => handleFieldChange('remarks', e.target.value)}
              placeholder="Enter any additional remarks..."
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              Submit Daily Report
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default PM_DailyLogs;
