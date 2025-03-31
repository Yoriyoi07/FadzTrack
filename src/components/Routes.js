
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Pic_Dash from './pic/Pic_Dash';
import Pic_Req from './pic/Pic_Req';
import Pic_Chat from './pic/Pic_Chat';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Pic_Dash />} />
      <Route path="/chat" element={<Pic_Chat />} />
      <Route path="/material-request" element={<Pic_Req />} />
    </Routes>
  );
};

export default AppRoutes;
