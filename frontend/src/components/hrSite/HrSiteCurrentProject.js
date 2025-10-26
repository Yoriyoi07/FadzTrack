import React from 'react';
import AppHeader from '../layout/AppHeader';
import ProjectView from '../project/ProjectView';

export default function HrSiteCurrentProject(){
  //yes
  return (
    <ProjectView
      role="hrsite"
      useUnifiedHeader={true}
      customHeader={<AppHeader roleSegment="hrsite" />}
    />
  );
}
