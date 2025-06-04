import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PicDash from './pic/PicDash';
import PicReq from './pic/PicReq';
import PicChat from './pic/PicChat';
import PmDash from './pm/PmDash';
import PmIncidentReport from './pm/PmIncidentReport';
import PmRequestManpower from './pm/PmRequestManpower';
import AreaManagerDashboard from './am/AreaDash';
import LoginPage from './Login';
import AreaManpowerList from './am/AreaManpowerList';
import AreaMaterialList from './am/AreaMaterialList';
import AddProject from './am/AreaAddproj';
import AreasPage from './am/AreaProjArea';
import CeoProj from './ceo/CeoProj';
import CeoViewSpecific from './ceo/CeoViewSpecific';
import CeoDash from './ceo/CeoDash';
import CeoAddArea from './ceo/CeoAddArea';
import PrivateRoute from "./PrivateRoute";
import ItDash from './it/ItDash';
import PicProject from './pic/PicProject';
import PicMatReq from './pic/PicMatReq';
import PmMatRequestList from './pm/PmMatRequestList';
import CeoMaterialRequestDetail from './ceo/CeoMaterialRequestDetail';
import PmMatRequestDetail from './pm/PmMatRequestDetail';
import ApproveDenyAction from './ApproveDenyActions';
import PmManpowerList from './pm/PmManpowerList';
import AreaManpowerReqDetails from './am/AreaManpowerReqDetails';
import HrManpowerList from './hr/HrManpowerList';
import HrDash from './hr/HrDash';
import PmViewProjects from './pm/PmViewProjects';
import PmRequestedManpowerDetail from './pm/PmRequestedManpowerDetail';
import CeoAuditLogs from './ceo/CeoAuditLogs';
import CeoMaterialList from './ceo/CeoMaterialList';
import HrMovementList from './hr/HrMovementList';
import AreaProj from './am/AreaProjArea';
import ActivateAccount from './it/ActivateAccount';
import ResetPassword from './it/ResetPassword';
import PmDailyLogs from './pm/PMDailyLogs';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      {/* PROJECT MANAGER */}
      <Route path="/pm/material-request/:id" element={<PmMatRequestDetail />} />
      <Route path="/pm/request/:id" element={<PmMatRequestList />} />
      <Route path="/pm/request-manpower" element={<PmRequestManpower />} />
      <Route path="/pm/manpower-request/:id" element={<PmRequestedManpowerDetail />} />
      <Route path="/pm/request-manpower/edit/:id" element={<PmRequestManpower />} />
      <Route path="/pm/manpower-list" element={<PmManpowerList />} />
      <Route path="/k" element={<PmIncidentReport />} />
      {/* <Route path="/q" element={<PmDailyReports />} /> */}
      <Route path="/pm" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmDash /></PrivateRoute>} />
      <Route path="/pm/viewprojects/:id" element={<PmViewProjects />} />
      <Route path="/pm/daily-logs" element={<PmDailyLogs />} />

      {/* PIC */}
      <Route path="/pic" element={<PicDash />} />
      <Route path="/pic/chat" element={<PicChat />} />
      <Route path="/pic/request/:id" element={<PicReq />} />
      <Route path="/pic/:id" element={<PicProject />} />
      <Route path="/pic/projects/:projectId/request" element={<PicMatReq />} />

      {/* AREA */}
      <Route path="/am" element={<AreaManagerDashboard />} />
      <Route path="/am/addproj" element={<AddProject />} />
      <Route path="/am/matreq" element={<AreaMaterialList />} />
      <Route path="/am/manpower-requests" element={<AreaManpowerList />} />
      <Route path="/am/viewproj" element={<AreasPage />} />
      <Route path="/am/viewproj/:id" element={<AreasPage />} />
      <Route path="/am/manpower-requests/:id" element={<AreaManpowerReqDetails />} />
      <Route path="/am/projects" element={<AreaProj />} />

      {/* IT */}
      <Route path="/it" element={<PrivateRoute allowedRoles={["IT"]}><ItDash /></PrivateRoute>} />
      <Route path="/activate-account" element={<ActivateAccount />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* CEO */}
      <Route path="/ceo/proj" element={<CeoProj />} />
      <Route path="/ceo/dash" element={<CeoDash />} />
      <Route path="/ceo/addarea" element={<CeoAddArea />} />
      <Route path="/ceo/proj/:id" element={<CeoViewSpecific />} />
      <Route path="/ceo/material-list" element={<CeoMaterialList />} />
      <Route path="/ceo/material-request/:id" element={<CeoMaterialRequestDetail />} />
      <Route path="/ceo/audit-logs" element={<CeoAuditLogs />} />

      {/* HR */}
      <Route path="/hr/dash" element={<HrDash />} />
      <Route path="/hr/mlist" element={<HrManpowerList />} />
      <Route path="/hr/movement" element={<HrMovementList />} />

      {/* Reusable */}
      <Route path="/approve-deny/:id" element={<ApproveDenyAction />} />
    </Routes>
  );
};

export default AppRoutes;
