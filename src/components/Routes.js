import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PicDash from './pic/PicDash';
import PicReq from './pic/PicReq';
import PicChat from './pic/PicChat';
import PmDash from './pm/PmDash';
import PmDailyReports from './pm/PmDailyReports';
import PmViewProjects from './pm/PmViewProjects';
import PmIncidentReport from './pm/PmIncidentReport';
import PmManpowerRequest from './pm/PmManpowerRequest';
import AreaManagerDashboard from './am/Area_Dash';
import Area_ViewAll from './am/Area_Viewall';
import LoginPage from './Login';
import Area_Manpower_List from './am/Area_Manpower_List'
import Area_Material_list from './am/Area_Material_List';
import AddProject from './am/Area_Addproj';
import AreasPage from './am/Area_Proj_Area';
import Ceo_Proj from './ceo/Ceo_Proj';
import Ceo_ViewSpecific from './ceo/Ceo_ViewSpecific';
import Ceo_Dash from './ceo/Ceo_Dash';
import Ceo_Addproject from './ceo/Ceo_Addproj';
import Pic_Dailylogs from './pic/Pic_Dailylogs';
import PrivateRoute from "./PrivateRoute";
import It_Dash from './it/It_Dash';
import Pic_Project from './pic/Pic_Project';
import Pic_MatReq from './pic/Pic_MatReq';
import Pm_ViewRequest from './pm/Pm_ViewRequest';
import Pm_MaterialRequestDetail from './pm/Pm_MatRequest';
import { Link } from 'react-router-dom';


import Hr_ManpowerList from './hr/Hr_ManpowerList';
import Hr_Dash from './hr/Hr_Dash';
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      {/* PROJECT MANAGER */}
      <Route path="/pm/material-request/:id" element={<Pm_MaterialRequestDetail />} />
      <Route path="/pm/request/:id" element={<Pm_ViewRequest />} />
      <Route path="/d" element={<PmManpowerRequest />} />
      <Route path="/k" element={<PmIncidentReport />} />
      <Route path="/j" element={<PmViewProjects />} />
      <Route path="/q" element={<PmDailyReports />} />
      <Route path="/pm" element={<PrivateRoute allowedRoles={["Project Manager"]}><PmDash /></PrivateRoute>}/>

      {/* PIC */}
      <Route path="/pic" element={<PicDash />} />
      <Route path="/chat" element={<PicChat />} />
      <Route path="/pic/request/:id" element={<PicReq />} />
      <Route path="/daily-logs" element={<Pic_Dailylogs />} />
      <Route path="/pic/:id" element={<Pic_Project />} />
      <Route path="/pic/projects/:projectId/request" element={<Pic_MatReq />} />

      {/* AREA */}
      <Route path="/am" element={<AreaManagerDashboard />} />
      <Route path="/am/viewall" element={<Area_ViewAll />} />
      <Route path="/am/addproj" element={<AddProject />} />
      <Route path="/am/matreq" element={<Area_Material_list />} />
      <Route path="/am/manreq" element={<Area_Manpower_List />} />
      <Route path="/am/viewproj" element={<AreasPage />} />

      {/* IT */}
      <Route path="/it" element={<PrivateRoute allowedRoles={["IT"]}><It_Dash /></PrivateRoute>}/>

      {/* CEO */}
      <Route path="/ceo/proj" element={<Ceo_Proj />} />
      <Route path="/ceo/dash" element={<Ceo_Dash />} />
      <Route path="/ceo/addproj" element={<Ceo_Addproject />} />
      <Route path="/ceo/proj/:id" element={<Ceo_ViewSpecific />} />

      {/* HR */}
      <Route path="/hr/dash" element={<Hr_Dash />} />
      <Route path="/hr/mlist" element={<Hr_ManpowerList />} />

    </Routes>
  );
};

export default AppRoutes;