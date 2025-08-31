import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import '../style/pic_style/PicAllProjects.css'; // reuse existing styling
import { FaSearch, FaSortAmountDown, FaCheckCircle, FaHourglassHalf, FaProjectDiagram } from 'react-icons/fa';

const PmAllProjects = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Ongoing');
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

  const projects = activeTab==='Ongoing'? filteredOngoing : filteredCompleted;

  return (
    <div className="pic-projects-page">
      <AppHeader roleSegment="pm" />
      <section className="pp-hero">
        <div className="pp-hero-inner">
          <h1>My Projects</h1>
          <p>Overview of all projects you manage. Search, sort and open a project.</p>
          <div className="pp-stats">
            <div className="stat-card">
              <div className="sc-icon ongoing"><FaHourglassHalf/></div>
              <div className="sc-body"><span className="sc-label">Ongoing</span><span className="sc-value">{ongoing.length}</span></div>
            </div>
            <div className="stat-card">
              <div className="sc-icon completed"><FaCheckCircle/></div>
              <div className="sc-body"><span className="sc-label">Completed</span><span className="sc-value">{completed.length}</span></div>
            </div>
            <div className="stat-card">
              <div className="sc-icon total"><FaProjectDiagram/></div>
              <div className="sc-body"><span className="sc-label">Total</span><span className="sc-value">{ongoing.length+completed.length}</span></div>
            </div>
          </div>
        </div>
      </section>
      <main className="pp-main">
        <div className="pp-controls">
          <div className="search-box"><FaSearch className="icon"/><input placeholder="Search projects..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
          <div className="filters">
            <div className="tab-group">
              {['Ongoing','Completed'].map(tab=> <button key={tab} className={`tg-btn ${activeTab===tab?'active':''}`} onClick={()=> setActiveTab(tab)}>{tab}</button>)}
            </div>
            <div className="sort-box">
              <FaSortAmountDown className="icon"/>
              <select value={sortKey} onChange={e=>setSortKey(e.target.value)}>
                <option value="startDate">Start Date</option>
                <option value="endDate">End Date</option>
                <option value="name">Name</option>
                <option value="status">Status</option>
              </select>
              <button className="dir-btn" onClick={()=> setSortDir(d=> d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑':'↓'}</button>
            </div>
          </div>
        </div>
        <div className="projects-table-wrapper">
          <table className="projects-table">
            <thead>
              <tr>
                <th onClick={()=> setSortKey('name')}>Project</th>
                <th onClick={()=> setSortKey('startDate')}>Start</th>
                <th onClick={()=> setSortKey('endDate')}>End</th>
                <th>Status</th>
                <th>Timeline</th>
                <th>Days Left</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="empty-row">Loading projects...</td></tr> : projects.length===0 ? <tr><td colSpan="7" className="empty-row">No projects</td></tr> : projects.map(p=> (
                <tr key={p._id} onClick={()=> navigate(`/pm/viewprojects/${p._id}`)} style={{cursor:'pointer'}}>
                  <td>
                    <div className="proj-main">
                      <span className="proj-title">{p.projectName}</span>
                      <span className="proj-meta">{p.location?.name||'No location'}</span>
                    </div>
                  </td>
                  <td>{p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'}</td>
                  <td>{p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</td>
                  <td><span className={`status-badge badge-${(p.status||'').toLowerCase()}`}>{p.status||'Unknown'}</span></td>
                  <td>
                    {p.pctTime!=null ? <div className="timeline-bar small"><div className="timeline-fill" style={{width:`${p.pctTime}%`}}/></div> : <span className="muted">—</span>}
                  </td>
                  <td>{p.daysLeft!=null ? p.daysLeft : '—'}</td>
                  <td><button className="btn-view ghost" onClick={(e)=> { e.stopPropagation(); navigate(`/pm/viewprojects/${p._id}`); }}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="projects-cards">
            {projects.map(p=> (
              <div key={p._id} className="project-card" onClick={()=> navigate(`/pm/viewprojects/${p._id}`)}>
                <div className="pc-header"><span className={`status-dot ${(p.status||'').toLowerCase()}`}></span><h4>{p.projectName}</h4></div>
                <div className="pc-meta">{p.location?.name||'No location'}</div>
                <div className="pc-timeline">{p.pctTime!=null ? <div className="timeline-bar small"><div className="timeline-fill" style={{width:`${p.pctTime}%`}}/></div> : <div className="muted">No timeline</div>}</div>
                <div className="pc-dates"><span>{p.startDate? new Date(p.startDate).toLocaleDateString(): '—'}</span><span>→</span><span>{p.endDate? new Date(p.endDate).toLocaleDateString(): '—'}</span></div>
                <div className="pc-footer"><button className="btn-view ghost" onClick={(e)=> { e.stopPropagation(); navigate(`/pm/viewprojects/${p._id}`); }}>Open</button></div>
              </div>
            ))}
            {!loading && projects.length===0 && <div className="empty-placeholder">No projects found.</div>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PmAllProjects;