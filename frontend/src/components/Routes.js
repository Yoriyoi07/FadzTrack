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
import PmMatRequestList from './pm/PmMatRequestList';
import PmMatRequestDetail from './pm/PmMatRequestDetail';
import PmManpowerList from './pm/PmManpowerList';
import PM_Manpower_Request_List from './pm/PM_Manpower_Request_List';
import PmRequestedManpowerDetail from './pm/PmRequestedManpowerDetail';
import PmViewProjects from './pm/PmViewProjects';
import PmDailyLogs from './pm/PMDailyLogs';
import PmDailyLogsList from './pm/PmDailyLogsList';
import PmViewDailyLogs from './pm/PmViewDailyLogs';
import PmProgressReport from './pm/PmProgressReport';

// PIC
import PicDash from './pic/PicDash';
import PicChat from './chats/PicChat';
import PicReq from './pic/PicReq';
import PicProject from './pic/PicProject';
import PicMatReq from './pic/PicMatReq';
import PicAllProjects from './pic/PicAllProjects';

// AREA MANAGER
import AreaManagerDashboard from './am/AreaDash';
import AreaChat from './chats/AreaChat';
import AddProject from './am/AreaAddproj';
import AreaMaterialList from './am/AreaMaterialList';
import AreaManpowerList from './am/AreaManpowerList';
import AreasPage from './am/AreaProjArea';
import AreaViewSpecificProj from './am/AreaViewSpecificProj';
import AreaManpowerReqDetails from './am/AreaManpowerReqDetails';
import AreaMaterialReq from './am/AreaRequestDetail';
import ProgressReport from './am/ProgressReport';

// IT
import ItDash from './it/ItDash';
import ItChat from './chats/ItChat';
import ItAuditLog from './it/ItAuditLogs';
import ItMaterialList from './it/ItMaterialList';
import ItMaterialRequestDetail from './it/ItMaterialRequestDetail';
import ItManpowerList from './it/ItManpowerList';
import ItManpowerRequestDetail from './it/ItManpowerRequestDetail';

// CEO
import CeoDash from './ceo/CeoDash';
import CeoProj from './ceo/CeoProj';
import CeoViewSpecific from './ceo/CeoViewSpecific';
import CeoAddArea from './ceo/CeoAddArea';
import CeoMaterialList from './ceo/CeoMaterialList';
import CeoMaterialRequestDetail from './ceo/CeoMaterialRequestDetail';
import CeoAuditLogs from './ceo/CeoAuditLogs';
import CeoChat from './chats/CeoChat';

// HR
import HrDash from './hr/HrDash';
import HrManpowerList from './hr/HrManpowerList';
import HrMovementList from './hr/HrMovementList';
import HrProj from './hr/HrProj';
import HrViewSpecific from './hr/HrViewSpeficic';
import HrChat from './chats/HrChat';

// STAFF
import StaffCurrentProject from './staff/StaffCurrentProject';
import StaffAllProjects from './staff/StaffAllProjects';

// HR-SITE
import HrSiteCurrentProject from './hrSite/HrSiteCurrentProject';
import HrSiteAllProjects from './hrSite/HrSiteAllProjects';
import HrSiteAttendanceReport from './hrSite/HrSiteAttendanceReport';

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
        <Route path="/pm/request/:id" element={<PmMatRequestList />} />
        <Route path="/pm/material-request/:id" element={<PmMatRequestDetail />} />
        <Route path="/pm/request-manpower" element={<PmRequestManpower />} />
        <Route path="/pm/request-manpower/edit/:id" element={<PmRequestManpower />} />
        <Route path="/pm/manpower-request/:id" element={<PmRequestedManpowerDetail />} />
        <Route path="/pm/manpower-list" element={<PmManpowerList />} />
        <Route path="/pm/viewprojects/:id" element={<PmViewProjects />} />
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
        <Route path="/pic/request/:id" element={<PicReq />} />
        <Route path="/pic/:id" element={<PicProject />} />
        <Route path="/pic/projects/:projectId/request" element={<PicMatReq />} />
        <Route path="/pic/projects" element={<PicAllProjects />} />
      </Route>

      {/* Area Manager-only */}
      <Route element={<PrivateRoute allowedRoles={['Area Manager']} />}>
        <Route path="/am" element={<AreaManagerDashboard />} />
        <Route path="/am/chat" element={<AreaChat />} />
        <Route path="/am/chat/:chatId" element={<AreaChat />} />
        <Route path="/am/addproj" element={<AddProject />} />
        <Route path="/am/matreq" element={<AreaMaterialList />} />
        <Route path="/am/manpower-requests" element={<AreaManpowerList />} />
        <Route path="/am/viewproj" element={<AreasPage />} />
        <Route path="/am/viewproj/:id" element={<AreasPage />} />
        <Route path="/am/manpower-requests/:id" element={<AreaManpowerReqDetails />} />
        <Route path="/am/projects" element={<AreasPage />} />
        <Route path="/am/projects/:id" element={<AreaViewSpecificProj />} />
        <Route path="/am/material-list" element={<AreaMaterialList />} />
        <Route path="/am/material-request/:id" element={<AreaMaterialReq />} />
        <Route path="/am/progress-report/:id" element={<ProgressReport />} />
      </Route>

      {/* IT-only */}
      <Route element={<PrivateRoute allowedRoles={['IT']} />}>
        <Route path="/it" element={<ItDash />} />
        <Route path="/it/auditlogs" element={<ItAuditLog />} />
        <Route path="/it/material-list" element={<ItMaterialList />} />
        <Route path="/it/material-request/:id" element={<ItMaterialRequestDetail />} />
        <Route path="/it/manpower-list" element={<ItManpowerList />} />
        <Route path="/it/manpower-list/:id" element={<ItManpowerRequestDetail />} />
        <Route path="/it/chat" element={<ItChat />} />
        <Route path="/it/chat/:chatId" element={<ItChat />} />
      </Route>

      {/* CEO-only */}
      <Route element={<PrivateRoute allowedRoles={['CEO']} />}>
        <Route path="/ceo/dash" element={<CeoDash />} />
        <Route path="/ceo/addarea" element={<CeoAddArea />} />
        <Route path="/ceo/proj" element={<CeoProj />} />
        <Route path="/ceo/proj/:id" element={<CeoViewSpecific />} />
        <Route path="/ceo/material-list" element={<CeoMaterialList />} />
        <Route path="/ceo/material-request/:id" element={<CeoMaterialRequestDetail />} />
        <Route path="/ceo/audit-logs" element={<CeoAuditLogs />} />
        <Route path="/ceo/chat" element={<CeoChat />} />
        <Route path="/ceo/chat/:chatId" element={<CeoChat />} />
      </Route>

      {/* HR-only */}
      <Route element={<PrivateRoute allowedRoles={['HR']} />}>
        <Route path="/hr/dash" element={<HrDash />} />
        <Route path="/hr/mlist" element={<HrManpowerList />} />
        <Route path="/hr/movement" element={<HrMovementList />} />
        <Route path="/hr/project-records" element={<HrProj />} />
        <Route path="/hr/project-records/:id" element={<HrViewSpecific />} />
        <Route path="/hr/chat" element={<HrChat />} />
        <Route path="/hr/chat/:chatId" element={<HrChat />} />
      </Route>

      {/* Staff-only */}
      <Route element={<PrivateRoute allowedRoles={['Staff']} />}>
        <Route path="/staff/current-project" element={<StaffCurrentProject />} />
        <Route path="/staff/all-projects" element={<StaffAllProjects />} />
      </Route>

      {/* HR-Site-only */}
      <Route element={<PrivateRoute allowedRoles={['HR - Site']} />}>
        <Route path="/hr-site/current-project" element={<HrSiteCurrentProject />} />
        <Route path="/hr-site/all-projects" element={<HrSiteAllProjects />} />
        <Route path="/hr-site/attendance-report" element={<HrSiteAttendanceReport />} />
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
