import React from 'react';
import AppHeader from '../layout/AppHeader';
import ProjectView from '../project/ProjectView';

export default function HrSiteCurrentProject(){
  return (
    <div className="dashboard-container hr-site-view-root">
      <AppHeader roleSegment="hrsite" />
      <main className="dashboard-main">
        <ProjectView role="hrsite" useUnifiedHeader={true} />
      </main>
    </div>
  );
}
