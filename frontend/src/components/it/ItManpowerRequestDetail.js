import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList, FaPlus, FaTrash, FaSave, FaTimes, FaEdit } from 'react-icons/fa';

const inputStyle = { width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontSize:14 };
const pill = (bg, color='#111827') => ({ background:bg, color, padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 });

const ItManpowerRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState(null);
  const [editMode, setEditMode] = useState(() => new URLSearchParams(location.search).get('edit') === '1');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [formData, setFormData] = useState({
    acquisitionDate:'', duration:'', project:'', projectName:'', manpowers:[{ type:'', quantity:'' }], description:''
  });

  // Fetch request
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/manpower-requests/${id}`, { headers:{ Authorization:`Bearer ${token}` }});
        setRequest(data);
        setFormData({
          acquisitionDate: data.acquisitionDate ? data.acquisitionDate.split('T')[0] : '',
          duration: data.duration || '',
          project: data.project?._id || data.project || '', // keep ID for updates
          projectName: (typeof data.project === 'object' && data.project?.projectName) ? data.project.projectName : data.projectName || '',
          manpowers: data.manpowers?.length ? data.manpowers.map(m => ({ type:m.type || '', quantity:m.quantity || '' })) : [{ type:'', quantity:'' }],
          description: data.description || ''
        });
      } catch (e) {
        console.error(e); setError('Failed to load request');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [id, token]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = e => { if (!e.target.closest('.user-profile')) setProfileMenuOpen(false); };
    document.addEventListener('click', handler); return () => document.removeEventListener('click', handler);
  }, []);

  const handleLogout = () => {
    api.post('/auth/logout', {}, { headers:{ Authorization:`Bearer ${token}` }}).finally(() => {
      localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/');
    });
  };

  const setField = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
  const updateManpowerRow = (i, field, value) => setFormData(prev => ({ ...prev, manpowers: prev.manpowers.map((r,idx)=> idx===i ? { ...r, [field]: value } : r) }));
  const addRow = () => setFormData(prev => ({ ...prev, manpowers:[...prev.manpowers, { type:'', quantity:'' }] }));
  const removeRow = (i) => setFormData(prev => ({ ...prev, manpowers: prev.manpowers.filter((_,idx)=>idx!==i) }));

  const validate = () => {
    if (!formData.acquisitionDate || !formData.duration || !formData.project || !formData.description) return 'All fields are required';
    if (!formData.manpowers.length) return 'At least one manpower row';
    if (formData.manpowers.some(m => !m.type.trim() || !m.quantity || isNaN(Number(m.quantity)) || Number(m.quantity) <= 0)) return 'Fix manpower rows';
    return '';
  };

  const handleSave = async () => {
    const v = validate(); if (v) { alert(v); return; }
    setSaving(true);
    try {
      const body = {
        acquisitionDate: formData.acquisitionDate,
        duration: Number(formData.duration),
        project: formData.project,
        description: formData.description,
        manpowers: formData.manpowers.map(m => ({ type: m.type.trim(), quantity: Number(m.quantity) }))
      };
      const res = await api.put(`/manpower-requests/${id}`, body, { headers:{ Authorization:`Bearer ${token}` }});
      if (res.status === 200) {
        alert('✅ Updated');
        setRequest(res.data.data || res.data); // controller returns { message, data }
        setEditMode(false);
      } else {
        alert(res.data?.message || 'Update failed');
      }
    } catch (e) {
      console.error(e); alert('Server error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this manpower request? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/manpower-requests/${id}`, { headers:{ Authorization:`Bearer ${token}` }});
      alert('🗑️ Deleted');
      navigate('/it/manpower-list');
    } catch (e) {
      alert('Delete failed');
    } finally { setDeleting(false); }
  };

  const statusColors = {
    Pending: pill('#fef3c7', '#92400e'),
    Approved: pill('#dcfce7', '#065f46'),
    Overdue: pill('#fee2e2', '#991b1b'),
    Completed: pill('#e0f2fe', '#075985')
  };

  if (loading) return <div className="dashboard-container"><div className="loading-spinner" />Loading...</div>;
  if (error || !request) return <div style={{ color:'red', padding:24 }}>{error || 'Request not found'}</div>;

  // IT can edit anything except Rejected (if that status exists)
  const nonEditableStatuses = ['Rejected'];
  const editable = !nonEditableStatuses.includes(request.status);

  return (
    <div className="dashboard-container">
      {/* Header matches IT dashboard styling */}
      <header className="dashboard-header">
        <div className="header-top">
          <div className="logo-container">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
            <span className="brand-name">FadzTrack</span>
          </div>
          <div className="user-profile" onClick={() => setProfileMenuOpen(p=>!p)}>
            <div className="profile-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'I'}</div>
            <div className="profile-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="dropdown-item">Logout</button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/it" className="nav-item"><FaTachometerAlt /><span>Dashboard</span></Link>
            <Link to="/it/chat" className="nav-item"><FaComments /><span>Chat</span></Link>
            <Link to="/it/material-list" className="nav-item"><FaBoxes /><span>Materials</span></Link>
            <Link to="/it/manpower-list" className="nav-item active"><FaUsers /><span>Manpower</span></Link>
            <Link to="/it/auditlogs" className="nav-item"><FaClipboardList /><span>Audit Logs</span></Link>
          </nav>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="form-container" style={{ maxWidth:900, margin:'40px auto', background:'#fff', borderRadius:16, padding:'32px 40px', boxShadow:'0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:24 }}>
            <div>
              <h2 style={{ margin:0, fontSize:30, fontWeight:700 }}>Manpower Request #{(request._id || '').slice(-5)}</h2>
              <div style={{ marginTop:8, fontSize:14, color:'#4b5563' }}>
                Project: <strong>{request.project?.projectName || 'N/A'}</strong> &nbsp;•&nbsp; Requested by {request.createdBy?.name}
              </div>
              <div style={{ marginTop:12 }}>{/* status badge */}
                <span style={statusColors[request.status] || pill('#e5e7eb')}>{request.status}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <button onClick={()=>navigate(-1)} style={btn('secondary')}>Back</button>
              {editable && !editMode && (
                <button onClick={()=>setEditMode(true)} style={btn('primary')}><FaEdit/> Edit</button>
              )}
              {editMode && (
                <>
                  <button disabled={saving} onClick={handleSave} style={btn('primary')}><FaSave/>{saving? ' Saving...' : ' Save'}</button>
                  <button disabled={saving} onClick={()=>{ setEditMode(false); /* reset form to original */ setFormData({
                    acquisitionDate: request.acquisitionDate ? request.acquisitionDate.split('T')[0] : '',
                    duration: request.duration || '',
                    project: request.project?._id || request.project || '',
                    projectName: request.project?.projectName || '',
                    manpowers: request.manpowers?.length ? request.manpowers.map(m => ({ type:m.type||'', quantity:m.quantity||'' })) : [{ type:'', quantity:'' }],
                    description: request.description || ''
                  }); }} style={btn('neutral')}><FaTimes/> Cancel</button>
                </>
              )}
              <button disabled={deleting} onClick={handleDelete} style={btn('danger')}>{deleting? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>

          {/* Content Sections */}
          <div style={{ marginTop:32, display:'grid', gap:32, gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))' }}>
            <div>
              <label style={labelStyle}>Target Acquisition Date</label>
              {editMode && editable ? (
                <input type="date" value={formData.acquisitionDate} onChange={e=>setField('acquisitionDate', e.target.value)} style={inputStyle} />
              ) : (
                <div style={valueBox}>{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Duration (days)</label>
              {editMode && editable ? (
                <input type="number" min={1} value={formData.duration} onChange={e=>setField('duration', e.target.value)} style={inputStyle} />
              ) : (
                <div style={valueBox}>{request.duration} days</div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Project</label>
              <div style={{ ...valueBox, background:'#f3f4f6' }}>{formData.projectName || request.project?.projectName || '—'}</div>
            </div>
          </div>

          <div style={{ marginTop:40 }}>
            <label style={labelStyle}>Manpower Needed</label>
            {editMode && editable ? (
              <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:16, background:'#f9fafb' }}>
                {formData.manpowers.map((row,i)=>(
                  <div key={i} style={{ display:'flex', gap:12, alignItems:'center', marginBottom:8 }}>
                    <input placeholder="Type" value={row.type} onChange={e=>updateManpowerRow(i,'type', e.target.value)} style={{ ...inputStyle, flex:2 }} />
                    <input type="number" min={1} placeholder="Qty" value={row.quantity} onChange={e=>updateManpowerRow(i,'quantity', e.target.value)} style={{ ...inputStyle, width:120 }} />
                    {formData.manpowers.length > 1 && (
                      <button type="button" onClick={()=>removeRow(i)} style={iconBtn('#dc2626')}><FaTrash/></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addRow} style={addRowBtn}><FaPlus/> Add Row</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
                {request.manpowers?.length ? request.manpowers.map((m,i)=>(
                  <span key={i} style={pill('#eef2ff', '#3730a3')}>{m.quantity} {m.type}</span>
                )) : <span style={{ color:'#6b7280' }}>No manpower entries</span>}
              </div>
            )}
          </div>

            <div style={{ marginTop:40 }}>
              <label style={labelStyle}>Description / Purpose</label>
              {editMode && editable ? (
                <textarea value={formData.description} onChange={e=>setField('description', e.target.value)} style={{ ...inputStyle, minHeight:140, resize:'vertical' }} />
              ) : (
                <div style={{ ...valueBox, minHeight:80 }}>{request.description}</div>
              )}
            </div>

          {!editable && (
            <div style={{ marginTop:32, padding:'12px 16px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, fontSize:14, color:'#92400e' }}>
              This request is <strong>{request.status}</strong> and cannot be edited by IT.
            </div>
          )}

          <AuditTrail requestId={request._id} />
        </div>
      </main>
    </div>
  );
};

const labelStyle = { display:'block', fontWeight:600, marginBottom:6, fontSize:13, letterSpacing:'.25px', color:'#374151' };
const valueBox = { padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', fontSize:14, minHeight:44, display:'flex', alignItems:'center' };
const iconBtn = (bg) => ({ background:bg, color:'#fff', border:'none', padding:'10px 12px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' });
const addRowBtn = { marginTop:8, display:'inline-flex', alignItems:'center', gap:8, background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontWeight:600, fontSize:14 };
const btn = (variant) => {
  const base = { display:'inline-flex', alignItems:'center', gap:8, padding:'10px 18px', fontSize:14, fontWeight:600, borderRadius:8, border:'none', cursor:'pointer' };
  switch(variant){
    case 'primary': return { ...base, background:'#2563eb', color:'#fff' };
    case 'danger': return { ...base, background:'#dc2626', color:'#fff' };
    case 'neutral': return { ...base, background:'#6b7280', color:'#fff' };
    default: return { ...base, background:'#e5e7eb', color:'#111827' };
  }
};

// Audit trail component (inline fetch)
const AuditTrail = ({ requestId }) => {
  const [logs, setLogs] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const token = localStorage.getItem('token');
  useEffect(() => {
    if (!open) return;
    const fetchLogs = async () => {
      try {
        const { data } = await api.get('/audit-logs', { headers:{ Authorization:`Bearer ${token}` } });
        // Filter to those referencing this request
        const filtered = data.filter(l => l.meta?.requestId === requestId);
        setLogs(filtered);
      } catch(e){ console.error('Audit fetch failed', e); }
    };
    fetchLogs();
  }, [open, requestId, token]);

  return (
    <div style={{ marginTop:48 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ ...btn('neutral'), background:'#f3f4f6', color:'#111827' }}>{open? 'Hide' : 'Show'} Audit Log</button>
      {open && (
        <div style={{ marginTop:16, maxHeight:260, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:12, padding:16, background:'#fafafa' }}>
          {logs.length === 0 && <div style={{ fontSize:13, color:'#6b7280' }}>No audit entries for this request.</div>}
          {logs.map(l => (
            <div key={l._id || l.timestamp} style={{ padding:'10px 12px', borderBottom:'1px solid #e5e7eb', fontSize:13, lineHeight:1.4 }}>
              <div style={{ fontWeight:600 }}>{l.action}</div>
              <div style={{ color:'#374151' }}>{l.description}</div>
              <div style={{ color:'#6b7280', fontSize:12, marginTop:4 }}>{new Date(l.timestamp).toLocaleString()} • {l.performedBy?.name} ({l.performedByRole})</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItManpowerRequestDetail;
