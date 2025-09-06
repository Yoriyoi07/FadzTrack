import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/pm_style/Pm_ManpowerRequest.css';
import AppHeader from '../layout/AppHeader';
import { FaPlus, FaTrash, FaSave, FaArrowLeft } from 'react-icons/fa';

const PmRequestManpower = () => {
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const token = localStorage.getItem('token');
  const userId = user?._id;
  const { id } = useParams();
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
            setProject(data.project);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setEditMode(false);
      setLoading(false);
    }
  }, [id]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
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
  }, [user, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

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

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading manpower request form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <AppHeader roleSegment="pm" />

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="content-wrapper">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-content">
              <button 
                onClick={() => navigate('/pm/manpower-list')} 
                className="back-button"
              >
                <FaArrowLeft />
                <span>Back to Manpower List</span>
              </button>
              <div className="page-title-section">
                <h1 className="page-title">
                  {editMode ? "Edit Manpower Request" : "Request Manpower"}
                </h1>
                <p className="page-subtitle">
                  {editMode 
                    ? "Update your manpower request details" 
                    : "Submit a new manpower request for your project"
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Form Container */}
          <div className="form-container">
            <form onSubmit={handleSubmit} className="manpower-form">
              {/* Project Information */}
              {project && (
                <div className="form-section">
                  <div className="section-header">
                    <h3>Project Information</h3>
                  </div>
                  <div className="form-row">
                    <div className="form-group full-width">
                      <label htmlFor="projectName">Project Name</label>
                      <input
                        type="text"
                        id="projectName"
                        value={project.projectName || 'Project Name Not Available'}
                        readOnly
                        className="readonly-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Request Details */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Request Details</h3>
                </div>
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
                      className="form-input"
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
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Manpower Requirements */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Manpower Requirements</h3>
                  <p className="section-description">
                    Specify the types and quantities of manpower needed
                  </p>
                </div>
                
                <div className="manpower-table">
                  <div className="table-header">
                    <div className="header-cell">Type of Manpower</div>
                    <div className="header-cell">Quantity</div>
                    <div className="header-cell actions">Actions</div>
                  </div>
                  
                  {formData.manpowers.map((mp, idx) => (
                    <div className="table-row" key={idx}>
                      <div className="table-cell">
                        <input
                          type="text"
                          placeholder="e.g., Electrician, Plumber, Carpenter"
                          value={mp.type}
                          onChange={e => handleManpowerChange(idx, 'type', e.target.value)}
                          required
                          className="form-input"
                        />
                      </div>
                      <div className="table-cell">
                        <input
                          type="number"
                          placeholder="Number of workers"
                          min="1"
                          value={mp.quantity}
                          onChange={e => handleManpowerChange(idx, 'quantity', e.target.value)}
                          required
                          className="form-input"
                        />
                      </div>
                      <div className="table-cell actions">
                        <button
                          type="button"
                          onClick={() => removeManpowerRow(idx)}
                          className="remove-btn"
                          title="Remove this manpower requirement"
                          disabled={formData.manpowers.length === 1}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="add-manpower-section">
                  <button
                    type="button"
                    onClick={addManpowerRow}
                    className="add-manpower-btn"
                  >
                    <FaPlus />
                    <span>Add Another Manpower Type</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Request Description</h3>
                  <p className="section-description">
                    Provide detailed information about your manpower request
                  </p>
                </div>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      placeholder="Describe the specific requirements, skills needed, work scope, and any other relevant details..."
                      value={formData.description}
                      onChange={handleChange}
                      rows={6}
                      required
                      className="form-textarea"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Submit Section */}
              <div className="form-section submit-section">
                <div className="submit-actions">
                  <button
                    type="button"
                    onClick={() => navigate('/pm/manpower-list')}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn">
                    <FaSave />
                    <span>
                      {editMode ? "Update Request" : "Submit Request"}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PmRequestManpower;
