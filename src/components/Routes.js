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
import Area_Viewall from './am/Area_Viewall';
import LoginPage from './Login';
import MaterialRequests from './am/Area_Material_Approval';
import AddProject from './am/Area_Addproj';
import AreasPage from './am/Area_Proj_Area';
import ITAdminPage from './it/It_Dash';
import Ceo_Proj from './ceo/Ceo_Proj';
import Ceo_ViewSpecific from './ceo/Ceo_ViewSpecific';
import Ceo_Dash from './ceo/Ceo_Dash';
import Ceo_Addproject from './ceo/Ceo_Addproj';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      {/* PROJECT MANAGER */}
      <Route path="/d" element={<PmManpowerRequest />} />
      <Route path="/k" element={<PmIncidentReport />} />
      <Route path="/j" element={<PmViewProjects />} />
      <Route path="/q" element={<PmDailyReports />} />
      <Route path="/pm" element={<PmDash />} />

      {/* PIC */}
      <Route path="/pic" element={<PicDash />} />
      <Route path="/chat" element={<PicChat />} />
      <Route path="/material-request" element={<PicReq />} />

      {/* HR */}
      {/* <Route path="/hraccounts" element = {<Hr_Accounts/>} />
      <Route path="/hrchat" element = {<Hr_Chat/>} />
      <Route path="/hrdash" element = {<Hr_Dash/>} />
      <Route path="/hrrecords" element = {<Hr_Rec/>} />
      <Route path="/hrprojects" element = {<Hr_Proj/>} /> */}

      {/* AREA */}
      <Route path="/am" element={<AreaManagerDashboard />} />
      <Route path="/am/viewall" element={<Area_Viewall />} />
      <Route path="/am/addproj" element={<AddProject />} />
      <Route path="/am/matreq" element={<MaterialRequests />} />
      <Route path="/am/viewproj" element={<AreasPage />} />

      {/* IT */}
      <Route path="/it" element={<ITAdminPage />} />

      {/* CEO */}
      <Route path="/ceo/proj" element={<Ceo_Proj />} />
      <Route path="/ceo/view" element={<Ceo_ViewSpecific />} />
      <Route path="/ceo/dash" element={<Ceo_Dash />} />
      <Route path="/ceo/addproj" element={<Ceo_Addproject />} />

    
    </Routes>
  );
};

export default AppRoutes;