import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/it_style/It_Dash.css';
import '../style/it_style/It_Projects.css';
import '../style/am_style/Area_Projects.css';
import NotificationBell from '../NotificationBell';
import { generateProjectPDF } from '../../utils/projectPdf';
import { 
  FaTachometerAlt, 
  FaComments, 
  FaBoxes, 
  FaUsers, 
  FaClipboardList, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSync,
  FaProjectDiagram,
  FaMapMarkerAlt,
  FaUserTie,
  FaBuilding,
  FaCalendarAlt,
  FaUsers as FaUsersIcon,
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaFilter,
  FaTh,
  FaList,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaEye,
  FaDownload
} from 'react-icons/fa';

const PAGE_SIZE = 8;
const emptyForm = { projectName:'', contractor:'', budget:'', location:'', startDate:'', endDate:'', status:'Ongoing', projectmanager:'', areamanager:'', area:'', pic:[], staff:[], hrsite:[], manpower:[] };

export default function ItProjects(){
  const navigate = useNavigate();
  const user = useMemo(()=> JSON.parse(localStorage.getItem('user')||'{}'), []);
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);
  const [isHeaderCollapsed,setIsHeaderCollapsed]=useState(false);
  const [userName,setUserName]=useState(user?.name||'');
  const [userRole,setUserRole]=useState(user?.role||'');
  const [projects,setProjects]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [showForm,setShowForm]=useState(false);
  const [formData,setFormData]=useState(emptyForm);
  const [editingId,setEditingId]=useState(null);
  const [saving,setSaving]=useState(false);
  const [allLocations,setAllLocations]=useState([]);
  const [usersByRole,setUsersByRole]=useState({});
  const [userLookup,setUserLookup]=useState({});
  const [showAudit,setShowAudit]=useState(false);
  const [auditLogs,setAuditLogs]=useState([]);
  const [auditLoading,setAuditLoading]=useState(false);
  const [auditProjectId,setAuditProjectId]=useState(null);
  const [allManpower,setAllManpower]=useState([]);
  const [validationErrors,setValidationErrors]=useState([]);
  const [docFiles,setDocFiles]=useState([]);
  const [photoFiles,setPhotoFiles]=useState([]);
  const [areasByManager,setAreasByManager]=useState({});
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Export functionality
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    status: 'all',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  
  // New state for AM-style layout
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(()=>{
    if(user?.role!== 'IT'){ setError('Forbidden'); setLoading(false); return; }
    load(); fetchLookups(); fetchManpower();
  },[]); // eslint-disable-line

  useEffect(()=>{ const onScroll=()=> setIsHeaderCollapsed((window.pageYOffset||document.documentElement.scrollTop)>50); window.addEventListener('scroll',onScroll); return ()=>window.removeEventListener('scroll',onScroll);},[]);
  useEffect(()=>{ const handler=e=>{ if(!e.target.closest('.user-profile')) setProfileMenuOpen(false); }; document.addEventListener('click',handler); return ()=>document.removeEventListener('click',handler);},[]);
  useEffect(()=>{ setUserName(user?.name||''); setUserRole(user?.role||'');},[user]);

  const handleLogout=()=>{ const token=localStorage.getItem('token'); api.post('/auth/logout',{}, {headers:{Authorization:`Bearer ${token}`}}).finally(()=>{localStorage.removeItem('token');localStorage.removeItem('user');navigate('/');});};

  async function load(){ setLoading(true); setError(''); try{ const {data}=await api.get('/projects'); setProjects(Array.isArray(data)?data:[]);}catch{ setError('Failed to load projects'); }finally{ setLoading(false);} }
  async function fetchLookups(){ 
    try{ 
      const [locRes, usersRes, areasRes]= await Promise.all([
        api.get('/locations'), 
        api.get('/auth/Users'),
        api.get('/areas')
      ]); 
      setAllLocations(locRes.data||[]); 
      const byRole={}; 
      const lookup={}; 
      const normRole=r=>{ if(!r) return r; return r.toLowerCase()==='pic'?'Person in Charge':r;}; 
      (usersRes.data||[]).forEach(u=>{ 
        const id=u._id||u.id; 
        if(!id) return; 
        const roleN=normRole(u.role||''); 
        if(!byRole[roleN]) byRole[roleN]=[]; 
        const rec={_id:String(id), name:u.name, role:roleN}; 
        byRole[roleN].push(rec); 
        lookup[String(id)]=u.name;
      }); 
      setUsersByRole(byRole); 
      setUserLookup(lookup);
      
      // Group areas by area manager
      const areasByAM = {};
      (areasRes.data || []).forEach(area => {
        if (area.areaManager) {
          const amId = area.areaManager._id || area.areaManager;
          if (!areasByAM[amId]) areasByAM[amId] = [];
          areasByAM[amId].push(area);
        }
      });
      setAreasByManager(areasByAM);
    }catch(e){console.error(e);} 
  }
  async function fetchManpower(){ try{ const {data}=await api.get('/manpower'); setAllManpower(Array.isArray(data)?data:[]);}catch{} }

  function openCreate(){ setEditingId(null); setFormData(emptyForm); setShowForm(true); }
  function openEdit(p){ setEditingId(p._id); setFormData({ projectName:p.projectName||'', contractor:p.contractor||'', budget:p.budget??'', location:p.location?._id||'', startDate:p.startDate? new Date(p.startDate).toISOString().slice(0,10):'', endDate:p.endDate? new Date(p.endDate).toISOString().slice(0,10):'', status:p.status||'Ongoing', projectmanager:p.projectmanager?._id||'', areamanager:p.areamanager?._id||'', area:p.area?._id||'', pic:(p.pic||[]).map(x=>String(x._id||x)), staff:(p.staff||[]).map(x=>String(x._id||x)), hrsite:(p.hrsite||[]).map(x=>String(x._id||x)), manpower:(p.manpower||[]).map(x=>String(x._id||x)) }); setShowForm(true); }
  function handleChange(e){ 
    const {name,value,multiple,options}=e.target; 
    if(multiple){ 
      const vals=Array.from(options).filter(o=>o.selected).map(o=>o.value); 
      setFormData(f=>({...f,[name]:vals})); 
    } else { 
      setFormData(f=>({...f,[name]:value})); 
      // Clear area when area manager changes
      if(name === 'areamanager') {
        setFormData(f=>({...f,[name]:value, area: ''}));
      }
    } 
  }
  function validate(form){ 
    const errs=[]; 
    if(!form.projectName.trim()) errs.push('Project name is required'); 
    if(!form.contractor.trim()) errs.push('Contractor is required');
    if(!form.location) errs.push('Location is required'); 
    if(!form.startDate) errs.push('Start date is required'); 
    if(!form.endDate) errs.push('End date is required'); 
    if(form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) errs.push('Start date must be before end date'); 
    if(!form.projectmanager) errs.push('Project Manager is required');
    if(!form.areamanager) errs.push('Area Manager is required');
    if(!form.area) errs.push('Area is required');
    if(!form.pic || form.pic.length === 0) errs.push('At least one PIC is required');
    if(!form.staff || form.staff.length === 0) errs.push('At least one Staff member is required');
    if(!form.hrsite || form.hrsite.length === 0) errs.push('At least one HR-Site member is required');
    if(!form.manpower || form.manpower.length === 0) errs.push('At least one Manpower is required');
    return errs; 
  }
  async function submitForm(e){ 
    e.preventDefault(); 
    setSaving(true); 
    const errs=validate(formData); 
    setValidationErrors(errs); 
    if(errs.length){ 
      setSaving(false); 
      return; 
    } 
    try{ 
      const payload={...formData}; 
      if(payload.budget==='') delete payload.budget; 
      else payload.budget=Number(payload.budget); 
      ['projectmanager','areamanager','area'].forEach(k=>{ if(!payload[k]) delete payload[k]; }); 
      
      let createdProject;
      if(!editingId && (docFiles.length||photoFiles.length)){ 
        const fd=new FormData(); 
        Object.entries(payload).forEach(([k,v])=>{ 
          if(Array.isArray(v)) v.forEach(val=>fd.append(k,val)); 
          else fd.append(k,v); 
        }); 
        photoFiles.forEach(f=>fd.append('photos',f)); 
        docFiles.forEach(f=>fd.append('documents',f)); 
        const response = await api.post('/projects', fd, {headers:{'Content-Type':'multipart/form-data'}});
        createdProject = response.data;
      } else if(editingId){ 
        await api.patch(`/projects/${editingId}`, payload); 
      } else { 
        const response = await api.post('/projects', payload);
        createdProject = response.data;
      } 
      
      // Create group chat for new projects
      if (!editingId && createdProject) {
        try {
          // Collect all assigned user IDs
          const allUserIds = [];
          if (payload.projectmanager) allUserIds.push(payload.projectmanager);
          if (payload.areamanager) allUserIds.push(payload.areamanager);
          if (payload.pic && payload.pic.length > 0) allUserIds.push(...payload.pic);
          if (payload.staff && payload.staff.length > 0) allUserIds.push(...payload.staff);
          if (payload.hrsite && payload.hrsite.length > 0) allUserIds.push(...payload.hrsite);
          
          // Remove duplicates
          const uniqueUserIds = [...new Set(allUserIds)];
          
          // Create group chat if there are users to add
          if (uniqueUserIds.length > 0) {
            await api.post('/chats', {
              name: payload.projectName,
              users: uniqueUserIds,
              isGroup: true
            });
            setSuccessMessage(`Project "${payload.projectName}" created successfully! A group chat has been created with all assigned team members.`);
          } else {
            setSuccessMessage(`Project "${payload.projectName}" created successfully!`);
          }
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 5000); // Hide after 5 seconds
        } catch (chatError) {
          console.error('Failed to create group chat:', chatError);
          setSuccessMessage(`Project "${payload.projectName}" created successfully! (Note: Group chat creation failed)`);
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 5000);
        }
      } else if (editingId) {
        setSuccessMessage(`Project updated successfully!`);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
      
      setShowForm(false); 
      await load();
    }catch{ 
      alert('Save failed'); 
    } finally{ 
      setSaving(false);
    } 
  }
  async function remove(id){ if(!window.confirm('Delete this project? This cannot be undone.')) return; try{ await api.delete(`/projects/${id}`); setProjects(prev=>prev.filter(p=>p._id!==id)); }catch{ alert('Delete failed'); } }
  async function loadAudit(projectId){ setAuditLoading(true); setAuditProjectId(projectId); try{ const {data}=await api.get('/audit-logs',{params:{projectId}}); setAuditLogs(data||[]);}catch{ setAuditLogs([]);} finally{ setAuditLoading(false); setShowAudit(true);} }

  // Export function
  const exportProjects = () => {
    // Filter projects based on export filters
    const filteredProjects = projects.filter(project => {
      // Status filter
      if (exportFilters.status !== 'all') {
        if (exportFilters.status === 'completed' && project.status !== 'Completed') return false;
        if (exportFilters.status === 'ongoing' && !['Ongoing', 'On Going'].includes(project.status)) return false;
        if (exportFilters.status === 'pending' && !['Pending', 'Not Started'].includes(project.status)) return false;
      }
      
      // Search filter
      if (exportFilters.search) {
        const searchLower = exportFilters.search.toLowerCase();
        const matches = (
          project.projectName?.toLowerCase().includes(searchLower) ||
          project.location?.name?.toLowerCase().includes(searchLower) ||
          project.projectmanager?.name?.toLowerCase().includes(searchLower) ||
          project.contractor?.toLowerCase().includes(searchLower)
        );
        if (!matches) return false;
      }
      
      // Date range filter
      if (exportFilters.dateFrom || exportFilters.dateTo) {
        const startDate = project.startDate ? new Date(project.startDate) : null;
        if (exportFilters.dateFrom && startDate && startDate < new Date(exportFilters.dateFrom)) return false;
        if (exportFilters.dateTo && startDate && startDate > new Date(exportFilters.dateTo)) return false;
      }
      
      return true;
    });

    // Generate PDF content
    const pdfContent = {
      companyName: 'FadzTrack',
      companyLogo: require('../../assets/images/FadzLogo1.png'),
      exportedBy: userName,
      exportDate: new Date().toLocaleDateString(),
      filters: exportFilters,
      projects: filteredProjects.map(project => ({
        name: project.projectName,
        area: project.location?.name || 'N/A',
        pm: project.projectmanager?.name || 'N/A',
        contractor: project.contractor || 'N/A',
        timeline: `${project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'} - ${project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}`,
        pics: Array.isArray(project.pic) ? project.pic.map(p => p.name).join(', ') : 'N/A',
        budget: project.budget ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.budget) : 'N/A'
      }))
    };

    // Create and download PDF
    generateProjectPDF(pdfContent);
    setShowExportModal(false);
  };

  // Apply filters and search (AM-style)
  const displayedProjects = projects
    .filter(project => {
      // Status filter
      if (filter === 'completed') {
        return project.status === 'Completed';
      }
      if (filter === 'ongoing') {
        return project.status === 'Ongoing' || project.status === 'On Going';
      }
      if (filter === 'pending') {
        return project.status === 'Pending' || project.status === 'Not Started';
      }
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          project.projectName?.toLowerCase().includes(searchLower) ||
          project.location?.name?.toLowerCase().includes(searchLower) ||
          project.projectmanager?.name?.toLowerCase().includes(searchLower) ||
          project.contractor?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.projectName || '';
          bValue = b.projectName || '';
          break;
        case 'location':
          aValue = a.location?.name || '';
          bValue = b.location?.name || '';
          break;
        case 'manager':
          aValue = a.projectmanager?.name || '';
          bValue = b.projectmanager?.name || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'startDate':
          aValue = new Date(a.startDate || 0);
          bValue = new Date(b.startDate || 0);
          break;
        default:
          aValue = a.projectName || '';
          bValue = b.projectName || '';
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#10B981';
      case 'ongoing':
      case 'on going':
        return '#3B82F6';
      case 'pending':
      case 'not started':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <FaCheckCircle />;
      case 'ongoing':
      case 'on going':
        return <FaClock />;
      case 'pending':
      case 'not started':
        return <FaClock />;
      default:
        return <FaClock />;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Modern Header */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        {/* Top Row: Logo and Profile */}
        <div className="header-top">
          <div className="logo-section" onClick={() => navigate('/it')} style={{ cursor: 'pointer' }}>
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="header-logo"
            />
            <h1 className="header-brand">FadzTrack</h1>
          </div>

          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">
              {userName ? userName.charAt(0).toUpperCase() : 'I'}
            </div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn">
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Navigation */}
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/it" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/it/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/it/material-list" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Materials</span>
            </Link>
            <Link to="/it/manpower-list" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            <Link to="/it/auditlogs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Audit Logs</span>
            </Link>
            <Link to="/it/projects" className="nav-item active">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Projects</span>
            </Link>
          </nav>

          <NotificationBell />
        </div>
      </header>

             {/* Main Content */}
       <main className="dashboard-main">
         {/* Success Message */}
         {showSuccessMessage && (
           <div className="success-message" style={{
             position: 'fixed',
             top: '20px',
             right: '20px',
             background: 'linear-gradient(135deg, #10B981, #059669)',
             color: 'white',
             padding: '15px 20px',
             borderRadius: '8px',
             boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
             zIndex: 1000,
             maxWidth: '400px',
             fontSize: '14px',
             lineHeight: '1.4'
           }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <FaCheckCircle style={{ fontSize: '18px' }} />
               <span>{successMessage}</span>
             </div>
           </div>
         )}
         
         <div className="projects-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">Projects</h1>
              <p className="page-subtitle">Manage and monitor all projects in the system</p>
            </div>
            <div className="page-actions">
              <button className="export-btn" onClick={() => setShowExportModal(true)}>
                <FaDownload />
                Export Projects
              </button>
              <button className="add-project-btn" onClick={openCreate}>
                <FaPlus />
                New Project
              </button>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="projects-controls">
            <div className="controls-left">
              {/* Search */}
              <div className="search-container">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Status Filter */}
              <div className="filter-group">
                <button
                  className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All ({projects.length})
                </button>
                <button
                  className={`filter-btn ${filter === 'ongoing' ? 'active' : ''}`}
                  onClick={() => setFilter('ongoing')}
                >
                  Ongoing ({projects.filter(p => p.status === 'Ongoing' || p.status === 'On Going').length})
                </button>
                <button
                  className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                  onClick={() => setFilter('completed')}
                >
                  Completed ({projects.filter(p => p.status === 'Completed').length})
                </button>
                <button
                  className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                  onClick={() => setFilter('pending')}
                >
                  Pending ({projects.filter(p => p.status === 'Pending' || p.status === 'Not Started').length})
                </button>
              </div>
            </div>

            <div className="controls-right">
              {/* Sort */}
              <div className="sort-container">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="name">Sort by Name</option>
                  <option value="location">Sort by Location</option>
                  <option value="manager">Sort by Manager</option>
                  <option value="status">Sort by Status</option>
                  <option value="startDate">Sort by Start Date</option>
                </select>
                <button
                  className="sort-order-btn"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />}
                </button>
              </div>

              {/* View Mode */}
              <div className="view-mode-container">
                <button
                  className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <FaTh />
                </button>
                <button
                  className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <FaList />
                </button>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="error-state">
              <FaClock />
              <span>{error}</span>
              <button onClick={() => window.location.reload()} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {/* Projects Grid/List */}
          {!error && (
            <div className={`projects-display ${viewMode}`}>
              {displayedProjects.length === 0 ? (
                <div className="empty-state">
                  <FaProjectDiagram />
                  <h3>No projects found</h3>
                  <p>
                    {searchTerm || filter !== 'all' 
                      ? 'Try adjusting your search or filters'
                      : 'No projects available in the system'
                    }
                  </p>
                  {!searchTerm && filter === 'all' && (
                    <button className="add-project-btn" onClick={openCreate}>
                      Add Your First Project
                    </button>
                  )}
                </div>
              ) : (
                displayedProjects.map(project => (
                  <div
                    key={project._id}
                    className="project-card"
                  >
                    {/* Project Image */}
                    <div className="project-image-container">
                      <img
                        src={project.photos && project.photos.length > 0
                          ? project.photos[0]
                          : 'https://placehold.co/400x250?text=No+Photo'}
                        alt={project.projectName}
                        className="project-image"
                      />
                      <div className="project-status-badge" style={{ backgroundColor: getStatusColor(project.status) }}>
                        {getStatusIcon(project.status)}
                        <span>{project.status || 'Unknown'}</span>
                      </div>
                      
                      {/* Hover Action Buttons */}
                      <div className="project-actions">
                        <button 
                          className="action-btn view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/it/projects/${project._id}`);
                          }}
                          title="View Project"
                        >
                          <FaEye />
                        </button>
                        <button 
                          className="action-btn edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(project);
                          }}
                          title="Edit Project"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="action-btn audit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadAudit(project._id);
                          }}
                          title="Audit Trail"
                        >
                          🕑
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(project._id);
                          }}
                          title="Delete Project"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>

                    {/* Project Content */}
                    <div className="project-content">
                      <div className="project-header">
                        <h3 className="project-name">{project.projectName}</h3>
                        <div className="project-location">
                          <FaMapMarkerAlt />
                          <span>{project.location?.name || 'No Location'}</span>
                        </div>
                      </div>

                      <div className="project-details">
                        <div className="detail-item">
                          <FaUserTie className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Project Manager</span>
                            <span className="detail-value">{project.projectmanager?.name || 'Not Assigned'}</span>
                          </div>
                        </div>

                        <div className="detail-item">
                          <FaBuilding className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Contractor</span>
                            <span className="detail-value">{project.contractor || 'Not Assigned'}</span>
                          </div>
                        </div>

                        <div className="detail-item">
                          <FaCalendarAlt className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Timeline</span>
                            <span className="detail-value">
                              {project.startDate && project.endDate
                                ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}`
                                : 'Not Set'
                              }
                            </span>
                          </div>
                        </div>

                        <div className="detail-item">
                          <FaUsersIcon className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Manpower</span>
                            <span className="detail-value">
                              {Array.isArray(project.manpower) && project.manpower.length > 0
                                ? `${project.manpower.length} assigned`
                                : 'No manpower assigned'
                              }
                            </span>
                          </div>
                        </div>

                        {project.budget && (
                          <div className="detail-item">
                            <FaMoneyBillWave className="detail-icon" />
                            <div className="detail-content">
                              <span className="detail-label">Budget</span>
                              <span className="detail-value">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'USD'
                                }).format(project.budget)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showForm && (
        <div className="modal-overlay" onClick={e=>{ if(e.target.classList.contains('modal-overlay')) setShowForm(false);}}>
          <div className="modal-card large" style={{maxWidth:900}}>
            <h2 style={{marginTop:0}}>{editingId?'Edit Project':'Create Project'}</h2>
            {validationErrors.length>0 && <div className="alert error" style={{marginBottom:'0.5rem'}}>{validationErrors.map((er,i)=><div key={i}>{er}</div>)}</div>}
            <form onSubmit={submitForm} className="grid-2col gap-md" style={{maxHeight:'70vh',overflow:'auto',paddingRight:8}}>
              <fieldset className="section">
                <legend>Core</legend>
                <label>Project Name<input name="projectName" value={formData.projectName} onChange={handleChange} required/></label>
                <label>Contractor<input name="contractor" value={formData.contractor} onChange={handleChange}/></label>
                <label>Budget<input name="budget" type="number" min="0" value={formData.budget} onChange={handleChange}/></label>
                <label>Status<select name="status" value={formData.status} onChange={handleChange}><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option></select></label>
                <label>Location<select name="location" value={formData.location} onChange={handleChange} required><option value="">-- select --</option>{allLocations.map(l=> <option key={l._id} value={l._id}>{l.name} {l.region?`(${l.region})`:''}</option>)}</select></label>
                <label>Start Date<input name="startDate" type="date" value={formData.startDate} onChange={handleChange} required/></label>
                <label>End Date<input name="endDate" type="date" value={formData.endDate} onChange={handleChange} required/></label>
              </fieldset>
              <fieldset className="section">
                <legend>Assignments</legend>
                <label>Project Manager<select name="projectmanager" value={formData.projectmanager} onChange={handleChange}><option value="">-- none --</option>{(usersByRole['Project Manager']||[]).map(u=> <option key={u._id} value={u._id}>{u.name}</option>)}</select></label>
                <label>Area Manager<select name="areamanager" value={formData.areamanager} onChange={handleChange}><option value="">-- none --</option>{(usersByRole['Area Manager']||[]).map(u=> <option key={u._id} value={u._id}>{u.name}</option>)}</select></label>
                <label>Area<select name="area" value={formData.area} onChange={handleChange} required><option value="">-- select area --</option>{formData.areamanager && areasByManager[formData.areamanager] ? areasByManager[formData.areamanager].map(area=> <option key={area._id} value={area._id}>{area.name}</option>) : []}</select></label>
                <label>PIC(s)<MultiBox name="pic" values={formData.pic} options={usersByRole['Person in Charge']||[]} userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,pic:vals}))}/></label>
                <label>Staff<MultiBox name="staff" values={formData.staff} options={usersByRole['Staff']||[]} userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,staff:vals}))}/></label>
                <label>HR - Site<MultiBox name="hrsite" values={formData.hrsite} options={usersByRole['HR - Site']||[]} userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,hrsite:vals}))}/></label>
                <label>Manpower<MultiBox name="manpower" values={formData.manpower} options={allManpower} labelKey="name" idKey="_id" userLookup={userLookup} onChange={vals=>setFormData(f=>({...f,manpower:vals}))}/></label>
              </fieldset>
              {!editingId && <fieldset className="section" style={{gridColumn:'1 / -1'}}>
                <legend>Initial Files (optional)</legend>
                <div className="flex-row gap-sm">
                  <label className="uploader">Photos <input type="file" multiple accept="image/*" onChange={e=> setPhotoFiles(Array.from(e.target.files||[]))}/></label>
                  <label className="uploader">Documents <input type="file" multiple onChange={e=> setDocFiles(Array.from(e.target.files||[]))}/></label>
                </div>
                <small>{photoFiles.length} photo(s), {docFiles.length} document(s) selected</small>
              </fieldset>}
              <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',gap:'0.5rem',marginTop:'0.5rem'}}>
                <button type="button" onClick={()=>setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" disabled={saving}>{saving?'Saving...':'Save Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAudit && (
        <div className="modal-overlay" onClick={e=>{ if(e.target.classList.contains('modal-overlay')) setShowAudit(false);}}>
          <div className="modal-card" style={{maxWidth:900}}>
            <h2 style={{marginTop:0}}>Audit Trail {auditProjectId && `for ${auditProjectId}`}</h2>
            <button style={{position:'absolute',top:8,right:8}} onClick={()=>setShowAudit(false)}>Close</button>
            {auditLoading && <p>Loading audit logs...</p>}
            {!auditLoading && <div style={{maxHeight:400,overflow:'auto'}}>
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Description</th>
                    <th>Changed Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(l=> <tr key={l._id}>
                    <td>{new Date(l.timestamp).toLocaleString()}</td>
                    <td>{l.action}</td>
                    <td>{l.performedBy?.name || '—'}</td>
                    <td>{l.performedByRole}</td>
                    <td style={{minWidth:180}}>{l.description}</td>
                    <td style={{minWidth:220}}>
                      {(l.meta?.changedFields||[]).length===0 && '—'}
                      {(l.meta?.changedFields||[]).map((c,i)=><div key={i} style={{marginBottom:2}}><strong>{c.field}:</strong> <span style={{color:'#888'}}>{JSON.stringify(c.before)}</span> → <span>{JSON.stringify(c.after)}</span></div>)}
                    </td>
                  </tr>)}
                  {auditLogs.length===0 && !auditLoading && <tr><td colSpan={6} style={{textAlign:'center'}}>No logs</td></tr>}
                </tbody>
              </table>
            </div>}
          </div>
        </div>
      )}
      
      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={e => { if(e.target.classList.contains('modal-overlay')) setShowExportModal(false); }}>
          <div className="modal-card" style={{maxWidth: 600}}>
            <h2 style={{marginTop: 0}}>Export Projects</h2>
            <button style={{position: 'absolute', top: 8, right: 8}} onClick={() => setShowExportModal(false)}>Close</button>
            
            <div className="export-filters">
              <h3>Filter Options</h3>
              
              <div className="filter-row">
                <label>Status Filter:</label>
                <select 
                  value={exportFilters.status} 
                  onChange={e => setExportFilters(prev => ({...prev, status: e.target.value}))}
                >
                  <option value="all">All Projects</option>
                  <option value="ongoing">Ongoing Only</option>
                  <option value="completed">Completed Only</option>
                  <option value="pending">Pending Only</option>
                </select>
              </div>
              
              <div className="filter-row">
                <label>Search:</label>
                <input 
                  type="text" 
                  placeholder="Search by name, location, PM, or contractor..."
                  value={exportFilters.search}
                  onChange={e => setExportFilters(prev => ({...prev, search: e.target.value}))}
                />
              </div>
              
              <div className="filter-row">
                <label>Date Range:</label>
                <div className="date-inputs">
                  <input 
                    type="date" 
                    placeholder="From Date"
                    value={exportFilters.dateFrom}
                    onChange={e => setExportFilters(prev => ({...prev, dateFrom: e.target.value}))}
                  />
                  <span>to</span>
                  <input 
                    type="date" 
                    placeholder="To Date"
                    value={exportFilters.dateTo}
                    onChange={e => setExportFilters(prev => ({...prev, dateTo: e.target.value}))}
                  />
                </div>
              </div>
              
              <div className="filter-summary">
                <h4>Export Summary:</h4>
                <p>Status: {exportFilters.status === 'all' ? 'All Projects' : exportFilters.status.charAt(0).toUpperCase() + exportFilters.status.slice(1)}</p>
                {exportFilters.search && <p>Search: "{exportFilters.search}"</p>}
                {exportFilters.dateFrom && <p>From Date: {exportFilters.dateFrom}</p>}
                {exportFilters.dateTo && <p>To Date: {exportFilters.dateTo}</p>}
              </div>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem'}}>
              <button onClick={() => setShowExportModal(false)}>Cancel</button>
              <button onClick={exportProjects} style={{background: '#3b82f6', color: 'white'}}>
                Export to PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function MultiBox({ name, values, options, onChange, labelKey='name', idKey='_id', userLookup }) {
  const [input,setInput] = React.useState('');
  const filtered = (options||[]).filter(o=> (o[labelKey]||'').toLowerCase().includes(input.toLowerCase()));
  function toggle(id){ onChange(values.includes(id)? values.filter(v=>v!==id) : [...values,id]); }
  return <div className="multibox">
    <input placeholder="Filter..." value={input} onChange={e=>setInput(e.target.value)} />
    <div className="box-list">
      {filtered.map(o=> <div key={o[idKey]} className={values.includes(o[idKey])? 'box-item selected':'box-item'} onClick={()=>toggle(o[idKey])}>{o[labelKey]||o[idKey]}</div>)}
      {filtered.length===0 && (options||[]).length>0 && <div className="empty">No matches</div>}
      {(options||[]).length===0 && <div className="empty">Loading...</div>}
    </div>
    <div className="chips">
      {values.map(v=> {
        const obj = options.find(o=>o[idKey]===v);
        const name = obj ? (obj[labelKey]) : (userLookup ? userLookup[v] : null);
        return <span key={v} className="chip" onClick={()=>toggle(v)}>{name || v} ×</span>;
      })}
    </div>
  </div>;
}
