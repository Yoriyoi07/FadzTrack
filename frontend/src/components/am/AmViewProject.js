import React from 'react';
import ProjectView from '../project/ProjectView';
import { useParams } from 'react-router-dom';

export default function AmViewProject(){
	const { id } = useParams();
	const overrides = {
		'View Project': `/am/projects/${id}`,
		'Reports': `/am/progress-report/${id}`
	};
	return <ProjectView role="am" navPathOverrides={overrides} />;
}
