// Unified StaffCurrentProject now reuses generic ProjectView.
import React from 'react';
import ProjectView from '../project/ProjectView';
import AppHeader from '../layout/AppHeader';

export default function StaffCurrentProject(){
  return (
    <div className="dashboard-container staff-view-root">
      <AppHeader roleSegment="staff" />
      <main className="dashboard-main">
        <ProjectView role="staff" useUnifiedHeader={true} />
      </main>
    </div>
  );
}
