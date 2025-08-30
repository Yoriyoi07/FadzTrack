import React from 'react';
import ProjectView from '../project/ProjectView';
import { useParams } from 'react-router-dom';

export default function HrViewProject(){
	const { id } = useParams();
	const overrides = {
		'View Project': `/hr/project-records/${id}`,
		'Reports': `/hr/progress-report/${id}`
	};
	return <ProjectView role="hr" navPathOverrides={overrides} />;
}
