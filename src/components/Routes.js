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
import LoginPage from './Login';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/d" element={<PmManpowerRequest />} />
      <Route path="/k" element={<PmIncidentReport />} />
      <Route path="/j" element={<PmViewProjects />} />
      <Route path="/q" element={<PmDailyReports />} />
      <Route path="/c" element={<PmDash />} />
      <Route path="/h" element={<PicDash />} />
      <Route path="/chat" element={<PicChat />} />
      <Route path="/material-request" element={<PicReq />} />
    </Routes>
  );
};

export default AppRoutes;