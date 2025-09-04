import React from 'react';
import ProjectView from '../project/ProjectView';

// Minimal unified PIC wrapper. All PIC behavior handled inside ProjectView (roleConfigs.pic).
export default function PicProject() {
	return <ProjectView role="pic" useUnifiedHeader />;
}

export const PicCurrentProject = PicProject;

