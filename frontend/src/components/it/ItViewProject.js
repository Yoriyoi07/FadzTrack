import ProjectView from '../project/ProjectView';
import { FaTachometerAlt, FaComments, FaProjectDiagram, FaClipboardList } from 'react-icons/fa';

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

  // Custom navigation items for IT users (simplified)
  const navItems = [
    { to: '/it', icon: <FaTachometerAlt />, label: 'Dashboard' },
    { to: '/it/chat', icon: <FaComments />, label: 'Chat' },
    { to: '/it/material-list', icon: <FaClipboardList />, label: 'Materials' },
    { to: '/it/projects', icon: <FaProjectDiagram />, label: 'Projects', active: true }
  ];

  return <ProjectView role="it" navItems={navItems} navPathOverrides={overrides} />;
};

export default ItViewProject;
