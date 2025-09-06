// Reusable ProjectView component with role-based permissions (pm, am, ceo, hr)
// Extracted and refactored from original PM-specific implementation.
import React, { useEffect, useRef, useState } from 'react';
import AppHeader from '../layout/AppHeader';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import NotificationBell from '../NotificationBell';
import api from '../../api/axiosInstance';
import { exportProjectDetails } from '../../utils/projectPdf';
import {
  FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaDownload, FaCalendarAlt, FaMapMarkerAlt,
  FaUsers, FaUserTie, FaBuilding, FaMoneyBillWave, FaCheckCircle, FaClock, FaTrash, FaCamera
} from 'react-icons/fa';
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers as FaUsersNav, FaProjectDiagram, FaClipboardList, FaChartBar, FaCalendarAlt as FaCalendarAltNav } from 'react-icons/fa';
import "../style/pm_style/Pm_Dash.css";
import "../style/pm_style/Pm_ViewProjects.css";
import "../style/pm_style/Pm_ViewProjects_Wide.css";
// Staff style sheet (safe to load globally; selectors are namespaced under .staff-view-root)
import "../style/staff_style/Staff_ViewProject.css";

const SOCKET_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/api', '');
const SOCKET_PATH = '/socket.io';

function extractOriginalNameFromPath(path) {
  const base = (path || '').split('/').pop() || '';
  const underscore = base.indexOf('_');
  if (underscore !== -1 && underscore < base.length - 1) return base.slice(underscore + 1);
  const m = base.match(/^project-\d{8,}-(.+)$/i);
  if (m && m[1]) return m[1];
  return base;
}
function getFileType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map = { pdf:'PDF', doc:'DOC', docx:'DOCX', xls:'XLS', xlsx:'XLSX', ppt:'PPT', pptx:'PPTX', txt:'TXT', rtf:'RTF', csv:'CSV', jpg:'JPG', jpeg:'JPEG', png:'PNG', gif:'GIF', bmp:'BMP', svg:'SVG' };
  return map[ext] || 'FILE';
}
function getFileSize() { return 'N/A'; }
async function openSignedPath(path) { try { const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(path)}`); const url=data?.signedUrl; if(!url) throw 0; window.open(url,'_blank','noopener,noreferrer'); } catch { alert('Failed to open attachment.'); } }
async function openReportSignedPath(projectId, path) {
  try {
    if(!projectId) throw new Error('Missing project id');
    const { data } = await api.get(`/projects/${encodeURIComponent(projectId)}/reports-signed-url`, { params: { path } });
    const url = data?.signedUrl; if(!url) throw new Error('No signed url');
    window.open(url,'_blank','noopener,noreferrer');
  } catch (e) { console.error('Failed to open report file', e); alert('Failed to open report file.'); }
}
async function fetchSignedUrlsForImages(files){ const imgs=files.filter(f=>{ const name= typeof f==='string'? extractOriginalNameFromPath(f) : f.name || extractOriginalNameFromPath(f.path); return ['JPG','JPEG','PNG','GIF','BMP','SVG'].includes(getFileType(name));}); const out={}; for(const f of imgs){ const p= typeof f==='string'? f : f.path; try { const {data}=await api.get(`/photo-signed-url?path=${encodeURIComponent(p)}`); if(data?.signedUrl) out[p]=data.signedUrl; } catch{} } return out; }
function generateFileThumbnail(fileName,filePath,fileType,signedUrl){ const isImg=['JPG','JPEG','PNG','GIF','BMP','SVG'].includes(fileType); if(isImg){ const src=signedUrl||filePath; return <div className="file-thumbnail image-thumbnail"><img src={src} alt={fileName} onError={(e)=>{e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} /><div className="fallback-icon" style={{display:'none'}}>🖼️</div></div>; } const map={ PDF:['#ff6b6b','#ee5a52','📄'], DOC:['#4ecdc4','#44a08d','📝'], DOCX:['#4ecdc4','#44a08d','📝'], XLS:['#45b7d1','#96c93d','📊'], XLSX:['#45b7d1','#96c93d','📊'], PPT:['#f093fb','#f5576c','📈'], PPTX:['#f093fb','#f5576c','📈'], TXT:['#a8edea','#fed6e3','📄'], RTF:['#a8edea','#fed6e3','📄'], CSV:['#ffecd2','#fcb69f','📊'], FILE:['#667eea','#764ba2','📁'] }; const s=map[fileType]||map.FILE; return <div className="file-thumbnail document-thumbnail" style={{background:`linear-gradient(135deg,${s[0]},${s[1]})`}}><span className="thumbnail-icon">{s[2]}</span><span className="thumbnail-extension">{fileType}</span></div>; }
function renderMessageText(text='',me=''){ const slug=(me||'').trim().toLowerCase().replace(/\s+/g,''); if(!slug||!text) return text; const re=new RegExp(`@${slug}\\b`,'gi'); const parts=text.split(re); if(parts.length===1) return text; return parts.map((p,i)=> i===0? p : <React.Fragment key={i}><span style={{background:'#f6c343',color:'#3a2f00',padding:'2px 6px',borderRadius:4,fontWeight:'bold',fontSize:'0.9em'}}>@{me}</span>{p}</React.Fragment>); }
function isMentioned(text='',me=''){ const slug=(me||'').trim().toLowerCase().replace(/\s+/g,''); if(!slug||!text) return false; return text.toLowerCase().replace(/\s+/g,'').includes(`@${slug}`); }
function readContractor(p){
  if(!p) return 'N/A';
  const cRaw = p.contractor !== undefined && p.contractor !== null ? p.contractor : p.contractorName;
  if(!cRaw) return 'N/A';
  if(typeof cRaw === 'string') return cRaw.trim() || 'N/A';
  if(Array.isArray(cRaw)){
    const names = cRaw.map(x=> typeof x==='string'? x : (x?.name||x?.company||x?.companyName||x?.title||x?.fullName||''))
      .map(s=> (s||'').trim()).filter(Boolean);
    if(names.length) return names.join(', ');
  }
  if(typeof cRaw === 'object'){
    for(const k of ['name','company','companyName','title','fullName']){
      if(typeof cRaw[k] === 'string' && cRaw[k].trim()) return cRaw[k].trim();
    }
  }
  return 'N/A';
}
const peso = new Intl.NumberFormat('en-PH',{ style:'currency', currency:'PHP' });
const mentionRowStyles={ container:{position:'relative',background:'#fffbe6',border:'1px solid #f6c343',boxShadow:'0 0 0 2px rgba(246,195,67,.25) inset',borderRadius:10}, badge:{position:'absolute',top:6,right:6,fontSize:12,lineHeight:'16px',background:'#f6c343',color:'#3a2f00',borderRadius:999,padding:'2px 8px',fontWeight:700}};
const roleConfigs={
  pic:{ label:'Person in Charge', permissions:{ image:false,statusToggle:false,uploadFiles:true,deleteFiles:true,postDiscuss:true }, base:'/pic'},
  pm:{ label:'Project Manager', permissions:{ image:true,statusToggle:true,uploadFiles:true,deleteFiles:true,postDiscuss:true }, base:'/pm'},
  am:{ label:'Area Manager', permissions:{ image:true,statusToggle:false,uploadFiles:false,deleteFiles:false,postDiscuss:true }, base:'/am'},
  ceo:{ label:'CEO', permissions:{ image:false,statusToggle:false,uploadFiles:false,deleteFiles:false,postDiscuss:false }, base:'/ceo'},
  hr:{ label:'HR', permissions:{ image:false,statusToggle:false,uploadFiles:false,deleteFiles:false,postDiscuss:false }, base:'/hr'},
  it:{ label:'IT', permissions:{ image:false,statusToggle:false,uploadFiles:false,deleteFiles:false,postDiscuss:false }, base:'/it'},
  staff:{ label:'Staff', permissions:{ image:false,statusToggle:false,uploadFiles:false,deleteFiles:false,postDiscuss:true }, base:'/staff'},
  hrsite:{ label:'HR-Site', permissions:{ image:false,statusToggle:false,uploadFiles:false,deleteFiles:false,postDiscuss:true }, base:'/hr-site'}
};

export default function ProjectView(props) {
  const { role='pm', navItems, permissionsOverride, navPathOverrides, useUnifiedHeader: useUnifiedHeaderProp=false } = props || {};
  // Use unified header only when explicitly requested by parent
  const useUnifiedHeader = !!useUnifiedHeaderProp;
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const roleCfg = roleConfigs[role] || roleConfigs.pm;
  const perms = { ...roleCfg.permissions, ...(permissionsOverride||{}) };
  const basePath = roleCfg.base;
  // Role-specific route differences (legacy structure mapping)
  const viewProjectPathMap = {
  pic: `${basePath}/current-project${id?`/${id}`:''}`,
    pm: `${basePath}/viewprojects/${id}`,
    am: `${basePath}/projects/${id}`,
    ceo: `${basePath}/proj/${id}`,
    hr: `${basePath}/project-records/${id}`,
    it: `${basePath}/projects/${id}`,
  staff: `${basePath}/current-project${id?`/${id}`:''}`,
  hrsite: `${basePath}/current-project${id?`/${id}`:''}`
  };
  const progressReportPathMap = {
  pic: `${basePath}/progress-report/${id}`,
    pm: `${basePath}/progress-report/${id}`,
    am: `${basePath}/progress-report/${id}`,
    ceo: `${basePath}/progress-report/${id}`,
    hr: `${basePath}/progress-report/${id}`,
  it: `${basePath}/progress-report/${id}`,
  hrsite: `${basePath}/progress-report/${id}`
  };
  const dailyLogsPathMap = {
  pic: `${basePath}/daily-logs-list`,
    pm: `${basePath}/daily-logs-list`,
    am: `${basePath}/daily-logs-list`,
    ceo: `${basePath}/daily-logs-list`,
    hr: `${basePath}/daily-logs-list`,
  it: `${basePath}/daily-logs-list`,
  hrsite: `${basePath}/daily-logs-list`
  };
  const defaultNav = [
    { to: basePath, icon:<FaTachometerAlt/>, label:'Dashboard' },
    { to: `${basePath}/chat`, icon:<FaComments/>, label:'Chat' },
    { to: `${basePath}/request/:id`, icon:<FaBoxes/>, label:'Material' },
    { to: `${basePath}/manpower-list`, icon:<FaUsersNav/>, label:'Manpower' },
    { to: viewProjectPathMap[role] || `${basePath}/viewprojects/${id}`, icon:<FaProjectDiagram/>, label:'View Project', active:true },
    // Legacy nav items (Logs / Reports / Daily Logs) intentionally omitted for PM when using unified header
    ...(!useUnifiedHeader ? [
      { to: `${basePath}/daily-logs`, icon:<FaClipboardList/>, label:'Logs' },
      { to: progressReportPathMap[role] || `${basePath}/progress-report/${id}`, icon:<FaChartBar/>, label:'Reports' },
      { to: dailyLogsPathMap[role] || `${basePath}/daily-logs-list`, icon:<FaCalendarAltNav/>, label:'Daily Logs' }
    ] : [])
  ].map(item => navPathOverrides && navPathOverrides[item.label] ? { ...item, to: navPathOverrides[item.label] } : item);
  const nav = navItems || defaultNav;
  const userRef = useRef(null); if(userRef.current===null){ try { userRef.current = JSON.parse(localStorage.getItem('user')); } catch { userRef.current=null; } }
  const user = userRef.current; const userId = user?._id || null; const [userName] = useState(user?.name || roleCfg.label.split(' ')[0]);
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);
  const [isHeaderCollapsed,setIsHeaderCollapsed]=useState(false);
  const [project,setProject]=useState(null); const [activeTab,setActiveTab]=useState('Details'); const [status,setStatus]=useState('');
  const [progress,setProgress]=useState(0); const [loading,setLoading]=useState(true); const [picContributions,setPicContributions]=useState(null);
  const [purchaseOrders,setPurchaseOrders]=useState([]); const [totalPO,setTotalPO]=useState(0);
  const [messages,setMessages]=useState([]); const [loadingMsgs,setLoadingMsgs]=useState(false); const [newMessage,setNewMessage]=useState('');
  // Per-message reply collapse map: { [messageId]: boolean }
  const [collapsedReplies, setCollapsedReplies] = useState({});
  const [replyInputs,setReplyInputs]=useState({}); const [posting,setPosting]=useState(false); const [composerFiles,setComposerFiles]=useState([]); const [isDragOver,setIsDragOver]=useState(false); const [selectedLabel,setSelectedLabel]=useState('');
  const listScrollRef=useRef(null); const listBottomRef=useRef(null); const textareaRef=useRef(null);
  const [uploading,setUploading]=useState(false); const [uploadProgress,setUploadProgress]=useState(0); const [uploadError,setUploadError]=useState('');
  const [imageUploading,setImageUploading]=useState(false); const [imageUploadProgress,setImageUploadProgress]=useState(0); const [imageUploadError,setImageUploadError]=useState('');
  const [mentionDropdown,setMentionDropdown]=useState({open:false,options:[],query:'',position:{top:0,left:0},activeInputId:null});
  const [projectUsers,setProjectUsers]=useState([]); const [fileSignedUrls,setFileSignedUrls]=useState({}); const [fileSearchTerm,setFileSearchTerm]=useState('');
  const [reports,setReports]=useState([]);
  // Reports upload (PPTX) for PM & PIC
  const [reportUploading,setReportUploading]=useState(false);
  const [reportUploadProgress,setReportUploadProgress]=useState(0);
  const [reportUploadError,setReportUploadError]=useState('');
  const [attendanceReports,setAttendanceReports]=useState([]);
  const [attUploading,setAttUploading]=useState(false);
  const [attError,setAttError]=useState('');
  const [attendanceAI,setAttendanceAI]=useState(null);
  const [showCompleteConfirm,setShowCompleteConfirm]=useState(false);
  const [statusUpdating,setStatusUpdating]=useState(false);
  // Load attendance reports when Attendance tab selected
  useEffect(()=>{ if(activeTab!=='Attendance' || !project?._id) return; (async()=>{ try { const list=await api.get(`/projects/${project._id}/attendance`,{ headers:{Authorization:`Bearer ${token}`}}); const reps=list.data?.reports||[]; setAttendanceReports(reps); // pick latest AI summary
    if(reps.length){ const latest = reps[reps.length-1]; setAttendanceAI(latest.ai||null);} else setAttendanceAI(null); } catch { setAttendanceReports([]); } })(); },[activeTab,project?._id,token]);
  // Realtime socket refs
  const socketRef = useRef(null);
  const joinedProjectRef = useRef(null);
  useEffect(()=>{ const onScroll=()=> setIsHeaderCollapsed((window.pageYOffset||document.documentElement.scrollTop)>50); window.addEventListener('scroll',onScroll); return ()=> window.removeEventListener('scroll',onScroll); },[]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        if(!id){
          // Fallback for staff/hrsite/pic roles without explicit project id: pick first assigned project
            if((role==='staff' || role==='hrsite' || role==='pic') && userId){
              try {
                const { data } = await api.get(`/projects/assigned/allroles/${userId}`);
                if(cancelled) return;
                const list = Array.isArray(data)? data : [];
                const first = list[0];
                if(first){ setProject(first); setStatus(first?.status||''); }
                else { setProject(null); }
              } catch { if(!cancelled) setProject(null); }
            } else {
              setProject(null);
            }
            return;
        }
        const {data}=await api.get(`/projects/${id}`);
        if(cancelled) return;
        setProject(data); setStatus(data?.status||'');
      } catch { if(!cancelled) setProject(null); } finally { if(!cancelled) setLoading(false);} })();
    return ()=> {cancelled=true;};
  },[id,role,userId]);
  useEffect(()=>{ if(!project?._id) return; let cancelled=false; (async()=>{ try { const res=await api.get('/requests'); if(cancelled) return; const approved=(res.data||[]).filter(r=> String(r?.project?._id||'')===String(project._id) && r.status==='Approved' && r.totalValue); setPurchaseOrders(approved); setTotalPO(approved.reduce((s,r)=> s+(Number(r.totalValue)||0),0)); } catch { if(!cancelled){ setPurchaseOrders([]); setTotalPO(0);} } })(); return ()=> {cancelled=true;}; },[project?._id]);
  useEffect(()=>{ if(!project?._id || (activeTab!=='Discussions' && activeTab!=='Reports')) return; const controller=new AbortController(); setLoadingMsgs(true); api.get(`/projects/${project._id}/discussions`,{ headers:{Authorization:`Bearer ${token}`}, signal:controller.signal }).then(res=>{ const list=Array.isArray(res.data)?[...res.data].sort((a,b)=> new Date(a.timestamp||0)-new Date(b.timestamp||0)):[]; setMessages(list); }).catch(()=> setMessages([])).finally(()=> setLoadingMsgs(false)); return ()=> controller.abort(); },[project?._id,activeTab,token]);
  // Initialize collapsed state for messages with 3+ replies (only once per message)
  useEffect(()=>{ if(!messages.length) return; setCollapsedReplies(prev=>{ const next={...prev}; let changed=false; messages.forEach(m=>{ const rc=Array.isArray(m.replies)?m.replies.length:0; if(rc>=3 && typeof next[m._id]==='undefined'){ next[m._id]=true; changed=true; } }); return changed?next:prev; }); },[messages]);
  const fetchReports=async(pid=project?._id)=>{ if(!pid) return; try { const {data}=await api.get(`/projects/${pid}/reports`,{ headers:{Authorization:`Bearer ${token}`}}); const list=data?.reports||[]; setReports(list); if(!list.length){ console.info('[ProjectView] No reports for project', pid, 'role', role); return; } const sorted=[...list].sort((a,b)=> new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0)); const byUser=new Map(); for(const rep of sorted){ const key=rep.uploadedBy||rep.uploadedByName||rep._id; if(!byUser.has(key)) byUser.set(key,rep);} const distinct=[...byUser.values()]; let vals=distinct.map(r=> Number(r?.ai?.pic_contribution_percent)).filter(v=> isFinite(v)&&v>=0); if(!vals.length){ vals=distinct.map(r=>{ const done=r?.ai?.completed_tasks?.length||0; const total=done+(r?.ai?.summary_of_work_done?.length||0); return total>0?(done/total)*100:0; }); } if(vals.length){ const avg=vals.reduce((s,v)=> s+v,0)/vals.length; const avgClamped=Number(Math.min(100,Math.max(0,avg)).toFixed(1)); setProgress(avgClamped); setPicContributions({ averageContribution:Number(avg.toFixed(1)), picContributions:distinct.map(r=> ({ picId:r.uploadedBy||r._id, picName:r.uploadedByName||'Unknown', contribution:Math.round(Number(r?.ai?.pic_contribution_percent)||0), hasReport:true, lastReportDate:r.uploadedAt||null })), totalPics:distinct.length, reportingPics:distinct.length, pendingPics:0 }); } } catch (e){ console.error('[ProjectView] fetchReports failed', e); setReports([]);} };
  const completionPreconditionsMet = React.useMemo(()=>{
    if(!project) return false;
    const docCount = Array.isArray(project.documents)? project.documents.length : 0;
    const reportCount = Array.isArray(reports)? reports.length : 0;
    return docCount>0 && reportCount>0;
  },[project,reports]);

  const handleToggleStatus = async(forceComplete=false)=> {
    if(!project?._id) return;
    // If completing, ensure progress is 100 (already checked in UI) and confirmation accepted
    setStatusUpdating(true);
    try {
      const res = await api.patch(`/projects/${project._id}/toggle-status`);
      const newStatus = res.data?.status || status;
      setStatus(newStatus);
      setShowCompleteConfirm(false);
      // Optional: clear activeProject in header if completed so PM header updates after refresh
      if(newStatus==='Completed' && role==='pm') {
        // Mark flag so AppHeader refetches
        try { localStorage.setItem('activeProjectInvalidated','1'); window.dispatchEvent(new Event('storage')); } catch {}
      }
    } catch(e){
      let msg='Failed to update project status.';
      if(e?.response?.data?.error==='PRECONDITION_FAILED') msg=e.response.data.message;
      alert(msg);
    } finally { setStatusUpdating(false); }
  };
  useEffect(()=>{ if(!project?._id) return; fetchReports(project._id); },[project?._id]);
  useEffect(()=>{ if(activeTab==='Reports' && project?._id && reports.length===0) fetchReports(project._id); },[activeTab,project?._id]);
  useEffect(()=>{ if(!project?._id) return; const int=setInterval(()=> fetchReports(project._id),120000); return ()=> clearInterval(int); },[project?._id]);
  useEffect(()=>{ if(activeTab!=='Discussions') return; requestAnimationFrame(()=>{ if(listBottomRef.current) listBottomRef.current.scrollIntoView(); else if(listScrollRef.current) listScrollRef.current.scrollTop=listScrollRef.current.scrollHeight; }); },[messages,activeTab]);
  useEffect(()=>{ if(!project?._id) return; let cancelled=false; (async()=>{ try { const all=[]; if(project.documents) all.push(...project.documents); if(messages) messages.forEach(m=>{ if(m.attachments) all.push(...m.attachments); m.replies?.forEach(r=> r.attachments && all.push(...r.attachments)); }); if(all.length){ const signed=await fetchSignedUrlsForImages(all); if(!cancelled) setFileSignedUrls(p=> ({...p,...signed})); } } catch{} })(); return ()=> {cancelled=true;}; },[project?.documents,messages]);
  // Fetch project users once project id is available (used for Discussions + resolving HR/Staff names)
  useEffect(()=>{ if(!project?._id) return; let cancelled=false; (async()=>{ try { const res=await api.get(`/projects/${project._id}/users`); if(!cancelled) setProjectUsers(res.data||[]); } catch { if(!cancelled) setProjectUsers([]);} })(); return ()=> {cancelled=true;}; },[project?._id]);
  useEffect(()=>{ const close=e=>{ if(!e.target.closest('.user-profile')) setProfileMenuOpen(false); }; document.addEventListener('click',close); return ()=> document.removeEventListener('click',close); },[]);
  // Live discussions socket (all roles) - single effect with dedup
  useEffect(()=>{
    if((activeTab !== 'Discussions' && activeTab !== 'Reports') || !project?._id){
      if(socketRef.current){
        try { socketRef.current.emit('leaveProject', joinedProjectRef.current); } catch {}
        try { socketRef.current.disconnect(); } catch {}
        socketRef.current=null; joinedProjectRef.current=null;
      }
      return;
    }
    if(socketRef.current){
      if(joinedProjectRef.current === project._id) return; // already connected to correct project
      try { socketRef.current.emit('leaveProject', joinedProjectRef.current); } catch {}
      joinedProjectRef.current=null;
    }
    const socket=io(SOCKET_ORIGIN,{ path:SOCKET_PATH, transports:['websocket'], auth:{ userId } });
    socketRef.current=socket; joinedProjectRef.current=project._id;
    socket.emit('joinProject', project._id);
    const hNew=data=>{ if(String(data.projectId)===String(project._id)&&data.message){ const mid=String(data.message._id); setMessages(prev=> prev.some(m=> String(m._id)===mid) ? prev : [...prev,data.message].sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp))); } };
    const hReply=data=>{ if(String(data.projectId)===String(project._id)&&data.msgId&&data.reply){ setMessages(prev=> prev.map(m=> { if(String(m._id)!==data.msgId) return m; const has = m.replies.some(r=> String(r._id)===String(data.reply._id)); return has? m : { ...m, replies:[...m.replies,data.reply] }; })); } };
    const hReports=d=>{ if(String(d.projectId)===String(project._id)) fetchReports(project._id); };
    socket.on('project:newDiscussion',hNew); socket.on('project:newReply',hReply); socket.on('project:reportsUpdated',hReports);
    return ()=>{ try{socket.off('project:newDiscussion',hNew);socket.off('project:newReply',hReply);socket.off('project:reportsUpdated',hReports);socket.emit('leaveProject',joinedProjectRef.current);socket.disconnect();}catch{} socketRef.current=null; joinedProjectRef.current=null; };
  },[project?._id,activeTab,userId]);
  const handlePostMessage=async()=>{ if(!perms.postDiscuss) return; if((!newMessage.trim() && composerFiles.length===0) || posting || !project?._id) return; try { setPosting(true); const fd=new FormData(); if(newMessage.trim()) fd.append('text',newMessage.trim()); if(selectedLabel) fd.append('label',selectedLabel); composerFiles.forEach(f=> fd.append('files',f)); const res=await api.post(`/projects/${project._id}/discussions`,fd,{ headers:{Authorization:`Bearer ${token}`}}); const msg=res.data; setMessages(prev=> prev.some(m=> String(m._id)===String(msg._id)) ? prev : [...prev,msg].sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp))); setNewMessage(''); setComposerFiles([]); setSelectedLabel(''); } catch {} finally { setPosting(false);} };
  const handlePostReply=async(msgId)=>{ if(!perms.postDiscuss) return; const txt=(replyInputs[msgId]||'').trim(); if(!txt||posting||!project?._id) return; setPosting(true); try { const fd=new FormData(); fd.append('text',txt); const res=await api.post(`/projects/${project._id}/discussions/${msgId}/reply`,fd,{ headers:{Authorization:`Bearer ${token}`}}); const reply=res.data; setMessages(prev=> prev.map(m=> { if(String(m._id)!==msgId) return m; if(m.replies.some(r=> String(r._id)===String(reply._id))) return m; return { ...m, replies:[...m.replies,reply] }; })); setReplyInputs(p=> ({...p,[msgId]:''})); } catch {} finally { setPosting(false);} };
  const handleKeyDownComposer=e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(!posting && (newMessage.trim()||composerFiles.length)) handlePostMessage(); } };
  const acceptTypes=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.rtf,.csv,image/*";
  const addComposerFiles=f=>{ if(!perms.postDiscuss) return; if(!f?.length) return; setComposerFiles(p=> [...p,...Array.from(f)]); };
  const handleTextareaInput=e=>{ const v=e.target.value; setNewMessage(v); const caret=e.target.selectionStart; const up=v.slice(0,caret); const m=/(^|\s)@(\w*)$/.exec(up); if(m){ const q=m[2].toLowerCase(); const opts=projectUsers.concat([{_id:'_all_',name:'all'},{_id:'_everyone_',name:'everyone'}]).filter(u=> (u.name||'').toLowerCase().includes(q)); setMentionDropdown({open:true,options:opts,query:q,position:{top:0,left:0},activeInputId:e.target.id}); } else setMentionDropdown({open:false,options:[],query:'',position:{top:0,left:0},activeInputId:null}); };
  const handleMentionSelect=u=>{ if(!textareaRef.current) return; const val=newMessage; const caret=textareaRef.current.selectionStart; const up=val.slice(0,caret); const m=/(^|\s)@(\w*)$/.exec(up); if(!m) return; const before=val.slice(0,m.index+m[1].length); const after=val.slice(caret); const mention=`@${u.name} `; const nv=before+mention+after; setNewMessage(nv); setMentionDropdown({open:false,options:[],query:'',position:{top:0,left:0},activeInputId:null}); setTimeout(()=>{ if(textareaRef.current){ textareaRef.current.focus(); textareaRef.current.selectionStart=textareaRef.current.selectionEnd=(before+mention).length; }},0); };
  const handleLogout=()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); navigate(basePath); };
  const handleFileUpload=async(files)=>{ if(!perms.uploadFiles) return; if(!files?.length||!project?._id) return; setUploading(true); setUploadProgress(0); setUploadError(''); try { const fd=new FormData(); files.forEach(f=> fd.append('files',f)); const it=setInterval(()=> setUploadProgress(p=> p>=90? (clearInterval(it),90):p+10),200); const res=await api.post(`/projects/${project._id}/documents`,fd,{ headers:{Authorization:`Bearer ${token}`,'Content-Type':'multipart/form-data'} }); clearInterval(it); setUploadProgress(100); if(res.data?.documents) setProject(pr=> ({...pr,documents:res.data.documents})); setTimeout(()=>{ setUploading(false); setUploadProgress(0); },800); } catch { setUploadError('Upload failed'); setUploading(false); setUploadProgress(0);} };
  const handleDeleteFile=async(doc,i)=>{ if(!perms.deleteFiles) return; if(!project?._id || !window.confirm('Delete this file?')) return; try { const path= typeof doc==='string'? doc : doc.path; await api.delete(`/projects/${project._id}/documents`,{ headers:{Authorization:`Bearer ${token}`}, data:{ path }}); setProject(pr=> ({...pr,documents: pr.documents.filter((_,idx)=> idx!==i)})); } catch { alert('Failed to delete file'); } };
  const canUploadReport = role==='pic' || role==='pm';
  const handleReportUpload = async(file)=>{
    if(!file || !project?._id) return;
    if(!/\.pptx?$/i.test(file.name)) { alert('Please select a .pptx file'); return; }
    try {
      setReportUploading(true); setReportUploadError(''); setReportUploadProgress(0);
      const fd=new FormData(); fd.append('report', file);
      // fake progress (since axios onUploadProgress with FormData & fetch may vary)
      const tick = setInterval(()=> setReportUploadProgress(p=> p>=85?85:p+7),180);
      const { data } = await api.post(`/projects/${project._id}/reports`, fd, { headers:{ Authorization:`Bearer ${token}` } });
      clearInterval(tick); setReportUploadProgress(100);
      // Prepend new report for immediate feedback
      if(data?.report){ setReports(prev=> [data.report, ...prev]); }
      // refresh to ensure AI / pdfPath etc.
      fetchReports(project._id);
      setTimeout(()=> { setReportUploading(false); setReportUploadProgress(0); },600);
    } catch(e){
      setReportUploading(false);
      setReportUploadProgress(0);
      setReportUploadError(e?.response?.data?.message || 'Report upload failed');
    }
  };
  const canDeleteReport = role==='pic' || role==='pm';
  const handleDeleteReport = async(reportId)=>{
    if(!project?._id || !reportId || !canDeleteReport) return;
    if(!window.confirm('Delete this report (PPT + AI outputs)?')) return;
    try {
      const { data } = await api.delete(`/projects/${project._id}/reports/${reportId}`, { headers:{ Authorization:`Bearer ${token}` } });
      if(data?.reports) setReports(data.reports); else setReports(prev=> prev.filter(r=> String(r._id)!==String(reportId)));
    } catch(e){
      alert(e?.response?.data?.message || 'Failed to delete report');
    }
  };
  // Flash banner (must be declared before any early returns to satisfy hooks rules)
  const justCreated = !!(location.state && location.state.justCreated);
  const [showFlash, setShowFlash] = useState(justCreated);
  useEffect(()=>{ if(justCreated){ const t=setTimeout(()=> setShowFlash(false),6000); return ()=> clearTimeout(t);} },[justCreated]);

  // Always include staff-view-root so unified overview card styles apply for every role
  const rootRoleClass = `pm-view-root staff-view-root ${role==='staff'?'is-staff':''} ${role==='ceo'?'ceo-view-root':''}`;
  if(loading) return <div className={`dashboard-container ${rootRoleClass}`}><div className="professional-loading-screen"><div className="loading-content"><div className="loading-logo"><img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="loading-logo-img" /></div><div className="loading-spinner-container"><div className="loading-spinner"/></div><div className="loading-text"><h2 className="loading-title">Loading Project Details</h2><p className="loading-subtitle">Fetching project information...</p></div><div className="loading-progress"><div className="progress-bar"><div className="progress-fill"/></div></div></div></div></div>;
  if(!project) return <div className={`dashboard-container ${rootRoleClass}`}><div className="professional-loading-screen"><div className="loading-content"><div className="loading-logo"><img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="loading-logo-img" /></div><div className="loading-text"><h2 className="loading-title" style={{color:'#ef4444'}}>Project Not Found</h2><p className="loading-subtitle">Project missing or access denied.</p></div><div style={{marginTop:'2rem'}}><button onClick={()=> navigate(basePath)} style={{background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',color:'#fff',border:'none',padding:'12px 24px',borderRadius:8,fontSize:'1rem',fontWeight:600,cursor:'pointer'}}>Return to Dashboard</button></div></div></div></div>;
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const contractor = readContractor(project);
  let locationLabel = 'N/A';
  if(project?.location){
    const loc = project.location;
    if(typeof loc === 'string') locationLabel = loc;
    else if(loc.name) locationLabel = loc.name + (loc.region?` (${loc.region})`: '');
    else if(loc.title) locationLabel = loc.title;
  }
  const manpowerText = Array.isArray(project?.manpower)&&project.manpower.length>0 ? project.manpower.map(mp=> [mp?.name,mp?.position].filter(Boolean).join(' (') + (mp?.position?')':'')).join(', ') : 'No Manpower Assigned';
  const budgetNum = Number(project?.budget||0); const remaining = Math.max(budgetNum - Number(totalPO||0),0);
  // Resolve HR Site / Staff names even if backend didn't populate (ids only)
  const resolveUserNames = (arr)=> {
    if(!Array.isArray(arr) || !arr.length) return [];
    return arr.map(u=>{
      if(u && typeof u === 'object' && u.name) return u.name;
      const id = typeof u === 'string' ? u : (u?._id||'');
      const match = projectUsers.find(pu=> String(pu._id)===String(id));
      return match?.name || null;
    }).filter(Boolean);
  };
  const hrSiteNames = resolveUserNames(project?.hrsite);
  const staffNames = resolveUserNames(project?.staff);
  // Rewritten JSX with proper nesting & explicit wrappers to avoid unclosed tag errors
// Discussion label style map
const labelColorMap = {
  Important: { bg: 'linear-gradient(90deg,#dc2626,#f87171)', fg: '#fff' },
  Announcement: { bg: 'linear-gradient(90deg,#6366f1,#8b5cf6)', fg: '#fff' },
  Update: { bg: 'linear-gradient(90deg,#0d9488,#14b8a6)', fg: '#fff' },
  Reminder: { bg: 'linear-gradient(90deg,#eab308,#f59e0b)', fg: '#3a2f00' },
  Urgent: { bg: 'linear-gradient(90deg,#b91c1c,#ef4444)', fg: '#fff' }
};
function renderLabelBadge(label){ if(!label) return null; const s=labelColorMap[label]||{bg:'#334155',fg:'#fff'}; return <span className="discussion-label-badge" style={{background:s.bg,color:s.fg,padding:'2px 8px',borderRadius:8,fontSize:11,marginLeft:8,fontWeight:600,letterSpacing:.5,display:'inline-flex',alignItems:'center',gap:4}}>{label}</span>; }
  return (
  <div className={`dashboard-container ${rootRoleClass}`}>
  {useUnifiedHeader && !document.body.dataset?.appHeaderMounted && <AppHeader roleSegment={role} />}
  {!useUnifiedHeader && (
  <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile" onClick={() => setProfileMenuOpen(o => !o)}>
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'U'}</div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{roleCfg.label}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            {nav.map(n => (
              <Link key={n.to} to={n.to} className={`nav-item ${n.active ? 'active' : ''}`}>
                {n.icon}
                <span className={isHeaderCollapsed ? 'hidden' : ''}>{n.label}</span>
              </Link>
            ))}
          </nav>
          <NotificationBell />
        </div>
  </header>) }
      <main className="dashboard-main">
        {showFlash && (
          <div role="status" aria-live="polite" className="project-flash-banner" style={{
            background: 'linear-gradient(90deg,#15803d,#16a34a)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '0.95rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 4px 12px -2px rgba(16,185,129,0.35)',
            margin: '0 24px 18px'
          }}>
            <span style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:'1.2rem'}}>✅</span>
              <span>Project <strong>{(location.state && location.state.projectName) || (project && project.projectName)}</strong> created. Team notified.</span>
            </span>
            <button onClick={()=> setShowFlash(false)} style={{
              background:'rgba(255,255,255,0.15)',
              border:'none',
              color:'#fff',
              padding:'4px 10px',
              borderRadius:6,
              cursor:'pointer',
              fontSize:'0.75rem',
              letterSpacing:'.5px'
            }}>DISMISS</button>
          </div>
        )}
        <div className="project-view-container">
          {/* Project Header */}
          <div className="project-header">
            <div className="project-image-section">
              <img
                src={(project.photos && project.photos[0]) || 'https://placehold.co/1200x400?text=Project+Image'}
                alt={project.projectName}
                className="project-hero-image"
              />
              {perms.image && (
                <div className="image-upload-overlay">
                  <input
                    type="file"
                    id="project-image-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const f = e.target.files[0];
                      if (!f) return;
                      if (!f.type.startsWith('image/')) {
                        alert('Select an image');
                        return;
                      }
                      if (f.size > 5 * 1024 * 1024) {
                        alert('Image must be <5MB');
                        return;
                      }
                      try {
                        setImageUploading(true);
                        setImageUploadProgress(0);
                        setImageUploadError('');
                        const fd = new FormData();
                        fd.append('photo', f);
                        const res = await api.post(`/projects/${project._id}/photo`, fd, {
                          onUploadProgress: pe =>
                            setImageUploadProgress(Math.round((pe.loaded * 100) / pe.total))
                        });
                        setProject(p => ({ ...p, photos: [res.data.photoUrl, ...(p.photos || []).slice(1)] }));
                      } catch {
                        setImageUploadError('Upload failed');
                      } finally {
                        setImageUploading(false);
                        setImageUploadProgress(0);
                        e.target.value = '';
                      }
                    }}
                  />
                  <label htmlFor="project-image-upload" className="change-image-btn">
                    <FaCamera />
                    <span>Change Image</span>
                  </label>
                  {imageUploading && (
                    <div className="image-upload-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${imageUploadProgress}%` }} />
                      </div>
                      <p className="progress-text">Uploading... {imageUploadProgress}%</p>
                    </div>
                  )}
                  {imageUploadError && (
                    <div className="image-upload-error">
                      <p>{imageUploadError}</p>
                    </div>
                  )}
                </div>
              )}
              {perms.statusToggle && (
                <>
                  <button
                    onClick={()=> status==='Completed'? handleToggleStatus() : setShowCompleteConfirm(true)}
                    disabled={statusUpdating || (status!=='Completed' && !completionPreconditionsMet)}
                    className={`status-toggle-btn ${status === 'Completed' ? 'completed' : 'ongoing'}`}
                  >
                    {statusUpdating ? 'Updating...' : status === 'Completed' ? 'Mark as Ongoing' : 'Complete Project'}
                  </button>
                  {showCompleteConfirm && status!=='Completed' && (
                    <div className="modal-overlay">
                      <div className="modal small">
                        <h3>Confirm Completion</h3>
                        {!completionPreconditionsMet && <p style={{color:'#b91c1c',fontWeight:600}}>Preconditions not met. At least one file and one report are required to complete this project.</p>}
                        <p>Mark this project as Completed? All members (PM, PIC, Staff, HR-Site) will become available for new assignments.</p>
                        <div className="modal-actions" style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                          <button className="btn" onClick={()=> setShowCompleteConfirm(false)}>Cancel</button>
                          <button className="btn primary" disabled={statusUpdating || !completionPreconditionsMet} onClick={()=> handleToggleStatus(true)}>Yes, Complete</button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="project-title-section">
              <h1 className="project-title">{project.projectName}</h1>
              <div className="project-status-badge">
                <span className={`status-indicator ${status === 'Completed' ? 'completed' : 'ongoing'}`}>
                  {status === 'Completed' ? <FaCheckCircle /> : <FaClock />}
                </span>
                <span className="status-text">{status || project?.status || 'N/A'}</span>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="project-tabs">
            <button className={`project-tab ${activeTab === 'Details' ? 'active' : ''}`} onClick={() => setActiveTab('Details')}>
              <FaRegListAlt />
              <span>Project Details</span>
            </button>
            <button className={`project-tab ${activeTab === 'Discussions' ? 'active' : ''}`} onClick={() => setActiveTab('Discussions')}>
              <FaRegCommentDots />
              <span>Discussions</span>
            </button>
            <button className={`project-tab ${activeTab === 'Files' ? 'active' : ''}`} onClick={() => setActiveTab('Files')}>
              <FaRegFileAlt />
              <span>Files</span>
            </button>
            <button className={`project-tab ${activeTab === 'Reports' ? 'active' : ''}`} onClick={() => setActiveTab('Reports')}>
              <FaRegFileAlt />
              <span>Reports</span>
            </button>
            <button className={`project-tab ${activeTab === 'Attendance' ? 'active' : ''}`} onClick={() => setActiveTab('Attendance')}>
              <FaRegFileAlt />
              <span>Attendance</span>
            </button>
          </div>
          <div className="tab-content">
            {/* DETAILS TAB */}
            {activeTab === 'Details' && (
              <div className="project-details-content">
                <div className="action-buttons">
                  <button
                    onClick={() => {
                      const user = JSON.parse(localStorage.getItem('user') || '{}');
                      const exportDateTime = new Date().toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      });
                      exportProjectDetails(project, { 
                        contextTitle: `Project Details — ${roleCfg.label}`,
                        exportedBy: user?.name || 'Unknown User',
                        exportDate: exportDateTime
                      });
                    }}
                    className="export-btn"
                  >
                    <FaDownload />
                    <span>Export Project Details</span>
                  </button>
                </div>
                <div className="overview-grid">
                  <div className="overview-card budget-card">
                    <div className="card-icon"><FaMoneyBillWave /></div>
                    <h3 className="card-title">Budget</h3>
                    <div className="budget-amount">{peso.format(budgetNum || 0)}</div>
                    {totalPO>0 && (
                      <div className="remaining-budget" style={{marginTop:6,fontSize:12}}>
                        Remaining: {peso.format(remaining)} (POs: {peso.format(totalPO)})
                      </div>
                    )}
                  </div>
                  <div className="overview-card timeline-card">
                    <div className="card-icon"><FaCalendarAlt /></div>
                    <h3 className="card-title">Timeline</h3>
                    <div className="timeline-dates">
                      <div className="date-item"><span className="date-label">Start:</span><span className="date-value">{start}</span></div>
                      <div className="date-item"><span className="date-label">End:</span><span className="date-value">{end}</span></div>
                    </div>
                  </div>
                  <div className="overview-card location-card">
                    <div className="card-icon"><FaMapMarkerAlt /></div>
                    <h3 className="card-title">Location</h3>
                    <div className="location-value">{locationLabel}</div>
                  </div>
                  <div className="overview-card contractor-card">
                    <div className="card-icon"><FaBuilding /></div>
                    <h3 className="card-title">Contractor</h3>
                    <div className="contractor-value">{contractor}</div>
                  </div>
                </div>
                {/* Progress Section */}
                <div className="progress-section">
                  <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    Project Progress{' '}
                    {progress >= 100 && (
                      <span
                        style={{
                          background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                          color: '#fff',
                          padding: '4px 10px',
                          fontSize: 12,
                          borderRadius: 20
                        }}
                      >
                        COMPLETED
                      </span>
                    )}
                  </h2>
                  <div
                    className="progress-grid"
                    style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}
                  >
                    <div
                      className="progress-card overall-progress"
                      style={{ background: '#0f172a', color: '#f1f5f9', borderRadius: 18, padding: 20, position: 'relative' }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'radial-gradient(circle at 30% 20%, rgba(59,130,246,.25), transparent 70%)'
                        }}
                      />
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Overall Progress</h3>
                          <FaChartBar style={{ opacity: 0.7 }} />
                        </div>
                        <div
                          style={{
                            fontSize: 38,
                            fontWeight: 700,
                            background: 'linear-gradient(90deg,#3b82f6,#06b6d4)',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent'
                          }}
                        >
                          {Math.round(progress)}%
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div
                            style={{ height: 14, background: '#1e293b', borderRadius: 10, position: 'relative' }}
                            aria-label={`Overall progress ${Math.round(progress)}%`}
                            role="progressbar"
                            aria-valuenow={Math.round(progress)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)',
                                width: `${progress}%`,
                                borderRadius: 10,
                                transition: 'width .5s ease'
                              }}
                            />
                          </div>
                          <small style={{ opacity: 0.8 }}>Average across all PiCs</small>
                        </div>
                        {picContributions && (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 12, letterSpacing: 0.5, opacity: 0.85 }}>Reporting Coverage</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {Array.from({ length: picContributions.totalPics }).map((_, i) => (
                                <div
                                  key={i}
                                  style={{
                                    flex: 1,
                                    height: 6,
                                    background:
                                      i < picContributions.reportingPics
                                        ? 'linear-gradient(90deg,#10b981,#4ade80)'
                                        : '#334155',
                                    borderRadius: 4
                                  }}
                                />
                              ))}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              {picContributions.reportingPics}/{picContributions.totalPics} submitted
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {(picContributions || (project?.pic && project.pic.length > 0)) && (
                      <div
                        className="progress-card pic-contributions"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>PiC Contributions</h3>
                          <FaUsers style={{ color: '#475569' }} />
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#0f172a' }}>
                          {picContributions ? picContributions.averageContribution : 0}%
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {picContributions ? (
                            <div
                              style={{ fontSize: 13, color: '#475569', display: 'flex', justifyContent: 'space-between' }}
                            >
                              <span>Reporting</span>
                              <span style={{ fontWeight: 600 }}>
                                {picContributions.reportingPics}/{picContributions.totalPics}
                              </span>
                            </div>
                          ) : (
                            <div
                              style={{ fontSize: 12, background: '#f1f5f9', padding: '8px 10px', borderRadius: 8, color: '#475569' }}
                            >
                              No contribution data yet.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {picContributions && picContributions.picContributions.length > 0 && (
                    <div className="individual-contributions" style={{ marginTop: 24 }}>
                      <h3 className="subsection-title" style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>
                        Individual PiC Contributions
                      </h3>
                      <div
                        className="pic-list"
                        style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}
                      >
                        {picContributions.picContributions.map((pic, i) => (
                          <div
                            key={i}
                            className={`pic-item ${!pic.hasReport ? 'no-report' : ''}`}
                            style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}
                          >
                            <div style={{ fontWeight: 600 }}>{pic.picName}</div>
                            {pic.lastReportDate && (
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                Last: {new Date(pic.lastReportDate).toLocaleDateString()}
                              </span>
                            )}
                            <div style={{ marginTop: 8 }}>
                              {pic.hasReport ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    background: 'linear-gradient(90deg,#3b82f6,#6366f1)',
                                    color: '#fff',
                                    fontSize: 13,
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    fontWeight: 600
                                  }}
                                >
                                  {pic.contribution}%
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    fontSize: 12,
                                    padding: '4px 10px',
                                    borderRadius: 8
                                  }}
                                >
                                  No report
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Team */}
                <div className="team-section">
                  <h2 className="section-title">Project Team</h2>
                  <div className="team-grid">
                    <div className="team-member">
                      <div className="member-avatar">
                        <FaUserTie />
                      </div>
                      <div className="member-info">
                        <h4 className="member-role">Project Manager</h4>
                        <p className="member-name">{project?.projectmanager?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="team-member">
                      <div className="member-avatar">
                        <FaUsers />
                      </div>
                      <div className="member-info">
                        <h4 className="member-role">Person in Charge</h4>
                        <p className="member-name">
                          {Array.isArray(project?.pic) && project.pic.length
                            ? project.pic.map(p => p?.name).filter(Boolean).join(', ')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="team-member">
                      <div className="member-avatar">
                        <FaUsers />
                      </div>
                      <div className="member-info">
                        <h4 className="member-role">HR Site</h4>
                        <p className="member-name">
                          {hrSiteNames.length
                            ? hrSiteNames.join(', ')
                            : (Array.isArray(project?.hrsite) && project.hrsite.length
                                ? `${project.hrsite.length} assigned`
                                : (role==='hrsite' ? (userName || 'You') : 'N/A'))}
                        </p>
                      </div>
                    </div>
                    <div className="team-member">
                      <div className="member-avatar">
                        <FaUsers />
                      </div>
                      <div className="member-info">
                        <h4 className="member-role">Staff</h4>
                        <p className="member-name">
                          {staffNames.length
                            ? staffNames.join(', ')
                            : (Array.isArray(project?.staff) && project.staff.length
                                ? `${project.staff.length} assigned`
                                : (role==='staff' ? (userName || 'You') : 'N/A'))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Manpower */}
                <div className="manpower-section">
                  <h2 className="section-title">Assigned Manpower</h2>
                  <div className="manpower-content">
                    <p className="manpower-text">{manpowerText}</p>
                  </div>
                </div>
                {/* Purchase Orders */}
                {purchaseOrders.length > 0 && (
                  <div className="purchase-orders-section">
                    <h2 className="section-title">Purchase Orders</h2>
                    <div className="po-list">
                      {purchaseOrders.map(po => (
                        <div key={po._id} className="po-item">
                          <span className="po-number">PO#: {po.purchaseOrder}</span>
                          <span className="po-amount">{peso.format(Number(po.totalValue))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* DISCUSSIONS TAB */}
            {activeTab === 'Discussions' && (
              <div className="discussions-container" style={{minHeight:'120vh',maxHeight:'calc(200vh - 300px)',display:'flex',flexDirection:'column'}}>
                <div className="messages-list" ref={listScrollRef} style={{flex:'1 1 auto',overflowY:'auto',paddingBottom:16}}>
                  {loadingMsgs ? (
                    <div className="loading-messages">
                      <div className="loading-spinner" />
                      <span>Loading discussions...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="empty-discussions">
                      <FaRegCommentDots />
                      <h3>No discussions yet</h3>
                      <p>Start a conversation about this project.</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const mentioned = isMentioned(msg.text, userName);
          return ( 
                        <div key={msg._id} className="message-item" style={{ ...(mentioned ? mentionRowStyles.container : {}) }}>
                          {mentioned && <div style={mentionRowStyles.badge}>MENTIONED</div>}
                          <div className="message-header">
                            <div className="message-avatar">{msg.userName?.charAt(0)?.toUpperCase() || '?'}</div>
                            <div className="message-info">
                              <span className="message-author">{msg.userName || 'Unknown'}</span>
                              <span className="message-time">
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                              </span>
                            </div>
            {renderLabelBadge(msg.label)}
                          </div>
                          <div className="message-content">
                            {msg.text && (
                              <p className="message-text">{renderMessageText(msg.text, userName)}</p>
                            )}
                            {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                              <div className="message-attachments">
                                {msg.attachments.map((att, i) => {
                                  const name = att.name || extractOriginalNameFromPath(att.path);
                                  const t = getFileType(name);
                                  return (
                                    <div key={i} className="attachment-item">
                                      <div className="attachment-thumbnail">
                                        {generateFileThumbnail(name, att.path, t, fileSignedUrls[att.path])}
                                      </div>
                                      <div className="attachment-info">
                                        <a
                                          href="#"
                                          onClick={e => {
                                            e.preventDefault();
                                            openSignedPath(att.path);
                                          }}
                                          className="attachment-name"
                                          title={name}
                                        >
                                          {name}
                                        </a>
                                        <span className="attachment-type">{t}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {Array.isArray(msg.replies) && msg.replies.length > 0 && (
                            <div className="replies-container">
                              {(() => { const total = msg.replies.length; const collapsed = collapsedReplies[msg._id]; const list = (collapsed && total >=3) ? msg.replies.slice(0,2) : msg.replies; return list.map(r => {
                                const rm = isMentioned(r.text, userName);
                                return (
                                  <div key={r._id} className="reply-item" style={rm ? mentionRowStyles.container : {}}>
                                    {rm && <div style={mentionRowStyles.badge}>MENTIONED</div>}
                                    <div className="reply-header">
                                      <div className="reply-avatar">{r.userName?.charAt(0)?.toUpperCase() || '?'}</div>
                                      <div className="reply-info">
                                        <span className="reply-author">{r.userName || 'Unknown'}</span>
                                        <span className="reply-time">
                                          {r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="reply-content">
                                      {r.text && (
                                        <p className="reply-text">{renderMessageText(r.text, userName)}</p>
                                      )}
                                      {Array.isArray(r.attachments) && r.attachments.length > 0 && (
                                        <div className="reply-attachments">
                                          {r.attachments.map((att, i) => {
                                            const name = att.name || extractOriginalNameFromPath(att.path);
                                            const t = getFileType(name);
                                            return (
                                              <div key={i} className="attachment-item">
                                                <div className="attachment-thumbnail">
                                                  {generateFileThumbnail(name, att.path, t, fileSignedUrls[att.path])}
                                                </div>
                                                <div className="attachment-info">
                                                  <a
                                                    href="#"
                                                    onClick={e => {
                                                      e.preventDefault();
                                                      openSignedPath(att.path);
                                                    }}
                                                    className="attachment-name"
                                                    title={name}
                                                  >
                                                    {name}
                                                  </a>
                                                  <span className="attachment-type">{t}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }); })()}
                              {msg.replies.length >=3 && (
                                <button
                                  onClick={()=> setCollapsedReplies(p=> ({...p, [msg._id]: !p[msg._id]}))}
                                  className="replies-toggle-btn"
                                  style={{marginTop:8,background:'transparent',border:'none',color:'#2563eb',cursor:'pointer',fontSize:13,fontWeight:600,padding:0}}
                                >
                                  {collapsedReplies[msg._id] ? `Show all ${msg.replies.length} replies` : 'Hide replies'}
                                </button>
                              )}
                            </div>
                          )}
                          {/* Reply Composer */}
                          {perms.postDiscuss && (
                            <div className="reply-composer" style={{marginTop:12,padding:12,borderTop:'1px solid #e2e8f0',display:'flex',gap:8,alignItems:'flex-start'}}>
                              <textarea
                                value={replyInputs[msg._id] || ''}
                                onChange={e => setReplyInputs(p => ({ ...p, [msg._id]: e.target.value }))}
                                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handlePostReply(msg._id); } }}
                                placeholder="Write a reply..."
                                style={{flex:1,minHeight:60,resize:'vertical',fontFamily:'inherit',fontSize:14,padding:8,border:'1px solid #cbd5e1',borderRadius:8}}
                              />
                              <button
                                onClick={() => handlePostReply(msg._id)}
                                disabled={posting || !(replyInputs[msg._id]||'').trim()}
                                style={{background:'linear-gradient(90deg,#3b82f6,#6366f1)',color:'#fff',border:'none',padding:'10px 16px',borderRadius:8,fontSize:14,fontWeight:600,cursor: posting || !(replyInputs[msg._id]||'').trim()? 'not-allowed':'pointer',opacity: posting || !(replyInputs[msg._id]||'').trim()? .6:1,alignSelf:'stretch'}}
                              >
                                {posting ? 'Posting...' : 'Reply'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <div ref={listBottomRef} />
                {perms.postDiscuss && (
                  <div className="message-composer">
                    <div
                      className={`composer-area ${isDragOver ? 'drag-over' : ''}`}
                      onDragOver={e => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={e => {
                        e.preventDefault();
                        setIsDragOver(false);
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer?.files?.length) addComposerFiles(e.dataTransfer.files);
                      }}
                    >
                      <div className="label-selector">
                        <select
                          value={selectedLabel}
                          onChange={e => setSelectedLabel(e.target.value)}
                          className="label-dropdown"
                        >
                          <option value="">No Label</option>
                          <option value="Important">Important</option>
                          <option value="Announcement">Announcement</option>
                          <option value="Update">Update</option>
                          <option value="Reminder">Reminder</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                      <textarea
                        ref={textareaRef}
                        id="main-composer-textarea"
                        value={newMessage}
                        onChange={handleTextareaInput}
                        onKeyDown={handleKeyDownComposer}
                        placeholder="Type your message here..."
                        className="composer-textarea"
                      />
                      {mentionDropdown.open && mentionDropdown.activeInputId === textareaRef.current?.id && (
                        <div className="mention-dropdown">
                          {mentionDropdown.options.map(u => (
                            <div key={u._id} className="mention-option" onClick={() => handleMentionSelect(u)}>
                              {u.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="composer-actions">
                      <div className="composer-left">
                        <label htmlFor="composer-attachments" className="attachment-button">
                          <FaRegFileAlt />
                          <span>Attach Files</span>
                        </label>
                        <input
                          id="composer-attachments"
                          type="file"
                          multiple
                          accept={acceptTypes}
                          style={{ display: 'none' }}
                          onChange={e => {
                            addComposerFiles(e.target.files);
                            e.target.value = '';
                          }}
                        />
                        {composerFiles.map((f, i) => (
                          <div key={i} className="file-preview">
                            <span>📎 {f.name}</span>
                            <button
                              onClick={() => setComposerFiles(p => p.filter((_, idx) => idx !== i))}
                              className="remove-file-btn"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="composer-right">
                        <button
                          onClick={handlePostMessage}
                          disabled={posting || (!newMessage.trim() && composerFiles.length === 0)}
                          className="send-button"
                        >
                          {posting ? 'Sending...' : 'Send Message'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* FILES TAB */}
            {activeTab === 'Files' && (
              <div className="files-container">
                <div className="files-header">
                  <div className="files-title-section">
                    <h2 className="files-title">Project Files</h2>
                    <p className="files-subtitle">
                      {project?.documents && project.documents.length
                        ? `Showing ${Math.min(
                            project.documents.filter(d => {
                              if (!fileSearchTerm) return true;
                              const n =
                                typeof d === 'string'
                                  ? extractOriginalNameFromPath(d)
                                  : d.name || extractOriginalNameFromPath(d.path);
                              return n.toLowerCase().includes(fileSearchTerm.toLowerCase());
                            }).length,
                            5
                          )} of ${project.documents.length} files`
                        : 'Manage and organize project documents'}
                    </p>
                  </div>
                  <div className="files-actions">
                    <div className="search-container">
                      <input
                        type="text"
                        placeholder="Search files..."
                        value={fileSearchTerm}
                        onChange={e => setFileSearchTerm(e.target.value)}
                        className="file-search-input"
                      />
                    </div>
                    {perms.uploadFiles && (
                      <>
                        <label htmlFor="file-upload" className="upload-btn">
                          <FaRegFileAlt />
                          <span>Upload Files</span>
                        </label>
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,image/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            if (e.target.files?.length) handleFileUpload(Array.from(e.target.files));
                            e.target.value = '';
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
                {uploading && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="progress-text">Uploading... {uploadProgress}%</span>
                  </div>
                )}
                <div className="files-table-container">
                  {project?.documents && project.documents.length ? (
                    <table className="files-table">
                      <thead className="table-header">
                        <tr>
                          <th className="header-cell file-name">File Name</th>
                          <th className="header-cell file-type">Type</th>
                          <th className="header-cell file-size">Size</th>
                          <th className="header-cell file-uploader">Uploaded By</th>
                          <th className="header-cell file-date">Date</th>
                          <th className="header-cell file-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {project.documents
                          .filter(d => {
                            if (!fileSearchTerm) return true;
                            const n =
                              typeof d === 'string'
                                ? extractOriginalNameFromPath(d)
                                : d.name || extractOriginalNameFromPath(d.path);
                            return n.toLowerCase().includes(fileSearchTerm.toLowerCase());
                          })
                          .slice(0, 5)
                          .map((doc, i) => {
                            const fileName =
                              typeof doc === 'string'
                                ? extractOriginalNameFromPath(doc)
                                : doc.name || extractOriginalNameFromPath(doc.path);
                            const filePath = typeof doc === 'string' ? doc : doc.path;
                            const type = getFileType(fileName);
                            const size = getFileSize(fileName);
                            const by = typeof doc === 'string' ? 'Unknown' : doc.uploadedByName || 'Unknown';
                            const at = typeof doc === 'string' ? null : doc.uploadedAt;
                            return (
                              <tr key={i} className="table-row">
                                <td className="table-cell file-name">
                                  <div className="file-info">
                                    <div className="file-thumbnail-container">
                                      {generateFileThumbnail(fileName, filePath, type, fileSignedUrls[filePath])}
                                    </div>
                                    <span className="file-name-text" title={fileName}>
                                      {fileName}
                                    </span>
                                  </div>
                                </td>
                                <td className="table-cell file-type">
                                  <span className="file-type-badge">{type}</span>
                                </td>
                                <td className="table-cell file-size">{size}</td>
                                <td className="table-cell file-uploader">{by}</td>
                                <td className="table-cell file-date">
                                  {at ? new Date(at).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="table-cell file-actions">
                                  <div className="action-buttons">
                                    <button
                                      onClick={() => openSignedPath(filePath)}
                                      className="action-btn download-btn"
                                      title="Download"
                                    >
                                      <FaDownload />
                                    </button>
                                    {perms.deleteFiles && (
                                      <button
                                        onClick={() => handleDeleteFile(doc, i)}
                                        className="action-btn delete-btn"
                                        title="Delete"
                                      >
                                        <FaTrash />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-files">
                      <FaRegFileAlt />
                      <h3>No files uploaded yet</h3>
                      <p>Upload project documents to get started</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* REPORTS TAB */}
            {activeTab === 'Reports' && (
              <div className="project-reports" style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h3 style={{ marginBottom: 18 }}>Project Reports</h3>
                  {canUploadReport && (
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <label htmlFor="pptx-report-uploader" style={{ cursor: reportUploading? 'not-allowed':'pointer', padding:'8px 14px', borderRadius:8, background: reportUploading? '#e2e8f0':'#ffffff', border:'1px solid #cbd5e1', fontWeight:600, fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }}>
                        {reportUploading ? 'Uploading…' : 'Upload Report (.pptx)'}
                      </label>
                      <input id="pptx-report-uploader" type="file" accept=".ppt,.pptx" style={{ display:'none' }} disabled={reportUploading} onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; if(f) handleReportUpload(f); }} />
                      {reportUploading && (
                        <div style={{ minWidth:140 }}>
                          <div style={{ height:6, background:'#e2e8f0', borderRadius:4, overflow:'hidden', marginBottom:4 }}>
                            <div style={{ width: reportUploadProgress+'%', height:'100%', background:'linear-gradient(90deg,#3b82f6,#6366f1)', transition:'width .25s' }} />
                          </div>
                          <span style={{ fontSize:11, color:'#475569' }}>{reportUploadProgress}%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {reportUploadError && <div style={{ color:'#b91c1c', fontSize:12, marginBottom:10 }}>{reportUploadError}</div>}
                {reports.length === 0 ? (
                  <div style={{ color: '#888', fontSize: 16 }}>No reports yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="files-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                            Name
                          </th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                            Uploaded By
                          </th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                            Uploaded At
                          </th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                            Status
                          </th>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              borderBottom: '1px solid #eee',
                              background: '#fafafa',
                              width: 280
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map(r => {
                          const uploadedAt = r?.uploadedAt ? new Date(r.uploadedAt).toLocaleString() : '—';
                          return (
                            <tr key={r._id}>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  <FaRegFileAlt style={{ marginRight: 6 }} />
                                  {r?.name || 'Report.pptx'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>
                                {r?.uploadedByName || 'Unknown'}
                              </td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>{uploadedAt}</td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  borderTop: '1px solid #f1f1f1',
                                  textTransform: 'capitalize'
                                }}
                              >
                                {r?.status || 'pending'}
                              </td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>
                                {r?.path ? (
                                  <button
                                    onClick={() => openReportSignedPath(project._id, r.path)}
                                    style={{
                                      marginRight: 10,
                                      border: '1px solid #cbd5e1',
                                      background: '#000000ff',
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      fontWeight: 600
                                    }}
                                  >
                                    View PPT
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', marginRight: 10, fontSize: 12 }}>No PPT</span>
                                )}
                                {r?.pdfPath ? (
                                  <button
                                    onClick={() => openReportSignedPath(project._id, r.pdfPath)}
                                    style={{
                                      marginRight: 10,
                                      border: '1px solid #cbd5e1',
                                      background: 'linear-gradient(90deg,#3b82f6,#6366f1)',
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: '#fff'
                                    }}
                                  >
                                    Download AI PDF
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', marginRight: 10, fontSize: 12 }}>No PDF</span>
                                )}
                                {canDeleteReport && (
                                  <button
                                    onClick={() => handleDeleteReport(r._id)}
                                    style={{
                                      border: '1px solid #dc2626',
                                      background: '#fee2e2',
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: '#b91c1c'
                                    }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {reports[0]?.ai && (
                      <div style={{ marginTop: 16, padding: 16, border: '1px solid #eee', borderRadius: 10 }}>
                        <h4 style={{ marginTop: 0 }}>Latest AI Summary</h4>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
                            gap: 16
                          }}
                        >
                          <div>
                            <b>Summary of Work Done</b>
                            <ul style={{ marginTop: 6 }}>
                              {(reports[0].ai.summary_of_work_done || []).map((x, i) => (
                                <li key={i}>{x}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <b>Completed Tasks</b>
                            <ul style={{ marginTop: 6 }}>
                              {(reports[0].ai.completed_tasks || []).map((x, i) => (
                                <li key={i}>{x}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <b>Critical Path (3)</b>
                            <div style={{ marginTop: 6 }}>
                              {(reports[0].ai.critical_path_analysis || [])
                                .slice(0, 3)
                                .map((c, i) => (
                                  <div key={i} style={{ marginBottom: 8 }}>
                                    <b>{`${i + 1}. ${c?.path_type || 'Path ' + (i + 1)}`}</b>
                                    <ul style={{ marginTop: 4, marginBottom: 4 }}>
                                      {c?.risk && (
                                        <li>
                                          <b>Risk:</b> {c.risk}
                                        </li>
                                      )}
                                      {c?.blockers?.length > 0 && (
                                        <li>
                                          <b>Blockers:</b> {c.blockers.join('; ')}
                                        </li>
                                      )}
                                      {c?.next?.length > 0 && (
                                        <li>
                                          <b>Next:</b> {c.next.join('; ')}
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                ))}
                            </div>
                          </div>
                          {/* Task Priorities */}
                          <div>
                            <b>Task Priorities</b>
                            <div style={{ marginTop: 6 }}>
                              {Array.isArray(reports[0].ai.task_priorities) && reports[0].ai.task_priorities.length > 0 ? (
                                <ol style={{ margin: 0, paddingLeft: 18 }}>
                                  {reports[0].ai.task_priorities.slice(0,5).map((t, i) => {
                                    const pr = (t.priority || '').toString();
                                    const color = /high/i.test(pr)
                                      ? '#dc2626'
                                      : /medium|med/i.test(pr)
                                      ? '#ea580c'
                                      : /low/i.test(pr)
                                      ? '#0d9488'
                                      : '#334155';
                                    return (
                                      <li key={i} style={{ marginBottom: 8 }}>
                                        <div
                                          style={{
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            flexWrap: 'wrap'
                                          }}
                                        >
                                          <span
                                            style={{
                                              background: color,
                                              color: '#fff',
                                              fontSize: 11,
                                              padding: '2px 6px',
                                              borderRadius: 12
                                            }}
                                          >
                                            {pr || 'Priority'}
                                          </span>
                                          <span>{t.task || t.title || 'Untitled Task'}</span>
                                        </div>
                                        {(t.impact || t.justification) && (
                                          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                                            {t.impact && (
                                              <li>
                                                <b>Impact:</b> {t.impact}
                                              </li>
                                            )}
                                            {t.justification && (
                                              <li>
                                                <b>Reason:</b> {t.justification}
                                              </li>
                                            )}
                                          </ul>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ol>
                              ) : (
                                <p style={{ margin: 0, color: '#64748b' }}>No prioritized tasks.</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <b>PiC Performance</b>
                            <p style={{ marginTop: 6 }}>
                              {reports[0].ai.pic_performance_evaluation?.text || 'Performance summary unavailable.'}
                            </p>
                            {typeof reports[0].ai.pic_performance_evaluation?.score === 'number' && (
                              <p>Score: {reports[0].ai.pic_performance_evaluation.score}/100</p>
                            )}
                            <p>
                              PiC Contribution: {Math.round(Number(reports[0].ai.pic_contribution_percent) || 0)}%
                            </p>
                            {typeof reports[0].ai.confidence === 'number' && (
                              <p>Model Confidence: {(reports[0].ai.confidence * 100).toFixed(0)}%</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'Attendance' && (
              <div className="attendance-tab" style={{textAlign:'left'}}>
                <h3 style={{margin:'0 0 16px'}}>Attendance Reports</h3>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
                  <label style={{background:'#0f172a',color:'#fff',padding:'8px 14px',borderRadius:8,fontSize:14,cursor: attUploading? 'not-allowed':'pointer',opacity: attUploading? .6:1}}>
                    {attUploading? 'Uploading...' : 'Upload Schedule (.xlsx)'}
                    <input type="file" accept=".xls,.xlsx" style={{display:'none'}} disabled={attUploading} onChange={async e=>{ const f=e.target.files?.[0]; if(!f||!project?._id) return; setAttError(''); setAttUploading(true); try { const fd=new FormData(); fd.append('schedule',f); await api.post(`/projects/${project._id}/attendance/upload`,fd,{ headers:{Authorization:`Bearer ${token}`}}); // refresh list
                      const list=await api.get(`/projects/${project._id}/attendance`,{ headers:{Authorization:`Bearer ${token}`}}); setAttendanceReports(list.data?.reports||[]); } catch(err){ setAttError('Upload failed'); } finally { setAttUploading(false); e.target.value=''; } }} />
                  </label>
                  <button onClick={async()=>{ if(!project?._id) return; try { const list=await api.get(`/projects/${project._id}/attendance`,{ headers:{Authorization:`Bearer ${token}`}}); setAttendanceReports(list.data?.reports||[]); } catch { setAttError('Refresh failed'); } }} style={{background:'#334155',color:'#fff',border:'none',padding:'8px 14px',borderRadius:8,cursor:'pointer'}}>Refresh</button>
                  {attError && <span style={{color:'#b91c1c',fontWeight:600}}>{attError}</span>}
                </div>
                {attendanceReports.length===0 ? (
                  <div style={{color:'#666'}}>No attendance reports yet.</div>
                ) : (
                  <table className="files-table" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign:'left',padding:'8px'}}>Original File</th>
                        <th style={{textAlign:'left',padding:'8px'}}>Uploaded By</th>
                        <th style={{textAlign:'left',padding:'8px'}}>Generated At</th>
                        <th style={{textAlign:'left',padding:'8px'}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceReports.slice().reverse().map((r,i)=>(
                        <tr key={i} style={{borderTop:'1px solid #eee'}}>
                          <td style={{padding:'8px'}}>{r.originalName}</td>
                          <td style={{padding:'8px'}}>{r.uploadedByName || r.uploaderName || '—'}</td>
                          <td style={{padding:'8px'}}>{r.generatedAt? new Date(r.generatedAt).toLocaleString(): 'N/A'}</td>
                          <td style={{padding:'8px',display:'flex',gap:8}}>
                            <button onClick={async()=>{ try { const {data}=await api.get(`/projects/${project._id}/attendance-signed-url`,{ params:{ path:r.inputPath}, headers:{Authorization:`Bearer ${token}`}}); if(data?.signedUrl) window.open(data.signedUrl,'_blank'); } catch {} }} className="btn small">View Excel</button>
                            <button onClick={async()=>{ try { const {data}=await api.get(`/projects/${project._id}/attendance-signed-url`,{ params:{ path:r.outputPath}, headers:{Authorization:`Bearer ${token}`}}); if(data?.signedUrl) window.open(data.signedUrl,'_blank'); } catch {} }} className="btn small primary">Download AI Attendace Report</button>
                            <button onClick={async()=>{ if(!window.confirm('Delete this attendance report?')) return; try { const {data}=await api.delete(`/projects/${project._id}/attendance/${r._id}`,{ headers:{Authorization:`Bearer ${token}`}}); setAttendanceReports(data?.reports||[]); } catch { alert('Delete failed'); } }} className="btn small danger" style={{background:'#fee2e2',color:'#b91c1c'}}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {attendanceAI && (
                  <div style={{marginTop:24,background:'#f8fafc',padding:16,border:'1px solid #e2e8f0',borderRadius:12}}>
                    <h4 style={{marginTop:0}}>AI Attendance Summary</h4>
                    {attendanceAI.insights && attendanceAI.insights.length>0 && (
                      <ul style={{marginTop:8}}>
                        {attendanceAI.insights.map((i,idx)=> <li key={idx}>{i}</li>)}
                      </ul>
                    )}
                    {attendanceAI.top_absent && attendanceAI.top_absent.length>0 && (
                      <div style={{marginTop:12}}>
                        <b>Most Absent:</b>
                        <ol style={{marginTop:6}}>
                          {attendanceAI.top_absent.map((t,idx)=> <li key={idx}>{t.name}: {t.absent}</li>)}
                        </ol>
                      </div>
                    )}
                    {attendanceAI.average_attendance && (
                      <p style={{marginTop:12}}><b>Average Attendance:</b> {attendanceAI.average_attendance}%</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
