// src/AppRoutes.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// PUBLIC (small; keep Login eager, lazy the rest)
import LoginPage from './Login';
const TwoFactorAuth = lazy(() => import(/* webpackChunkName: "auth" */ './TwoFactorAuth'));
const ActivateAccount = lazy(() => import(/* webpackChunkName: "auth" */ './it/ActivateAccount'));
const ResetPassword = lazy(() => import(/* webpackChunkName: "auth" */ './it/ResetPassword'));

// GUARD
const PrivateRoute = lazy(() => import(/* webpackChunkName: "guard" */ './PrivateRoute'));

// PROJECT MANAGER
const PmDash = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmDash'));
const PmChat = lazy(() => import(/* webpackChunkName: "pm" */ './chats/PmChat'));
const PmRequestManpower = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmRequestManpower'));
const PmMatRequestListWrapper = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmMatRequestListWrapper'));
const PmMatRequestDetailWrapper = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmMatRequestDetailWrapper'));
const PmManpowerList = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmManpowerList'));
const PM_Manpower_Request_List = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PM_Manpower_Request_List'));
const PmRequestedManpowerDetail = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmRequestedManpowerDetail'));
const PmViewProjects = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmViewProjects'));
const PmAllProjects = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmAllProjects'));
const PmDailyLogs = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PMDailyLogs'));
const PmDailyLogsList = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmDailyLogsList'));
const PmViewDailyLogs = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmViewDailyLogs'));
const PmProgressReport = lazy(() => import(/* webpackChunkName: "pm" */ './pm/PmProgressReport'));

// PIC
const PicDash = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicDash'));
const PicChat = lazy(() => import(/* webpackChunkName: "pic" */ './chats/PicChat'));
const PicReq = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicReq')); // legacy detail (to retire)
const PicProject = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicProject'));
const PicMatReq = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicMatReq'));
const PicRequestList = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicRequestList')); // legacy list
const PicMatRequestListWrapper = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicMatRequestListWrapper'));
const PicMatRequestDetailWrapper = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicMatRequestDetailWrapper'));
const PicAllProjects = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicAllProjects'));
const PicMaterialRequestEdit = lazy(() => import(/* webpackChunkName: "pic" */ './pic/PicMaterialRequestEdit'));

// AREA MANAGER
const AreaManagerDashboard = lazy(() => import(/* webpackChunkName: "am" */ './am/AreaDash'));
const AreaChat = lazy(() => import(/* webpackChunkName: "am" */ './chats/AreaChat'));
const AddProject = lazy(() => import(/* webpackChunkName: "am" */ './am/AreaAddproj'));
const AmMatRequestList = lazy(() => import(/* webpackChunkName: "am" */ './am/AmMatRequestList'));
const AreaManpowerList = lazy(() => import(/* webpackChunkName: "am" */ './am/AreaManpowerList'));
const AreasPage = lazy(() => import(/* webpackChunkName: "am" */ './am/AreaProjArea'));
const AreaManpowerReqDetails = lazy(() => import(/* webpackChunkName: "am" */ './am/AreaManpowerReqDetails'));
const AmMatRequestDetail = lazy(() => import(/* webpackChunkName: "am" */ './am/AmMatRequestDetail'));
const ProgressReport = lazy(() => import(/* webpackChunkName: "am" */ './am/ProgressReport'));
const AmViewProject = lazy(() => import(/* webpackChunkName: "am" */ './am/AmViewProject'));

// IT
const ItDash = lazy(() => import(/* webpackChunkName: "it" */ './it/ItDash'));
const ItChat = lazy(() => import(/* webpackChunkName: "it" */ './chats/ItChat'));
const ItAuditLog = lazy(() => import(/* webpackChunkName: "it" */ './it/ItAuditLogs'));
const ItMatRequestListWrapper = lazy(() => import(/* webpackChunkName: "it" */ './it/ItMatRequestListWrapper'));
const ItMaterialRequestDetail = lazy(() => import(/* webpackChunkName: "it" */ './it/ItMaterialRequestDetail'));
const ItMaterialRequestEdit = lazy(() => import(/* webpackChunkName: "it" */ './it/ItMaterialRequestEdit'));
const ItManpowerList = lazy(() => import(/* webpackChunkName: "it" */ './it/ItManpowerList'));
const ItManpowerRequestDetail = lazy(() => import(/* webpackChunkName: "it" */ './it/ItManpowerRequestDetail'));
const ItProjects = lazy(() => import(/* webpackChunkName: "it" */ './it/ItProjects'));
const ItViewProject = lazy(() => import(/* webpackChunkName: "it" */ './it/ItViewProject'));

// CEO
const CeoDash = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoDash'));
const CeoProj = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoProj'));
const CeoAddArea = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoAddArea'));
const CeoMatRequestListWrapper = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoMatRequestListWrapper'));
const CeoMaterialRequestDetail = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoMaterialRequestDetail'));
const CeoAuditLogs = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoAuditLogs'));
const CeoChat = lazy(() => import(/* webpackChunkName: "ceo" */ './chats/CeoChat'));
const CeoMaterialRequestEdit = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoMaterialRequestEdit'));
const CeoManpowerRequestList = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoManpowerRequestList'));
const CeoManpowerRequestDetail = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoManpowerRequestDetail'));
const CeoViewProject = lazy(() => import(/* webpackChunkName: "ceo" */ './ceo/CeoViewProject'));

// HR
const HrDash = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrDash'));
const HrManpowerList = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrManpowerList'));
const HrMovementList = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrMovementList'));
const HrProj = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrProj'));
const HrManpowerRequestDetail = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrManpowerRequestDetail'));
const HrChat = lazy(() => import(/* webpackChunkName: "hr" */ './chats/HrChat'));
const HrManpowerRequestList = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrManpowerRequestList'));
const HrViewProject = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrViewProject'));
const HrAttendance = lazy(() => import(/* webpackChunkName: "hr" */ './hr/HrAttendance'));

// STAFF
const StaffCurrentProject = lazy(() => import(/* webpackChunkName: "staff" */ './staff/StaffCurrentProject'));
const StaffAllProjects = lazy(() => import(/* webpackChunkName: "staff" */ './staff/StaffAllProjects'));
const StaffChat = lazy(() => import(/* webpackChunkName: "staff" */ './chats/StaffChat'));

// HR-SITE
const HrSiteCurrentProject = lazy(() => import(/* webpackChunkName: "hrsite" */ './hrSite/HrSiteCurrentProject'));
const HrSiteAllProjects = lazy(() => import(/* webpackChunkName: "hrsite" */ './hrSite/HrSiteAllProjects'));
const HrSiteChat = lazy(() => import(/* webpackChunkName: "hrsite" */ './chats/HrSiteChat'));

// SHARED / REUSABLE
const ProgressTracker = lazy(() => import(/* webpackChunkName: "shared" */ './ProgressTracker'));
const ApproveDenyAction = lazy(() => import(/* webpackChunkName: "shared" */ './ApproveDenyActions'));

const AppRoutes = ({ forceUserUpdate }) => {
  return (
    <Suspense fallback={<div style={{padding: 24}}>Loading…</div>}>
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
    </Suspense>
  );
};

export default AppRoutes;
