
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Pic_Dash from './pic/Pic_Dash';
import Pic_Req from './pic/Pic_Req';
import Pic_Chat from './pic/Pic_Chat';
import Pm_Dash from './pm/Pm_Dash';
import Pm_DailyReports from './pm/Pm_DailyReports';
import Pm_ViewProjects from './pm/Pm_ViewProjects';
import Pm_IncidentReport from './pm/Pm_IncidentReport';
import Pm_ManpowerRequest from './pm/Pm_ManpowerRequest';
const AppRoutes = () => {
  return (
    <Routes>
       <Route path="/" element={<Pm_ManpowerRequest />} />
       <Route path="/k" element={<Pm_IncidentReport />} />
           <Route path="/j" element={<Pm_ViewProjects />} />
       <Route path="/q" element={<Pm_DailyReports />} />
       <Route path="/c" element={<Pm_Dash />} />
      <Route path="/h" element={<Pic_Dash />} />
      <Route path="/chat" element={<Pic_Chat />} />
      <Route path="/material-request" element={<Pic_Req />} />
    </Routes>
  );
};

export default AppRoutes;
