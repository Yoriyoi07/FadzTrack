import React from 'react';
import ProjectView from '../project/ProjectView';

// PM role wrapper pointing to the reusable ProjectView component
export default function PmViewProjects(){
  return <ProjectView role="pm" />;
}

