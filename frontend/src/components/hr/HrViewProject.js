import React from 'react';
import ProjectView from '../project/ProjectView';
import { useParams } from 'react-router-dom';

// HR wrapper ensuring the unified HR AppHeader is used (same header as other HR pages)
export default function HrViewProject(){
	const { id } = useParams();
	const overrides = {
		'View Project': `/hr/project-records/${id}`,
		'Reports': `/hr/progress-report/${id}`
	};
	return (
		<ProjectView
			role="hr"
			navPathOverrides={overrides}
			useUnifiedHeader
		/>
	);
}
