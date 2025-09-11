import React, { useEffect, useMemo, useState } from 'react';
import './materialRequests.css';
import AppHeader from '../layout/AppHeader';
import { Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { truncateWords, getStatusBadge, computeApprovalSteps } from './materialStatusUtils';
import { FaDownload } from 'react-icons/fa';
import { exportMaterialRequestsPdf } from '../../utils/materialRequestsPdfEnhanced';

// Generic list view for PM / AM roles
const MaterialRequestListView = ({
  role,
  fetchUrl = '/requests/mine',
  rootClass = 'mr-request-list',
  itemsPerPage = 8,
  detailLinkBase = '/material-request',
  headerTitle = 'Material Requests',
  headerSubtitle = 'All material requests',
  customHeader = null,
  disableHeader = false,
  enableExport = false,
  exportTitle = 'Material Requests Export'
}) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  // PIC specific state (active project + nudge cooldowns)
  const [activeProject, setActiveProject] = useState(null);
  const [nudgeCooldowns, setNudgeCooldowns] = useState({});
  const [nowTs, setNowTs] = useState(Date.now());
  const isPICRole = role === 'Person in Charge';
  const storedUser = (()=>{ try { return JSON.parse(localStorage.getItem('user')||'null'); } catch { return null; } })();
  const userId = storedUser?._id;
  
  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);

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
    const isArchived = status === 'archived' || !!r.isArchived;
    
    // For "All" filter, exclude archived requests to keep the dashboard clean
    const matchesFilter = filter === 'All' ? !isArchived :
      (filter === 'Pending' && status.includes('pending') && !isArchived) ||
      (filter === 'Approved' && status.includes('approved') && status !== 'received' && !isArchived) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel')) && !isArchived) ||
      (filter === 'Completed' && isCompleted && !isArchived) ||
      (filter === 'Archived' && isArchived);
    
    if (!matchesFilter) return false;
    
    // For archived requests, use original project name if available
    const projectName = isArchived && r.originalProjectName ? r.originalProjectName : r.project?.projectName;
    
    const searchTarget = [
      r.materials?.map(m => m.materialName).join(', ') || '',
      r.description || '',
      r.createdBy?.name || '',
      projectName || ''
    ].join(' ').toLowerCase();
    return searchTarget.includes(searchTerm.toLowerCase());
  });

  // priority removed
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a,b) => {
      if (filter === 'All') {
        const aC = (a.status||'').toLowerCase() === 'received' || a.receivedByPIC ? 1:0;
        const bC = (b.status||'').toLowerCase() === 'received' || b.receivedByPIC ? 1:0;
        if (aC !== bC) return aC - bC;
      }
              switch (sortBy) {
          case 'latest':
          case 'date': 
            return new Date(b.createdAt||0) - new Date(a.createdAt||0);
          case 'oldest': 
            return new Date(a.createdAt||0) - new Date(b.createdAt||0);
          // priority case removed
          case 'status': 
            return (a.status||'').localeCompare(b.status||'');
          case 'requester': 
            return (a.createdBy?.name||'').localeCompare(b.createdBy?.name||'');
          case 'project': 
            return (a.project?.projectName||'').localeCompare(b.project?.projectName||'');
                    default:
            return new Date(b.createdAt||0) - new Date(a.createdAt||0);
        }
    });
  }, [filteredRequests, sortBy, filter]);

  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageRequests = sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const [pendingNudges, setPendingNudges] = useState({}); // transient disable while awaiting server
  const [deletingId, setDeletingId] = useState(null);

  const handleExportPdf = async () => {
    if (!enableExport) return;
    try {
      setExporting(true);
      await exportMaterialRequestsPdf(sortedRequests, {
        companyName: 'FadzTrack',
        logoPath: `${process.env.PUBLIC_URL || ''}/images/Fadz-logo.png`,
        exporterName: storedUser?.name || 'Unknown',
        exporterRole: storedUser?.role || '',
        filters: { filter, searchTerm, sortBy },
        reportTitle: exportTitle,
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };
  
  const handleDeleteArchived = (requestId) => {
    const request = requests.find(r => r._id === requestId);
    setRequestToDelete(request);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteArchived = async () => {
    if (!requestToDelete) return;
    
    setDeletingId(requestToDelete._id);
    try {
      await api.delete(`/requests/${requestToDelete._id}/archived`);
      // Refresh the requests list
      const res = await api.get(fetchUrl);
      setRequests(Array.isArray(res.data) ? res.data : []);
      setShowDeleteConfirm(false);
      setRequestToDelete(null);
    } catch (error) {
      alert('Failed to delete archived request: ' + (error?.response?.data?.message || error.message));
    } finally {
      setDeletingId(null);
    }
  };
  
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
      case 'current': return '●';
      case 'pending': return '○';
      default: return '○';
    }
  };
  const subFor = (s, key) => {
    if (s === 'completed') return key === 'received' ? 'Done' : 'Done';
    if (s === 'denied') return 'Denied';
    if (s === 'blocked') return 'Waiting';
    if (s === 'current') return 'Current';
    if (key === 'received') return 'Pending';
    return 'Pending';
  };

  const renderCardView = () => (
    <ul className="request-list">
      {pageRequests.map(r => {
        const { steps, meta } = computeApprovalSteps(r);
        const statusBadge = getStatusBadge(r.status, meta.isReceived);
        const isArchived = r.status === 'Archived' || r.isArchived;
        const projectName = isArchived && r.originalProjectName ? r.originalProjectName : r.project?.projectName;
        
        return (
          <li key={r._id} className={`request-row ${meta.anyDenied?'request-denied':''} ${meta.isReceived?'request-completed':''} ${isArchived?'status-archived':''}`}>
            {isArchived && (
              <div className="archived-notice">
                <span className="archived-badge">Archived – Project Completed</span>
                {r.archivedReason && <span className="archive-reason">{r.archivedReason}</span>}
              </div>
            )}
            <div className="request-row-header">
              <div className="request-title-group">
                <h3 className="request-row-title">{r.materials?.length ? r.materials.map(m=>`${m.materialName} (${m.quantity}${m.unit? ' '+m.unit:''})`).join(', ') : 'Material Request'}</h3>
                <p className="request-row-desc">{truncateWords(r.description||'No description',28)}</p>
              </div>
              <span className={`status-chip status-${statusBadge.toLowerCase()}`}>{statusBadge}</span>
            </div>
            <div className="request-meta-line">
              <span className="meta-origin">
                <strong>{r.createdBy?.name||'Unknown'}</strong> • {new Date(r.createdAt).toLocaleDateString()} 
                {projectName && <span>• {projectName}</span>}
              </span>
            </div>
            {isArchived && r.originalRequestDetails && (
              <div className="original-request-details">
                <div className="original-project-info">
                  <strong>Original Status:</strong> {r.originalRequestStatus}
                  {r.originalProjectEndDate && (
                    <span> • <strong>Project End Date:</strong> {new Date(r.originalProjectEndDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            )}
            {!isArchived && (
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
            )}
            <div className="request-actions">
              {isArchived ? (
                <div className="archived-actions">
                  <Link to={`${detailLinkBase}/${r._id}`} className="view-details-btn">View Details</Link>
                  <button 
                    onClick={() => handleDeleteArchived(r._id)} 
                    className="delete-archived-btn"
                    disabled={deletingId === r._id}
                  >
                    {deletingId === r._id ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </div>
              ) : (
                <>
                  {isPICRole && (
                    (()=>{ const status=(r.status||'').toLowerCase(); const canNudge = (status==='pending project manager'||status==='pending area manager') && r.createdBy?._id===userId && !meta.isReceived && !meta.anyDenied; if(!canNudge) return null; const coolingRaw=nudgeCooldowns[r._id]; const remaining = coolingRaw ? (coolingRaw - nowTs) : 0; if(remaining<=0 && coolingRaw){ // cleanup expired
                      setTimeout(()=>{ setNudgeCooldowns(prev=>{ const copy={...prev}; delete copy[r._id]; localStorage.setItem('nudgeCooldowns', JSON.stringify(copy)); return copy; }); },0); }
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
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const renderListView = () => (
    <div className="request-table-container">
      <table className="request-table">
        <thead>
          <tr>
            <th>Materials</th>
            <th>Description</th>
            <th>Requester</th>
            <th>Project</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pageRequests.map(r => {
            const { steps, meta } = computeApprovalSteps(r);
            const statusBadge = getStatusBadge(r.status, meta.isReceived);
            const isArchived = r.status === 'Archived' || r.isArchived;
            const projectName = isArchived && r.originalProjectName ? r.originalProjectName : r.project?.projectName;
            
            return (
              <React.Fragment key={r._id}>
                <tr className={`table-row ${meta.anyDenied?'request-denied':''} ${meta.isReceived?'request-completed':''} ${isArchived?'status-archived':''}`}>
                  <td className="table-cell materials-cell" title={r.materials?.length ? r.materials.map(m=>`${m.materialName} (${m.quantity}${m.unit? ' '+m.unit:''})`).join(', ') : 'Material Request'}>
                    {r.materials?.length ? r.materials.map(m=>`${m.materialName} (${m.quantity}${m.unit? ' '+m.unit:''})`).join(', ') : 'Material Request'}
                  </td>
                  <td className="table-cell description-cell" title={r.description||'No description'}>
                    {truncateWords(r.description||'No description', 50)}
                  </td>
                  <td className="table-cell requester-cell" title={r.createdBy?.name||'Unknown'}>
                    <strong>{r.createdBy?.name||'Unknown'}</strong>
                  </td>
                  <td className="table-cell project-cell" title={projectName || '—'}>
                    {projectName || '—'}
                  </td>
                  <td className="table-cell date-cell" title={new Date(r.createdAt).toLocaleDateString()}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="table-cell status-cell">
                    <span className={`status-chip status-${statusBadge.toLowerCase()}`}>{statusBadge}</span>
                    {isArchived && r.archivedReason && (
                      <div className="archive-reason" style={{fontSize: '11px', color: '#666', marginTop: '2px'}}>
                        {r.archivedReason}
                      </div>
                    )}
                  </td>
                  <td className="table-cell actions-cell">
                    {isArchived ? (
                      <div className="archived-actions">
                        <Link to={`${detailLinkBase}/${r._id}`} className="view-details-btn">View</Link>
                        <button 
                          onClick={() => handleDeleteArchived(r._id)} 
                          className="delete-archived-btn"
                          disabled={deletingId === r._id}
                          style={{marginLeft: '5px', fontSize: '11px', padding: '2px 6px'}}
                        >
                          {deletingId === r._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {isPICRole && (
                          (()=>{ const status=(r.status||'').toLowerCase(); const canNudge = (status==='pending project manager'||status==='pending area manager') && r.createdBy?._id===userId && !meta.isReceived && !meta.anyDenied; if(!canNudge) return null; const coolingRaw=nudgeCooldowns[r._id]; const remaining = coolingRaw ? (coolingRaw - nowTs) : 0; if(remaining<=0 && coolingRaw){ // cleanup expired
                            setTimeout(()=>{ setNudgeCooldowns(prev=>{ const copy={...prev}; delete copy[r._id]; localStorage.setItem('nudgeCooldowns', JSON.stringify(copy)); return copy; }); },0); }
                          const isPending = pendingNudges[r._id];
                          const nextAt = nudgeCooldowns[r._id];
                          return <button
                            onClick={()=>handleNudge(r)}
                            disabled={remaining>0 || isPending}
                            className="nudge-btn"
                            title={remaining>0 && nextAt ? `Next nudge allowed at ${formatNextTime(nextAt)}` : 'Send reminder to pending approver'}
                          >{isPending? 'Sending...' : formatRemaining(remaining)}</button>; })()
                        )}
                        <Link to={`${detailLinkBase}/${r._id}`} className="view-details-btn">View</Link>
                      </>
                    )}
                  </td>
                </tr>
                <tr className={`progress-row ${meta.anyDenied?'request-denied':''} ${meta.isReceived?'request-completed':''}`}>
                  <td colSpan="7" className="progress-cell-full">
                    <div className="progress-steps-list">
                      {steps.map((s,idx)=>(
                        <div key={s.key} className={`progress-step-list ${s.state}`}>
                          <div className="step-icon-list">{iconFor(s.state)}</div>
                          <div className="step-label-list">{s.label}</div>
                          <div className="step-sub-list">{subFor(s.state,s.key)}</div>
                          <div className="step-date-list">{s.date? new Date(s.date).toLocaleDateString(): '—'}</div>
                          {idx < steps.length-1 && <div className={`step-connector-list ${steps[idx+1].state==='completed'?'completed':''}`}></div>}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`dashboard-container ${rootClass}`}>
  {!disableHeader && (customHeader ? customHeader : (
        <AppHeader roleSegment={(role||'').toLowerCase().includes('project manager')? 'pm' : (role||'').toLowerCase().includes('area manager')? 'am' : (role||'').toLowerCase().includes('person in charge')? 'pic' : (role||'').toLowerCase().includes('ceo')? 'ceo' : (role||'').toLowerCase().includes('it')? 'it':'pic'}
          below={<div className="header-content" style={{padding:'0.75rem 1.5rem'}}>
            <div className="header-left"><h1 className="header-title" style={{margin:0,fontSize:'1.15rem'}}>{headerTitle}</h1><p className="header-subtitle" style={{margin:0,fontSize:'0.75rem',opacity:.75}}>{headerSubtitle}</p></div>
            <div className="header-right"><div className="header-role-chip" style={{background:'#1e293b',padding:'4px 10px',borderRadius:16,fontSize:12}}>{role}</div></div>
          </div>}
        />
  ))}
      <main className="dashboard-main">
        <div className="page-container">
          <div className="controls-bar">
            <div className="filter-tabs">
              {['All','Pending','Approved','Cancelled','Completed','Archived'].map(tab => (
                <button key={tab} className={`filter-tab ${filter===tab?'active':''}`} onClick={()=>{setFilter(tab); setCurrentPage(1);}}>{tab}</button>
              ))}
            </div>
            <div className="search-sort-section">
              <div className="search-wrapper">
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search requests..." className="search-input" />
              </div>
              <div className="sort-wrapper">
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="sort-select">
                  <option value="latest">Latest First</option>
                  <option value="oldest">Oldest First</option>
                  {/* Priority sort removed */}
                  <option value="status">By Status</option>
                  <option value="requester">By Requester</option>
                  <option value="project">By Project</option>
                </select>
              </div>
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
                  onClick={() => setViewMode('card')}
                  title="Card View"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
                  </svg>
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                  </svg>
                </button>
              </div>
              {enableExport && (
                <button
                  onClick={handleExportPdf}
                  disabled={exporting || sortedRequests.length === 0}
                  className="btn-primary export-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', minWidth: 'auto' }}
                >
                  <FaDownload />
                  {exporting ? 'Exporting...' : 'Export PDF'}
                </button>
              )}
              {isPICRole && activeProject && (
                <button onClick={()=>window.location.href = `/pic/projects/${activeProject._id}/request`} className="view-details-btn" style={{marginLeft:'0.5rem'}}>
                  + New Request
                </button>
              )}
            </div>
          </div>
          <div className={`requests-grid ${viewMode === 'list' ? 'list-view' : 'enhanced-list'}`}>
            {loading ? (
              <div className="loading-state"><div className="loading-spinner"/><p>Loading...</p></div>
            ) : error ? (
              <div className="error-state"><p>{error}</p></div>
            ) : pageRequests.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📦</div><h3>No material requests found</h3><p>No requests match your current filters.</p></div>
            ) : (
              viewMode === 'card' ? renderCardView() : renderListView()
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
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && requestToDelete && (
        <div className="modal-overlay">
          <div className="modal small">
            <h3>Confirm Permanent Deletion</h3>
            
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                <span style={{fontSize: '20px'}}>⚠️</span>
                <strong style={{color: '#dc2626'}}>Permanent Deletion Warning</strong>
              </div>
              <p style={{color: '#dc2626', margin: 0, fontSize: '14px'}}>
                This action cannot be undone. The archived request will be permanently removed from the system.
              </p>
            </div>

            <div style={{marginBottom: '16px'}}>
              <p style={{marginBottom: '8px', fontWeight: '600'}}>Request Details:</p>
              <div style={{backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '14px'}}>
                <p style={{margin: '0 0 4px 0'}}><strong>Project:</strong> {requestToDelete.project?.projectName || 'Unknown'}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>Requester:</strong> {requestToDelete.createdBy?.name || 'Unknown'}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>Status:</strong> {requestToDelete.status || 'Unknown'}</p>
                <p style={{margin: '0'}}><strong>Created:</strong> {requestToDelete.createdAt ? new Date(requestToDelete.createdAt).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </div>

            <p style={{marginBottom: '16px', fontSize: '14px', lineHeight: '1.5'}}>
              Are you sure you want to <strong>permanently delete</strong> this archived material request?
            </p>

            <div className="modal-actions" style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
              <button 
                className="btn" 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setRequestToDelete(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn primary" 
                disabled={deletingId === requestToDelete._id}
                onClick={confirmDeleteArchived}
                style={{backgroundColor: '#dc2626'}}
              >
                {deletingId === requestToDelete._id ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialRequestListView;
