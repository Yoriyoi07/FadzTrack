import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Adjust path as needed!
import '../style/pm_style/Pm_DailyLogs.css';

const PMDailyLogs = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
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

  // Ensure workPerformed always matches projectTasks
  useEffect(() => {
    if (projectTasks.length > 0) {
      setFormData(prev => {
        // Map each project task to a workPerformed entry
        const newWorkPerformed = projectTasks.map((task, i) => {
          const taskName = typeof task === 'string' ? task : task.name;
          // Try to find existing entry
          const existing = prev.workPerformed.find(wp => wp.task === taskName);
          return existing || { task: taskName, status: '', remarks: '' };
        });
        return { ...prev, workPerformed: newWorkPerformed };
      });
    }
    // eslint-disable-next-line
  }, [projectTasks]);

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

  // Profile menu close on outside click
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
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          {projects.length > 0 && (
            <Link to={`/pm/viewprojects/${projects[0]._id || projects[0].id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/pm/daily-logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
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
            <div style={{ overflowX: 'auto' }}>
              <table className="work-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.workPerformed.map((work, index) => (
                    <tr key={work.task}>
                      <td>{work.task}</td>
                      <td>
                        <label style={{ marginRight: 10 }}>
                          <input
                            type="radio"
                            name={`status-${index}`}
                            value="In Progress"
                            checked={work.status === 'In Progress'}
                            onChange={() => handleWorkPerformedChange(index, 'status', 'In Progress')}
                          /> In Progress
                        </label>
                        <label style={{ marginRight: 10 }}>
                          <input
                            type="radio"
                            name={`status-${index}`}
                            value="Completed"
                            checked={work.status === 'Completed'}
                            onChange={() => handleWorkPerformedChange(index, 'status', 'Completed')}
                          /> Completed
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`status-${index}`}
                            value="Not Started"
                            checked={work.status === 'Not Started'}
                            onChange={() => handleWorkPerformedChange(index, 'status', 'Not Started')}
                          /> Not Started
                        </label>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Remarks"
                          value={work.remarks || ''}
                          onChange={e => handleWorkPerformedChange(index, 'remarks', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

export default PMDailyLogs;
