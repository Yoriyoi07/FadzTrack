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
  // Lightbox preview state for attachments
  const [previewAttachment, setPreviewAttachment] = useState(null);
  // Signed URL map { key: signedUrl }
  const [signedUrls, setSignedUrls] = useState({});
  const profileDropdownRef = useRef(null);
  const user = (()=>{ try {return JSON.parse(localStorage.getItem('user'))||null;}catch{return null;} })();
  const userId = user?._id; const userRole = user?.role;

  const fetchRequest = useCallback(()=>{ let mounted=true; setLoading(true); setError(''); const ctrl=new AbortController();
    axiosInstance.get(`/requests/${id}`,{signal:ctrl.signal}).then(r=>{ if(!mounted) return; setMaterialRequest(r.data); })
      .catch(e=>{ if(!mounted) return; if(e.name==='CanceledError') return; setError(e?.response?.data?.message||'Failed to load'); })
      .finally(()=>mounted && setLoading(false));
    return ()=>{ mounted=false; ctrl.abort(); };
  },[id]);
  useEffect(()=>{ const cleanup = fetchRequest(); return cleanup; },[fetchRequest]);

  // Fetch signed URLs once request (and its attachments) are loaded
  useEffect(()=>{
    if(!materialRequest || !materialRequest.attachments || materialRequest.attachments.length===0) return;
    let active=true;
    (async()=>{
      try{
        const res = await axiosInstance.get(`/requests/${materialRequest._id}/attachments/signed`);
        if(!active) return;
        const map={};
        (res.data||[]).forEach(o=>{ if(o.key && o.signedUrl) map[o.key]=o.signedUrl; });
        setSignedUrls(map);
      }catch(err){ console.warn('Failed to fetch signed attachment urls', err); }
    })();
    return ()=>{active=false};
  },[materialRequest]);

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

  const isImage = (fname='') => {
    const ext = fname.split('.').pop().toLowerCase();
    return ['png','jpg','jpeg','gif','webp'].includes(ext);
  };
  const buildAttachmentUrl = (a='') => {
    if(!a) return '';
    if(signedUrls[a]) return signedUrls[a];
    // If a is full public supabase URL, attempt to extract relative key and look up
    if(a.startsWith('http')){
      const m = a.match(/\/storage\/v1\/object\/public\/material-request-photos\/(.+)$/);
      if(m && m[1] && signedUrls[m[1]]) return signedUrls[m[1]];
      return a; // fallback to original public URL
    }
    return '';
  };

  // Close preview on ESC
  useEffect(()=>{
    if(!previewAttachment) return; const onKey=e=>{ if(e.key==='Escape') setPreviewAttachment(null); }; window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey); },[previewAttachment]);

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
  // Denial info
  const isDenied = /denied/i.test(materialRequest.status||'');
  let denialApproval = null;
  if(isDenied && Array.isArray(materialRequest.approvals)){
    denialApproval = [...materialRequest.approvals].reverse().find(a=>a.decision==='denied');
  }
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
          <div className="mrd-page-bar">
            <div className="mrd-page-left">
              <button onClick={handleBack} className="mrd-back-btn" type="button" aria-label="Back to previous page">
                <i className="fas fa-arrow-left"/>
                <span>Back</span>
              </button>
              <h1 className="mrd-page-title">Material Request</h1>
            </div>
            {materialRequest.status && <div className="mrd-page-status"></div>}
          </div>
          {/* Modern Redesigned Layout */}
          <div className="mrd-modern">
            <div className="mrd-modern-summary">
              <div className="mrd-ms-left">
                <div className="mrd-id-line">
                  <span className="mrd-id-label">ID</span>
                  <span className="mrd-id-value">{materialRequest._id}</span>
                  <button className="mrd-copy" onClick={()=>{navigator.clipboard?.writeText(materialRequest._id); setCopied(true); setTimeout(()=>setCopied(false),1600);}} title="Copy ID"><i className="fas fa-copy"/></button>
                  {copied && <span className="mrd-copied">Copied!</span>}
                </div>
                <h2 className="mrd-title" style={{marginTop:4}}>{materialRequest.requestNumber || 'Material Request'}</h2>
                {materialRequest.description && <p className="mrd-desc" style={{marginTop:8}}>{materialRequest.description}</p>}
                <div className="mrd-summary-tags">
                  <span className="mrd-meta">Created {new Date(materialRequest.createdAt).toLocaleDateString()}</span>
                    {materialRequest.project?.projectName && <span className="mrd-meta">{materialRequest.project.projectName}</span>}
                    {typeof materialRequest.project?.budget === 'number' && <span className="mrd-meta">Remaining Budget: ₱{materialRequest.project.budget.toLocaleString()}</span>}
                  {materialRequest.project?.location && <span className="mrd-meta">{materialRequest.project.location?.name || materialRequest.project.location?.toString?.() || '—'}</span>}
                </div>
                <div className="mrd-progress" aria-label="Approval progress">
                  <div className="mrd-progress-bar"><div className="mrd-progress-fill" style={{width:progressPct+'%'}}/></div>
                  <span className="mrd-progress-meta">{progressPct}% • {completedCount}/{totalCount} steps</span>
                </div>
              </div>
              <div className="mrd-ms-right">
                <div className={`mrd-status-badge status-${statusBadge.toLowerCase()}`}>{statusBadge}</div>
                {/* priority removed */}
              </div>
            </div>
            <div className="mrd-modern-body">
              <div className="mrd-col-main">
                {isDenied && denialApproval && (
                  <div style={{
                    background:'#fef2f2',
                    border:'1px solid #fecaca',
                    padding:'14px 18px',
                    borderRadius:12,
                    marginBottom:18,
                    color:'#991b1b',
                    lineHeight:1.4,
                    fontSize:14
                  }} role="alert" aria-live="polite">
                    <div style={{fontWeight:600,marginBottom:6,display:'flex',alignItems:'center',gap:8}}>
                      <i className="fas fa-ban"/> Request Denied{denialApproval.role?` by ${denialApproval.role}`:''}
                    </div>
                    <div style={{whiteSpace:'pre-wrap'}}>{denialApproval.reason || 'No reason provided.'}</div>
                    {denialApproval.user?.name && (
                      <div style={{marginTop:8,fontSize:11,opacity:.7}}>By: {denialApproval.user.name} • {new Date(denialApproval.date||denialApproval.updatedAt||denialApproval.createdAt||materialRequest.updatedAt).toLocaleString()}</div>
                    )}
                  </div>
                )}
                {/* Info */}
        <section className="mrd-section flat" aria-labelledby="info-h">
                  <h3 id="info-h" className="mrd-section-title"><i className="fas fa-info-circle"/> Information</h3>
                  <dl className="mrd-fields two-col">
                    <div className="mrd-field"><dt>Request #</dt><dd>{materialRequest.requestNumber||'—'}</dd></div>
                    {/* Priority field removed */}
                    <div className="mrd-field"><dt>Created</dt><dd>{new Date(materialRequest.createdAt).toLocaleString()}</dd></div>
                    {meta.isReceived && <div className="mrd-field"><dt>Received</dt><dd>{new Date(materialRequest.receivedAt || materialRequest.receivedDate).toLocaleString()}</dd></div>}
                    <div className="mrd-field"><dt>Status</dt><dd>{statusBadge}</dd></div>
                    <div className="mrd-field"><dt>Project</dt><dd>{materialRequest.project?.projectName||'—'}</dd></div>
          {typeof materialRequest.project?.budget === 'number' && <div className="mrd-field"><dt>Project Budget</dt><dd>₱{materialRequest.project.budget.toLocaleString()}</dd></div>}
                  </dl>
                </section>
                {/* Requester */}
                <section className="mrd-section flat" aria-labelledby="req-h">
                  <h3 id="req-h" className="mrd-section-title"><i className="fas fa-user"/> Requester</h3>
                  <dl className="mrd-fields two-col">
                    <div className="mrd-field"><dt>Name</dt><dd>{materialRequest.createdBy?.name||'—'}</dd></div>
                    <div className="mrd-field"><dt>Email</dt><dd>{materialRequest.createdBy?.email||'—'}</dd></div>
                    <div className="mrd-field"><dt>Role</dt><dd>{materialRequest.createdBy?.role||'—'}</dd></div>
                    <div className="mrd-field"><dt>Location</dt><dd>{materialRequest.project?.location?.name || materialRequest.project?.location?.toString?.() || '—'}</dd></div>
                  </dl>
                </section>
                {/* Materials */}
                <section className="mrd-section flat" aria-labelledby="mat-h">
                  <h3 id="mat-h" className="mrd-section-title"><i className="fas fa-boxes"/> Materials</h3>
                  {materialRequest.materials?.length ? (
                    <ul className="mrd-material-list modern">
                      {materialRequest.materials.map((m,i)=>(
                        <li key={i} className="mrd-material-item">
                          <div className="mrd-material-head">
                            <span className="mrd-material-name">{m.materialName}</span>
                            <span className="mrd-qty">{m.quantity}{m.unit?` ${m.unit}`:''}</span>
                          </div>
                          {m.specifications && <div className="mrd-spec">{m.specifications}</div>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mrd-empty">No materials specified.</p>}
                </section>
                {/* Attachments moved to right column for immediate visibility */}
              </div>
              <div className="mrd-col-side">
                {/* Attachments (Gallery) */}
                <section className="mrd-section flat" aria-labelledby="att-h">
                  <h3 id="att-h" className="mrd-section-title"><i className="fas fa-paperclip"/> Attachments</h3>
                  {materialRequest.attachments?.length ? (
                    <div className="mrd-attach-gallery">
                      {materialRequest.attachments.map((a,i)=>{
                        const url = buildAttachmentUrl(a);
                        const image = isImage(a);
                        return (
                          <div key={i} className="mrd-attach-tile" title={a}>
                            {image && url ? (
                              <button type="button" className="mrd-thumb" onClick={()=>setPreviewAttachment(url)} aria-label="Open image preview">
                                <img src={url} alt={a} loading="lazy" />
                              </button>
                            ) : (
                              <div className="mrd-file-icon" onClick={()=> url && window.open(url,'_blank','noopener')} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&& url && window.open(url,'_blank','noopener')}>
                                {renderAttachmentIcon(a)}
                              </div>
                            )}
                            <div className="mrd-attach-meta">
                              <span className="mrd-attach-filename">{a}</span>
                              {url ? <a className="mrd-attach-download" href={url} target="_blank" rel="noopener noreferrer">Download</a> : <span style={{fontSize:10,color:'#dc2626'}}>No URL</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="mrd-empty">No attachments.</p>}
                </section>
                {/* Approval Timeline */}
                <section className="mrd-section flat" aria-labelledby="flow-h">
                  <h3 id="flow-h" className="mrd-section-title"><i className="fas fa-tasks"/> Approval Flow</h3>
                  <ul className="mrd-timeline">
                    {steps.map(step=>{ const waitingForReceipt = step.key==='received' && step.state==='pending' && meta.pmApproved && meta.amApproved && !meta.isReceived && !meta.anyDenied; const metaText = step.date? new Date(step.date).toLocaleString() : step.state==='blocked' ? 'Waiting' : waitingForReceipt ? 'Awaiting PIC receipt' : 'Pending'; return (
                      <li key={step.key} className={`tl-step ${step.state}`}>
                        <div className="tl-node" />
                        <div className="tl-content">
                          <div className="tl-title">{step.label}</div>
                          <div className="tl-meta">{metaText}</div>
                        </div>
                      </li>
                    ); })}
                  </ul>
                </section>
                {/* Actions */}
                {(canAct || canEditPIC || canMarkReceived) && (
                  <section className="mrd-section flat" aria-labelledby="act-h">
                    <h3 id="act-h" className="mrd-section-title"><i className="fas fa-gavel"/> Actions</h3>
                    {canAct && <div className="mrd-action-block"><ApproveDenyActions requestData={materialRequest} userId={userId} userRole={userRole} onBack={handleBack} onActionComplete={fetchRequest} /></div>}
                    {(canEditPIC || canMarkReceived) && (
                      <div className="mrd-action-block" style={{display:'flex',flexDirection:'column',gap:12}}>
                        {canEditPIC && <button onClick={handleEdit} className="btn-secondary"><i className="fas fa-edit"/> Edit Request</button>}
                        {canMarkReceived && <button onClick={handleMarkReceived} disabled={receiving} className="btn-primary"><i className="fas fa-box-open"/> {receiving? 'Marking...' : 'Mark as Received'}</button>}
                        <p style={{fontSize:12,margin:0,color:'#64748b'}}>Edit allowed only before manager validation. Receipt after full approval.</p>
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
          {previewAttachment && (
            <div className="mrd-lightbox" role="dialog" aria-modal="true" aria-label="Attachment preview" onClick={()=>setPreviewAttachment(null)}>
              <div className="mrd-lightbox-inner" onClick={e=>e.stopPropagation()}>
                <button className="mrd-lightbox-close" onClick={()=>setPreviewAttachment(null)} aria-label="Close preview"><i className="fas fa-times"/></button>
                <img src={previewAttachment} alt="Attachment preview" className="mrd-lightbox-img" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialRequestDetailView;
