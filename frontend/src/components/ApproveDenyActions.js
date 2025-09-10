import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axiosInstance';



// Helper: Get display date from a date string
const formatDateTime = (dateVal) => {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  return (
    date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    " " +
    date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
};

const ApproveDenyActions = ({
  requestData,
  userId,
  userRole,
  onBack,
  onActionComplete
}) => {
  // Map roles to approval keys
  const roleKey =
    userRole === 'Project Manager' ? 'PM'
    : userRole === 'Area Manager' ? 'AM'
    : userRole;

  const status = requestData?.status;
  const isPendingForMe =
    (status === 'Pending Project Manager' && roleKey === 'PM') ||
    (status === 'Pending Area Manager' && roleKey === 'AM');

  const hasActed = requestData?.approvals?.some(
    (a) => a.role === roleKey && String(a.user?._id || a.user) === String(userId)
  );

  const showApproveDeny = isPendingForMe && !hasActed;

  // PO feature removed: simple approve/deny only

  // Modal state
  const [showDenyReason, setShowDenyReason] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const closeDenyModal = (clear=true)=>{ setShowDenyReason(false); if(clear) setDenyReason(''); };
  // Track previous denyReason to detect prepend typing bug (characters appearing in reverse order)
  const prevDenyRef = useRef('');
  const denyTextareaRef = useRef(null);
  useEffect(()=>{ prevDenyRef.current = denyReason; },[denyReason]);
  // When modal opens, focus & move caret to end
  useEffect(()=>{
    if(showDenyReason && denyTextareaRef.current){
      requestAnimationFrame(()=>{
        const el = denyTextareaRef.current; el.focus(); el.selectionStart = el.selectionEnd = el.value.length;
      });
    }
  },[showDenyReason]);
  // Modal body scroll lock + ESC handling
  useEffect(()=>{
    const anyOpen = showDenyReason || showApproveConfirm;
    if(anyOpen){
      const prev = document.body.style.overflow;
      document.body.style.overflow='hidden';
      const onKey = (e)=>{ if(e.key==='Escape'){ if(showDenyReason) closeDenyModal(true); if(showApproveConfirm) setShowApproveConfirm(false);} };
      window.addEventListener('keydown', onKey);
      return ()=>{ document.body.style.overflow=prev; window.removeEventListener('keydown', onKey); };
    }
  },[showDenyReason, showApproveConfirm]);

  const ModalPortal = ({children}) => createPortal(children, document.body);
  const [feedback, setFeedback] = useState(null); // {type:'success'|'error', message:string}
  const [denySubmitting, setDenySubmitting] = useState(false);
  // Auto clear feedback after a few seconds
  useEffect(()=>{ if(!feedback) return; const t=setTimeout(()=>setFeedback(null), 5000); return ()=>clearTimeout(t); },[feedback]);

  // Approve button click: only validation + open modal
  const handleApprove = () => { if(!showApproveDeny) return; setShowApproveConfirm(true); };

  // Actual approve submission from confirmation modal
  const submitApproveFromModal = () => {
    setShowApproveConfirm(false);
    (async()=>{
      const token = localStorage.getItem('token');
      const payload = { decision: 'approved' };
      try {
        await api.post(`/requests/${requestData._id}/approve`, payload, { headers:{ Authorization:`Bearer ${token}` } });
        setFeedback({type:'success', message:'Request approved.'});
        if(onActionComplete) onActionComplete(); else onBack();
      } catch(err){
        setFeedback({type:'error', message: err?.response?.data?.message || 'Failed to approve request.'});
      }
    })();
  };


  // Deny
  const handleDeny = () => { setShowDenyReason(true); setDenySubmitting(false); };
  const submitDeny = async () => {
    if (!denyReason.trim()) {
      setFeedback({ type:'error', message:'Reason is required.' });
      return;
    }
    const token = localStorage.getItem('token');
    if(!token){ setFeedback({type:'error', message:'Not authenticated.'}); return; }
    try {
      setDenySubmitting(true);
      console.log('[DENY] submitting', { id: requestData?._id, reason: denyReason });
      await api.post(
        `/requests/${requestData._id}/approve`,
        { decision: 'denied', reason: denyReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedback({ type:'success', message:'Request denied.' });
      setShowDenyReason(false);
      setDenyReason('');
      if (onActionComplete) onActionComplete();
      else onBack();
    } catch (err) {
      console.error(err);
      setFeedback({ type:'error', message: err?.response?.data?.message || 'Failed to deny request.' });
    } finally {
      setDenySubmitting(false);
    }
  };

  // --- RECEIVED BY PIC INFO ---
  const isReceived = !!requestData?.receivedDate;
  const receivedDate = requestData?.receivedDate
    ? formatDateTime(requestData.receivedDate)
    : null;

  // --- DENIAL INFO ---
  const deniedStatuses = ['Denied by Project Manager', 'Denied by Area Manager'];
  const isDenied = deniedStatuses.includes(requestData?.status);
  let deniedApproval = null;
  if (isDenied) {
    deniedApproval = [...(requestData?.approvals || [])]
      .reverse()
      .find(app => app.decision === 'denied');
  }

  // Helper: Get Denier Display
  const getDenierDisplay = (approval) => {
    if (!approval) return '';
    let role =
      approval.role === 'Project Manager'
        ? 'Project Manager'
        : approval.role === 'Area Manager'
        ? 'Area Manager'
        : approval.role;
    if (approval.user && typeof approval.user === 'object' && approval.user.name) {
      return `${approval.user.name} (${role})`;
    }
    return `${role}`;
  };

  // ---- Approve Button Label logic ----
  let approveLabel = 'Approve';
  if (status === 'Pending Project Manager' && roleKey === 'PM') {
    approveLabel = 'Validate';
  } else if (status === 'Pending Area Manager' && roleKey === 'AM') {
    approveLabel = 'Approve';
  }

  // Validation helpers
  const canApprove = useMemo(()=> showApproveDeny, [showApproveDeny]);

  // Dynamic approve modal messaging
  let approveModalMessage = 'You are approving this request.';
  if (status === 'Pending Project Manager' && roleKey === 'PM') {
    approveModalMessage = 'You are validating this request and sending it to the Area Manager.';
  } else if (status === 'Pending Area Manager' && roleKey === 'AM') {
    approveModalMessage = 'You are approving and completing this request.';
  }

  return (
    <>
      {/* Denied Banner */}
      {isDenied && deniedApproval && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 4
          }}>
            Request Denied By: {getDenierDisplay(deniedApproval)}
          </div>
          <div style={{
            background: '#faeaea',
            color: '#a12d2d',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 15,
            maxWidth: 800,
            margin: '0 auto',
            border: '1px solid #eedcdc',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>Reason:</div>
            {deniedApproval.reason}
          </div>
        </div>
      )}

      {feedback && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 13,
          background: feedback.type==='success'? '#ecfdf5':'#fef2f2',
          color: feedback.type==='success'? '#065f46':'#b91c1c',
          border: `1px solid ${feedback.type==='success'? '#a7f3d0':'#fecaca'}`
        }}>
          {feedback.message}
        </div>
      )}

      {/* Delivered Banner */}
      {isReceived && (
        <div style={{
          margin: '40px 0 0',
          textAlign: 'center',
          color: '#15a563',
          fontWeight: 600
        }}>
          This Request has been Closed and Items were Successfully Delivered On: {receivedDate}
        </div>
      )}

      {/* PO input section for AM final approval */}
  {/* PO UI removed */}

      {/* Action Buttons */}
      <div className="action-buttons unified">
        <button onClick={onBack} className="back-btn">Back</button>
        {showApproveDeny && (
          <>
            <button
              onClick={handleApprove}
              disabled={!canApprove}
              className="publish-button-picmatreq"
              style={{ background: canApprove? '#16a34a':'#9ca3af', minWidth: 140, cursor: canApprove? 'pointer':'not-allowed' }}
            >
              {approveLabel}
            </button>
            <button
              onClick={handleDeny}
              className="cancel-btn"
              style={{
                marginLeft: '1rem',
                background: '#dc3545',
                color: '#fff',
                minWidth: 120
              }}
            >
              Deny
            </button>
          </>
        )}
      </div>

  {/* (Removed legacy inline deny modal; using portal version below) */}

      {showDenyReason && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-label="Deny Request" style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.55)'}} onClick={()=>!denySubmitting && closeDenyModal(true)}>
            {/* Center wrapper */}
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'100%',maxWidth:840,padding:'0 24px'}}>
            <div style={{background:'#fff',width:'100%',borderRadius:14,padding:'30px 34px',boxShadow:'0 15px 40px -8px rgba(0,0,0,0.25)',animation:'fadeInScale .18s ease'}} onClick={e=>e.stopPropagation()}>
              <h3 style={{margin:'0 0 14px',fontSize:22}}>Deny Request</h3>
              <p style={{margin:'0 0 18px',fontSize:14,color:'#475569'}}>Please provide a reason for denial:</p>
              {/* LTR isolation wrapper */}
              <div style={{direction:'ltr'}}>
              <textarea
                dir="ltr"
                spellCheck={true}
                value={denyReason}
                onChange={e=>{
                  const raw = e.target.value;
                  const prev = prevDenyRef.current;
                  let next = raw;
                  // Detect pattern where new chars are prepended (typing appears reversed): new ends with previous
                  if(raw.length === prev.length + 1 && raw.endsWith(prev)){
                    // Example: typed 'a','b','c' but value becomes 'cba' progression; fix by appending typed char
                    const added = raw.slice(0, raw.length - prev.length); // the prepended char(s)
                    next = prev + added;
                  } else if(raw.length > prev.length + 1 && raw.endsWith(prev)){
                    // Multiple chars pasted/inserted at start
                    const added = raw.slice(0, raw.length - prev.length);
                    next = prev + added;
                  }
                  setDenyReason(next);
                  // Force caret to end after React updates DOM
                  requestAnimationFrame(()=>{
                    if(denyTextareaRef.current){
                      const el = denyTextareaRef.current;
                      el.selectionStart = el.selectionEnd = el.value.length;
                    }
                  });
                }}
                rows={6}
                autoFocus
                disabled={denySubmitting}
                style={{
                  width:'100%',
                  borderRadius:10,
                  border:'1px solid #93c5fd',
                  padding:'14px 16px',
                  fontSize:14,
                  background: denySubmitting? '#f1f5f9':'#f8fafc',
                  minHeight:170,
                  resize:'vertical',
                  direction:'ltr',
                  textAlign:'left',
                  whiteSpace:'pre-wrap',
                  overflowWrap:'break-word',
                  lineHeight:'1.45',
                  fontFamily:'inherit',
                  writingMode:'horizontal-tb',
                  textIndent:0,
                  caretColor:'#111827',
                  unicodeBidi:'isolate',
                  transform:'none'
                }}
                autoComplete="off"
                ref={denyTextareaRef}
                placeholder="Enter reason for denial"
              />
              </div>
              <div style={{marginTop:20,display:'flex',justifyContent:'flex-end',gap:12}}>
                <button onClick={()=>closeDenyModal(true)} disabled={denySubmitting} style={{padding:'11px 22px',background:'#e2e8f0',border:'none',borderRadius:9,fontWeight:500,cursor: denySubmitting? 'not-allowed':'pointer',opacity: denySubmitting? .6:1}}>Cancel</button>
                <button onClick={submitDeny} disabled={!denyReason.trim()||denySubmitting} style={{padding:'11px 24px',background: (!denyReason.trim()||denySubmitting)? '#fca5a5':'#dc2626',color:'#fff',border:'none',borderRadius:9,fontWeight:600,cursor: (!denyReason.trim()||denySubmitting)? 'not-allowed':'pointer',opacity: denySubmitting? .7:1}}>{denySubmitting? 'Submitting...':'Submit'}</button>
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}

  {showApproveConfirm && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-label="Approve Request" style={{position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.55)',padding:'24px'}} onClick={()=>setShowApproveConfirm(false)}>
            <div style={{background:'#fff',borderRadius:14,padding:'30px 34px',width:'100%',maxWidth:640,boxShadow:'0 15px 40px -8px rgba(0,0,0,0.25)',animation:'fadeInScale .18s ease'}} onClick={e=>e.stopPropagation()}>
      <h3 style={{margin:'0 0 14px',fontSize:22,display:'flex',alignItems:'center',gap:10}}><i className="fas fa-check-circle" style={{color:'#16a34a'}}/> Confirm {approveLabel}</h3>
              <p style={{margin:'0 0 18px',fontSize:14,color:'#475569'}}>{approveModalMessage}</p>
              <div style={{marginTop:4,display:'flex',justifyContent:'flex-end',gap:12}}>
                <button onClick={()=>setShowApproveConfirm(false)} style={{padding:'11px 22px',background:'#e2e8f0',border:'none',borderRadius:9,fontWeight:500,cursor:'pointer'}}>Cancel</button>
                <button onClick={submitApproveFromModal} style={{padding:'11px 24px',background:'#16a34a',color:'#fff',border:'none',borderRadius:9,fontWeight:600,cursor:'pointer'}}>Confirm</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

export default ApproveDenyActions;
