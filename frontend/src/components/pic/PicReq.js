import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; 
import NotificationBell from '../NotificationBell';
import '../style/pic_style/Pic_Req.css';
// Nav icons
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram } from 'react-icons/fa';

const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

const MaterialRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?._id;

  const [requests, setRequests] = useState([]);
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(user?.name || '');
  const [editMode, setEditMode] = useState(false);
  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const isPIC = user?._id === requestData?.createdBy?._id;

  useEffect(() => {
    api.get(`/requests/${id}`)
      .then(res => {
        const data = res.data;
        setRequestData(data);
        const materialsWithIds = (data.materials || []).map((mat, idx) => ({
          ...mat,
          id: mat.id || Date.now() + idx
        }));
        setMaterials(materialsWithIds);
        setDescription(data.description || '');
        setAttachments(data.attachments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

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
      const res = await api.put(`/requests/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data;

      const updatedMaterialsWithIds = (updated.materials || []).map((mat, idx) => ({
        ...mat,
        id: mat.id || Date.now() + idx
      }));
      setRequestData(updated);
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
    api.delete(`/requests/${id}`)
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
      await api.patch(`/requests/${id}/received`);
      alert('Request marked as received!');
      window.location.reload();
    } catch (err) {
      alert('Failed to mark as received');
      console.error(err);
    }
  };

  const isEditable = [
    'Pending PM',
    'Pending AM',
    'Pending CEO'
  ].includes(requestData?.status);

  // Only fetch user's active/ongoing project
  useEffect(() => {
    if (!token || !userId) return;
    const fetchActiveProject = async () => {
      try {
        const { data } = await api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`);
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchActiveProject();
  }, [token, userId]);

  // Fetch requests for this PIC's current project **only**
  useEffect(() => {
    if (!token || !project) return;

    api.get('/requests/mine', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => {
        const projectRequests = Array.isArray(data)
          ? data.filter(r => r.project && r.project._id === project._id)
          : [];
        setRequests(projectRequests);
      })
      .catch(() => setRequests([]));
  }, [token, project]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading request details...</p>
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="error-container">
        <p>Request not found</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="header">
  <div className="logo-container">
    <img
      src={require('../../assets/images/FadzLogo1.png')}
      alt="FadzTrack Logo"
      className="logo-img"
    />
    <h1 className="brand-name">FadzTrack</h1>
  </div>

  <nav className="nav-menu">
    <Link to="/pic" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
    <Link to="/pic/chat" className="nav-link"><FaComments /> Chat</Link>
    {project && (
      <Link to={`/pic/projects/${project._id}/request`} className="nav-link">
        <FaClipboardList /> Requests
      </Link>
    )}
    {project && (
      <Link to={`/pic/${project._id}`} className="nav-link">
        <FaEye /> View Project
      </Link>
    )}
    <Link to="/pic/projects" className="nav-link"><FaProjectDiagram /> My Projects</Link>
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

      
      {/* Main Dashboard Layout with Sidebar */}
      <div className="dashboard-layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>
                    {chat.initial}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Main Content */}
        <div className="main-content-picmatreq">
          <div className="request-materials-container-picmatreq">
            <h1 className="page-title-picmatreq">Material Request #{requestData.requestNumber}</h1>
            <div className="project-details-box" style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{requestData.project?.projectName || '-'}</h2>
              <p style={{ margin: 0, fontStyle: 'italic' }}>{requestData.project?.location || '-'}</p>
              <p style={{ margin: 0, color: '#555' }}>{requestData.project?.targetDate || ''}</p>
            </div>

            {editMode && isEditable ? (
              <form className="materials-form-picmatreq" onSubmit={e => { e.preventDefault(); handleSaveEdit(); }}>
                {/* ... (unchanged) ... */}
              </form>
            ) : (
              <>
                <div className="materials-section">
                  <h2 className="section-title">Material to be Requested</h2>
                  <div className="materials-list">
                    {requestData.materials?.map((mat, idx) => (
                      <div key={idx} className="material-item">
                        <span className="material-name">
                          <strong>Material:</strong> {mat.materialName}
                        </span>
                        <span className="material-quantity">
                          <strong>Quantity:</strong> {mat.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="attachments-section">
                  <h2 className="section-title">Attachment Proof</h2>
                  <div className="attachments-grid">
                    {requestData.attachments?.length
                      ? requestData.attachments.map((file, idx) => (
                          <div key={idx} className="attachment-item">
                            <img src={getAttachmentUrl(file)} alt={`Attachment ${idx + 1}`} className="attachment-image" style={{ width: '200px', height: '200px'}} />
                          </div>
                      )) : <div>No attachments</div>}
                  </div>
                </div>

                <div className="description-section">
                  <h2 className="section-title">Request Description</h2>
                  <div className="description-content">
                    <p>{requestData.description}</p>
                  </div>
                </div>

                {/* CEO FINAL APPROVAL SECTION (always show PDF link if exists) */}
                {requestData.status === 'Approved' && (requestData.purchaseOrder || requestData.totalValue) && (
                  <div className="ceo-approval-section" style={{
                    margin: '30px 0 20px 0', padding: '18px', border: '1px solid #ebebeb', borderRadius: 8, background: '#f8fafc'
                  }}>
                    <h2 style={{ margin: 0, marginBottom: 8, color: '#1955a4' }}>CEO Final Approval</h2>
                    <div style={{ fontSize: 16 }}>
                      {requestData.purchaseOrder && (
                        <div style={{ marginBottom: 4 }}>
                          <strong>Purchase Order #:</strong> {requestData.purchaseOrder}
                        </div>
                      )}
                      {requestData.totalValue && (
                        <div>
                          <strong>Total Value (₱):</strong> {Number(requestData.totalValue).toLocaleString()}
                        </div>
                      )}
                      {requestData.ceoApprovalPDF && (
                        <div style={{ marginTop: 8 }}>
                          <a
                            href={`http://localhost:5000${requestData.ceoApprovalPDF}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#1857a5',
                              textDecoration: 'underline',
                              fontWeight: 500,
                              fontSize: 15,
                              marginLeft: 10
                            }}
                          >
                            View CEO Approval PDF
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="action-buttons">
                  <button onClick={handleBack} className="back-btn">Back</button>
                  {isEditable && (
                    <>
                      <button onClick={() => setEditMode(true)} className="edit-btn">Edit</button>
                      <button onClick={handleCancelRequest} className="cancel-btn">Cancel Request</button>
                    </>
                  )}
                  {requestData.status === 'Approved' && isPIC && (
                    requestData.receivedByPIC ? (
                      <span className="received-badge">
                        <span>✔</span> Received by PIC&nbsp;
                        {requestData.receivedDate && (
                          <span>({new Date(requestData.receivedDate).toLocaleString()})</span>
                        )}
                      </span>
                    ) : (
                      <button onClick={handleMarkReceived} className="received-btn">Mark as Received</button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MaterialRequestDetail;
