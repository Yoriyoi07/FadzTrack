import React, { useEffect, useRef, useState, useCallback } from 'react';
import './materialRequestDetail.css';
import AppHeader from '../layout/AppHeader';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import ApproveDenyActions from '../ApproveDenyActions';
import { getStatusBadge, computeApprovalSteps, canUserActOnRequest } from './materialStatusUtils';

const MaterialRequestDetailView = ({ role, rootClass='mr-request-detail', headerTitle='Material Request Detail', headerSubtitle='Full lifecycle view', customHeader=null, disableHeader=false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [materialRequest, setMaterialRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isCEO = (role||'').toLowerCase()==='ceo';
  const [collapsedSections, setCollapsedSections] = useState(()=> isCEO ? { att:true } : {});
  const [copied, setCopied] = useState(false);
  // PIC receiving action state must be declared before any early return to satisfy hooks rules
  const [receiving, setReceiving] = useState(false);
  const profileDropdownRef = useRef(null);
  const user = (()=>{ try {return JSON.parse(localStorage.getItem('user'))||null;}catch{return null;} })();
  const userId = user?._id; const userRole = user?.role;

  useEffect(()=>{ let mounted=true; setLoading(true); setError(''); const ctrl=new AbortController();
    axiosInstance.get(`/requests/${id}`,{signal:ctrl.signal}).then(r=>{ if(!mounted) return; setMaterialRequest(r.data); })
      .catch(e=>{ if(!mounted) return; if(e.name==='CanceledError') return; setError(e?.response?.data?.message||'Failed to load'); })
      .finally(()=>mounted && setLoading(false));
    return ()=>{ mounted=false; ctrl.abort(); };
  },[id]);

  useEffect(()=>{ const onScroll=()=>{ const st=window.pageYOffset||document.documentElement.scrollTop; setIsHeaderCollapsed(st>50); }; const onClick=(e)=>{ if(profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) setIsProfileOpen(false); }; window.addEventListener('scroll',onScroll); document.addEventListener('click',onClick); return ()=>{ window.removeEventListener('scroll',onScroll); document.removeEventListener('click',onClick); }; },[]);

  const handleBack = useCallback(()=> navigate(-1),[navigate]);
  const toggleSection = (key)=> setCollapsedSections(prev=>({...prev,[key]:!prev[key]}));
  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); };

  const renderAttachmentIcon = (filename='') => {
    const ext = filename.split('.').pop().toLowerCase();
    if(['png','jpg','jpeg','gif','webp'].includes(ext)) return <i className="fas fa-file-image"/>;
    if(ext==='pdf') return <i className="fas fa-file-pdf" style={{color:'#dc2626'}}/>;
    if(['doc','docx'].includes(ext)) return <i className="fas fa-file-word" style={{color:'#2563eb'}}/>;
    if(['xls','xlsx'].includes(ext)) return <i className="fas fa-file-excel" style={{color:'#16a34a'}}/>;
    return <i className="fas fa-file"/>;
  };

  if(loading||error||!materialRequest){
    return <div className={`dashboard-container ${rootClass}`}>
      {!disableHeader && <AppHeader roleSegment={(role||'').toLowerCase().includes('project manager')? 'pm' : (role||'').toLowerCase().includes('area manager')? 'am' : (role||'').toLowerCase().includes('person in charge')? 'pic' : (role||'').toLowerCase().includes('ceo')? 'ceo' : (role||'').toLowerCase().includes('it')? 'it':'pic'}
        below={<div className="header-content" style={{padding:'0.75rem 1.5rem'}}>
          <div className="header-left"><h1 className="header-title" style={{margin:0,fontSize:'1.15rem'}}>Material Request Detail</h1><p className="header-subtitle" style={{margin:0,fontSize:'0.75rem',opacity:.75}}>Loading details</p></div>
          <div className="header-right"><button onClick={handleBack} className="btn-secondary"><i className="fas fa-arrow-left"/> Back</button></div>
        </div>}
      />}
      <div className="dashboard-main"><div className="page-container">{loading && <div className="loading-state"><div className="loading-spinner"/><p>Loading...</p></div>}{!loading && error && <div className="error-state"><p>{error}</p></div>}</div></div></div>;
  }

  const { steps, meta } = computeApprovalSteps(materialRequest);
  const completedCount = steps.filter(s=>s.state==='completed').length;
  const totalCount = steps.length;
  const progressPct = Math.min(100, Math.round((completedCount/(totalCount||1))*100));
  const statusBadge = getStatusBadge(materialRequest.status, meta.isReceived);
  const canAct = canUserActOnRequest(materialRequest, userRole);
  // PIC role specific capabilities
  const lowerRole = (userRole||'').toLowerCase();
  const isPIC = lowerRole === 'person in charge';
  const isCreator = materialRequest?.createdBy?._id === userId;
  const statusLower = (materialRequest.status||'').toLowerCase();
  const alreadyReceived = statusLower === 'received' || materialRequest.receivedByPIC;
  // PIC can only edit while request is still at initial stage (no validations / approvals yet)
  const hasAnyApproval = Array.isArray(materialRequest.approvals) && materialRequest.approvals.length > 0;
  const canEditPIC = isPIC && isCreator && !alreadyReceived && !hasAnyApproval && statusLower === 'pending project manager';
  const canMarkReceived = isPIC && isCreator && !alreadyReceived && statusLower === 'approved';

  const handleMarkReceived = async () => {
    if(!canMarkReceived || receiving) return;
    setReceiving(true);
    try {
      await axiosInstance.patch(`/requests/${materialRequest._id}/received`);
      setMaterialRequest(prev => ({...prev, status:'Received', receivedByPIC:true, receivedDate:new Date().toISOString()}));
    } catch (e) {
      alert('Failed to mark as received');
    } finally { setReceiving(false); }
  };
  const handleEdit = () => { if(canEditPIC) navigate(`/pic/material-request/edit/${materialRequest._id}`); };

  return (
    <div className={`dashboard-container ${rootClass}`}>
      {!disableHeader && (customHeader ? customHeader : (
        <AppHeader roleSegment={(role||'').toLowerCase().includes('project manager')? 'pm' : (role||'').toLowerCase().includes('area manager')? 'am' : (role||'').toLowerCase().includes('person in charge')? 'pic' : (role||'').toLowerCase().includes('ceo')? 'ceo' : (role||'').toLowerCase().includes('it')? 'it':'pic'}
          below={<div className="header-content" style={{padding:'0.75rem 1.5rem'}}>
            <div className="header-left"><h1 className="header-title" style={{margin:0,fontSize:'1.15rem'}}>{headerTitle}</h1><p className="header-subtitle" style={{margin:0,fontSize:'0.75rem',opacity:.75}}>{headerSubtitle}</p></div>
            <div className="header-right"><button onClick={handleBack} className="btn-secondary"><i className="fas fa-arrow-left"/> Back</button></div>
          </div>}
        />
      ))}
      <div className="dashboard-main">
  <div className={`mrd ${isCEO? 'mrd--bar':''}`}>
          <div className="mrd-summary">
            <div className="mrd-summary-main">
              <div id="summary" className="mrd-id-line"><span className="mrd-id-label">ID:</span><span className="mrd-id-value">{materialRequest._id}</span><button className="mrd-copy" onClick={()=>{navigator.clipboard?.writeText(materialRequest._id); setCopied(true); setTimeout(()=>setCopied(false),1600);}} title="Copy ID"><i className="fas fa-copy"/></button>{copied && <span className="mrd-copied">Copied!</span>}</div>
              <h2 className="mrd-title">{materialRequest.requestNumber || 'Material Request'}</h2>
              <p className="mrd-desc">{materialRequest.description || 'No description provided.'}</p>
              <div className="mrd-meta-row">
                <span className="mrd-meta">Created {new Date(materialRequest.createdAt).toLocaleDateString()}</span>
                {materialRequest.project?.projectName && <span className="mrd-meta">Project: {materialRequest.project.projectName}</span>}
                {materialRequest.project?.location && (
                  <span className="mrd-meta">Location: {materialRequest.project.location?.name || materialRequest.project.location?.toString?.() || '—'}</span>
                )}
              </div>
              <div className="mrd-progress" aria-label="Approval progress">
                <div className="mrd-progress-bar"><div className="mrd-progress-fill" style={{width:progressPct+'%'}}/></div>
                <span className="mrd-progress-meta">{progressPct}% complete • {completedCount}/{totalCount} steps</span>
              </div>
            </div>
            <div className="mrd-summary-side">
              <div className={`mrd-status-badge status-${statusBadge.toLowerCase()}`}>{statusBadge}</div>
              {materialRequest.priority && <div className={`mrd-chip priority-${(materialRequest.priority||'').toLowerCase()}`}>{materialRequest.priority}</div>}
            </div>
          </div>
          <div className="mrd-grid">
            <section className={`mrd-section ${collapsedSections.info?'collapsed':''}`} aria-labelledby="info-h">
              <div className="mrd-section-head" onClick={()=>toggleSection('info')} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&toggleSection('info')}>
                <h3 id="info-h" className="mrd-section-title"><i className="fas fa-info-circle"/> Request Information</h3>
                <button className="mrd-collapse-btn" aria-label="Toggle section">{collapsedSections.info? <i className="fas fa-plus"/>:<i className="fas fa-minus"/>}</button>
              </div>
              {!collapsedSections.info && <dl className="mrd-fields"><div className="mrd-field"><dt>Request Number</dt><dd>{materialRequest.requestNumber||'—'}</dd></div><div className="mrd-field"><dt>Priority</dt><dd><span className={`mrd-chip priority-${(materialRequest.priority||'').toLowerCase()}`}>{materialRequest.priority||'—'}</span></dd></div><div className="mrd-field"><dt>Created</dt><dd>{new Date(materialRequest.createdAt).toLocaleString()}</dd></div>{meta.isReceived && <div className="mrd-field"><dt>Received</dt><dd>{new Date(materialRequest.receivedAt || materialRequest.receivedDate).toLocaleString()}</dd></div>}<div className="mrd-field"><dt>Status</dt><dd>{statusBadge}</dd></div></dl>}
            </section>
            <section className={`mrd-section ${collapsedSections.req?'collapsed':''}`} aria-labelledby="req-h">
              <div className="mrd-section-head" onClick={()=>toggleSection('req')} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&toggleSection('req')}>
                <h3 id="req-h" className="mrd-section-title"><i className="fas fa-user"/> Requester</h3>
                <button className="mrd-collapse-btn" aria-label="Toggle section">{collapsedSections.req? <i className="fas fa-plus"/>:<i className="fas fa-minus"/>}</button>
              </div>
              {!collapsedSections.req && <dl className="mrd-fields"><div className="mrd-field"><dt>Name</dt><dd>{materialRequest.createdBy?.name||'—'}</dd></div><div className="mrd-field"><dt>Email</dt><dd>{materialRequest.createdBy?.email||'—'}</dd></div><div className="mrd-field"><dt>Role</dt><dd>{materialRequest.createdBy?.role||'—'}</dd></div><div className="mrd-field"><dt>Project</dt><dd>{materialRequest.project?.projectName||'—'}</dd></div><div className="mrd-field"><dt>Location</dt><dd>{materialRequest.project?.location?.name || materialRequest.project?.location?.toString?.() || '—'}</dd></div></dl>}
            </section>
            <section className={`mrd-section ${collapsedSections.mat?'collapsed':''}`} aria-labelledby="mat-h">
              <div className="mrd-section-head" onClick={()=>toggleSection('mat')} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&toggleSection('mat')}>
                <h3 id="mat-h" className="mrd-section-title"><i className="fas fa-boxes"/> Materials</h3>
                <button className="mrd-collapse-btn" aria-label="Toggle section">{collapsedSections.mat? <i className="fas fa-plus"/>:<i className="fas fa-minus"/>}</button>
              </div>
              {!collapsedSections.mat && (materialRequest.materials?.length ? <ul className="mrd-material-list">{materialRequest.materials.map((m,i)=>(<li key={i} className="mrd-material-item"><div className="mrd-material-head"><span className="mrd-material-name">{m.materialName}</span><span className="mrd-qty">{m.quantity}{m.unit?` ${m.unit}`:''}</span></div>{m.specifications && <div className="mrd-spec">{m.specifications}</div>}</li>))}</ul> : <p className="mrd-empty">No materials specified.</p>)}
            </section>
            <section className={`mrd-section ${collapsedSections.att?'collapsed':''}`} aria-labelledby="att-h">
              <div className="mrd-section-head" onClick={()=>toggleSection('att')} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&toggleSection('att')}>
                <h3 id="att-h" className="mrd-section-title"><i className="fas fa-paperclip"/> Attachments</h3>
                <button className="mrd-collapse-btn" aria-label="Toggle section">{collapsedSections.att? <i className="fas fa-plus"/>:<i className="fas fa-minus"/>}</button>
              </div>
              {!collapsedSections.att && (materialRequest.attachments?.length ? <ul className="mrd-attach-list">{materialRequest.attachments.map((a,i)=>(<li key={i} className="mrd-attach-item"><div className="mrd-attach-icon">{renderAttachmentIcon(a)}</div><span className="mrd-attach-name">{a}</span><a href={a.startsWith('http')?a:`http://localhost:5000/uploads/${a}`} target="_blank" rel="noopener noreferrer" className="mrd-attach-link">Download</a></li>))}</ul> : <p className="mrd-empty">No attachments.</p>)}
            </section>
            <section className={`mrd-section ${collapsedSections.flow?'collapsed':''}`} aria-labelledby="flow-h">
              <div className="mrd-section-head" onClick={()=>toggleSection('flow')} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&toggleSection('flow')}>
                <h3 id="flow-h" className="mrd-section-title"><i className="fas fa-tasks"/> Approval Flow</h3>
                <button className="mrd-collapse-btn" aria-label="Toggle section">{collapsedSections.flow? <i className="fas fa-plus"/>:<i className="fas fa-minus"/>}</button>
              </div>
              {!collapsedSections.flow && <ol className="mrd-flow">{steps.map(step => {const waitingForReceipt = step.key==='received' && step.state==='pending' && meta.pmApproved && meta.amApproved && !meta.isReceived && !meta.anyDenied; const metaText = step.date? new Date(step.date).toLocaleString() : step.state==='blocked' ? 'Waiting' : waitingForReceipt ? 'Awaiting PIC receipt' : 'Pending'; return (<li key={step.key} className={`mrd-flow-step ${step.state}`}><div className="mrd-step-icon"><i className={`fas ${step.state==='completed'?'fa-check':step.state==='denied'?'fa-times':step.state==='blocked'?'fa-pause':'fa-clock'}`}/></div><div className="mrd-step-body"><span className="mrd-step-title">{step.label}</span><span className="mrd-step-meta">{metaText}</span></div></li>);})}</ol>}
            </section>
            {canAct && <section className="mrd-section mrd-actions" aria-labelledby="act-h"><h3 id="act-h" className="mrd-section-title"><i className="fas fa-gavel"/> Actions</h3><ApproveDenyActions requestData={materialRequest} userId={userId} userRole={userRole} onBack={handleBack} /></section>}
      {(canEditPIC || canMarkReceived) && (
              <section className="mrd-section mrd-actions" aria-labelledby="pic-act-h">
                <h3 id="pic-act-h" className="mrd-section-title"><i className="fas fa-toolbox"/> PIC Actions</h3>
                <div className="mrd-action-buttons" style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                  {canEditPIC && <button onClick={handleEdit} className="btn-secondary"><i className="fas fa-edit"/> Edit Request</button>}
                  {canMarkReceived && <button onClick={handleMarkReceived} disabled={receiving} className="btn-primary"><i className="fas fa-box-open"/> {receiving? 'Marking...' : 'Mark as Received'}</button>}
                </div>
        <p style={{fontSize:'12px',marginTop:'8px',color:'#64748b'}}>PIC may edit only before any manager validates (no approvals yet). Mark as received becomes available after full approval.</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialRequestDetailView;
