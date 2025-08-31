import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/pic_style/PicAllProjects.css';
import { FaSearch, FaSortAmountDown, FaCheckCircle, FaHourglassHalf, FaProjectDiagram } from 'react-icons/fa';
import AppHeader from '../layout/AppHeader';

const PicAllProjects = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const navigate = useNavigate();
  const [requests, setRequests] = useState([]); // (kept – may be surfaced later for quick view)
  const [activeTab, setActiveTab] = useState('Ongoing');
  const [ongoing, setOngoing] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null); // current active project (for nav view button)
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('startDate');
  const [sortDir, setSortDir] = useState('asc');

  // Profile menu and user display
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState(user?.name || '');
  const roleName = (user?.role || user?.userType || user?.position || user?.designation || '').toString();

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

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`),
      api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Completed`)
    ])
      .then(([resOngoing, resCompleted]) => {
        setOngoing(resOngoing.data || []);
        setCompleted(resCompleted.data || []);
        setLoading(false);
      })
      .catch(() => {
        setOngoing([]); setCompleted([]); setLoading(false);
      });
  }, [userId]);

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

  const decorate = (proj) => {
    const start = proj.startDate ? new Date(proj.startDate) : null;
    const end = proj.endDate ? new Date(proj.endDate) : null;
    const today = new Date();
    let totalDays = null, elapsedDays = null, pctTime = null, daysLeft = null;
    if (start && end && end > start) {
      totalDays = Math.round((end - start) / 86400000) || 1;
      elapsedDays = Math.min(totalDays, Math.max(0, Math.round((today - start) / 86400000)));
      pctTime = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
      daysLeft = Math.max(0, Math.round((end - today) / 86400000));
    }
    return { ...proj, totalDays, elapsedDays, pctTime, daysLeft };
  };

  const stats = useMemo(() => ({
    ongoing: ongoing.length,
    completed: completed.length,
    total: ongoing.length + completed.length
  }), [ongoing, completed]);

  const sortFn = (a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getVal = (p) => {
      switch (sortKey) {
        case 'name': return p.projectName?.toLowerCase() || '';
        case 'startDate': return p.startDate || '';
        case 'endDate': return p.endDate || '';
        case 'status': return p.status || '';
        default: return p.startDate || '';
      }
    };
    const av = getVal(a), bv = getVal(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  };

  const filteredOngoing = useMemo(()=> ongoing
    .filter(p=> p.projectName.toLowerCase().includes(search.toLowerCase()))
    .map(decorate)
    .sort(sortFn),[ongoing,search,sortKey,sortDir]);
  const filteredCompleted = useMemo(()=> completed
    .filter(p=> p.projectName.toLowerCase().includes(search.toLowerCase()))
    .map(decorate)
    .sort(sortFn),[completed,search,sortKey,sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (loading) return (
    <div className="dashboard-container"><div className="professional-loading-screen"><div className="loading-content"><div className="loading-logo"><img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="loading-logo-img" /></div><div className="loading-spinner-container"><div className="loading-spinner"/></div><div className="loading-text"><h2 className="loading-title">Loading Projects</h2><p className="loading-subtitle">Fetching your project list...</p></div></div></div></div>
  );

  const ProjectTable = ({ projects }) => (
    <div className="projects-table-wrapper glass-card">
      <table className="projects-table">
        <thead>
          <tr>
            <th onClick={()=>toggleSort('name')} className={sortKey==='name'? 'sorted':''}>Project</th>
            <th onClick={()=>toggleSort('status')} className={sortKey==='status'? 'sorted':''}>Status</th>
            <th>Timeline</th>
            <th onClick={()=>toggleSort('startDate')} className={sortKey==='startDate'? 'sorted':''}>Start</th>
            <th onClick={()=>toggleSort('endDate')} className={sortKey==='endDate'? 'sorted':''}>End</th>
            <th style={{textAlign:'right'}}>Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-row">No projects found.</td>
            </tr>
          )}
          {projects.map(proj => (
            <tr key={proj._id}>
              <td>
                <div className="proj-main">
                  <div className="proj-title">{proj.projectName}</div>
                  <div className="proj-meta">{proj.location?.name || 'No location'} • {proj.daysLeft != null ? `${proj.daysLeft}d left` : '—'}</div>
                </div>
              </td>
              <td><span className={`status-badge badge-${(proj.status||'').toLowerCase()}`}>{proj.status||'—'}</span></td>
              <td>
                {proj.pctTime != null ? (
                  <div className="timeline-bar" title={proj.totalDays? `${proj.elapsedDays}/${proj.totalDays} days (${proj.pctTime.toFixed(0)}%)` : ''}>
                    <div className="timeline-fill" style={{width:`${proj.pctTime}%`}} />
                  </div>
                ) : <span className="muted">—</span>}
              </td>
              <td>{proj.startDate ? new Date(proj.startDate).toLocaleDateString() : '—'}</td>
              <td>{proj.endDate ? new Date(proj.endDate).toLocaleDateString() : '—'}</td>
              <td style={{textAlign:'right'}}>
                <button className="btn-view" onClick={()=> navigate(`/pic/${proj._id}`)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Responsive card layout */}
      <div className="projects-cards">
        {projects.map(proj => (
          <div key={proj._id} className="project-card" onClick={()=> navigate(`/pic/${proj._id}`)}>
            <div className="pc-header">
              <span className={`status-dot ${(proj.status||'').toLowerCase()}`}></span>
              <h4>{proj.projectName}</h4>
            </div>
            <div className="pc-meta">{proj.location?.name || 'No location'}</div>
            <div className="pc-timeline">
              {proj.pctTime != null ? (
                <div className="timeline-bar small"><div className="timeline-fill" style={{width:`${proj.pctTime}%`}}/></div>
              ) : <div className="muted">No timeline</div>}
            </div>
            <div className="pc-dates">
              <span>{proj.startDate ? new Date(proj.startDate).toLocaleDateString() : '—'}</span>
              <span>→</span>
              <span>{proj.endDate ? new Date(proj.endDate).toLocaleDateString() : '—'}</span>
            </div>
            <div className="pc-footer">
              <button className="btn-view ghost" onClick={(e)=>{e.stopPropagation(); navigate(`/pic/${proj._id}`);}}>Open</button>
            </div>
          </div>
        ))}
        {projects.length === 0 && <div className="empty-placeholder">No projects found.</div>}
      </div>
    </div>
  );

  return (
    <div className="pic-projects-page">
  <AppHeader roleSegment="pic" />

      <section className="pp-hero">
        <div className="pp-hero-inner">
          <h1>My Projects</h1>
          <p>Quick overview of all projects you are assigned to. Search, filter and open a project instantly.</p>
          <div className="pp-stats">
            <div className="stat-card">
              <div className="sc-icon ongoing"><FaHourglassHalf/></div>
              <div className="sc-body">
                <span className="sc-label">Ongoing</span>
                <span className="sc-value">{stats.ongoing}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="sc-icon completed"><FaCheckCircle/></div>
              <div className="sc-body">
                <span className="sc-label">Completed</span>
                <span className="sc-value">{stats.completed}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="sc-icon total"><FaProjectDiagram/></div>
              <div className="sc-body">
                <span className="sc-label">Total</span>
                <span className="sc-value">{stats.total}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="pp-main">
        <div className="pp-controls">
          <div className="search-box">
            <FaSearch className="icon"/>
            <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Search project name..." />
          </div>
          <div className="filters">
            <div className="tab-group">
              <button className={activeTab==='Ongoing'? 'tg-btn active':'tg-btn'} onClick={()=> setActiveTab('Ongoing')}>Ongoing ({stats.ongoing})</button>
              <button className={activeTab==='Completed'? 'tg-btn active':'tg-btn'} onClick={()=> setActiveTab('Completed')}>Completed ({stats.completed})</button>
            </div>
            <div className="sort-box">
              <FaSortAmountDown className="icon"/>
              <select value={sortKey} onChange={e=> setSortKey(e.target.value)}>
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
          {activeTab==='Ongoing' ? <ProjectTable projects={filteredOngoing}/> : <ProjectTable projects={filteredCompleted}/>}        
        </div>
      </main>
    </div>
  );
};

export default PicAllProjects;
