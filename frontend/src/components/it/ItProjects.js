import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/it_style/It_Dash.css';
import '../style/it_style/It_Projects.css';
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList, FaPlus, FaEdit, FaTrash, FaSync } from 'react-icons/fa';

const PAGE_SIZE = 8;
const emptyForm = { projectName:'', contractor:'', budget:'', location:'', startDate:'', endDate:'', status:'Ongoing', projectmanager:'', areamanager:'', pic:[], staff:[], hrsite:[], manpower:[], tasks:[] };

export default function ItProjects(){
  const navigate = useNavigate();
  const user = useMemo(()=> JSON.parse(localStorage.getItem('user')||'{}'), []);
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);
  const [isHeaderCollapsed,setIsHeaderCollapsed]=useState(false);
  const [userName,setUserName]=useState(user?.name||'');
  const [userRole,setUserRole]=useState(user?.role||'');
  const [projects,setProjects]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [showForm,setShowForm]=useState(false);
  const [formData,setFormData]=useState(emptyForm);
  const [editingId,setEditingId]=useState(null);
  const [saving,setSaving]=useState(false);
  const [allLocations,setAllLocations]=useState([]);
  const [usersByRole,setUsersByRole]=useState({});
  const [userLookup,setUserLookup]=useState({});
  const [showAudit,setShowAudit]=useState(false);
  const [auditLogs,setAuditLogs]=useState([]);
  const [auditLoading,setAuditLoading]=useState(false);
  const [auditProjectId,setAuditProjectId]=useState(null);
  const [allManpower,setAllManpower]=useState([]);
  const [validationErrors,setValidationErrors]=useState([]);
  const [docFiles,setDocFiles]=useState([]);
  const [photoFiles,setPhotoFiles]=useState([]);

  useEffect(()=>{
    if(user?.role!== 'IT'){ setError('Forbidden'); setLoading(false); return; }
    load(); fetchLookups(); fetchManpower();
  },[]); // eslint-disable-line

  useEffect(()=>{ const onScroll=()=> setIsHeaderCollapsed((window.pageYOffset||document.documentElement.scrollTop)>50); window.addEventListener('scroll',onScroll); return ()=>window.removeEventListener('scroll',onScroll);},[]);
  useEffect(()=>{ const handler=e=>{ if(!e.target.closest('.user-profile')) setProfileMenuOpen(false); }; document.addEventListener('click',handler); return ()=>document.removeEventListener('click',handler);},[]);
  useEffect(()=>{ setUserName(user?.name||''); setUserRole(user?.role||'');},[user]);

  const handleLogout=()=>{ const token=localStorage.getItem('token'); api.post('/auth/logout',{}, {headers:{Authorization:`Bearer ${token}`}}).finally(()=>{localStorage.removeItem('token');localStorage.removeItem('user');navigate('/');});};

  async function load(){ setLoading(true); setError(''); try{ const {data}=await api.get('/projects'); setProjects(Array.isArray(data)?data:[]);}catch{ setError('Failed to load projects'); }finally{ setLoading(false);} }
  async function fetchLookups(){ try{ const [locRes, usersRes]= await Promise.all([api.get('/locations'), api.get('/auth/Users')]); setAllLocations(locRes.data||[]); const byRole={}; const lookup={}; const normRole=r=>{ if(!r) return r; return r.toLowerCase()==='pic'?'Person in Charge':r;}; (usersRes.data||[]).forEach(u=>{ const id=u._id||u.id; if(!id) return; const roleN=normRole(u.role||''); if(!byRole[roleN]) byRole[roleN]=[]; const rec={_id:String(id), name:u.name, role:roleN}; byRole[roleN].push(rec); lookup[String(id)]=u.name;}); setUsersByRole(byRole); setUserLookup(lookup);}catch(e){console.error(e);} }
  async function fetchManpower(){ try{ const {data}=await api.get('/manpower'); setAllManpower(Array.isArray(data)?data:[]);}catch{} }

  function openCreate(){ setEditingId(null); setFormData(emptyForm); setShowForm(true); }
  function openEdit(p){ setEditingId(p._id); setFormData({ projectName:p.projectName||'', contractor:p.contractor||'', budget:p.budget??'', location:p.location?._id||'', startDate:p.startDate? new Date(p.startDate).toISOString().slice(0,10):'', endDate:p.endDate? new Date(p.endDate).toISOString().slice(0,10):'', status:p.status||'Ongoing', projectmanager:p.projectmanager?._id||'', areamanager:p.areamanager?._id||'', pic:(p.pic||[]).map(x=>String(x._id||x)), staff:(p.staff||[]).map(x=>String(x._id||x)), hrsite:(p.hrsite||[]).map(x=>String(x._id||x)), manpower:(p.manpower||[]).map(x=>String(x._id||x)), tasks:p.tasks||[] }); setShowForm(true); }
  function handleChange(e){ const {name,value,multiple,options}=e.target; if(multiple){ const vals=Array.from(options).filter(o=>o.selected).map(o=>o.value); setFormData(f=>({...f,[name]:vals})); } else { setFormData(f=>({...f,[name]:value})); } }
  function validate(form){ const errs=[]; if(!form.projectName.trim()) errs.push('Project name required'); if(!form.location) errs.push('Location required'); if(!form.startDate) errs.push('Start date required'); if(!form.endDate) errs.push('End date required'); if(form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) errs.push('Start date must be before end date'); const totalPct=(form.tasks||[]).reduce((a,b)=> a + (Number(b.percent)||0),0); if(totalPct>100) errs.push('Total task percent exceeds 100%'); return errs; }
  async function submitForm(e){ e.preventDefault(); setSaving(true); const errs=validate(formData); setValidationErrors(errs); if(errs.length){ setSaving(false); return; } try{ const payload={...formData}; if(payload.budget==='') delete payload.budget; else payload.budget=Number(payload.budget); if(!payload.tasks) payload.tasks=[]; ['projectmanager','areamanager'].forEach(k=>{ if(!payload[k]) delete payload[k]; }); if(!editingId && (docFiles.length||photoFiles.length)){ const fd=new FormData(); Object.entries(payload).forEach(([k,v])=>{ if(Array.isArray(v)) v.forEach(val=>fd.append(k,val)); else fd.append(k,v); }); photoFiles.forEach(f=>fd.append('photos',f)); docFiles.forEach(f=>fd.append('documents',f)); await api.post('/projects', fd, {headers:{'Content-Type':'multipart/form-data'}}); } else if(editingId){ await api.patch(`/projects/${editingId}`, payload); } else { await api.post('/projects', payload); } setShowForm(false); await load(); }catch{ alert('Save failed'); } finally{ setSaving(false);} }
  async function remove(id){ if(!window.confirm('Delete this project? This cannot be undone.')) return; try{ await api.delete(`/projects/${id}`); setProjects(prev=>prev.filter(p=>p._id!==id)); }catch{ alert('Delete failed'); } }
  async function loadAudit(projectId){ setAuditLoading(true); setAuditProjectId(projectId); try{ const {data}=await api.get('/audit-logs',{params:{projectId}}); setAuditLogs(data||[]);}catch{ setAuditLogs([]);} finally{ setAuditLoading(false); setShowAudit(true);} }

  const filtered=useMemo(()=>{ const q=search.toLowerCase(); return projects.filter(p=> [p.projectName, p.contractor, p.location?.name].filter(Boolean).some(v=>v.toLowerCase().includes(q)));},[projects,search]);
  const totalPages=Math.ceil(filtered.length / PAGE_SIZE)||1; const paginated=filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return <div className="fadztrack-app-IT">{/* Header */}<div className="head-IT"><header className={`dashboard-header ${isHeaderCollapsed?'collapsed':''}`}><div className="header-top"><div className="logo-section" onClick={()=>navigate('/it')} style={{cursor:'pointer'}}><img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo"/><h1 className="header-brand">FadzTrack</h1></div><div className="user-profile" onClick={()=>setProfileMenuOpen(!profileMenuOpen)}><div className="profile-avatar">{userName?userName.charAt(0).toUpperCase():'I'}</div><div className={`profile-info ${isHeaderCollapsed?'hidden':''}`}><span className="profile-name">{userName}</span><span className="profile-role">{userRole}</span></div>{profileMenuOpen && <div className="profile-dropdown"><button onClick={handleLogout} className="logout-btn"><span>Logout</span></button></div>}</div></div><div className="header-bottom"><nav className="header-nav"><Link to="/it" className="nav-item"><FaTachometerAlt/><span className={isHeaderCollapsed?'hidden':''}>Dashboard</span></Link><Link to="/it/chat" className="nav-item"><FaComments/><span className={isHeaderCollapsed?'hidden':''}>Chat</span></Link><Link to="/it/material-list" className="nav-item"><FaBoxes/><span className={isHeaderCollapsed?'hidden':''}>Materials</span></Link><Link to="/it/manpower-list" className="nav-item"><FaUsers/><span className={isHeaderCollapsed?'hidden':''}>Manpower</span></Link><Link to="/it/auditlogs" className="nav-item"><FaClipboardList/><span className={isHeaderCollapsed?'hidden':''}>Audit Logs</span></Link><Link to="/it/projects" className="nav-item active"><FaClipboardList/><span className={isHeaderCollapsed?'hidden':''}>Projects</span></Link></nav></div></header></div>{/* Content */}<div className="main-content-IT"><main className="dashboard-content-IT" style={{width:'100%'}}><div className="dashboard-card-IT"><div className="accounts-header-IT" style={{marginBottom:'1rem'}}><h3 style={{margin:0}}>Projects</h3><div className="accounts-tools-IT" style={{gap:'0.5rem'}}><div className="search-box-IT" style={{maxWidth:240}}><input type="text" placeholder="Search projects" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="search-input-IT"/></div><button className="new-account-btn-IT" onClick={openCreate}><FaPlus style={{marginRight:6}}/>New</button><button className="export-btn-IT" onClick={load} title="Refresh list"><FaSync/></button></div></div>{loading && <p>Loading...</p>}{error && <p style={{color:'red'}}>{error}</p>}{!loading && !error && <div className="accounts-table-IT" style={{overflowX:'auto'}}><table><thead><tr><th>Name</th><th>Location</th><th>Budget</th><th>Start</th><th>End</th><th>Status</th><th style={{textAlign:'right'}}>Actions</th></tr></thead><tbody>{paginated.map(p=> <tr key={p._id}><td>{p.projectName}</td><td>{p.location?.name||'-'}</td><td>{p.budget? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.budget):'-'}</td><td>{p.startDate? new Date(p.startDate).toLocaleDateString():'-'}</td><td>{p.endDate? new Date(p.endDate).toLocaleDateString():'-'}</td><td>{p.status}</td><td style={{textAlign:'right',whiteSpace:'nowrap'}}><button className="edit-button-IT" onClick={()=>openEdit(p)} title="Edit"><FaEdit/></button><button className="status-toggle-button-IT" style={{marginLeft:4}} onClick={()=>loadAudit(p._id)} title="Audit Trail">🕑</button><button className="status-toggle-button-IT deactivate-IT" style={{marginLeft:4}} onClick={()=>remove(p._id)} title="Delete"><FaTrash/></button></td></tr>)}{paginated.length===0 && <tr><td colSpan={7} style={{textAlign:'center',padding:'1rem'}}>No projects found</td></tr>}</tbody></table></div>}{!loading && !error && <div className="pagination-IT" style={{marginTop:'0.75rem'}}><span className="pagination-info-IT">Page {page} of {totalPages}</span><div className="pagination-controls-IT"><button className="pagination-btn-IT prev-IT" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>&lt;</button><button className="pagination-btn-IT next-IT" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>&gt;</button></div></div>}</div></main></div>{showForm && <div className="modal-overlay" onClick={e=>{ if(e.target.classList.contains('modal-overlay')) setShowForm(false);}}><div className="modal-card large" style={{maxWidth:900}}><h2 style={{marginTop:0}}>{editingId?'Edit Project':'Create Project'}</h2>{validationErrors.length>0 && <div className="alert error" style={{marginBottom:'0.5rem'}}>{validationErrors.map((er,i)=><div key={i}>{er}</div>)}</div>}<form onSubmit={submitForm} className="grid-2col gap-md" style={{maxHeight:'70vh',overflow:'auto',paddingRight:8}}><fieldset className="section"><legend>Core</legend><label>Project Name<input name="projectName" value={formData.projectName} onChange={handleChange} required/></label><label>Contractor<input name="contractor" value={formData.contractor} onChange={handleChange}/></label><label>Budget<input name="budget" type="number" min="0" value={formData.budget} onChange={handleChange}/></label><label>Status<select name="status" value={formData.status} onChange={handleChange}><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option></select></label><label>Location<select name="location" value={formData.location} onChange={handleChange} required><option value="">-- select --</option>{allLocations.map(l=> <option key={l._id} value={l._id}>{l.name} {l.region?`(${l.region})`:''}</option>)}</select></label><label>Start Date<input name="startDate" type="date" value={formData.startDate} onChange={handleChange} required/></label><label>End Date<input name="endDate" type="date" value={formData.endDate} onChange={handleChange} required/></label></fieldset><fieldset className="section"><legend>Assignments</legend><label>Project Manager<select name="projectmanager" value={formData.projectmanager} onChange={handleChange}><option value="">-- none --</option>{(usersByRole['Project Manager']||[]).map(u=> <option key={u._id} value={u._id}>{u.name}</option>)}</select></label><label>Area Manager<select name="areamanager" value={formData.areamanager} onChange={handleChange}><option value="">-- none --</option>{(usersByRole['Area Manager']||[]).map(u=> <option key={u._id} value={u._id}>{u.name}</option>)}</select></label><label>PIC(s)<MultiBox name="pic" values={formData.pic} options={usersByRole['Person in Charge']||[]} userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,pic:vals}))}/></label><label>Staff<MultiBox name="staff" values={formData.staff} options={usersByRole['Staff']||[]} userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,staff:vals}))}/></label><label>HR - Site<MultiBox name="hrsite" values={formData.hrsite} options={usersByRole['HR - Site']||[]} userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,hrsite:vals}))}/></label><label>Manpower<MultiBox name="manpower" values={formData.manpower} options={allManpower} labelKey="name" idKey="_id" userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,manpower:vals}))}/></label></fieldset><fieldset className="section" style={{gridColumn:'1 / -1'}}><legend>Tasks</legend><TaskEditor tasks={formData.tasks} onChange={tasks=>setFormData(f=>({...f,tasks}))}/></fieldset>{!editingId && <fieldset className="section" style={{gridColumn:'1 / -1'}}><legend>Initial Files (optional)</legend><div className="flex-row gap-sm"><label className="uploader">Photos <input type="file" multiple accept="image/*" onChange={e=> setPhotoFiles(Array.from(e.target.files||[]))}/></label><label className="uploader">Documents <input type="file" multiple onChange={e=> setDocFiles(Array.from(e.target.files||[]))}/></label></div><small>{photoFiles.length} photo(s), {docFiles.length} document(s) selected</small></fieldset>}<div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',gap:'0.5rem',marginTop:'0.5rem'}}><button type="button" onClick={()=>setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving?'Saving...':'Save Project'}</button></div></form></div></div>}{showAudit && <div className="modal-overlay" onClick={e=>{ if(e.target.classList.contains('modal-overlay')) setShowAudit(false);}}><div className="modal-card" style={{maxWidth:900}}><h2 style={{marginTop:0}}>Audit Trail {auditProjectId && `for ${auditProjectId}`}</h2><button style={{position:'absolute',top:8,right:8}} onClick={()=>setShowAudit(false)}>Close</button>{auditLoading && <p>Loading audit logs...</p>}{!auditLoading && <div style={{maxHeight:400,overflow:'auto'}}><table className="pm-table"><thead><tr><th>Time</th><th>Action</th><th>User</th><th>Role</th><th>Description</th><th>Changed Fields</th></tr></thead><tbody>{auditLogs.map(l=> <tr key={l._id}><td>{new Date(l.timestamp).toLocaleString()}</td><td>{l.action}</td><td>{l.performedBy?.name || '—'}</td><td>{l.performedByRole}</td><td style={{minWidth:180}}>{l.description}</td><td style={{minWidth:220}}>{(l.meta?.changedFields||[]).length===0 && '—'}{(l.meta?.changedFields||[]).map((c,i)=><div key={i} style={{marginBottom:2}}><strong>{c.field}:</strong> <span style={{color:'#888'}}>{JSON.stringify(c.before)}</span> → <span>{JSON.stringify(c.after)}</span></div>)}</td></tr>)}{auditLogs.length===0 && !auditLoading && <tr><td colSpan={6} style={{textAlign:'center'}}>No logs</td></tr>}</tbody></table></div>}</div></div>}</div>;
}

function TaskEditor({ tasks, onChange }) {
  const [name,setName] = React.useState('');
  const [percent,setPercent] = React.useState('');
  function addTask(){
    if(!name.trim()) return;
    const pct = Number(percent)||0;
    onChange([...(tasks||[]), { name: name.trim(), percent: pct }]);
    setName(''); setPercent('');
  }
  function removeTask(i){ onChange((tasks||[]).filter((_,idx)=>idx!==i)); }
  function updateTask(i, field, value){ onChange((tasks||[]).map((t,idx)=> idx===i ? { ...t, [field]: field==='percent'?Number(value):value } : t)); }
  function onKey(e){ if(e.key==='Enter'){ e.preventDefault(); addTask(); } }
  return (
    <div className="task-editor">
      <ul>
        {(tasks||[]).map((t,i)=> <li key={i} style={{marginBottom:'4px'}}>
          <input value={t.name} onChange={e=>updateTask(i,'name',e.target.value)} style={{marginRight:4}} />
          <input type="number" value={t.percent} onChange={e=>updateTask(i,'percent',e.target.value)} style={{width:70, marginRight:4}} />%
          <button type="button" onClick={()=>removeTask(i)} style={{marginLeft:4}}>x</button>
        </li>)}
      </ul>
      <div style={{display:'flex',gap:4,marginTop:4}}>
        <input placeholder="Task name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={onKey} />
        <input placeholder="%" type="number" value={percent} onChange={e=>setPercent(e.target.value)} onKeyDown={onKey} style={{width:70}} />
        <button type="button" onClick={addTask}>Add</button>
      </div>
    </div>
  );
}

function MultiBox({ name, values, options, onChange, labelKey='name', idKey='_id', userLookup }) {
  const [input,setInput] = React.useState('');
  const filtered = (options||[]).filter(o=> (o[labelKey]||'').toLowerCase().includes(input.toLowerCase()));
  function toggle(id){ onChange(values.includes(id)? values.filter(v=>v!==id) : [...values,id]); }
  return <div className="multibox">
    <input placeholder="Filter..." value={input} onChange={e=>setInput(e.target.value)} />
    <div className="box-list">
      {filtered.map(o=> <div key={o[idKey]} className={values.includes(o[idKey])? 'box-item selected':'box-item'} onClick={()=>toggle(o[idKey])}>{o[labelKey]||o[idKey]}</div>)}
      {filtered.length===0 && (options||[]).length>0 && <div className="empty">No matches</div>}
      {(options||[]).length===0 && <div className="empty">Loading...</div>}
    </div>
    <div className="chips">
      {values.map(v=> {
        const obj = options.find(o=>o[idKey]===v);
        const name = obj ? (obj[labelKey]) : (userLookup ? userLookup[v] : null);
        return <span key={v} className="chip" onClick={()=>toggle(v)}>{name || v} ×</span>;
      })}
    </div>
  </div>;
}
