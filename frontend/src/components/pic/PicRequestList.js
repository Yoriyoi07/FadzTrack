import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import AppHeader from '../layout/AppHeader';
import '../style/pm_style/PmMatRequest.css';
import '../style/pm_style/Pm_Dash.css';
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram } from 'react-icons/fa';

const ITEMS_PER_PAGE = 8;

export default function PicRequestList() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?._id;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeProject, setActiveProject] = useState(null);
  const [userRole] = useState(user?.role || 'Person in Charge');

  useEffect(() => {
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }
    api.get('/requests/mine', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        const mine = Array.isArray(data) ? data.filter(r => String(r.createdBy?._id || r.createdBy) === String(userId)) : [];
        setRequests(mine);
        setError('');
      })
      .catch(() => { setRequests([]); setError('Failed to load requests'); })
      .finally(() => setLoading(false));
  }, [token, userId]);

  useEffect(() => {
    if (!token || !userId) return;
    api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`)
      .then(({ data }) => setActiveProject(data?.[0] || null))
      .catch(() => setActiveProject(null));
  }, [token, userId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-profile')) setProfileMenuOpen(false);
    };
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsHeaderCollapsed(scrollTop > 50);
    };
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const truncateWords = (text = '', maxWords = 10) => {
    if (!text || typeof text !== 'string') return '';
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  const getStatusColor = (status, receivedByPIC) => {
    const s = (status || '').toLowerCase();
    if (receivedByPIC) return '#0ea5e9';
    if (s.includes('approved')) return '#10b981';
    if (s.includes('pending')) return '#f59e0b';
    if (s.includes('denied') || s.includes('cancel')) return '#ef4444';
    return '#6b7280';
  };
  const getStatusBadge = (status, receivedByPIC) => {
    if (receivedByPIC) return 'Completed';
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) return 'Approved';
    if (s.includes('pending')) return 'Pending';
    if (s.includes('denied') || s.includes('cancel')) return 'Rejected';
    return 'Unknown';
  };

  const filtered = requests.filter(r => {
    const s = (r.status || '').toLowerCase();
    const isCompleted = !!r.receivedByPIC;
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && s.includes('pending')) ||
      (filter === 'Approved' && s.includes('approved')) ||
      (filter === 'Cancelled' && (s.includes('denied') || s.includes('cancel'))) ||
      (filter === 'Completed' && isCompleted);
    const searchTarget = [
      r.materials?.map(m => m.materialName).join(', ') || '',
      r.description || '',
      r.project?.projectName || ''
    ].join(' ').toLowerCase();
    return matchesFilter && searchTarget.includes(searchTerm.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    const aCompleted = a.receivedByPIC ? 1 : 0;
    const bCompleted = b.receivedByPIC ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const page = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div>
  <AppHeader roleSegment="pic" />

      <div style={{padding:'1.1rem 1.6rem 0.4rem'}}>
        <h1 style={{margin:'0 0 4px',fontSize:'1.08rem',fontWeight:600,color:'#1e293b'}}>Material Requests</h1>
        <p style={{margin:0,fontSize:'.72rem',letterSpacing:.2,color:'#64748b'}}>Your submitted material requests</p>
      </div>

      <main className="dashboard-main">
        <div className="page-container">
          <div className="controls-bar">
            <div className="filter-tabs">
              {['All', 'Pending', 'Approved', 'Cancelled', 'Completed'].map(tab => (
                <button key={tab} className={`filter-tab ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>{tab}</button>
              ))}
            </div>
            <div className="search-sort-section">
              <div className="search-wrapper">
                <input className="search-input" placeholder="Search requests..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
              </div>
              {activeProject && (
                <Link to={`/pic/projects/${activeProject._id}/request`} className="view-details-btn" style={{ background:'#2563eb', color:'#fff' }}>+ New Request</Link>
              )}
            </div>
          </div>

          <div className="requests-grid">
            {loading ? (
              <div className="loading-state"><div className="loading-spinner"></div><p>Loading material requests...</p></div>
            ) : error ? (
              <div className="error-state"><p>{error}</p></div>
            ) : page.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No material requests</h3>
                <p>You have not submitted any requests yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {page.map(request => (
                  <div key={request._id} style={{ 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    padding: '12px',
                    fontSize: '13px'
                  }}>
                    {/* Request Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          margin: '0 0 4px 0', 
                          fontSize: '15px', 
                          fontWeight: '600', 
                          color: '#1f2937' 
                        }}>
                          {request.materials?.length
                            ? request.materials.map(m => `${m.materialName} (${m.quantity} ${m.unit || ''})`).join(', ')
                            : 'Material Request'}
                        </h3>
                        <p style={{ 
                          margin: '0 0 6px 0', 
                          color: '#6b7280', 
                          fontSize: '13px',
                          lineHeight: '1.3'
                        }}>
                          {request.description || 'No description provided'}
                        </p>
                      </div>
                      <span style={{ 
                        background: getStatusColor(request.status, request.receivedByPIC),
                        color: '#ffffff',
                        padding: '3px 10px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        marginLeft: '10px'
                      }}>
                        {getStatusBadge(request.status, request.receivedByPIC)}
                      </span>
                    </div>
                    
                    {/* Tracking Progress */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '500' }}>
                        Tracking Progress:
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0px',
                        background: '#ffffff',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {/* Placed Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Placed
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: '#10b981',
                            fontWeight: '500'
                          }}>
                            Done
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {/* Connector 1 */}
                        <div style={{ 
                          width: '16px',
                          height: '2px',
                          background: 'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)',
                          margin: '0 3px'
                        }}></div>
                        
                        {/* PM Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: (request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                          (request.status?.includes('denied') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') : 
                                          'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {(request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                              (request.status?.includes('denied') ? '✗' : '✓') : '○'}
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Project Manager
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: (request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                   (request.status?.includes('denied') ? '#ef4444' : '#10b981') : '#6b7280',
                            fontWeight: '500'
                          }}>
                            {(request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                              (request.status?.includes('denied') ? 'Rejected' : 'Approved') : 'Pending'}
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {request.pmApprovedAt ? new Date(request.pmApprovedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        
                        {/* Connector 2 */}
                        <div style={{ 
                          width: '16px',
                          height: '2px',
                          background: (request.status?.includes('pm') || request.status?.includes('project manager')) && !request.status?.includes('denied') ? 
                                        'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)' : 
                                        'linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 100%)',
                          margin: '0 3px'
                        }}></div>
                        
                        {/* AM Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: (request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                          (request.status?.includes('denied') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') : 
                                          'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {(request.status?.includes('am') || request.status?.includes('area manager')) ? 
                              (request.status?.includes('denied') ? '✗' : '✓') : '○'}
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Area Manager
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: (request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                   (request.status?.includes('denied') ? '#ef4444' : '#10b981') : '#6b7280',
                            fontWeight: '500'
                          }}>
                            {(request.status?.includes('am') || request.status?.includes('area manager')) ? 
                              (request.status?.includes('denied') ? 'Rejected' : 'Approved') : 'Pending'}
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {request.amApprovedAt ? new Date(request.amApprovedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        
                        {/* Connector 3 */}
                        <div style={{ 
                          width: '16px',
                          height: '2px',
                          background: (request.status?.includes('am') || request.status?.includes('area manager')) && !request.status?.includes('denied') ? 
                                        'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)' : 
                                        'linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 100%)',
                          margin: '0 3px'
                        }}></div>
                        
                        {/* Received Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: request.receivedByPIC ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {request.receivedByPIC ? '✓' : '○'}
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Received
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: request.receivedByPIC ? '#10b981' : '#6b7280',
                            fontWeight: '500'
                          }}>
                            {request.receivedByPIC ? 'Received' : 'Pending'}
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {request.receivedByPIC ? new Date(request.receivedByPIC).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Request Details */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        <span style={{ fontWeight: '500' }}>Project: {request.project?.projectName || '-'}</span> • {new Date(request.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Link to={`/pic/material-request/${request._id}`} className="view-details-btn">View Details</Link>
                      <Link to={`/pic/material-request/edit/${request._id}`} className="edit-btn" style={{
                        padding: '6px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        transition: 'all 0.2s ease',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#2563eb';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#3b82f6';
                      }}>
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {sorted.length > 0 && (
            <div className="pagination-section">
              <div className="pagination-info">Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, sorted.length)} of {sorted.length} entries</div>
              <div className="pagination-controls">
                <button className="pagination-btn" disabled={currentPage===1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}>Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} className={`pagination-btn ${currentPage===n?'active':''}`} onClick={()=>setCurrentPage(n)}>{n}</button>
                ))}
                <button className="pagination-btn" disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))}>Next</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


