import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PicDash from './pic/PicDash';
import PicReq from './pic/PicReq';
import PicChat from './pic/PicChat';
import PmDash from './pm/PmDash';
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
import HrProj from './hr/HrProj';
import AreaViewSpecificProj from './am/AreaViewSpecificProj';
import PicAllProjects from './pic/PicAllProjects';
import AreaMaterialReq from './am/AreaRequestDetail';
import ItAuditLog from './it/ItAuditLogs';
import ItMaterialList from './it/ItMaterialList';
import ProgressTracker from './ProgressTracker';
import ItManpowerList from './it/ItManpowerList';
import ItManpowerRequestDetail from './it/ItManpowerRequestDetail';
import ItMaterialRequestDetail from './it/ItMaterialRequestDetail';
import TwoFactorAuth from './TwoFactorAuth';

const AppRoutes = ({ forceUserUpdate }) => {
  return (
   <Routes>
  {/* Public */}
  <Route path="/" element={<LoginPage forceUserUpdate={forceUserUpdate} />} />
  <Route path="/2fa" element={<TwoFactorAuth forceUserUpdate={forceUserUpdate} />} />
  <Route path="/activate-account" element={<ActivateAccount />} />
  <Route path="/reset-password" element={<ResetPassword />} />

  {/* PROJECT MANAGER */}
  <Route path="/pm" element={<PrivateRoute allowedRoles={["Project Manager"]}> <PmDash forceUserUpdate={window.forceUserUpdate} /></PrivateRoute>} />
  <Route path="/pm/material-request/:id" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmMatRequestDetail /></PrivateRoute>} />
  <Route path="/pm/request/:id" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmMatRequestList /></PrivateRoute>} />
  <Route path="/pm/request-manpower" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmRequestManpower /></PrivateRoute>} />
  <Route path="/pm/manpower-request/:id" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmRequestedManpowerDetail /></PrivateRoute>} />
  <Route path="/pm/request-manpower/edit/:id" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmRequestManpower /></PrivateRoute>} />
  <Route path="/pm/manpower-list" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmManpowerList /></PrivateRoute>} />
  <Route path="/pm/viewprojects/:id" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmViewProjects /></PrivateRoute>} />
  <Route path="/pm/daily-logs" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmDailyLogs /></PrivateRoute>} />

  {/* PIC */}
  <Route path="/pic" element={<PrivateRoute allowedRoles={["Person in Charge"]}><PicDash /></PrivateRoute>} />
  <Route path="/pic/chat" element={<PrivateRoute allowedRoles={["PPerson in Charge"]}><PicChat /></PrivateRoute>} />
  <Route path="/pic/request/:id" element={<PrivateRoute allowedRoles={["Person in Charge"]}><PicReq /></PrivateRoute>} />
  <Route path="/pic/:id" element={<PrivateRoute allowedRoles={["Person in Charge"]}><PicProject /></PrivateRoute>} />
  <Route path="/pic/projects/:projectId/request" element={<PrivateRoute allowedRoles={["Person in Charge"]}><PicMatReq /></PrivateRoute>} />
  <Route path="/pic/projects" element={<PrivateRoute allowedRoles={["Person in Charge"]}><PicAllProjects /></PrivateRoute>} />

  {/* AREA MANAGER */}
  <Route path="/am" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaManagerDashboard /></PrivateRoute>} />
  <Route path="/am/addproj" element={<PrivateRoute allowedRoles={["Area Manager"]}><AddProject /></PrivateRoute>} />
  <Route path="/am/matreq" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaMaterialList /></PrivateRoute>} />
  <Route path="/am/manpower-requests" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaManpowerList /></PrivateRoute>} />
  <Route path="/am/viewproj" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreasPage /></PrivateRoute>} />
  <Route path="/am/viewproj/:id" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreasPage /></PrivateRoute>} />
  <Route path="/am/manpower-requests/:id" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaManpowerReqDetails /></PrivateRoute>} />
  <Route path="/am/projects" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaProj /></PrivateRoute>} />
  <Route path="/am/projects/:id" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaViewSpecificProj /></PrivateRoute>} />
  <Route path="/am/material-list" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaMaterialList /></PrivateRoute>} />
  <Route path="/am/material-request/:id" element={<PrivateRoute allowedRoles={["Area Manager"]}><AreaMaterialReq /></PrivateRoute>} />

  {/* IT */}
  <Route path="/it" element={<PrivateRoute allowedRoles={["IT"]}><ItDash /></PrivateRoute>} />
  <Route path="/it/auditlogs" element={<PrivateRoute allowedRoles={["IT"]}><ItAuditLog /></PrivateRoute>} />
  <Route path="/it/material-list" element={<PrivateRoute allowedRoles={["IT"]}><ItMaterialList /></PrivateRoute>} />
  <Route path="/it/material-request/:id" element={<PrivateRoute allowedRoles={["IT"]}><ItMaterialRequestDetail /></PrivateRoute>} />
  <Route path="/it/manpower-list" element={<PrivateRoute allowedRoles={["IT"]}><ItManpowerList /></PrivateRoute>} />
  <Route path="/it/manpower-list/:id" element={<PrivateRoute allowedRoles={["IT"]}><ItManpowerRequestDetail /></PrivateRoute>} />

  {/* CEO */}
  <Route path="/ceo/proj" element={<PrivateRoute allowedRoles={["CEO"]}><CeoProj /></PrivateRoute>} />
  <Route path="/ceo/dash" element={<PrivateRoute allowedRoles={["CEO"]}><CeoDash /></PrivateRoute>} />
  <Route path="/ceo/addarea" element={<PrivateRoute allowedRoles={["CEO"]}><CeoAddArea /></PrivateRoute>} />
  <Route path="/ceo/proj/:id" element={<PrivateRoute allowedRoles={["CEO"]}><CeoViewSpecific /></PrivateRoute>} />
  <Route path="/ceo/material-list" element={<PrivateRoute allowedRoles={["CEO"]}><CeoMaterialList /></PrivateRoute>} />
  <Route path="/ceo/material-request/:id" element={<PrivateRoute allowedRoles={["CEO"]}><CeoMaterialRequestDetail /></PrivateRoute>} />
  <Route path="/ceo/audit-logs" element={<PrivateRoute allowedRoles={["CEO"]}><CeoAuditLogs /></PrivateRoute>} />

  {/* HR */}
  <Route path="/hr/dash" element={<PrivateRoute allowedRoles={["HR"]}><HrDash /></PrivateRoute>} />
  <Route path="/hr/mlist" element={<PrivateRoute allowedRoles={["HR"]}><HrManpowerList /></PrivateRoute>} />
  <Route path="/hr/movement" element={<PrivateRoute allowedRoles={["HR"]}><HrMovementList /></PrivateRoute>} />
  <Route path='/hr/project-records' element={<PrivateRoute allowedRoles={["HR"]}><HrProj /></PrivateRoute>} />

  {/* Reusable */}
  <Route path="/approve-deny/:id" element={<PrivateRoute allowedRoles={["Project Manager", "Area Manager", "CEO"]}><ApproveDenyAction /></PrivateRoute>} />
  <Route path="/progress-tracker/:id" element={<PrivateRoute allowedRoles={["Project Manager", "Area Manager", "CEO", "Person in Charge"]}><ProgressTracker /></PrivateRoute>} />
  
</Routes>
  );
};

export default AppRoutes;
