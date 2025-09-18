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

  // Autocomplete state
  const [allTypes, setAllTypes] = useState([]);
  const [focusedRow, setFocusedRow] = useState(null);
  const [highlighted, setHighlighted] = useState({}); // rowIdx -> highlighted suggestion index
  // Modal state
  const [modal, setModal] = useState({ open: false, title: '', message: '', type: 'info', actions: [] });

  const openModal = ({ title, message, type = 'info', actions }) => {
    setModal({ open: true, title, message, type, actions: actions || [] });
  };
  const closeModal = () => setModal(m => ({ ...m, open: false }));

  const fetchTypeSuggestions = async () => {
    try {
      const { data } = await api.get('/manpower/types/list');
      const list = data.types || [];
      setAllTypes(list);
      console.log('[Autocomplete] Loaded manpower types:', list.length);
    } catch (e) {
      console.error('Failed to load manpower types', e);
    }
  };

  // Initial load of all types (once)
  useEffect(() => { fetchTypeSuggestions(); }, []);

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
  // No per-key fetch now; we filter client-side from allTypes
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
      openModal({
        title: 'Incomplete Form',
        message: 'All fields are required before submitting the manpower request.',
        type: 'warning',
        actions: [
          { label: 'Close', onClick: () => closeModal(), primary: true }
        ]
      });
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
      openModal({
        title: 'Invalid Manpower Entries',
        message: 'Each manpower row must have a type (text) and a quantity greater than 0.',
        type: 'warning',
        actions: [ { label: 'Fix Entries', onClick: () => closeModal(), primary: true } ]
      });
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
        openModal({
          title: editMode ? 'Request Updated' : 'Request Submitted',
          type: 'success',
            message: editMode
              ? 'The manpower request has been successfully updated.'
              : 'Your manpower request has been submitted successfully.',
          actions: [
            { label: 'Go to Manpower List', onClick: () => { closeModal(); navigate('/pm/manpower-list'); }, primary: true },
            !editMode ? { label: 'Create Another', onClick: () => { closeModal(); setFormData({ acquisitionDate: '', duration: '', project: formData.project, manpowers: [{ type: '', quantity: '' }], description: '' }); } } : null,
          ].filter(Boolean)
        });
      } else {
        openModal({
          title: 'Submission Error',
          type: 'error',
          message: response.data?.message || 'Failed to submit request. Please try again.',
          actions: [ { label: 'Close', onClick: () => closeModal(), primary: true } ]
        });
      }
    } catch (error) {
      console.error('❌ Submission error:', error);
      openModal({
        title: 'Network Error',
        type: 'error',
        message: 'Failed to connect to server. Please check your connection and try again.',
        actions: [ { label: 'Close', onClick: () => closeModal(), primary: true } ]
      });
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
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                  <div style={{ flex: '1' }}>
                    <label htmlFor="acquisitionDate" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Target Date</label>
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
                  <div style={{ flex: '1' }}>
                    <label htmlFor="duration" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Duration</label>
                    <input
                      type="number"
                      id="duration"
                      name="duration"
                      min="1"
                      placeholder="Days"
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
                    Add the types and quantities of manpower needed
                  </p>
                </div>
                
                <div className="manpower-table">
                  <div className="table-header">
                    <div className="header-cell">Type</div>
                    <div className="header-cell">Qty</div>
                    <div className="header-cell actions">Actions</div>
                  </div>
                  
      {formData.manpowers.map((mp, idx) => {
        const suggestions = (allTypes || []).filter(t => !mp.type || t.toLowerCase().includes(mp.type.toLowerCase())).slice(0, 15);
        const showDropdown = focusedRow === idx; // show whenever focused
        const currentHighlight = highlighted[idx] ?? -1;
        const handleKeyDown = (e) => {
          if (!showDropdown) return;
          if (['ArrowDown','ArrowUp','Enter','Tab','Escape'].includes(e.key)) e.preventDefault();
            if (e.key === 'ArrowDown') {
              if (suggestions.length === 0) return;
              setHighlighted(h => ({ ...h, [idx]: (currentHighlight + 1) % suggestions.length }));
            } else if (e.key === 'ArrowUp') {
              if (suggestions.length === 0) return;
              setHighlighted(h => ({ ...h, [idx]: (currentHighlight - 1 + suggestions.length) % suggestions.length }));
            } else if (e.key === 'Enter') {
              if (currentHighlight >= 0 && suggestions[currentHighlight]) {
                handleManpowerChange(idx, 'type', suggestions[currentHighlight]);
                setFocusedRow(null);
                setHighlighted(h => ({ ...h, [idx]: -1 }));
              }
            } else if (e.key === 'Escape') {
              setFocusedRow(null);
              setHighlighted(h => ({ ...h, [idx]: -1 }));
            }
        };
                    return (
                      <div className="table-row" key={idx} style={{ position:'relative' }}>
                        <div className="table-cell" style={{ position:'relative' }}>
                          <input
                            type="text"
                            placeholder="e.g., Electrician, Plumber"
                            value={mp.type}
          onChange={e => handleManpowerChange(idx, 'type', e.target.value)}
          onFocus={() => { setFocusedRow(idx); }}
          onBlur={() => { setTimeout(()=>{ setFocusedRow(r => r === idx ? null : r); }, 160); }}
          onKeyDown={handleKeyDown}
                            required
                            autoComplete="off"
                            className="form-input"
                          />
                          {showDropdown && (
                            <ul id={`mp-type-dd-${idx}`} className="type-suggestions" style={{
                              listStyle:'none', margin:0, padding:'4px 0', position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e5e7eb', zIndex:1000, maxHeight:200, overflowY:'auto', borderRadius:6, boxShadow:'0 4px 12px rgba(0,0,0,0.08)'
                            }}>
                              {suggestions.length === 0 && (
                                <li style={{ padding:'6px 10px', fontSize:12, color:'#6b7280' }}>No types found</li>
                              )}
                              {suggestions.map((s, i) => (
                                <li key={s}
                                  style={{ padding:'6px 10px', cursor:'pointer', fontSize:13, background: i===currentHighlight ? '#f3f4f6':'#fff' }}
                                  onMouseDown={e => { e.preventDefault(); handleManpowerChange(idx, 'type', s); setFocusedRow(null); setHighlighted(h=>({...h,[idx]:-1})); }}
                                  onMouseEnter={() => setHighlighted(h => ({ ...h, [idx]: i }))}
                                >{s}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      <div className="table-cell">
                        <input
                          type="number"
                          placeholder="Qty"
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
                    );
                  })}
                </div>
                
                <div className="add-manpower-section">
                  <button
                    type="button"
                    onClick={addManpowerRow}
                    className="add-manpower-btn"
                  >
                    <FaPlus />
                    <span>Add Manpower Type</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Description</h3>
                  <p className="section-description">
                    Provide details about the manpower request
                  </p>
                </div>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="description">Request Details</label>
                    <textarea
                      id="description"
                      name="description"
                      placeholder="Describe requirements, skills needed, work scope, and other relevant details..."
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
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
      {modal.open && (
        <div className={`center-modal-overlay ${modal.type}`} role="dialog" aria-modal="true">
          <div className="center-modal">
            <div className="center-modal-header">
              <h2>{modal.title}</h2>
            </div>
            <div className="center-modal-body">
              <p>{modal.message}</p>
            </div>
            <div className="center-modal-actions">
              {modal.actions.map((a,i) => (
                <button
                  key={i}
                  type="button"
                  className={a.primary ? 'modal-btn primary' : 'modal-btn'}
                  onClick={a.onClick}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PmRequestManpower;
