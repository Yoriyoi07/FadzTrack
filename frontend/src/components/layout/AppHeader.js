import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram, FaBoxes, FaUsers, FaClipboardList as FaLogs, FaChartBar } from 'react-icons/fa';
import '../style/pic_style/PicHeader.css'; // reuse base styles
import api from '../../api/axiosInstance';

/**
 * Generic multi-role header modeled after PicHeader.
 * Props:
 *  - roleSegment: 'pic' | 'pm' | 'am' | 'ceo' | 'it' | ... (used for nav config)
 *  - extraRight: node (inserts before user menu)
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
      { to:'/am/manpower-requests', label:'Manpower', icon:<FaUsers/>, match:'/am/manpower-requests' },
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
    { to:'/hr-site/attendance-report', label:'Attendance', icon:<FaClipboardList/>, match:'/hr-site/attendance-report' }
  ]
};

const AppHeader = ({ roleSegment='pic', extraRight, overrideNav, showBelow=false, below }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored? JSON.parse(stored) : null;
  const userName = user?.name || 'User';
  const roleName = (user?.role || user?.userType || user?.position || user?.designation || roleSegment).toString();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);

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

  useEffect(()=>{ const off=e=>{ if(!e.target.closest('.profile-menu-container')) setProfileMenuOpen(false); }; document.addEventListener('click', off); return ()=>document.removeEventListener('click', off); },[]);

  const logout=()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); };

  const ctx = { activeProject };
  // Normalize roleSegment (support aliases like 'hr-site' -> 'hrsite')
  const normalizedRole = ROLE_NAV[roleSegment] ? roleSegment : roleSegment.replace(/-/g,'');
  let navItems = overrideNav || (ROLE_NAV[normalizedRole] ? ROLE_NAV[normalizedRole](ctx) : []);

  return (
    <>
      <header className="pic-header pp-navbar">
        <div className="pp-left">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack" className="pp-logo" />
          <span className="pp-brand">FadzTrack</span>
          <nav className="pp-nav">
            {navItems.map(item=>{
              const isRoot = ['/pic','/pm','/am','/ceo','/it','/staff','/hr-site'].includes(item.match);
              const path = location.pathname.replace(/\/$/,'');
              const match = item.match.replace(/\/$/,'');
              const active = path === match || (!isRoot && path.startsWith(match + '/'));
              return <Link key={item.to} to={item.to} className={`pp-link${active?' active':''}`}>{item.icon}<span>{item.label}</span></Link>;
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
