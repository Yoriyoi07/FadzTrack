import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../../components/style/it_style/ItMaterialRequestDetail.css';
import '../style/pm_style/Pm_Dash.css';

const MaterialRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?._id;

  const [materialRequest, setMaterialRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const profileDropdownRef = useRef(null);

  const isPIC = user?._id === materialRequest?.createdBy?._id;

  useEffect(() => {
    axiosInstance.get(`/requests/${id}`)
      .then(res => {
        const data = res.data;
        setMaterialRequest(data);
        const materialsWithIds = (data.materials || []).map((mat, idx) => ({
          ...mat,
          id: mat.id || Date.now() + idx
        }));
        setMaterials(materialsWithIds);
        setDescription(data.description || '');
        setAttachments(data.attachments || []);
        setError('');
      })
      .catch(() => setError('Failed to load request details.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsHeaderCollapsed(scrollTop > 50);
    };

    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleBack = () => navigate(-1);

  const handleMaterialChange = (id, field, value) => {
    setMaterials(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleAddMaterial = () => {
    setMaterials(prev => [
      ...prev,
      { id: Date.now(), materialName: '', quantity: '' }
    ]);
  };

  const handleDeleteMaterial = id => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles(prev => [...prev, ...files]);
  };

  const handleRemoveNewFile = (idx) => setNewFiles(prev => prev.filter((_, i) => i !== idx));

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  const handleSaveEdit = async () => {
    const formData = new FormData();
    const materialsToSave = materials.map(({ id, ...mat }) => mat);
    formData.append('materials', JSON.stringify(materialsToSave));
    formData.append('description', description);
    formData.append('attachments', JSON.stringify(attachments));
    newFiles.forEach(file => formData.append('newAttachments', file));

    try {
      const res = await axiosInstance.put(`/requests/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data;

      const updatedMaterialsWithIds = (updated.materials || []).map((mat, idx) => ({
        ...mat,
        id: mat.id || Date.now() + idx
      }));
      setMaterialRequest(updated);
      setMaterials(updatedMaterialsWithIds);
      setDescription(updated.description || '');
      setAttachments(updated.attachments || []);
      setNewFiles([]);
      setEditMode(false);
      alert('Request updated!');
    } catch (err) {
      alert('Failed to update request');
      console.error(err);
    }
  };

  const handleCancelRequest = () => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    axiosInstance.delete(`/requests/${id}`)
      .then(() => {
        alert('Request cancelled');
        navigate('/pic');
      })
      .catch(err => {
        alert('Failed to cancel request');
        console.error(err);
      });
  };

  const handleMarkReceived = async () => {
    try {
      await axiosInstance.patch(`/requests/${id}/received`);
      alert('Request marked as received!');
      window.location.reload();
    } catch (err) {
      alert('Failed to mark as received');
      console.error(err);
    }
  };

  const isEditable = [
    'Pending PM',
    'Pending AM'
  ].includes(materialRequest?.status);

  // --- Status helpers for uniform UI ---
  const getStatusColor = (status, receivedByPIC) => {
    const s = (status || '').toLowerCase();
    if (receivedByPIC) return '#0ea5e9';
    if (s.includes('approved')) return '#10b981';
    if (s.includes('pending')) return '#f59e0b';
    if (s.includes('denied') || s.includes('cancel')) return '#ef4444';
    return '#6b7280';
  };
  const getStatusBadge = (status, receivedByPIC) => {
    if (receivedByPIC) return 'Completed';
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) return 'Approved';
    if (s.includes('pending')) return 'Pending';
    if (s.includes('denied') || s.includes('cancel')) return 'Rejected';
    return 'Unknown';
  };

  // Only fetch user's active/ongoing project
  useEffect(() => {
    if (!userId) return;
    const fetchActiveProject = async () => {
      try {
        const { data } = await axiosInstance.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`);
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchActiveProject();
  }, [userId]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading request details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  if (!materialRequest) {
    return (
      <div className="error-container">
        <p>Request not found</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Modern Header */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">Material Request Details</h1>
            <p className="header-subtitle">View and manage material request information</p>
          </div>
          <div className="header-right">
            <div className="header-actions">
              <button 
                onClick={handleBack}
                className="btn-secondary"
              >
                <i className="fas fa-arrow-left"></i>
                Back to List
              </button>
              <div className="profile-dropdown" ref={profileDropdownRef}>
                <button 
                  className="profile-button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                >
                  <div className="profile-avatar">
                    <i className="fas fa-user"></i>
                  </div>
                  <span className="profile-name">{user?.name || 'User'}</span>
                  <i className={`fas fa-chevron-down ${isProfileOpen ? 'rotated' : ''}`}></i>
                </button>
                {isProfileOpen && (
                  <div className="profile-menu">
                    <div className="profile-info">
                      <div className="profile-avatar-large">
                        <i className="fas fa-user"></i>
                      </div>
                      <div className="profile-details">
                        <span className="profile-name-large">{user?.name || 'User'}</span>
                        <span className="profile-role">Person in Charge</span>
                      </div>
                    </div>
                    <div className="profile-actions">
                      <button className="profile-action">
                        <i className="fas fa-user-cog"></i>
                        Profile Settings
                      </button>
                      <button className="profile-action">
                        <i className="fas fa-cog"></i>
                        System Settings
                      </button>
                      <button onClick={handleLogout} className="profile-action logout">
                        <i className="fas fa-sign-out-alt"></i>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="dashboard-main">
        <div className="page-container">
          {materialRequest && (
            <div className="material-request-detail">
              {/* Status Badge */}
              <div className="status-section">
                <div 
                  className="status-badge"
                  style={{ 
                    backgroundColor: getStatusColor(materialRequest.status, materialRequest.receivedByPIC),
                    color: 'white'
                  }}
                >
                  <i className="fas fa-circle"></i>
                  {getStatusBadge(materialRequest.status, materialRequest.receivedByPIC)}
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="detail-grid">
                {/* Left Column - Request Info */}
                <div className="detail-column">
                  <div className="detail-card">
                    <div className="card-header">
                      <h3><i className="fas fa-info-circle"></i> Request Information</h3>
                    </div>
                    <div className="card-content">
                      <div className="info-row">
                        <span className="info-label">Request ID:</span>
                        <span className="info-value">{materialRequest._id}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Request Number:</span>
                        <span className="info-value">{materialRequest.requestNumber}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Description:</span>
                        <span className="info-value description-text">{materialRequest.description}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Priority:</span>
                        <span className="info-value">
                          <span className={`priority-badge priority-${materialRequest.priority?.toLowerCase()}`}>
                            {materialRequest.priority}
                          </span>
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Requested Date:</span>
                        <span className="info-value">
                          {new Date(materialRequest.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="card-header">
                      <h3><i className="fas fa-user"></i> Requester Details</h3>
                    </div>
                    <div className="card-content">
                      <div className="info-row">
                        <span className="info-label">Name:</span>
                        <span className="info-value">{materialRequest.createdBy?.name}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Email:</span>
                        <span className="info-value">{materialRequest.createdBy?.email}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Role:</span>
                        <span className="info-value">{materialRequest.createdBy?.role}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Project:</span>
                        <span className="info-value">{materialRequest.project?.projectName}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Location:</span>
                        <span className="info-value">{materialRequest.project?.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Materials & Attachments */}
                <div className="detail-column">
                  <div className="detail-card">
                    <div className="card-header">
                      <h3><i className="fas fa-boxes"></i> Requested Materials</h3>
                    </div>
                    <div className="card-content">
                      {materialRequest.materials && materialRequest.materials.length > 0 ? (
                        <div className="materials-list">
                          {materialRequest.materials.map((material, index) => (
                            <div key={index} className="material-item">
                              <div className="material-info">
                                <span className="material-name">{material.materialName}</span>
                                <span className="material-quantity">Qty: {material.quantity}</span>
                              </div>
                              {material.specifications && (
                                <div className="material-specs">
                                  <span className="specs-label">Specifications:</span>
                                  <span className="specs-value">{material.specifications}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-data">No materials specified</p>
                      )}
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="card-header">
                      <h3><i className="fas fa-paperclip"></i> Attachments</h3>
                    </div>
                    <div className="card-content">
                      {materialRequest.attachments && materialRequest.attachments.length > 0 ? (
                        <div className="attachments-list">
                          {materialRequest.attachments.map((attachment, index) => (
                            <div key={index} className="attachment-item">
                              <div className="attachment-icon">
                                <i className="fas fa-file"></i>
                              </div>
                              <div className="attachment-info">
                                <span className="attachment-name">{attachment}</span>
                                <a 
                                  href={getAttachmentUrl(attachment)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="attachment-link"
                                >
                                  <i className="fas fa-download"></i>
                                  Download
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-data">No attachments</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Status */}
              <div className="detail-card full-width">
                <div className="card-header">
                  <h3><i className="fas fa-tasks"></i> Approval Status</h3>
                </div>
                <div className="card-content">
                  <div className="approval-timeline">
                    <div className="timeline-item">
                      <div className="timeline-marker completed">
                        <i className="fas fa-check"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>Request Submitted</h4>
                        <p>Request was submitted by {materialRequest.createdBy?.name}</p>
                        <span className="timeline-date">
                          {new Date(materialRequest.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {materialRequest.approvals?.projectManager && (
                      <div className="timeline-item">
                        <div className={`timeline-marker ${materialRequest.approvals.projectManager.approved ? 'completed' : 'pending'}`}>
                          <i className={materialRequest.approvals.projectManager.approved ? 'fas fa-check' : 'fas fa-clock'}></i>
                        </div>
                        <div className="timeline-content">
                          <h4>Project Manager Review</h4>
                          <p>
                            {materialRequest.approvals.projectManager.approved 
                              ? `Approved by ${materialRequest.approvals.projectManager.reviewer?.name || 'Project Manager'}`
                              : 'Pending Project Manager approval'
                            }
                          </p>
                          {materialRequest.approvals.projectManager.reviewedAt && (
                            <span className="timeline-date">
                              {new Date(materialRequest.approvals.projectManager.reviewedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {materialRequest.approvals?.areaManager && (
                      <div className="timeline-item">
                        <div className={`timeline-marker ${materialRequest.approvals.areaManager.approved ? 'completed' : 'pending'}`}>
                          <i className={materialRequest.approvals.areaManager.approved ? 'fas fa-check' : 'fas fa-clock'}></i>
                        </div>
                        <div className="timeline-content">
                          <h4>Area Manager Review</h4>
                          <p>
                            {materialRequest.approvals.areaManager.approved 
                              ? `Approved by ${materialRequest.approvals.areaManager.reviewer?.name || 'Area Manager'}`
                              : 'Pending Area Manager approval'
                            }
                          </p>
                          {materialRequest.approvals.areaManager.reviewedAt && (
                            <span className="timeline-date">
                              {new Date(materialRequest.approvals.areaManager.reviewedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="timeline-item">
                      <div className={`timeline-marker ${materialRequest.receivedByPIC ? 'completed' : 'pending'}`}>
                        <i className={materialRequest.receivedByPIC ? 'fas fa-check' : 'fas fa-clock'}></i>
                      </div>
                      <div className="timeline-content">
                        <h4>Materials Received</h4>
                        <p>
                          {materialRequest.receivedByPIC 
                            ? `Materials received by ${materialRequest.createdBy?.name}`
                            : 'Pending materials receipt'
                          }
                        </p>
                        {materialRequest.receivedAt && (
                          <span className="timeline-date">
                            {new Date(materialRequest.receivedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="detail-card full-width">
                <div className="card-header">
                  <h3><i className="fas fa-tools"></i> Actions</h3>
                </div>
                <div className="card-content">
                  <div className="action-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {isEditable && (
                      <>
                        <button onClick={() => setEditMode(true)} className="btn-primary">
                          <i className="fas fa-edit"></i>
                          Edit Request
                        </button>
                        <button onClick={handleCancelRequest} className="btn-danger">
                          <i className="fas fa-times"></i>
                          Cancel Request
                        </button>
                      </>
                    )}
                    {materialRequest.status === 'Approved' && isPIC && (
                      materialRequest.receivedByPIC ? (
                        <div className="received-badge" style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          borderRadius: '6px',
                          fontWeight: '600'
                        }}>
                          <i className="fas fa-check"></i>
                          Received by PIC
                          {materialRequest.receivedDate && (
                            <span>({new Date(materialRequest.receivedDate).toLocaleString()})</span>
                          )}
                        </div>
                      ) : (
                        <button onClick={handleMarkReceived} className="btn-success">
                          <i className="fas fa-check"></i>
                          Mark as Received
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialRequestDetail;
