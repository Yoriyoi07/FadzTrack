
import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import '../style/it_style/It_Projects.css';
import '../style/am_style/Area_Projects.css';
import { FaProjectDiagram, FaSearch, FaChevronUp, FaChevronDown, FaTh, FaList, FaMapMarkerAlt, FaUserTie, FaBuilding, FaCalendarAlt, FaUsers as FaUsersIcon, FaMoneyBillWave, FaClock, FaCheckCircle } from 'react-icons/fa';

const AreaProj = () => {
  const navigate = useNavigate();
  const [projects,setProjects]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');
  const [viewMode,setViewMode]=useState('grid');
  const [searchTerm,setSearchTerm]=useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [sortBy,setSortBy]=useState('name');
  const [sortOrder,setSortOrder]=useState('asc');
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(12);

  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const areaManagerId = user?._id;

  useEffect(()=>{ let active=true; (async()=>{ try{ const {data}=await api.get('/projects'); if(!active) return; setProjects(Array.isArray(data)?data:[]);}catch{ if(active) setError('Failed to fetch projects'); } finally{ if(active) setLoading(false);} })(); return ()=>{active=false}; },[]);

  const currencyFmt = useMemo(()=> new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}),[]);
  const dateFmt = d=> d? new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';

  const statusMeta = (statusRaw='')=>{ const s=statusRaw.toLowerCase(); if(s==='completed') return {color:'#10B981',Icon:FaCheckCircle,label:'Completed'}; if(['ongoing','on going'].includes(s)) return {color:'#3B82F6',Icon:FaClock,label:'Ongoing'}; if(['pending','not started'].includes(s)) return {color:'#F59E0B',Icon:FaClock,label:'Pending'}; return {color:'#6B7280',Icon:FaClock,label:statusRaw||'Unknown'}; };

  // base projects for this area manager (handles both populated areamanager object and raw ObjectId string)
  const baseProjects = useMemo(()=> {
    if(!areaManagerId) return [];
    return projects.filter(p=>{
      if(!p.areamanager) return false;
      // Populated reference object
      if(typeof p.areamanager === 'object'){
        const id = p.areamanager._id || p.areamanager.id;
        return id && String(id) === String(areaManagerId);
      }
      // Raw id string
      if(typeof p.areamanager === 'string'){
        return String(p.areamanager) === String(areaManagerId);
      }
      return false;
    });
  }, [projects, areaManagerId]);

  const filteredSorted = useMemo(()=>{ const srch=deferredSearch.trim().toLowerCase(); const subset = baseProjects
      .filter(p=>{ const st=(p.status||'').toLowerCase(); if(filter==='completed') return st==='completed'; if(filter==='ongoing') return ['ongoing','on going'].includes(st); if(filter==='pending') return ['pending','not started'].includes(st); return true; })
      .filter(p=>{ if(!srch) return true; return [p.projectName,p.location?.name,p.projectmanager?.name,p.contractor].some(v=>(v||'').toLowerCase().includes(srch)); })
      .sort((a,b)=>{ const pick=o=>{ switch(sortBy){ case 'location':return o.location?.name||''; case 'manager':return o.projectmanager?.name||''; case 'status':return o.status||''; case 'startDate': return o.startDate? new Date(o.startDate).getTime():0; default: return o.projectName||'';} }; const av=pick(a); const bv=pick(b); if(av===bv) return 0; return (av>bv?1:-1)*(sortOrder==='asc'?1:-1); }); return subset; },[baseProjects,filter,deferredSearch,sortBy,sortOrder]);

  useEffect(()=>{ setPage(1); },[filter,deferredSearch,sortBy,sortOrder]);

  const totalItems = filteredSorted.length; const totalPages=Math.max(1,Math.ceil(totalItems/pageSize)); const currentPage = Math.min(page,totalPages);
  const paginatedProjects = useMemo(()=> filteredSorted.slice((currentPage-1)*pageSize, currentPage*pageSize),[filteredSorted,currentPage,pageSize]);

  // counts derived from full baseProjects list so they don't change when switching filters
  const counts = useMemo(()=>({
    total: baseProjects.length,
    ongoing: baseProjects.filter(p=>['ongoing','on going'].includes((p.status||'').toLowerCase())).length,
    completed: baseProjects.filter(p=>(p.status||'').toLowerCase()==='completed').length,
    pending: baseProjects.filter(p=>['pending','not started'].includes((p.status||'').toLowerCase())).length
  }),[baseProjects]);

  const Skeleton = ({n=8}) => (<div className={`projects-display ${viewMode}`}>{Array.from({length:n}).map((_,i)=>(<div key={i} className="project-card skeleton"><div className="project-image-wrapper shimmer"/><div className="project-content"><div className="skeleton-line w60"/><div className="skeleton-line w40"/><div className="skeleton-line w80"/><div className="skeleton-line w50"/></div></div>))}</div>);

  return (
    <div className="dashboard-container no-inner-scroll am-projects-page">
      <AppHeader roleSegment="am" />
      <main className="dashboard-main auto-height">
        <div className="projects-container projects-light">
          <div className="page-header enhanced">
            <div className="page-title-section">
              <h1 className="page-title">My Projects</h1>
              <p className="page-subtitle">Manage and monitor your portfolio</p>
            </div>
            <div className="page-actions">
              <button className="add-project-btn" onClick={()=>navigate('/am/addproj')} aria-label="Add Project"><FaProjectDiagram/><span>Add Project</span></button>
              <div className="search-container">
                <FaSearch className="search-icon"/>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search by name, location, manager..." className="search-input" />
              </div>
              <div className="view-mode-container">
                <button aria-label="Grid view" className={`view-mode-btn ${viewMode==='grid'?'active':''}`} onClick={()=>setViewMode('grid')}><FaTh/></button>
                <button aria-label="List view" className={`view-mode-btn ${viewMode==='list'?'active':''}`} onClick={()=>setViewMode('list')}><FaList/></button>
              </div>
              <div className="sort-container">
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="sort-select">
                  <option value="name">Name</option>
                  <option value="location">Location</option>
                  <option value="manager">Manager</option>
                  <option value="status">Status</option>
                  <option value="startDate">Start Date</option>
                </select>
                <button aria-label="Toggle sort order" className="sort-order-btn" onClick={()=>setSortOrder(o=>o==='asc'?'desc':'asc')}>{sortOrder==='asc'? <FaChevronUp/> : <FaChevronDown/>}</button>
              </div>
            </div>
          </div>
          <div className="filter-bar below-header">
            <button className={`filter-chip ${filter==='all'?'active':''}`} onClick={()=>setFilter('all')}>All <span className="badge">{counts.total}</span></button>
            <button className={`filter-chip ${filter==='ongoing'?'active':''}`} onClick={()=>setFilter('ongoing')}>Ongoing <span className="badge">{counts.ongoing}</span></button>
            <button className={`filter-chip ${filter==='completed'?'active':''}`} onClick={()=>setFilter('completed')}>Completed <span className="badge">{counts.completed}</span></button>
            <button className={`filter-chip ${filter==='pending'?'active':''}`} onClick={()=>setFilter('pending')}>Pending <span className="badge">{counts.pending}</span></button>
          </div>
          {error && <div className="error-state compact"><FaClock/><span>{error}</span></div>}
          {loading && !error && <Skeleton n={8} />}
          {!loading && !error && (
            <>
            <div className={`projects-display ${viewMode}`}>
              {paginatedProjects.length===0 && (
                <div className="empty-state full">
                  <FaProjectDiagram size={42}/>
                  <h3>No projects found</h3>
                  <p>{searchTerm||filter!=='all' ? 'Adjust search text, filters or sorting.' : 'No projects assigned yet.'}</p>
                </div>
              )}
              {paginatedProjects.map(p=>{ const meta=statusMeta(p.status); return (
                <div key={p._id} className={`project-card ${viewMode}`} onClick={()=>navigate(`/am/projects/${p._id}`)} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter') navigate(`/am/projects/${p._id}`); }}>
                  <div className="project-image-wrapper">
                    <img loading="lazy" src={p.photos?.[0] || 'https://placehold.co/640x360?text=No+Photo'} alt={p.projectName} className="project-image" />
                    <div className="status-badge" style={{backgroundColor:meta.color}}><meta.Icon size={12}/><span>{meta.label}</span></div>
                  </div>
                  <div className="project-content">
                    <h3 className="project-name clamp">{p.projectName||'Untitled'}</h3>
                    <div className="project-location"><FaMapMarkerAlt/><span>{p.location?.name || 'No Location'}</span></div>
                    <ul className="meta-list">
                      <li><FaUserTie/><span>{p.projectmanager?.name||'Unassigned'}</span></li>
                      <li><FaBuilding/><span>{p.contractor||'No Contractor'}</span></li>
                      <li><FaCalendarAlt/><span>{p.startDate && p.endDate ? `${dateFmt(p.startDate)} - ${dateFmt(p.endDate)}` : (p.startDate? dateFmt(p.startDate): 'No timeline')}</span></li>
                      <li><FaUsersIcon/><span>{Array.isArray(p.manpower)&&p.manpower.length>0 ? `${p.manpower.length} manpower` : 'No manpower'}</span></li>
                      {p.budget && <li><FaMoneyBillWave/><span>{currencyFmt.format(p.budget)}</span></li>}
                    </ul>
                  </div>
                </div>
              ); })}
            </div>
            {paginatedProjects.length>0 && (
              <div className="pagination-bar">
                <div className="pagination-left">
                  <span className="pagination-info">Showing {(currentPage-1)*pageSize + 1}-{Math.min(currentPage*pageSize,totalItems)} of {totalItems}</span>
                  <label className="page-size-select-label"><span>Per page:</span>
                    <select value={pageSize} onChange={e=>{ setPageSize(parseInt(e.target.value)||12); setPage(1); }} className="page-size-select">{[6,12,18,24,36].map(sz=> <option key={sz} value={sz}>{sz}</option>)}</select>
                  </label>
                </div>
                <div className="pagination-pages">
                  <button disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="page-btn" aria-label="Previous page">‹</button>
                  {Array.from({length: totalPages}).slice(0, totalPages).map((_,i)=>{ const pageNumber=i+1; const show= pageNumber===1 || pageNumber===totalPages || Math.abs(pageNumber-currentPage)<=1; if(!show){ if(pageNumber===2 && currentPage>3) return <span key="start-ellipsis" className="ellipsis">…</span>; if(pageNumber===totalPages-1 && currentPage<totalPages-2) return <span key="end-ellipsis" className="ellipsis">…</span>; return null;} return (<button key={pageNumber} className={`page-btn ${pageNumber===currentPage?'active':''}`} onClick={()=>setPage(pageNumber)} aria-current={pageNumber===currentPage? 'page': undefined}>{pageNumber}</button>); })}
                  <button disabled={currentPage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="page-btn" aria-label="Next page">›</button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AreaProj;
