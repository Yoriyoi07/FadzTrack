import React from 'react';
import ProjectView from '../project/ProjectView';
import AppHeader from '../layout/AppHeader';

// PM role wrapper pointing to the reusable ProjectView component
export default function PmViewProjects(){
  return (
    <>
      <AppHeader roleSegment="pm" />
      <ProjectView role="pm" useUnifiedHeader />
    </>
  );
}

