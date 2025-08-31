import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import '../style/it_style/It_Projects.css';
import { 
  FaProjectDiagram, FaSearch, FaChevronUp, FaChevronDown, FaTh, FaList,
  FaMapMarkerAlt, FaUserTie, FaBuilding, FaCalendarAlt, FaUsers as FaUsersIcon,
  FaMoneyBillWave, FaClock, FaCheckCircle
} from 'react-icons/fa';

const CeoProj = () => {
  const navigate = useNavigate();
  const user = useMemo(()=> { try { return JSON.parse(localStorage.getItem('user')||'{}'); } catch { return {}; } }, []);
  const [projects,setProjects]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');
  const [viewMode,setViewMode]=useState('grid');
  const [searchTerm,setSearchTerm]=useState('');
  const [sortBy,setSortBy]=useState('name');
  const [sortOrder,setSortOrder]=useState('asc');

  useEffect(()=>{ (async()=>{ try{ const {data}=await api.get('/projects'); setProjects(Array.isArray(data)?data:[]);}catch{ setError('Failed to fetch projects'); }finally{ setLoading(false);} })(); },[]);

  const getStatusColor = (status) => {
    switch ((status||'').toLowerCase()) {
      case 'completed': return '#10B981';
      case 'ongoing':
      case 'on going': return '#3B82F6';
      case 'pending':
      case 'not started': return '#F59E0B';
      default: return '#6B7280';
    }
  };
  const getStatusIcon = (status) => {
    switch ((status||'').toLowerCase()) {
      case 'completed': return <FaCheckCircle/>;
      case 'ongoing':
      case 'on going': return <FaClock/>;
      case 'pending':
      case 'not started': return <FaClock/>;
      default: return <FaClock/>;
    }
  };

  const displayedProjects = useMemo(()=> {
    return projects
      .filter(p=> {
        if(filter==='completed') return p.status==='Completed';
        if(filter==='ongoing') return ['Ongoing','On Going'].includes(p.status);
        if(filter==='pending') return ['Pending','Not Started'].includes(p.status);
        return true;
      })
      .filter(p=> {
        if(!searchTerm) return true; const s=searchTerm.toLowerCase();
        return (p.projectName||'').toLowerCase().includes(s) || (p.location?.name||'').toLowerCase().includes(s) || (p.projectmanager?.name||'').toLowerCase().includes(s) || (p.contractor||'').toLowerCase().includes(s);
      })
      .sort((a,b)=> {
        let av,bv; switch (sortBy){
          case 'location': av=a.location?.name||''; bv=b.location?.name||''; break;
          case 'manager': av=a.projectmanager?.name||''; bv=b.projectmanager?.name||''; break;
          case 'status': av=a.status||''; bv=b.status||''; break;
          case 'startDate': av=new Date(a.startDate||0); bv=new Date(b.startDate||0); break;
          default: av=a.projectName||''; bv=b.projectName||'';
        }
        if(sortOrder==='asc') return av>bv?1:-1; else return av<bv?1:-1;
      });
  },[projects,filter,searchTerm,sortBy,sortOrder]);

  if(loading){
    return <div className="loading-container"><div className="loading-spinner"/><p>Loading projects...</p></div>;
  }

  return (
    <div className="dashboard-container">
      <AppHeader roleSegment="ceo" />
      <main className="dashboard-main">
        <div className="projects-container">
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">Projects</h1>
              <p className="page-subtitle">Portfolio overview</p>
            </div>
            <div className="page-actions" style={{gap:'0.5rem'}}>
              <div className="search-container" style={{minWidth:240}}>
                <FaSearch className="search-icon" />
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search..." className="search-input" />
              </div>
              <div className="view-mode-container">
                <button className={`view-mode-btn ${viewMode==='grid'?'active':''}`} onClick={()=>setViewMode('grid')}><FaTh/></button>
                <button className={`view-mode-btn ${viewMode==='list'?'active':''}`} onClick={()=>setViewMode('list')}><FaList/></button>
              </div>
            </div>
          </div>

          <div className="projects-controls" style={{marginTop:0}}>
            <div className="controls-left">
              <div className="filter-group">
                <button className={`filter-btn ${filter==='all'?'active':''}`} onClick={()=>setFilter('all')}>All ({projects.length})</button>
                <button className={`filter-btn ${filter==='ongoing'?'active':''}`} onClick={()=>setFilter('ongoing')}>Ongoing ({projects.filter(p=>['Ongoing','On Going'].includes(p.status)).length})</button>
                <button className={`filter-btn ${filter==='completed'?'active':''}`} onClick={()=>setFilter('completed')}>Completed ({projects.filter(p=>p.status==='Completed').length})</button>
                <button className={`filter-btn ${filter==='pending'?'active':''}`} onClick={()=>setFilter('pending')}>Pending ({projects.filter(p=>['Pending','Not Started'].includes(p.status)).length})</button>
              </div>
            </div>
            <div className="controls-right">
              <div className="sort-container">
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="sort-select">
                  <option value="name">Sort by Name</option>
                  <option value="location">Sort by Location</option>
                  <option value="manager">Sort by Manager</option>
                  <option value="status">Sort by Status</option>
                  <option value="startDate">Sort by Start Date</option>
                </select>
                <button className="sort-order-btn" onClick={()=>setSortOrder(o=>o==='asc'?'desc':'asc')}>
                  {sortOrder==='asc'? <FaChevronUp/> : <FaChevronDown/>}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="error-state"><FaClock/><span>{error}</span></div>}

          {!error && <div className={`projects-display ${viewMode}`}>
            {displayedProjects.length===0 && <div className="empty-state"><FaProjectDiagram/><h3>No projects found</h3><p>{searchTerm||filter!=='all'? 'Adjust search or filters':'No projects available'}</p></div>}
            {displayedProjects.map(project=> (
              <div key={project._id} className="project-card" onClick={()=>navigate(`/ceo/proj/${project._id}`)} style={{cursor:'pointer'}}>
                <div className="project-image-container">
                  <img src={project.photos?.[0] || 'https://placehold.co/400x250?text=No+Photo'} alt={project.projectName} className="project-image" />
                  <div className="project-status-badge" style={{backgroundColor:getStatusColor(project.status)}}>
                    {getStatusIcon(project.status)}
                    <span>{project.status||'Unknown'}</span>
                  </div>
                </div>
                <div className="project-content">
                  <div className="project-header">
                    <h3 className="project-name">{project.projectName}</h3>
                    <div className="project-location"><FaMapMarkerAlt/><span>{project.location?.name || 'No Location'}</span></div>
                  </div>
                  <div className="project-details">
                    <div className="detail-item"><FaUserTie className="detail-icon"/><div className="detail-content"><span className="detail-label">Project Manager</span><span className="detail-value">{project.projectmanager?.name||'Not Assigned'}</span></div></div>
                    <div className="detail-item"><FaBuilding className="detail-icon"/><div className="detail-content"><span className="detail-label">Contractor</span><span className="detail-value">{project.contractor||'Not Assigned'}</span></div></div>
                    <div className="detail-item"><FaCalendarAlt className="detail-icon"/><div className="detail-content"><span className="detail-label">Timeline</span><span className="detail-value">{project.startDate && project.endDate ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}` : 'Not Set'}</span></div></div>
                    <div className="detail-item"><FaUsersIcon className="detail-icon"/><div className="detail-content"><span className="detail-label">Manpower</span><span className="detail-value">{Array.isArray(project.manpower)&&project.manpower.length>0 ? `${project.manpower.length} assigned` : 'No manpower'}</span></div></div>
                    {project.budget && <div className="detail-item"><FaMoneyBillWave className="detail-icon"/><div className="detail-content"><span className="detail-label">Budget</span><span className="detail-value">{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(project.budget)}</span></div></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>}
        </div>
      </main>
    </div>
  );
};

export default CeoProj;
