import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList, FaPlus, FaTrash, FaSave, FaArrowLeft } from 'react-icons/fa';

/*
  IT Manpower Request Edit Page
  - Mirrors PM manpower request form but limited to editing existing request fields
  - Loads request via /manpower-requests/:id
  - Submits updates via PUT /manpower-requests/:id
*/

const ItManpowerRequestEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    acquisitionDate: '',
    duration: '',
    project: '',
    manpowers: [{ type: '', quantity: '' }],
    description: ''
  });

  // Fetch existing request
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/manpower-requests/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setFormData({
          acquisitionDate: data.acquisitionDate ? data.acquisitionDate.split('T')[0] : '',
          duration: data.duration || '',
            project: data.project?._id || data.project || '',
          manpowers: data.manpowers && data.manpowers.length ? data.manpowers.map(m => ({ type: m.type || '', quantity: m.quantity || '' })) : [{ type: '', quantity: '' }],
          description: data.description || ''
        });
      } catch (e) {
        console.error(e);
        setError('Failed to load manpower request');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id, token]);

  useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.user-profile')) setProfileMenuOpen(false); };
    document.addEventListener('click', handler); return () => document.removeEventListener('click', handler);
  }, []);

  const handleLogout = () => {
    api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    });
  };

  const updateManpowerRow = (idx, field, value) => {
    setFormData(prev => ({
      ...prev,
      manpowers: prev.manpowers.map((r,i) => i===idx ? { ...r, [field]: value } : r)
    }));
  };

  const addRow = () => setFormData(prev => ({ ...prev, manpowers: [...prev.manpowers, { type: '', quantity: '' }] }));
  const removeRow = (idx) => setFormData(prev => ({ ...prev, manpowers: prev.manpowers.filter((_,i)=>i!==idx) }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!formData.acquisitionDate || !formData.duration || !formData.project || !formData.description) return 'All fields are required';
    if (!formData.manpowers.length) return 'At least one manpower entry is required';
    const invalid = formData.manpowers.some(m => !m.type.trim() || !m.quantity || isNaN(Number(m.quantity)) || Number(m.quantity) <= 0);
    if (invalid) return 'Each manpower row needs a type and positive quantity';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valErr = validate();
    if (valErr) { alert(valErr); return; }
    setSaving(true);
    try {
      const body = {
        acquisitionDate: formData.acquisitionDate,
        duration: Number(formData.duration),
        project: formData.project,
        description: formData.description,
        manpowers: formData.manpowers.map(m => ({ type: m.type.trim(), quantity: Number(m.quantity) }))
      };
      const res = await api.put(`/manpower-requests/${id}`, body, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 200) {
        alert('✅ Manpower request updated');
        navigate(`/it/manpower-list/${id}`);
      } else {
        alert(res.data?.message || 'Update failed');
      }
    } catch (e) {
      console.error(e);
      alert('Server error while updating');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="dashboard-container"><div className="loading-spinner"/>Loading...</div>;
  if (error) return <div style={{ color:'red', padding:20 }}>{error}</div>;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-top">
          <div className="logo-container">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
            <span className="brand-name">FadzTrack</span>
          </div>
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
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
        <form onSubmit={handleSubmit} className="form-container" style={{ maxWidth: 350, margin: '20px auto', background:'#fff', borderRadius:4, padding:12, boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ textAlign:'center', marginBottom: 12, fontSize:'1rem', color:'#1e293b' }}>Edit Manpower Request</h2>

          <div style={{ display:'flex', gap:6, alignItems:'end', marginBottom:10 }}>
            <div style={{ flex:'1.2' }}>
              <label style={{ display:'block', fontWeight:500, marginBottom:2, fontSize:'0.7rem', color:'#374151' }}>Target Date</label>
              <input type="date" name="acquisitionDate" value={formData.acquisitionDate} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={{ flex:'0.8' }}>
              <label style={{ display:'block', fontWeight:500, marginBottom:2, fontSize:'0.7rem', color:'#374151' }}>Duration (days)</label>
              <input type="number" name="duration" value={formData.duration} onChange={handleChange} min={1} required style={inputStyle} />
            </div>
            <div style={{ flex:'1.5' }}>
              <label style={{ display:'block', fontWeight:500, marginBottom:2, fontSize:'0.7rem', color:'#374151' }}>Project</label>
              <input type="text" value={formData.project} readOnly style={{ ...inputStyle, background:'#f9fafb', color:'#6b7280' }} />
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <label style={{ fontWeight:500, fontSize:'0.7rem', color:'#374151' }}>Manpower Requirements</label>
              <button type="button" onClick={addRow} style={addBtnStyle}><FaPlus/> Add</button>
            </div>
            <div style={{ border:'1px solid #e5e7eb', borderRadius:3, padding:3, background:'#fff' }}>
              {formData.manpowers.map((row, idx) => (
                <div key={idx} style={{ display:'flex', gap:4, alignItems:'center', marginBottom:2 }}>
                  <input placeholder="Type (e.g. Mason)" value={row.type} onChange={e=>updateManpowerRow(idx,'type',e.target.value)} style={{ ...inputStyle, flex: '1' }} />
                  <input type="number" placeholder="Qty" value={row.quantity} min={1} onChange={e=>updateManpowerRow(idx,'quantity',e.target.value)} style={{ ...inputStyle, width:50 }} />
                  {formData.manpowers.length > 1 && (
                    <button type="button" onClick={()=>removeRow(idx)} style={removeBtnStyle}><FaTrash/></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontWeight:500, marginBottom:2, fontSize:'0.7rem', color:'#374151' }}>Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} required style={{ ...inputStyle, minHeight:45, resize:'vertical' }} />
          </div>

          <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:24 }}>
            <button type="button" onClick={()=>navigate(-1)} style={secondaryBtn}><FaArrowLeft/> Back</button>
            <button type="submit" disabled={saving} style={primaryBtn}><FaSave/>{saving? ' Saving...' : ' Save Changes'}</button>
          </div>
        </form>
      </main>
    </div>
  );
};

const inputStyle = { width:'100%', padding:'4px 6px', border:'1px solid #d1d5db', borderRadius:3, fontSize:11, background:'#fff' };
const addBtnStyle = { display:'flex', alignItems:'center', gap:2, background:'#10b981', color:'#fff', border:'none', borderRadius:3, padding:'3px 6px', cursor:'pointer', fontSize:10, fontWeight:500 };
const removeBtnStyle = { background:'#ef4444', color:'#fff', border:'none', padding:'3px 4px', borderRadius:2, cursor:'pointer', fontSize:8, width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center' };
const primaryBtn = { display:'flex', alignItems:'center', gap:3, background:'#3b82f6', color:'#fff', padding:'4px 8px', border:'none', borderRadius:3, fontSize:11, cursor:'pointer', fontWeight:500 };
const secondaryBtn = { display:'flex', alignItems:'center', gap:3, background:'#6b7280', color:'#fff', padding:'4px 8px', border:'none', borderRadius:3, fontSize:11, cursor:'pointer', fontWeight:500 };

export default ItManpowerRequestEdit;
