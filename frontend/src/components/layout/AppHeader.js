import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram, FaBoxes, FaUsers, FaClipboardList as FaLogs, FaChartBar, FaExchangeAlt, FaCalendarAlt } from 'react-icons/fa';
import '../style/pic_style/PicHeader.css'; // reuse base styles
import api, { API_BASE_URL } from '../../api/axiosInstance';
import { SOCKET_URL, SOCKET_PATH } from '../../utils/socketConfig';
import { io } from 'socket.io-client';

/**
 * Generic multi-role header modeled after PicHeader.
 * Props:
 *  - roleSegment: 'pic' | 'pm' | 'am' | 'ceo' | 'it' | ... (used for nav config)
 *  - extraRight: node (inserts before user menu)
 *  - extraLeft: node (inserts before logo on the left)
 *  - below: node (renders bar below header)
 *  - overrideNav: array to fully override nav items
 */
const ROLE_NAV = {
  pic: (ctx)=> {
    const ap = ctx.activeProject; return [
      { to:'/pic', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/pic' },
      { to:'/pic/chat', label:'Chat', icon:<FaComments/>, match:'/pic/chat' },
      { to:'/pic/requests', label:'Requests', icon:<FaClipboardList/>, match:'/pic/requests' },
      ap && { to:`/pic/${ap._id}`, label:'View Project', icon:<FaEye/>, match:'/pic/'+ap?._id },
      { to:'/pic/projects', label:'My Projects', icon:<FaProjectDiagram/>, match:'/pic/projects' }
    ].filter(Boolean);
  },
  pm: (ctx)=> {
    const ap = ctx.activeProject; return [
      { to:'/pm', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/pm' },
      { to:'/pm/chat', label:'Chat', icon:<FaComments/>, match:'/pm/chat' },
      ap && { to:'/pm/request/'+ap._id, label:'Material', icon:<FaBoxes/>, match:'/pm/request' },
      { to:'/pm/manpower-list', label:'Manpower', icon:<FaUsers/>, match:'/pm/manpower-list' },
  ap && { to:`/pm/viewprojects/${ap._id}`, label:'View Project', icon:<FaEye/>, match:'/pm/viewprojects/'+ap._id },
  { to:'/pm/projects', label:'Projects', icon:<FaProjectDiagram/>, match:'/pm/projects' },
    ].filter(Boolean);
  },
  am: (ctx)=> {
    return [
      { to:'/am', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/am' },
      { to:'/am/chat', label:'Chat', icon:<FaComments/>, match:'/am/chat' },
      { to:'/am/matreq', label:'Material', icon:<FaBoxes/>, match:'/am/matreq' },
      { to:'/am/viewproj', label:'Projects', icon:<FaProjectDiagram/>, match:'/am/viewproj' },
    ];
  },
  ceo: ()=> [
    { to:'/ceo/dash', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/ceo/dash' },
    { to:'/ceo/chat', label:'Chat', icon:<FaComments/>, match:'/ceo/chat' },
    { to:'/ceo/manpower-requests', label:'Manpower', icon:<FaUsers/>, match:'/ceo/manpower-requests' },
    { to:'/ceo/proj', label:'Projects', icon:<FaProjectDiagram/>, match:'/ceo/proj' },
    { to:'/ceo/material-list', label:'Materials', icon:<FaBoxes/>, match:'/ceo/material-list' },
    { to:'/ceo/audit-logs', label:'Audit Logs', icon:<FaClipboardList/>, match:'/ceo/audit-logs' },
  ],
  it: ()=> [
    { to:'/it', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/it' },
    { to:'/it/chat', label:'Chat', icon:<FaComments/>, match:'/it/chat' },
    { to:'/it/material-list', label:'Materials', icon:<FaBoxes/>, match:'/it/material-list' },
    { to:'/it/manpower-list', label:'Manpower', icon:<FaUsers/>, match:'/it/manpower-list' },
    { to:'/it/auditlogs', label:'Audit Logs', icon:<FaClipboardList/>, match:'/it/auditlogs' },
  { to:'/it/projects', label:'Projects', icon:<FaProjectDiagram/>, match:'/it/projects' },
  ],
  staff: ()=> [
    { to:'/staff', label:'Project', icon:<FaEye/>, match:'/staff' },
    { to:'/staff/chat', label:'Chat', icon:<FaComments/>, match:'/staff/chat' },
    { to:'/staff/all-projects', label:'My Projects', icon:<FaProjectDiagram/>, match:'/staff/all-projects' }
  ],
  hrsite: ()=> [
    { to:'/hr-site/current-project', label:'Project', icon:<FaEye/>, match:'/hr-site/current-project' },
    { to:'/hr-site/chat', label:'Chat', icon:<FaComments/>, match:'/hr-site/chat' },
    { to:'/hr-site/all-projects', label:'My Projects', icon:<FaProjectDiagram/>, match:'/hr-site/all-projects' },
  ],
  hr: ()=> [
    { to:'/hr/dash', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/hr/dash' },
    { to:'/hr/chat', label:'Chat', icon:<FaComments/>, match:'/hr/chat' },
    { to:'/hr/mlist', label:'Manpower', icon:<FaUsers/>, match:'/hr/mlist' },
    { to:'/hr/movement', label:'Movement', icon:<FaExchangeAlt/>, match:'/hr/movement' },
    { to:'/hr/project-records', label:'Projects', icon:<FaProjectDiagram/>, match:'/hr/project-records' },
    { to:'/hr/attendance', label:'Attendance', icon:<FaCalendarAlt/>, match:'/hr/attendance' }
  ]
};

const AppHeader = ({ roleSegment='pic', extraRight, extraLeft, overrideNav, showBelow=false, below, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored? JSON.parse(stored) : null;
  const userName = user?.name || 'User';
  const roleName = (user?.role || user?.userType || user?.position || user?.designation || roleSegment).toString();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [unreadChats, setUnreadChats] = useState(0);
  const [socketRef, setSocketRef] = useState(null);

  // Resolve Socket.IO base (reuse logic similar to AreaChat)
  // Use centralized socket config

  // lightweight socket just for chatUpdated events (avoid duplicating full AreaChat logic)
  useEffect(()=>{
    const token = localStorage.getItem('token');
    let s;
    try {
      s = io(SOCKET_URL, { path: SOCKET_PATH, transports:['websocket','polling'], auth:{ userId: user?._id } });
      setSocketRef(s);
    } catch {}
    const handle = (payload) => {
      if(!payload || !payload.chatId) return; // just refetch counts lazily
      fetchUnread();
    };
    if (s) s.on('chatUpdated', handle);
    return ()=>{ if (s) { s.off('chatUpdated', handle); s.disconnect(); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const fetchUnread = async () => {
    try {
      const { data } = await api.get('/chats');
      const uid = user?._id;
      const count = (data||[]).filter(c => {
        if(!c.lastMessage) return false;
        if(String(c.lastMessage.sender) === String(uid)) return false;
        const seen = (c.lastMessage.seen||[]).map(String);
        return !seen.includes(String(uid));
      }).length;
      setUnreadChats(count);
    } catch { setUnreadChats(0); }
  };

  useEffect(()=>{ fetchUnread(); }, []);

  // Window focus tracking for title badge
  const baseTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'FadzTrack');
  const [windowFocused, setWindowFocused] = useState(true);
  useEffect(() => {
    const onFocus = () => setWindowFocused(true);
    const onBlur  = () => setWindowFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Update tab title with unread count when unfocused
  useEffect(() => {
    try {
      const base = baseTitleRef.current || 'FadzTrack';
      if (!windowFocused && unreadChats > 0) {
        const n = unreadChats > 99 ? '99+' : String(unreadChats);
        document.title = `(${n}) ${base}`;
      } else {
        document.title = base;
      }
    } catch {}
  }, [unreadChats, windowFocused]);

  // React immediately to local optimistic unread changes from AreaChat (custom event)
  useEffect(()=>{
    const handler = (e)=>{ if(e?.detail?.action==='read') fetchUnread(); };
    window.addEventListener('chatUnreadChanged', handler);
    return ()=> window.removeEventListener('chatUnreadChanged', handler);
  },[]);

  // fetch active project for roles that need it (pic/pm)
  useEffect(()=>{
    let ignore=false; if(!user?._id) return;
    if(roleSegment==='pic'){
      api.get(`/projects/by-user-status?userId=${user._id}&role=pic&status=Ongoing`).then(({data})=>{ if(!ignore) setActiveProject(data?.[0]||null); }).catch(()=>!ignore&&setActiveProject(null));
    } else if(roleSegment==='pm') {
      // backend expects field name 'projectmanager' (not 'pm') for querying
      api.get(`/projects/by-user-status?userId=${user._id}&role=projectmanager&status=Ongoing`).then(({data})=>{ if(!ignore) setActiveProject(data?.[0]||null); }).catch(()=>!ignore&&setActiveProject(null));
    }
    return ()=>{ ignore=true; };
  },[roleSegment,user?._id]);

  // Listen for completion events (localStorage flag set by ProjectView) and refetch
  useEffect(()=>{
    function handleStorage(e){
      try {
        if(e && e.key && e.key!=='activeProjectInvalidated') return;
        const flag = localStorage.getItem('activeProjectInvalidated');
        if(flag==='1'){
          // refetch depending on role
          if(roleSegment==='pm'){
            api.get(`/projects/by-user-status?userId=${user._id}&role=projectmanager&status=Ongoing`).then(({data})=>{ setActiveProject(data?.[0]||null); localStorage.removeItem('activeProjectInvalidated'); });
          } else if(roleSegment==='pic'){
            api.get(`/projects/by-user-status?userId=${user._id}&role=pic&status=Ongoing`).then(({data})=>{ setActiveProject(data?.[0]||null); localStorage.removeItem('activeProjectInvalidated'); });
          }
        }
      } catch {}
    }
    window.addEventListener('storage', handleStorage);
    // Also poll every 60s in case storage event missed
    const poll = setInterval(()=> handleStorage({key:'activeProjectInvalidated'}),60000);
    return ()=>{ window.removeEventListener('storage', handleStorage); clearInterval(poll); };
  },[roleSegment,user?._id]);

  useEffect(()=>{ const off=e=>{ if(!e.target.closest('.profile-menu-container')) setProfileMenuOpen(false); }; document.addEventListener('click', off); return ()=>document.removeEventListener('click', off); },[]);

  const logout=()=>{ 
    if(onLogout){ onLogout(); return; }
    localStorage.removeItem('token'); 
    localStorage.removeItem('user'); 
    window.dispatchEvent(new Event('storage'));
    navigate('/'); 
  };

  const ctx = { activeProject };
  // Normalize roleSegment (support aliases like 'hr-site' -> 'hrsite')
  const normalizedRole = ROLE_NAV[roleSegment] ? roleSegment : roleSegment.replace(/-/g,'');
  let navItems = overrideNav || (ROLE_NAV[normalizedRole] ? ROLE_NAV[normalizedRole](ctx) : []);

  return (
    <>
      <header className="pic-header pp-navbar">
        <div className="pp-left">
          {extraLeft}
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack" className="pp-logo" />
          <span className="pp-brand">FadzTrack</span>
          <nav className="pp-nav">
            {navItems.map(item=>{
              const isRoot = ['/pic','/pm','/am','/ceo','/it','/staff','/hr-site'].includes(item.match);
              const path = location.pathname.replace(/\/$/,'');
              const match = item.match.replace(/\/$/,'');
              // Special case: PIC new material request route (/pic/projects/:id/request) should highlight 'Requests'
              const picMatReq = /^\/pic\/projects\/[^/]+\/request(\/|$)?/.test(path);
              let active = path === match || (!isRoot && path.startsWith(match + '/'));
              if(picMatReq){
                if(/\/pic\/requests$/.test(match) && item.label==='Requests') active = true; // force Requests active
                if(/\/pic\/projects$/.test(match) && item.label==='My Projects') active = false; // prevent My Projects active
              }
              const isChat = /\/chat$/.test(item.to);
              return <Link key={item.to} to={item.to} className={`pp-link${active?' active':''}`}>{item.icon}<span>{item.label}</span>{isChat && unreadChats>0 && <span className="chat-unread-badge">{unreadChats>99?'99+':unreadChats}</span>}</Link>;
            })}
          </nav>
        </div>
        <div className="pp-right">
          <NotificationBell />
          {extraRight}
          <div className="pp-user profile-menu-container" onClick={()=>setProfileMenuOpen(o=>!o)}>
            <div className="pp-avatar">{userName[0]?.toUpperCase()||'U'}</div>
            <div className="pp-user-text"><span className="pp-username">{userName}</span><span className="pp-role">{roleName}</span></div>
            {profileMenuOpen && <div className="pp-dropdown"><button onClick={logout}>Logout</button></div>}
          </div>
        </div>
      </header>
  {showBelow && below && <div className="pic-header-below">{below}</div>}
    </>
  );
};

export default AppHeader;
