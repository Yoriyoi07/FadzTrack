import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import '../style/pic_style/PicAllProjects.css';
import { FaSearch, FaSortAmountDown, FaCheckCircle, FaHourglassHalf, FaProjectDiagram } from 'react-icons/fa';

const PmAllProjects = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const navigate = useNavigate();

  // Default to All for consistency with PIC view
  const [activeTab, setActiveTab] = useState('All');
  const [ongoing, setOngoing] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('startDate');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(()=>{ if(!userId) return; setLoading(true); Promise.all([
    api.get(`/projects/by-user-status?userId=${userId}&role=projectmanager&status=Ongoing`),
    api.get(`/projects/by-user-status?userId=${userId}&role=projectmanager&status=Completed`)
  ]).then(([o,c])=>{ setOngoing(o.data||[]); setCompleted(c.data||[]); }).catch(()=>{ setOngoing([]); setCompleted([]);} ).finally(()=> setLoading(false)); },[userId]);

  useEffect(()=>{ if(!token || !userId) return; api.get(`/projects/by-user-status?userId=${userId}&role=projectmanager&status=Ongoing`).then(({data})=> setProject(data[0]||null)).catch(()=> setProject(null)); },[token,userId]);

  const decorate = (proj) => {
    const start = proj.startDate ? new Date(proj.startDate) : null;
    const end = proj.endDate ? new Date(proj.endDate) : null;
    const today = new Date();
    let totalDays=null, elapsedDays=null, pctTime=null, daysLeft=null;
    if(start && end && end>start){ totalDays=Math.round((end-start)/86400000)||1; elapsedDays=Math.min(totalDays,Math.max(0,Math.round((today-start)/86400000))); pctTime=Math.min(100,Math.max(0,(elapsedDays/totalDays)*100)); daysLeft=Math.max(0,Math.round((end-today)/86400000)); }
    return { ...proj, totalDays, elapsedDays, pctTime, daysLeft };
  };

  const sortFn = (a,b)=>{ const dir=sortDir==='asc'?1:-1; const val=(p)=>{ switch(sortKey){ case 'name': return p.projectName?.toLowerCase()||''; case 'startDate': return p.startDate||''; case 'endDate': return p.endDate||''; case 'status': return p.status||''; default: return p.startDate||'';} }; const av=val(a), bv=val(b); if(av<bv) return -1*dir; if(av>bv) return 1*dir; return 0; };
  const filteredOngoing = useMemo(()=> ongoing.filter(p=> p.projectName?.toLowerCase().includes(search.toLowerCase())).map(decorate).sort(sortFn),[ongoing,search,sortKey,sortDir]);
  const filteredCompleted = useMemo(()=> completed.filter(p=> p.projectName?.toLowerCase().includes(search.toLowerCase())).map(decorate).sort(sortFn),[completed,search,sortKey,sortDir]);
  const filteredAll = useMemo(()=> [...ongoing,...completed].filter(p=> p.projectName?.toLowerCase().includes(search.toLowerCase())).map(decorate).sort(sortFn),[ongoing,completed,search,sortKey,sortDir]);

  const stats = useMemo(()=> ({ ongoing: ongoing.length, completed: completed.length, total: ongoing.length+completed.length }),[ongoing,completed]);

  const toggleSort = (key)=> { if (sortKey === key) { setSortDir(d=> d==='asc'?'desc':'asc'); } else { setSortKey(key); setSortDir('asc'); } };

  if (loading) return <div className="dashboard-container"><div className="professional-loading-screen"><div className="loading-content"><div className="loading-logo"><img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="loading-logo-img" /></div><div className="loading-spinner-container"><div className="loading-spinner"/></div><div className="loading-text"><h2 className="loading-title">Loading Projects</h2><p className="loading-subtitle">Fetching your project list...</p></div></div></div></div>;

  const ProjectTable = ({ projects, showBadges }) => (
    <div className="projects-table-wrapper glass-card">
      <table className="projects-table">
        <thead>
          <tr>
            <th onClick={()=>toggleSort('name')} className={sortKey==='name'? 'sorted':''}>Project</th>
            <th onClick={()=>toggleSort('status')} className={`${sortKey==='status'? 'sorted ':''}status-col`}>Status</th>
            <th>Timeline</th>
            <th onClick={()=>toggleSort('startDate')} className={sortKey==='startDate'? 'sorted':''}>Start</th>
            <th onClick={()=>toggleSort('endDate')} className={sortKey==='endDate'? 'sorted':''}>End</th>
            <th style={{textAlign:'right'}}>Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.length===0 && <tr><td colSpan={6} className="empty-row">No projects found.</td></tr>}
          {projects.map(p=> (
            <tr key={p._id}>
              <td>
                <div className="proj-main">
                  <div className="proj-title">{p.projectName}</div>
                  <div className="proj-meta">{p.location?.name || 'No location'} • {p.daysLeft!=null ? `${p.daysLeft}d left` : '—'}</div>
                </div>
              </td>
              <td className="status-col">{showBadges ? <span className={`status-badge badge-${(p.status||'').toLowerCase()}`}>{p.status||'—'}</span> : <span className="status-plain">{p.status||'—'}</span>}</td>
              <td>{p.pctTime!=null ? <div className="timeline-bar" title={p.totalDays? `${p.elapsedDays}/${p.totalDays} days (${p.pctTime.toFixed(0)}%)` : ''}><div className="timeline-fill" style={{width:`${p.pctTime}%`}}/></div> : <span className="muted">—</span>}</td>
              <td>{p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'}</td>
              <td>{p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</td>
              <td style={{textAlign:'right'}}><button className="btn-view" onClick={()=> navigate(`/pm/viewprojects/${p._id}`)}>View</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="projects-cards">
        {projects.map(p=> (
          <div key={p._id} className="project-card" onClick={()=> navigate(`/pm/viewprojects/${p._id}`)}>
            {showBadges ? <div className="pc-status"><span className={`status-badge badge-${(p.status||'').toLowerCase()}`}>{p.status||'—'}</span></div> : <div className="pc-status-plain">{p.status||'—'}</div>}
            <div className="pc-header"><h4>{p.projectName}</h4></div>
            <div className="pc-meta">{p.location?.name||'No location'}</div>
            <div className="pc-timeline">{p.pctTime!=null ? <div className="timeline-bar small"><div className="timeline-fill" style={{width:`${p.pctTime}%`}}/></div> : <div className="muted">No timeline</div>}</div>
            <div className="pc-dates"><span>{p.startDate? new Date(p.startDate).toLocaleDateString(): '—'}</span><span>→</span><span>{p.endDate? new Date(p.endDate).toLocaleDateString(): '—'}</span></div>
            <div className="pc-footer"><button className="btn-view ghost" onClick={(e)=> { e.stopPropagation(); navigate(`/pm/viewprojects/${p._id}`); }}>Open</button></div>
          </div>
        ))}
        {projects.length===0 && <div className="empty-placeholder">No projects found.</div>}
      </div>
    </div>
  );

  return (
    <div className="pic-projects-page">
      <AppHeader roleSegment="pm" />
      <section className="pp-hero">
        <div className="pp-hero-inner">
          <h1>My Projects</h1>
          <p>Overview of all projects you manage. Search, filter and open a project instantly.</p>
          <div className="pp-stats">
            <div className={`stat-card stat-click ${activeTab==='Ongoing' ? 'active' : ''}`} onClick={()=> setActiveTab('Ongoing')} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ setActiveTab('Ongoing'); e.preventDefault(); }}} aria-pressed={activeTab==='Ongoing'}>
              <div className="sc-icon ongoing"><FaHourglassHalf/></div>
              <div className="sc-body"><span className="sc-label">Ongoing</span><span className="sc-value">{stats.ongoing}</span></div>
            </div>
            <div className={`stat-card stat-click ${activeTab==='Completed' ? 'active' : ''}`} onClick={()=> setActiveTab('Completed')} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ setActiveTab('Completed'); e.preventDefault(); }}} aria-pressed={activeTab==='Completed'}>
              <div className="sc-icon completed"><FaCheckCircle/></div>
              <div className="sc-body"><span className="sc-label">Completed</span><span className="sc-value">{stats.completed}</span></div>
            </div>
            <div className={`stat-card stat-click ${activeTab==='All' ? 'active' : ''}`} onClick={()=> setActiveTab('All')} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ setActiveTab('All'); e.preventDefault(); }}} aria-pressed={activeTab==='All'}>
              <div className="sc-icon total"><FaProjectDiagram/></div>
              <div className="sc-body"><span className="sc-label">Total</span><span className="sc-value">{stats.total}</span></div>
            </div>
          </div>
        </div>
      </section>
      <main className="pp-main">
        <div className="pp-controls">
          <div className="search-box"><FaSearch className="icon"/><input placeholder="Search project name..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
          <div className="filters">
            <div className="tab-group">
              <button className={activeTab==='All'? 'tg-btn active':'tg-btn'} onClick={()=> setActiveTab('All')}>All ({stats.total})</button>
              <button className={activeTab==='Ongoing'? 'tg-btn active':'tg-btn'} onClick={()=> setActiveTab('Ongoing')}>Ongoing ({stats.ongoing})</button>
              <button className={activeTab==='Completed'? 'tg-btn active':'tg-btn'} onClick={()=> setActiveTab('Completed')}>Completed ({stats.completed})</button>
            </div>
            <div className="sort-box">
              <FaSortAmountDown className="icon"/>
              <select value={sortKey} onChange={e=>setSortKey(e.target.value)}>
                <option value="startDate">Sort: Start Date</option>
                <option value="endDate">Sort: End Date</option>
                <option value="name">Sort: Name</option>
                <option value="status">Sort: Status</option>
              </select>
              <button className="dir-btn" onClick={()=> setSortDir(d=> d==='asc'?'desc':'asc')} aria-label="Toggle direction">{sortDir==='asc'?'↑':'↓'}</button>
            </div>
          </div>
        </div>
        <div className="pp-table-area">
          <ProjectTable 
            projects={activeTab==='All' ? filteredAll : activeTab==='Ongoing' ? filteredOngoing : filteredCompleted}
            showBadges={activeTab !== 'All'}
          />
        </div>
      </main>
    </div>
  );
};

export default PmAllProjects;