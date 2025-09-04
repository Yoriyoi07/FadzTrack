import React from 'react';
import ProjectView from '../project/ProjectView';
import { useParams } from 'react-router-dom';
import AppHeader from '../layout/AppHeader';

// Area Manager wrapper using unified AppHeader
export default function AmViewProject(){
	const { id } = useParams();
	const overrides = {
		dashboard: '/am',
		projects: '/am/viewproj',
		chat: '/am/chat',
		materials: '/am/matreq',
		manpower: '/am/manpower-requests'
	};
	const reportOverrides = {
		'View Project': `/am/projects/${id}`,
		'Reports': `/am/progress-report/${id}`
	};
	return (
		<ProjectView
			role="am"
			useUnifiedHeader={true}
			navPathOverrides={{ ...overrides, ...reportOverrides }}
			customHeader={<AppHeader roleSegment="am" />}
		/>
	);
}
