import ProjectView from '../project/ProjectView';
import { FaTachometerAlt, FaComments, FaProjectDiagram, FaClipboardList } from 'react-icons/fa';
import AppHeader from '../layout/AppHeader';

// IT role wrapper pointing to the reusable ProjectView component
const ItViewProject = () => {
  const overrides = {
    dashboard: '/it',
    projects: '/it/projects',
    chat: '/it/chat',
    materials: '/it/material-list',
    manpower: '/it/manpower-list',
    audit: '/it/auditlogs'
  };

  // Use unified header; let ProjectView build default nav with useUnifiedHeader flag
  return <ProjectView role="it" useUnifiedHeader={true} navPathOverrides={overrides} customHeader={<AppHeader roleSegment="it" />} />;
};

export default ItViewProject;
