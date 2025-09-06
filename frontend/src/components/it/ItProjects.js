import React, { useEffect, useState, useMemo, useDeferredValue } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import Papa from 'papaparse';
import '../style/it_style/It_Dash.css';
import '../style/it_style/It_Projects.css';
import '../style/am_style/Area_Projects.css';
import NotificationBell from '../NotificationBell';
import { generateProjectPDF } from '../../utils/projectPdf';
import AppHeader from '../layout/AppHeader';
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

// Removed legacy PAGE_SIZE (now using dynamic pageSize state)
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
  // Removed legacy search & page state (superseded by unified layout states below)
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
  
  // CSV functionality
  const [csvError, setCsvError] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  
  // Export functionality
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    status: 'all',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  // Live preview list of projects matching export filters
  const exportPreview = useMemo(()=>{
    return projects.filter(project => {
      if (exportFilters.status !== 'all') {
        const st = (project.status || '').toLowerCase();
        if (exportFilters.status === 'completed' && st !== 'completed') return false;
        if (exportFilters.status === 'ongoing' && !['ongoing','on going'].includes(st)) return false;
        if (exportFilters.status === 'pending' && !['pending','not started'].includes(st)) return false;
      }
      if (exportFilters.search) {
        const q = exportFilters.search.toLowerCase();
        const match = [project.projectName, project.location?.name, project.projectmanager?.name, project.contractor]
          .some(v => (v || '').toLowerCase().includes(q));
        if (!match) return false;
      }
      if (exportFilters.dateFrom) {
        const sd = project.startDate ? new Date(project.startDate) : null;
        if (sd && sd < new Date(exportFilters.dateFrom)) return false;
      }
      if (exportFilters.dateTo) {
        const sd = project.startDate ? new Date(project.startDate) : null;
        if (sd && sd > new Date(exportFilters.dateTo)) return false;
      }
      return true;
    });
  }, [projects, exportFilters]);
  
  // New state for AM-style layout
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page,setPage]=useState(1); // pagination current page (unified layout)
  const [pageSize,setPageSize]=useState(12);

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

  // CSV upload for manpower
  const handleCSVUpload = (e) => {
    setCsvError('');
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const csvData = results.data;
        const errors = results.errors;

        if (errors.length > 0) {
          setCsvError(`CSV Upload Error: ${errors[0].message}`);
          return;
        }

        if (csvData.length === 0) {
          setCsvError('No data found in CSV file.');
          return;
        }

        const newManpowers = [];
        const invalidRows = [];
        const validationErrors = [];
        const duplicateNames = [];

        csvData.forEach((row, index) => {
          const name = row['Name'] || row['name'] || '';
          const position = row['Position'] || row['position'] || '';
          const status = row['Status'] || row['status'] || '';
          const project = row['Project'] || row['project'] || '';

          // Validate required fields
          if (!name || !position) {
            invalidRows.push(`Row ${index + 1}: Missing name or position`);
            return;
          }

          // Check for duplicates in CSV file itself
          const duplicateInCSV = csvData.slice(0, index).some((prevRow, prevIndex) => {
            const prevName = (prevRow['Name'] || prevRow['name'] || '').trim().toLowerCase();
            const prevPosition = (prevRow['Position'] || prevRow['position'] || '').trim().toLowerCase();
            return prevName === name.trim().toLowerCase() && prevPosition === position.trim().toLowerCase();
          });
          
          if (duplicateInCSV) {
            duplicateNames.push(`Row ${index + 1}: Duplicate entry (${name} - ${position})`);
            return;
          }

          // Check for duplicates in existing manpower
          const existingManpower = allManpower.find(mp => 
            mp.name.trim().toLowerCase() === name.trim().toLowerCase() &&
            mp.position.trim().toLowerCase() === position.trim().toLowerCase()
          );
          
          if (existingManpower) {
            duplicateNames.push(`Row ${index + 1}: Already exists in system (${name} - ${position})`);
            return;
          }

          // For Create mode: validate no project assignment and status must be unassigned
          if (!editingId) {
            if (project && project.trim() !== '') {
              validationErrors.push(`Row ${index + 1}: Project should be empty (${name})`);
              return;
            }
            if (status && status.trim().toLowerCase() !== 'unassigned') {
              validationErrors.push(`Row ${index + 1}: Status should be 'unassigned' (${name})`);
              return;
            }
          }

          newManpowers.push({
            name: name.trim(),
            position: position.trim(),
            status: editingId ? (status || 'Active') : 'unassigned',
            project: '',
            isNew: true
          });
        });

        if (invalidRows.length > 0) {
          setCsvError(`Invalid rows: ${invalidRows.join(', ')}`);
          return;
        }

        if (duplicateNames.length > 0) {
          setCsvError(`Duplicate entries: ${duplicateNames.join(', ')}`);
          return;
        }

        if (validationErrors.length > 0) {
          setCsvError(`Validation errors: ${validationErrors.join(', ')}`);
          return;
        }

        if (newManpowers.length > 0) {
          setCsvUploading(true);
          try {
            // Create manpower entries individually
            const createdManpowers = [];
            for (const mp of newManpowers) {
              const { data } = await api.post('/manpower', {
                name: mp.name,
                position: mp.position,
                status: mp.status,
                assignedProject: null
              }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              });
              createdManpowers.push(data);
            }

            // Add created manpower to the form data
            const newManpowerIds = createdManpowers.map(mp => mp._id);
            setFormData(prev => ({
              ...prev,
              manpower: [...prev.manpower, ...newManpowerIds]
            }));

            // Update the allManpower list to include new entries
            setAllManpower(prev => [...prev, ...createdManpowers]);
            
            // Clear any previous errors
            setCsvError('');
            
            // Show success message
            const mode = editingId ? 'added to project' : 'created and assigned to project';
            alert(`Successfully imported ${createdManpowers.length} manpower entries. They have been ${mode}.`);
          } catch (err) {
            console.error('Error importing manpower:', err);
            setCsvError('Failed to import manpower. Please try again.');
          } finally {
            setCsvUploading(false);
          }
        } else {
          setCsvError('No valid manpower data found in CSV file.');
        }
      },
      error: (err) => {
        console.error('CSV Parsing Error:', err);
        setCsvError('Error parsing CSV file. Please ensure it is a valid CSV and try again.');
      }
    });
  };

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
  const exportProjects = async () => {
    const now = new Date();
    const exportDateTime = now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const pdfContent = {
      companyName: 'Fadz Construction Inc.',
      companyLogo: '/images/Fadz-logo.png', // Use the correct path to the logo
      exportedBy: userName || 'Unknown User',
      exportDate: exportDateTime,
      filters: exportFilters,
      projects: exportPreview.map(project => ({
        name: project.projectName,
        area: project.location?.name || 'N/A',
        pm: project.projectmanager?.name || 'N/A',
        contractor: project.contractor || 'N/A',
        timeline: `${project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'} - ${project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}`,
        pics: Array.isArray(project.pic) ? project.pic.map(p => p.name).join(', ') : 'N/A',
        budget: project.budget ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.budget) : 'N/A'
      }))
    };

    try {
      await generateProjectPDF(pdfContent);
    } catch (e) {
      console.error('PDF generation failed', e);
      alert('PDF generation failed. See console for details.');
    }
    setShowExportModal(false);
  };

  // Filtering + sorting (new unified style)
  const filteredSorted = useMemo(()=>{
    const q = deferredSearch.trim().toLowerCase();
    return projects
      .filter(p=>{
        const st=(p.status||'').toLowerCase();
        if(filter==='completed') return st==='completed';
        if(filter==='ongoing') return ['ongoing','on going'].includes(st);
        if(filter==='pending') return ['pending','not started'].includes(st);
        return true;
      })
      .filter(p=>{
        if(!q) return true; 
        return [p.projectName, p.location?.name, p.projectmanager?.name, p.contractor]
          .some(v=> (v||'').toLowerCase().includes(q));
      })
      .sort((a,b)=>{
        const pick=o=>{
          switch(sortBy){
            case 'location': return o.location?.name||'';
            case 'manager': return o.projectmanager?.name||'';
            case 'status': return o.status||'';
            case 'startDate': return o.startDate? new Date(o.startDate).getTime():0;
            default: return o.projectName||'';
          }
        };
        const av=pick(a), bv=pick(b);
        if(av===bv) return 0;
        return (av>bv?1:-1)*(sortOrder==='asc'?1:-1);
      });
  },[projects,filter,deferredSearch,sortBy,sortOrder]);

  // Reset page when criteria change
  useEffect(()=>{ setPage(1); },[filter,deferredSearch,sortBy,sortOrder]);

  const totalItems = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(()=> filteredSorted.slice((currentPage-1)*pageSize, currentPage*pageSize), [filteredSorted,currentPage,pageSize]);
  const counts = useMemo(()=>({
    total: projects.length,
    ongoing: projects.filter(p=> ['ongoing','on going'].includes((p.status||'').toLowerCase())).length,
    completed: projects.filter(p=> (p.status||'').toLowerCase()==='completed').length,
    pending: projects.filter(p=> ['pending','not started'].includes((p.status||'').toLowerCase())).length
  }),[projects]);

  const statusMeta = (statusRaw='')=>{ const s=statusRaw.toLowerCase(); if(s==='completed') return {color:'#10B981', Icon:FaCheckCircle, label:'Completed'}; if(['ongoing','on going'].includes(s)) return {color:'#3B82F6', Icon:FaClock, label:'Ongoing'}; if(['pending','not started'].includes(s)) return {color:'#F59E0B', Icon:FaClock, label:'Pending'}; return {color:'#6B7280', Icon:FaClock, label: statusRaw || 'Unknown'}; };

  const Skeleton = ({n=8}) => (<div className={`projects-display ${viewMode}`}>
    {Array.from({length:n}).map((_,i)=>(
      <div key={i} className="project-card skeleton">
        <div className="project-image-wrapper shimmer" />
        <div className="project-content">
          <div className="skeleton-line w60" />
          <div className="skeleton-line w40" />
          <div className="skeleton-line w80" />
          <div className="skeleton-line w50" />
        </div>
      </div>
    ))}
  </div>);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container no-inner-scroll it-projects-page">
      <AppHeader roleSegment="it" />
      <main className="dashboard-main auto-height">
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
         
         <div className="projects-container projects-light">
          <div className="page-header enhanced">
            <div className="page-title-section">
              <h1 className="page-title">Projects</h1>
              <p className="page-subtitle">System-wide project management</p>
            </div>
            <div className="page-actions">
              <button className="add-project-btn" onClick={openCreate} aria-label="Create Project"><FaPlus/><span>New Project</span></button>
              <button className="export-btn" onClick={()=>setShowExportModal(true)} aria-label="Export Projects"><FaDownload/><span>Export</span></button>
              <div className="search-container">
                <FaSearch className="search-icon" />
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search by name, location, manager..." className="search-input" />
              </div>
              <div className="view-mode-container">
                <button aria-label="Grid view" className={`view-mode-btn ${viewMode==='grid'?'active':''}`} onClick={()=>setViewMode('grid')}><FaTh/></button>
                <button aria-label="List view" className={`view-mode-btn ${viewMode==='list'?'active':''}`} onClick={()=>setViewMode('list')}><FaList/></button>
              </div>
              <div className="sort-container">
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="sort-select">
                  <option value="name">Name</option>
                  <option value="location">Location</option>
                  <option value="manager">Manager</option>
                  <option value="status">Status</option>
                  <option value="startDate">Start Date</option>
                </select>
                <button aria-label="Toggle sort order" className="sort-order-btn" onClick={()=>setSortOrder(o=>o==='asc'?'desc':'asc')}>{sortOrder==='asc'? <FaChevronUp/> : <FaChevronDown/>}</button>
              </div>
            </div>
          </div>
          <div className="filter-bar below-header">
            <button className={`filter-chip ${filter==='all'?'active':''}`} onClick={()=>setFilter('all')}>All <span className="badge">{counts.total}</span></button>
            <button className={`filter-chip ${filter==='ongoing'?'active':''}`} onClick={()=>setFilter('ongoing')}>Ongoing <span className="badge">{counts.ongoing}</span></button>
            <button className={`filter-chip ${filter==='completed'?'active':''}`} onClick={()=>setFilter('completed')}>Completed <span className="badge">{counts.completed}</span></button>
            <button className={`filter-chip ${filter==='pending'?'active':''}`} onClick={()=>setFilter('pending')}>Pending <span className="badge">{counts.pending}</span></button>
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

          {!error && loading && <Skeleton n={8} />}
          {!error && !loading && (
            <div className={`projects-display ${viewMode}`}>
              {paginatedProjects.length===0 && (
                <div className="empty-state full">
                  <FaProjectDiagram size={42}/>
                  <h3>No projects found</h3>
                  <p>{searchTerm||filter!=='all' ? 'Adjust search or filters.' : 'No projects available.'}</p>
                </div>
              )}
              {paginatedProjects.map(project=>{ const meta=statusMeta(project.status); return (
                <div key={project._id} className={`project-card ${viewMode}`} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter') navigate(`/it/projects/${project._id}`); }}>
                  <div className="project-image-wrapper">
                    <img loading="lazy" src={project.photos?.[0] || 'https://placehold.co/640x360?text=No+Photo'} alt={project.projectName} className="project-image" />
                    <div className="status-badge" style={{backgroundColor:meta.color}}><meta.Icon size={12}/><span>{meta.label}</span></div>
                    <div className="project-actions">
                      <button className="action-btn view-btn" onClick={(e)=>{e.stopPropagation();navigate(`/it/projects/${project._id}`);}} title="View"><FaEye/></button>
                      <button className="action-btn edit-btn" onClick={(e)=>{e.stopPropagation();openEdit(project);}} title="Edit"><FaEdit/></button>
                      <button className="action-btn audit-btn" onClick={(e)=>{e.stopPropagation();loadAudit(project._id);}} title="Audit">🕑</button>
                      <button className="action-btn delete-btn" onClick={(e)=>{e.stopPropagation();remove(project._id);}} title="Delete"><FaTrash/></button>
                    </div>
                  </div>
                  <div className="project-content">
                    <h3 className="project-name clamp">{project.projectName||'Untitled'}</h3>
                    <div className="project-location"><FaMapMarkerAlt/><span>{project.location?.name || 'No Location'}</span></div>
                    <ul className="meta-list">
                      <li><FaUserTie/><span>{project.projectmanager?.name||'Unassigned'}</span></li>
                      <li><FaBuilding/><span>{project.contractor||'No Contractor'}</span></li>
                      <li><FaCalendarAlt/><span>{project.startDate && project.endDate ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}` : (project.startDate? new Date(project.startDate).toLocaleDateString(): 'No timeline')}</span></li>
                      <li><FaUsersIcon/><span>{Array.isArray(project.manpower)&&project.manpower.length>0? `${project.manpower.length} manpower`:'No manpower'}</span></li>
                      {project.budget && <li><FaMoneyBillWave/><span>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(project.budget)}</span></li>}
                    </ul>
                  </div>
                </div>
              ); })}
            </div>
          )}
          {paginatedProjects.length>0 && !loading && (
            <div className="pagination-bar">
              <div className="pagination-left">
                <span className="pagination-info">Showing {(currentPage-1)*pageSize + 1}-{Math.min(currentPage*pageSize,totalItems)} of {totalItems}</span>
                <label className="page-size-select-label"><span>Per page:</span>
                  <select value={pageSize} onChange={e=>{ setPageSize(parseInt(e.target.value)||12); setPage(1); }} className="page-size-select">{[6,12,18,24,36].map(sz=> <option key={sz} value={sz}>{sz}</option>)}</select>
                </label>
              </div>
              <div className="pagination-pages">
                <button disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="page-btn" aria-label="Previous page">‹</button>
                {Array.from({length: totalPages}).map((_,i)=>{ const pageNumber=i+1; const show= pageNumber===1 || pageNumber===totalPages || Math.abs(pageNumber-currentPage)<=1; if(!show){ if(pageNumber===2 && currentPage>3) return <span key="start-ellipsis" className="ellipsis">…</span>; if(pageNumber===totalPages-1 && currentPage<totalPages-2) return <span key="end-ellipsis" className="ellipsis">…</span>; return null;} return (<button key={pageNumber} className={`page-btn ${pageNumber===currentPage?'active':''}`} onClick={()=>setPage(pageNumber)} aria-current={pageNumber===currentPage? 'page': undefined}>{pageNumber}</button>); })}
                <button disabled={currentPage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="page-btn" aria-label="Next page">›</button>
              </div>
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
                <label>
                  Manpower
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input 
                      id="csvUpload" 
                      type="file" 
                      accept=".csv" 
                      style={{ display: 'none' }} 
                      onChange={handleCSVUpload} 
                    />
                    <button 
                      type="button" 
                      onClick={() => document.getElementById('csvUpload').click()} 
                      disabled={csvUploading}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '12px', 
                        backgroundColor: '#3b82f6', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: csvUploading ? 'not-allowed' : 'pointer',
                        opacity: csvUploading ? 0.6 : 1
                      }}
                    >
                      {csvUploading ? 'Uploading...' : 'Import CSV'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const mode = editingId ? 'Edit' : 'Create';
                        alert(`CSV Format for ${mode} Project:\n\nRequired columns:\n- Name (required)\n- Position (required)\n\nOptional columns:\n- Status (defaults to "Active" for Edit, must be "unassigned" for Create)\n- Project (must be empty for Create mode)\n\nRules:\n• ${editingId ? 'New manpower will be added to existing project roster' : 'All persons must have status "unassigned" and no project assignments'}\n• Duplicate names/positions are not allowed\n• New manpower will be created and assigned to this project\n\nExample:\nName,Position,Status,Project\nJohn Doe,Engineer,${editingId ? 'Active' : 'unassigned'},\nJane Smith,Manager,${editingId ? 'Active' : 'unassigned'},\nMike Johnson,Technician,${editingId ? 'Active' : 'unassigned'},`);
                      }}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '12px', 
                        backgroundColor: '#17a2b8', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ?
                    </button>
                  </div>
                  {csvError && (
                    <div style={{ 
                      color: '#dc2626', 
                      fontSize: '12px', 
                      marginBottom: '8px',
                      padding: '4px 8px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '4px'
                    }}>
                      {csvError}
                    </div>
                  )}
                  <MultiBox 
                    name="manpower" 
                    values={formData.manpower} 
                    options={allManpower} 
                    labelKey="name" 
                    idKey="_id" 
                    userLookup={userLookup} 
                    onChange={vals=>setFormData(f=>({...f,manpower:vals}))}
                  />
                </label>
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
                <p>Matching Projects: {exportPreview.length}</p>
                {exportPreview.length>0 && (
                  <div style={{ maxHeight:120, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:4, padding:6, background:'#f9fafb', fontSize:12 }}>
                    {exportPreview.slice(0,8).map(p => (
                      <div key={p._id} style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                        <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.projectName}</span>
                        <span style={{ opacity:.7 }}>{p.status}</span>
                      </div>
                    ))}
                    {exportPreview.length>8 && <div style={{ textAlign:'center', fontStyle:'italic', marginTop:4 }}>+ {exportPreview.length-8} more…</div>}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem'}}>
              <button onClick={() => setShowExportModal(false)}>Cancel</button>
              <button onClick={exportProjects} disabled={exportPreview.length===0} style={{background: exportPreview.length? '#3b82f6':'#94a3b8', color: 'white'}}>
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
