import React from 'react';
import ProjectView from '../project/ProjectView';
import { useParams } from 'react-router-dom';

export default function CeoViewProject(){
	const { id } = useParams();
	const overrides = {
		'View Project': `/ceo/proj/${id}`,
		'Reports': `/ceo/progress-report/${id}`
	};
	return <ProjectView role="ceo" navPathOverrides={overrides} useUnifiedHeader={true} />;
}
