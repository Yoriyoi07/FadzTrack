import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PicDash from './pic/PicDash';
import PicReq from './pic/PicReq';
import PicChat from './pic/PicChat';
import PmDash from './pm/PmDash';
import PmDailyReports from './pm/PmDailyReports';
import PmIncidentReport from './pm/PmIncidentReport';
import Pm_RequestManpower from './pm/Pm_RequestManpower';
import AreaManagerDashboard from './am/Area_Dash';
import LoginPage from './Login';
import Area_Manpower_List from './am/Area_Manpower_List'
import Area_Material_list from './am/Area_Material_List';
import AddProject from './am/Area_Addproj';
import AreasPage from './am/Area_Proj_Area';
import Ceo_Proj from './ceo/Ceo_Proj';
import Ceo_ViewSpecific from './ceo/Ceo_ViewSpecific';
import Ceo_Dash from './ceo/Ceo_Dash';
import Ceo_AddArea from './ceo/Ceo_AddArea';
import PrivateRoute from "./PrivateRoute";
import It_Dash from './it/It_Dash';
import Pic_Project from './pic/Pic_Project';
import Pic_MatReq from './pic/Pic_MatReq';
import Pm_MatRequestList from './pm/Pm_MatRequestList';
import Ceo_Material_List from './ceo/Ceo_Material_List';
import Ceo_MaterialRequestDetail from './ceo/Ceo_MaterialRequestDetail';
import Pm_MaterialRequestDetail from './pm/Pm_MatRequestDetail';
import ApproveDenyAction from './ApproveDenyActions';
import Pm_Manpower_List from './pm/Pm_Manpower_List';
import { Link } from 'react-router-dom';
import Area_Manpower_ReqDetails from './am/Area_Manpower_ReqDetails';
import Hr_ManpowerList from './hr/Hr_ManpowerList';
import Hr_Dash from './hr/Hr_Dash';
import Area_Manpower_Request_List from './am/Area_Manpower_Request_List';
import PmViewProjects from './pm/PmViewProjects';
import Pm_RequestedManpowerDetail from './pm/Pm_RequestedManpowerDetail';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      {/* PROJECT MANAGER */}
      <Route path="/pm/material-request/:id" element={<Pm_MaterialRequestDetail />} />
      <Route path="/pm/request/:id" element={<Pm_MatRequestList />} />
      <Route path="/pm/request-manpower" element={<Pm_RequestManpower />} />
      <Route path="/pm/manpower-request/:id" element={<Pm_RequestedManpowerDetail />} />
      <Route path="/pm/request-manpower/edit/:id" element={<Pm_RequestManpower />} />
      <Route path="/pm/manpower-list" element={<Pm_Manpower_List />} />
      <Route path="/pm/request-manpower/edit/:id" element={<Pm_RequestManpower />} />
      <Route path="/k" element={<PmIncidentReport />} />
      <Route path="/q" element={<PmDailyReports />} />
      <Route path="/pm" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmDash /></PrivateRoute>}/>
      <Route path="/pm/viewprojects/:id" element={<PmViewProjects />} />

      {/* PIC */}
      <Route path="/pic" element={<PicDash />} />
      <Route path="/chat" element={<PicChat />} />
      <Route path="/pic/request/:id" element={<PicReq />} />
      <Route path="/pic/:id" element={<Pic_Project />} />
      <Route path="/pic/projects/:projectId/request" element={<Pic_MatReq />} />

      {/* AREA */}
      <Route path="/am" element={<AreaManagerDashboard />} />
      <Route path="/am/addproj" element={<AddProject />} />
      <Route path="/am/matreq" element={<Area_Material_list />} />
      <Route path="/am/manpower-requests" element={<Area_Manpower_List />} />
      <Route path="/am/viewproj" element={<AreasPage />} />
      <Route path="/am/viewproj/:id" element={<AreasPage />} />
      <Route path="/am/manpower-requests/:id" element={<Area_Manpower_ReqDetails />} />

      {/* IT */}
      <Route path="/it" element={<PrivateRoute allowedRoles={["IT"]}><It_Dash /></PrivateRoute>}/>

      {/* CEO */}
      <Route path="/ceo/proj" element={<Ceo_Proj />} />
      <Route path="/ceo/dash" element={<Ceo_Dash />} />
      <Route path="/ceo/addarea" element={<Ceo_AddArea />} />
      <Route path="/ceo/proj/:id" element={<Ceo_ViewSpecific />} />
      <Route path="/ceo/material-list" element={<Ceo_Material_List />} />
      <Route path="/ceo/material-request/:id" element={<Ceo_MaterialRequestDetail />} />

      {/* HR */}
      <Route path="/hr/dash" element={<Hr_Dash />} />
      <Route path="/hr/mlist" element={<Hr_ManpowerList />} />

      {/*Reusable*/}
      <Route path="/approve-deny/:id" element={<ApproveDenyAction />} />
    </Routes>
  );
};

export default AppRoutes;