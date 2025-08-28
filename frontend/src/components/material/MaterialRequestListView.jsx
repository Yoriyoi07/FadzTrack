import React, { useEffect, useMemo, useState } from 'react';
import './materialRequests.css';
import { Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { truncateWords, getStatusBadge, computeApprovalSteps } from './materialStatusUtils';

// Generic list view for PM / AM roles
const MaterialRequestListView = ({
  role,
  fetchUrl = '/requests/mine',
  rootClass = 'mr-request-list',
  itemsPerPage = 8,
  detailLinkBase = '/material-request',
  headerTitle = 'Material Requests',
  headerSubtitle = 'All material requests',
  customHeader = null
}) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [currentPage, setCurrentPage] = useState(1);
  // PIC specific state (active project + nudge cooldowns)
  const [activeProject, setActiveProject] = useState(null);
  const [nudgeCooldowns, setNudgeCooldowns] = useState({});
  const [nowTs, setNowTs] = useState(Date.now());
  const isPICRole = role === 'Person in Charge';
  const storedUser = (()=>{ try { return JSON.parse(localStorage.getItem('user')||'null'); } catch { return null; } })();
  const userId = storedUser?._id;

  // Load cooldowns from localStorage (PIC only)
  // Load persisted cooldowns once (don't filter out expired until display to keep stability if system clock shifts)
  useEffect(()=>{ if(!isPICRole) return; try { const saved=JSON.parse(localStorage.getItem('nudgeCooldowns')||'{}'); setNudgeCooldowns(saved); } catch{} },[isPICRole]);
  useEffect(()=>{ if(!isPICRole) return; localStorage.setItem('nudgeCooldowns', JSON.stringify(nudgeCooldowns)); },[nudgeCooldowns,isPICRole]);
  // ticking clock for countdown display
  useEffect(()=>{ if(!isPICRole) return; const id=setInterval(()=>setNowTs(Date.now()),1000); return ()=>clearInterval(id); },[isPICRole]);
  const ITEMS_PER_PAGE = itemsPerPage;

  useEffect(() => {
    api.get(fetchUrl)
      .then(res => {
        setRequests(Array.isArray(res.data) ? res.data : []);
        setError('');
      })
      .catch(err => setError(err?.response?.data?.message || 'Failed to load requests'))
      .finally(() => setLoading(false));
  }, [fetchUrl]);

  // Fetch active project for PIC so we can show an inline New Request button
  useEffect(()=>{ if(!isPICRole || !userId) return; api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`).then(r=>{ setActiveProject(r.data?.[0]||null); }).catch(()=>setActiveProject(null)); },[isPICRole,userId]);

  const filteredRequests = requests.filter(r => {
    const status = (r.status||'').toLowerCase();
    const isCompleted = status === 'received' || !!r.receivedByPIC;
    const matchesFilter = filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved') && status !== 'received') ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel'))) ||
      (filter === 'Completed' && isCompleted);
    if (!matchesFilter) return false;
    const searchTarget = [
      r.materials?.map(m => m.materialName).join(', ') || '',
      r.description || '',
      r.createdBy?.name || '',
      r.project?.projectName || ''
    ].join(' ').toLowerCase();
    return searchTarget.includes(searchTerm.toLowerCase());
  });

  const priorityRank = { high:3, medium:2, low:1 };
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a,b) => {
      if (filter === 'All') {
        const aC = (a.status||'').toLowerCase() === 'received' || a.receivedByPIC ? 1:0;
        const bC = (b.status||'').toLowerCase() === 'received' || b.receivedByPIC ? 1:0;
        if (aC !== bC) return aC - bC;
      }
      switch (sortBy) {
        case 'date': return new Date(b.createdAt||0) - new Date(a.createdAt||0);
        case 'priority': {
          const ap = priorityRank[(a.priority||'').toLowerCase()]||0;
          const bp = priorityRank[(b.priority||'').toLowerCase()]||0;
          return bp - ap;
        }
        case 'status': return (a.status||'').localeCompare(b.status||'');
        default: return 0;
      }
    });
  }, [filteredRequests, sortBy, filter]);

  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageRequests = sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const [pendingNudges, setPendingNudges] = useState({}); // transient disable while awaiting server
  const handleNudge = async (reqObj) => {
    if(!isPICRole) return; const id=reqObj._id; const status=(reqObj.status||'').toLowerCase();
    if(!(status==='pending project manager' || status==='pending area manager')) return;
    if(nudgeCooldowns[id] && nudgeCooldowns[id] > Date.now()) return; // still cooling down
    if(pendingNudges[id]) return; // already firing
    setPendingNudges(p=>({...p,[id]:true}));
    try {
      const { data } = await api.post(`/requests/${id}/nudge`);
      const until = data?.nextAllowedAt || (Date.now()+60*60*1000);
      alert('Reminder sent.');
      setNudgeCooldowns(prev=>{ const next={...prev,[id]:until}; localStorage.setItem('nudgeCooldowns', JSON.stringify(next)); return next; });
    } catch(e){
      const msg=e?.response?.data?.message; const untilServer=e?.response?.data?.nextAllowedAt; if(msg){ alert(msg); if(untilServer){ setNudgeCooldowns(prev=>{ const next={...prev,[id]:untilServer}; localStorage.setItem('nudgeCooldowns', JSON.stringify(next)); return next; }); } else { const match=/(\d+) minute/.exec(msg); if(match){ const mins=parseInt(match[1],10); const until=Date.now()+mins*60*1000; setNudgeCooldowns(prev=>{ const next={...prev,[id]:until}; localStorage.setItem('nudgeCooldowns', JSON.stringify(next)); return next; }); } } } else alert('Failed to send reminder.'); }
    finally { setPendingNudges(p=>{ const { [id]:_, ...rest}=p; return rest; }); }
  };

  const formatRemaining = (ms) => {
    if(ms <= 0) return 'Nudge';
    const totalSec = Math.ceil(ms/1000);
    const m = Math.floor(totalSec/60);
    const s = totalSec%60;
    if(m >= 60){
      const h = Math.floor(m/60); const rm = m%60; return `${h}h ${rm}m`;
    }
    return m>0 ? `${m}m ${s.toString().padStart(2,'0')}s` : `${s}s`;
  };

  const formatNextTime = (ts) => {
    if(!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const opts = { hour:'2-digit', minute:'2-digit' };
    const timePart = d.toLocaleTimeString([], opts);
    const isToday = d.toDateString() === now.toDateString();
    return `${isToday? 'Today' : d.toLocaleDateString()} ${timePart}`;
  };

  const iconFor = (state) => {
    switch(state){
      case 'completed': return '✓';
      case 'denied': return '✗';
      case 'blocked': return '!';
      case 'pending': return '○';
      default: return '○';
    }
  };
  const subFor = (s, key) => {
    if (s === 'completed') return key === 'received' ? 'Done' : 'Done';
    if (s === 'denied') return 'Denied';
    if (s === 'blocked') return 'Waiting';
    if (key === 'received') return 'Pending';
    return 'Pending';
  };

  return (
    <div className={`dashboard-container ${rootClass}`}>
      {customHeader ? customHeader : (
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="header-title">{headerTitle}</h1>
              <p className="header-subtitle">{headerSubtitle}</p>
            </div>
            <div className="header-right">
              <div className="header-role-chip">{role}</div>
            </div>
          </div>
        </header>
      )}
      <main className="dashboard-main">
        <div className="page-container">
          <div className="controls-bar">
            <div className="filter-tabs">
              {['All','Pending','Approved','Cancelled','Completed'].map(tab => (
                <button key={tab} className={`filter-tab ${filter===tab?'active':''}`} onClick={()=>{setFilter(tab); setCurrentPage(1);}}>{tab}</button>
              ))}
            </div>
            <div className="search-sort-section">
              <div className="search-wrapper">
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search requests..." className="search-input" />
              </div>
              <div className="sort-wrapper">
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="sort-select">
                  <option value="date">Sort by Date</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="status">Sort by Status</option>
                </select>
              </div>
              {isPICRole && activeProject && (
                <button onClick={()=>window.location.href = `/pic/projects/${activeProject._id}/request`} className="view-details-btn" style={{marginLeft:'0.5rem'}}>
                  + New Request
                </button>
              )}
            </div>
          </div>
          <div className="requests-grid enhanced-list">
            {loading ? (
              <div className="loading-state"><div className="loading-spinner"/><p>Loading...</p></div>
            ) : error ? (
              <div className="error-state"><p>{error}</p></div>
            ) : pageRequests.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📦</div><h3>No material requests found</h3><p>No requests match your current filters.</p></div>
            ) : (
              <ul className="request-list">
                {pageRequests.map(r => {
                  const { steps, meta } = computeApprovalSteps(r);
                  const statusBadge = getStatusBadge(r.status, meta.isReceived);
                  return (
                    <li key={r._id} className={`request-row ${meta.anyDenied?'request-denied':''} ${meta.isReceived?'request-completed':''}`}>
                      <div className="request-row-header">
                        <div className="request-title-group">
                          <h3 className="request-row-title">{r.materials?.length ? r.materials.map(m=>`${m.materialName} (${m.quantity}${m.unit? ' '+m.unit:''})`).join(', ') : 'Material Request'}</h3>
                          <p className="request-row-desc">{truncateWords(r.description||'No description',28)}</p>
                        </div>
                        <span className={`status-chip status-${statusBadge.toLowerCase()}`}>{statusBadge}</span>
                      </div>
                      <div className="request-meta-line">
                        <span className="meta-origin"><strong>{r.createdBy?.name||'Unknown'}</strong> • {new Date(r.createdAt).toLocaleDateString()} {r.project?.projectName && <span>• {r.project.projectName}</span>}</span>
                      </div>
                      <div className="progress-steps">
                        {steps.map((s,idx)=>(
                          <div key={s.key} className={`progress-step ${s.state}`}>
                            <div className="step-icon">{iconFor(s.state)}</div>
                            <div className="step-label">{s.label}</div>
                            <div className="step-sub">{subFor(s.state,s.key)}</div>
                            <div className="step-date">{s.date? new Date(s.date).toLocaleDateString(): '—'}</div>
                            {idx < steps.length-1 && <div className={`step-connector ${steps[idx+1].state==='completed'?'completed':''}`}></div>}
                          </div>))}
                      </div>
                      <div className="request-actions">
                        {isPICRole && (
                          (()=>{ const status=(r.status||'').toLowerCase(); const canNudge = (status==='pending project manager'||status==='pending area manager') && r.createdBy?._id===userId && !meta.isReceived && !meta.anyDenied; if(!canNudge) return null; const coolingRaw=nudgeCooldowns[r._id]; const remaining = coolingRaw ? (coolingRaw - nowTs) : 0; if(remaining<=0 && coolingRaw){ // cleanup expired
                            setTimeout(()=>{ setNudgeCooldowns(prev=>{ const copy={...prev}; delete copy[r._id]; localStorage.setItem('nudgeCooldowns', JSON.stringify(copy)); return copy; }); },0);
                          }
                          const isPending = pendingNudges[r._id];
                          const nextAt = nudgeCooldowns[r._id];
                          return <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start'}}>
                            <button
                              onClick={()=>handleNudge(r)}
                              disabled={remaining>0 || isPending}
                              className="view-details-btn"
                              title={remaining>0 && nextAt ? `Next nudge allowed at ${formatNextTime(nextAt)}` : 'Send reminder to pending approver'}
                              style={{background:'#0f766e', opacity:(remaining>0||isPending)?0.7:1}}
                            >{isPending? 'Sending...' : formatRemaining(remaining)}</button>
                            {remaining>0 && nextAt && <span style={{marginTop:4, fontSize:11, color:'#0f766e'}}>{formatNextTime(nextAt)}</span>}
                          </div>; })()
                        )}
                        <Link to={`${detailLinkBase}/${r._id}`} className="view-details-btn" style={{marginLeft:isPICRole? '0.5rem':0}}>View Details</Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {sortedRequests.length > 0 && (
            <div className="pagination-section">
              <div className="pagination-info">Showing {startIndex+1} to {Math.min(startIndex+ITEMS_PER_PAGE, sortedRequests.length)} of {sortedRequests.length} entries</div>
              <div className="pagination-controls">
                <button className="pagination-btn" disabled={currentPage===1} onClick={()=>setCurrentPage(p=>Math.max(p-1,1))}>Previous</button>
                {Array.from({length: totalPages},(_,i)=>i+1).map(p=> <button key={p} className={`pagination-btn ${p===currentPage?'active':''}`} onClick={()=>setCurrentPage(p)}>{p}</button>)}
                <button className="pagination-btn" disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>Math.min(p+1,totalPages))}>Next</button>
              </div>
            </div>) }
        </div>
      </main>
    </div>
  );
};

export default MaterialRequestListView;
