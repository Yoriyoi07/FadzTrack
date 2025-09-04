// Unified StaffCurrentProject now reuses generic ProjectView.
import React from 'react';
import ProjectView from '../project/ProjectView';
import AppHeader from '../layout/AppHeader';

// Use the same pattern as HrSiteCurrentProject: let ProjectView render layout once.
// Passing customHeader avoids nesting two headers and multiple scroll containers.
export default function StaffCurrentProject(){
  return (
    <ProjectView
      role="staff"
      useUnifiedHeader={true}
      customHeader={<AppHeader roleSegment="staff" />}
    />
  );
}
