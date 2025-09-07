// src/AppRoutes.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';

// PUBLIC
import LoginPage from './Login';
import TwoFactorAuth from './TwoFactorAuth';
import ActivateAccount from './it/ActivateAccount';
import ResetPassword from './it/ResetPassword';

// GUARD
import PrivateRoute from './PrivateRoute';

// PROJECT MANAGER
import PmDash from './pm/PmDash';
import PmChat from './chats/PmChat';
import PmRequestManpower from './pm/PmRequestManpower';
import PmMatRequestListWrapper from './pm/PmMatRequestListWrapper';
import PmMatRequestDetailWrapper from './pm/PmMatRequestDetailWrapper';
import PmManpowerList from './pm/PmManpowerList';
import PM_Manpower_Request_List from './pm/PM_Manpower_Request_List';
import PmRequestedManpowerDetail from './pm/PmRequestedManpowerDetail';
import PmViewProjects from './pm/PmViewProjects';
import PmAllProjects from './pm/PmAllProjects';
import PmDailyLogs from './pm/PMDailyLogs';
import PmDailyLogsList from './pm/PmDailyLogsList';
import PmViewDailyLogs from './pm/PmViewDailyLogs';
import PmProgressReport from './pm/PmProgressReport';

// PIC
import PicDash from './pic/PicDash';
import PicChat from './chats/PicChat';
import PicReq from './pic/PicReq'; // legacy detail (to retire)
import PicProject from './pic/PicProject';
import PicMatReq from './pic/PicMatReq';
import PicRequestList from './pic/PicRequestList'; // legacy list
import PicMatRequestListWrapper from './pic/PicMatRequestListWrapper';
import PicMatRequestDetailWrapper from './pic/PicMatRequestDetailWrapper';
import PicAllProjects from './pic/PicAllProjects';
import PicMaterialRequestEdit from './pic/PicMaterialRequestEdit';

// AREA MANAGER
import AreaManagerDashboard from './am/AreaDash';
import AreaChat from './chats/AreaChat';
import AddProject from './am/AreaAddproj';
import AmMatRequestList from './am/AmMatRequestList';
import AreaManpowerList from './am/AreaManpowerList';
import AreasPage from './am/AreaProjArea';
import AreaManpowerReqDetails from './am/AreaManpowerReqDetails';
import AmMatRequestDetail from './am/AmMatRequestDetail';
import ProgressReport from './am/ProgressReport';
import AmViewProject from './am/AmViewProject';

// IT
import ItDash from './it/ItDash';
import ItChat from './chats/ItChat';
import ItAuditLog from './it/ItAuditLogs';
import ItMatRequestListWrapper from './it/ItMatRequestListWrapper';
import ItMaterialRequestDetail from './it/ItMaterialRequestDetail';
import ItMaterialRequestEdit from './it/ItMaterialRequestEdit';
import ItManpowerList from './it/ItManpowerList';
import ItManpowerRequestDetail from './it/ItManpowerRequestDetail';
import ItProjects from './it/ItProjects';
import ItViewProject from './it/ItViewProject';

// CEO
import CeoDash from './ceo/CeoDash';
import CeoProj from './ceo/CeoProj';
import CeoAddArea from './ceo/CeoAddArea';
import CeoMatRequestListWrapper from './ceo/CeoMatRequestListWrapper';
import CeoMaterialRequestDetail from './ceo/CeoMaterialRequestDetail';
import CeoAuditLogs from './ceo/CeoAuditLogs';
import CeoChat from './chats/CeoChat';
import CeoMaterialRequestEdit from './ceo/CeoMaterialRequestEdit';
import CeoManpowerRequestList from './ceo/CeoManpowerRequestList';
import CeoManpowerRequestDetail from './ceo/CeoManpowerRequestDetail';
import CeoViewProject from './ceo/CeoViewProject';

// HR
import HrDash from './hr/HrDash';
import HrManpowerList from './hr/HrManpowerList';
import HrMovementList from './hr/HrMovementList';
import HrProj from './hr/HrProj';
import HrManpowerRequestDetail from './hr/HrManpowerRequestDetail';
import HrChat from './chats/HrChat';
import HrManpowerRequestList from './hr/HrManpowerRequestList';
import HrViewProject from './hr/HrViewProject';
import HrAttendance from './hr/HrAttendance';

// STAFF
import StaffCurrentProject from './staff/StaffCurrentProject';
import StaffAllProjects from './staff/StaffAllProjects';
import StaffChat from './chats/StaffChat';

// HR-SITE
import HrSiteCurrentProject from './hrSite/HrSiteCurrentProject';
import HrSiteAllProjects from './hrSite/HrSiteAllProjects';
import HrSiteChat from './chats/HrSiteChat';

// SHARED / REUSABLE
import ProgressTracker from './ProgressTracker';
import ApproveDenyAction from './ApproveDenyActions';

const AppRoutes = ({ forceUserUpdate }) => {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LoginPage forceUserUpdate={forceUserUpdate} />} />
      <Route path="/2fa" element={<TwoFactorAuth forceUserUpdate={forceUserUpdate} />} />
      <Route path="/activate-account" element={<ActivateAccount />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Project Manager-only */}
      <Route element={<PrivateRoute allowedRoles={['Project Manager']} />}>
        <Route path="/pm" element={<PmDash />} />
        <Route path="/pm/chat" element={<PmChat />} />
        <Route path="/pm/chat/:chatId" element={<PmChat />} />
  <Route path="/pm/request/:id" element={<PmMatRequestListWrapper />} />
  <Route path="/pm/material-request/:id" element={<PmMatRequestDetailWrapper />} />
        <Route path="/pm/request-manpower" element={<PmRequestManpower />} />
        <Route path="/pm/request-manpower/edit/:id" element={<PmRequestManpower />} />
        <Route path="/pm/manpower-request/:id" element={<PmRequestedManpowerDetail />} />
        <Route path="/pm/manpower-list" element={<PmManpowerList />} />
  <Route path="/pm/viewprojects/:id" element={<PmViewProjects />} />
  <Route path="/pm/projects" element={<PmAllProjects />} />
        <Route path="/pm/daily-logs" element={<PmDailyLogs />} />
        <Route path="/pm/progress-report/:id" element={<PmProgressReport />} />
        <Route path="/pm/daily-logs-list" element={<PmDailyLogsList />} />
        <Route path="/pm/daily-logs/:id" element={<PmViewDailyLogs />} />
        <Route path="/pm/manpower-requests" element={<PM_Manpower_Request_List />} />
      </Route>

      {/* Person in Charge-only */}
      <Route element={<PrivateRoute allowedRoles={['Person in Charge']} />}>
        <Route path="/pic" element={<PicDash />} />
        <Route path="/pic/chat" element={<PicChat />} />
        <Route path="/pic/chat/:chatId" element={<PicChat />} />
  {/* PIC Material Requests (list + detail) */}
  <Route path="/pic/requests" element={<PicMatRequestListWrapper />} />
  <Route path="/pic/material-request/:id" element={<PicMatRequestDetailWrapper />} />
        <Route path="/pic/:id" element={<PicProject />} />
        <Route path="/pic/projects/:projectId/request" element={<PicMatReq />} />
        <Route path="/pic/projects" element={<PicAllProjects />} />
        <Route path="/pic/material-request/edit/:id" element={<PicMaterialRequestEdit />} />
      </Route>

      {/* Area Manager-only */}
      <Route element={<PrivateRoute allowedRoles={['Area Manager']} />}>
        <Route path="/am" element={<AreaManagerDashboard />} />
        <Route path="/am/chat" element={<AreaChat />} />
        <Route path="/am/chat/:chatId" element={<AreaChat />} />
        <Route path="/am/addproj" element={<AddProject />} />
  <Route path="/am/matreq" element={<AmMatRequestList />} />
        <Route path="/am/manpower-requests" element={<AreaManpowerList />} />
        <Route path="/am/viewproj" element={<AreasPage />} />
        <Route path="/am/viewproj/:id" element={<AreasPage />} />
        <Route path="/am/manpower-requests/:id" element={<AreaManpowerReqDetails />} />
        <Route path="/am/projects" element={<AreasPage />} />
  <Route path="/am/projects/:id" element={<AmViewProject />} />
  {/* New unified project view (reusable) */}
  <Route path="/am/viewprojects/:id" element={<AmViewProject />} />
  <Route path="/am/material-list" element={<AmMatRequestList />} />
  <Route path="/am/material-request/:id" element={<AmMatRequestDetail />} />
        <Route path="/am/progress-report/:id" element={<ProgressReport />} />
      </Route>

      {/* IT-only */}
      <Route element={<PrivateRoute allowedRoles={['IT']} />}>
        <Route path="/it" element={<ItDash />} />
        <Route path="/it/auditlogs" element={<ItAuditLog />} />
        <Route path="/it/material-list" element={<ItMatRequestListWrapper />} />
        <Route path="/it/material-request/:id" element={<ItMaterialRequestDetail />} />
        <Route path="/it/material-request/edit/:id" element={<ItMaterialRequestEdit />} />
        <Route path="/it/manpower-list" element={<ItManpowerList />} />
        <Route path="/it/manpower-list/:id" element={<ItManpowerRequestDetail />} />
        <Route path="/it/projects" element={<ItProjects />} />
        <Route path="/it/projects/:id" element={<ItViewProject />} />
        <Route path="/it/chat" element={<ItChat />} />
        <Route path="/it/chat/:chatId" element={<ItChat />} />
      </Route>

      {/* CEO-only */}
      <Route element={<PrivateRoute allowedRoles={['CEO']} />}>
        <Route path="/ceo/dash" element={<CeoDash />} />
        <Route path="/ceo/addarea" element={<CeoAddArea />} />
        <Route path="/ceo/proj" element={<CeoProj />} />
  <Route path="/ceo/proj/:id" element={<CeoViewProject />} />
  {/* New unified project view (reusable) */}
  <Route path="/ceo/viewprojects/:id" element={<CeoViewProject />} />
        <Route path="/ceo/material-list" element={<CeoMatRequestListWrapper />} />
        <Route path="/ceo/material-request/:id" element={<CeoMaterialRequestDetail />} />
        <Route path="/ceo/material-request/edit/:id" element={<CeoMaterialRequestEdit />} />
        <Route path="/ceo/audit-logs" element={<CeoAuditLogs />} />
        <Route path="/ceo/chat" element={<CeoChat />} />
        <Route path="/ceo/chat/:chatId" element={<CeoChat />} />
  <Route path="/ceo/manpower-requests" element={<CeoManpowerRequestList />} />
  <Route path="/ceo/manpower-request/:id" element={<CeoManpowerRequestDetail />} />
      </Route>

      {/* HR-only */}
      <Route element={<PrivateRoute allowedRoles={['HR']} />}>
        <Route path="/hr/dash" element={<HrDash />} />
        <Route path="/hr/mlist" element={<HrManpowerList />} />
        <Route path="/hr/movement" element={<HrMovementList />} />
        <Route path="/hr/project-records" element={<HrProj />} />
  <Route path="/hr/project-records/:id" element={<HrViewProject />} />
  {/* New unified project view (reusable) */}
  <Route path="/hr/viewprojects/:id" element={<HrViewProject />} />
        <Route path="/hr/manpower-request/:id" element={<HrManpowerRequestDetail />} />
        <Route path="/hr/chat" element={<HrChat />} />
        <Route path="/hr/chat/:chatId" element={<HrChat />} />
        <Route path="/hr/manpower-requests" element={<HrManpowerRequestList />} />
        <Route path="/hr/attendance" element={<HrAttendance />} />
      </Route>

      {/* Staff-only */}
      <Route element={<PrivateRoute allowedRoles={['Staff']} />}>
        <Route path="/staff" element={<StaffCurrentProject />} />
        <Route path="/staff/current-project" element={<StaffCurrentProject />} />
        <Route path="/staff/chat" element={<StaffChat />} />
        <Route path="/staff/chat/:chatId" element={<StaffChat />} />
        <Route path="/staff/all-projects" element={<StaffAllProjects />} />
      </Route>

      {/* HR-Site-only */}
      <Route element={<PrivateRoute allowedRoles={['HR - Site']} />}>
        <Route path="/hr-site" element={<HrSiteCurrentProject />} />
        <Route path="/hr-site/current-project" element={<HrSiteCurrentProject />} />
        <Route path="/hr-site/chat" element={<HrSiteChat />} />
        <Route path="/hr-site/chat/:chatId" element={<HrSiteChat />} />
        <Route path="/hr-site/all-projects" element={<HrSiteAllProjects />} />
      </Route>

      {/* Shared protected routes (multiple roles) */}
      <Route element={<PrivateRoute allowedRoles={['Project Manager', 'Area Manager', 'CEO']} />}>
        <Route path="/approve-deny/:id" element={<ApproveDenyAction />} />
      </Route>

      <Route element={<PrivateRoute allowedRoles={['Project Manager', 'Area Manager', 'CEO', 'Person in Charge']} />}>
        <Route path="/progress-tracker/:id" element={<ProgressTracker />} />
      </Route>

      {/* Not found → back to login */}
      <Route path="*" element={<LoginPage forceUserUpdate={forceUserUpdate} />} />
    </Routes>
  );
};

export default AppRoutes;
