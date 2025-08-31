import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/ceo_style/Ceo_Dash.css';
import '../style/ceo_style/Ceo_Material_List.css';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';

// React Icons
// icons retained only within request cards; header icons handled by AppHeader
import { FaBoxes } from 'react-icons/fa';

const ITEMS_PER_PAGE = 5;

const CeoMaterialList = () => {
  const navigate = useNavigate();
  // Header/profile handled by AppHeader
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userName, setUserName] = useState(user?.name || 'CEO');
  const [userRole, setUserRole] = useState(user?.role || 'Chief Executive Officer');
  // header collapse removed (AppHeader fixed height)

  // --- Main requests (for this page)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }

    api.get('/requests')
      .then(res => {
        setRequests(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
        setError('');
      })
      .catch(err => {
        if (err.response && (err.response.status === 403 || err.response.status === 401)) {
          setError('Session expired or unauthorized. Please login.');
        } else {
          setError('Failed to load requests');
        }
        setRequests([]);
        setLoading(false);
      });
  }, []);

  // removed clickOutside/scroll logic

  // Logout handled by AppHeader

  // --- Helpers
  const getStatusColor = (status, receivedByPIC) => {
    const s = (status || '').toLowerCase();
    if (receivedByPIC) return '#0ea5e9'; // Completed
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

  // Add edit and delete functionality
  const openEdit = (request) => {
    // Navigate to the comprehensive edit form
    navigate(`/ceo/material-request/edit/${request._id}`);
  };

  const deleteRequest = async (id, event) => {
    event.preventDefault(); // Prevent navigation to detail page
    event.stopPropagation(); // Prevent event bubbling
    
    if (!window.confirm('Delete this material request? This action cannot be undone.')) return;
    
    try {
      await api.delete(`/requests/${id}`);
      setRequests(prev => prev.filter(r => r._id !== id));
    } catch (e) {
      console.error('Failed to delete request:', e);
      alert('Failed to delete request. Please try again.');
    }
  };

  // --- Filtering/search/pagination
  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const isCompleted = !!request.receivedByPIC;
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel'))) ||
      (filter === 'Completed' && isCompleted);
    const searchTarget = [
      request.materials && request.materials.map(m => m.materialName).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort: push Completed to end when viewing All; otherwise newest first
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (filter === 'All') {
      const aCompleted = a.receivedByPIC ? 1 : 0;
      const bCompleted = b.receivedByPIC ? 1 : 0;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    }
    const ad = new Date(a.createdAt || 0).getTime();
    const bd = new Date(b.createdAt || 0).getTime();
    return bd - ad;
  });
  
  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div>
      <AppHeader roleSegment="ceo" />

      {/* Main content */}
      <div className="dashboard-layout">
        <main className="dashboard-main">
          <div className="page-container">
            <div className="controls-bar">
                <div className="filter-tabs">
                {['All', 'Pending', 'Approved', 'Cancelled', 'Completed'].map(tab => (
                    <button
                      key={tab}
                      className={`filter-tab ${filter === tab ? 'active' : ''}`}
                      onClick={() => setFilter(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              <div className="search-sort-section">
                <div className="search-wrapper">
                <input
                    type="text"
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                </div>
              </div>
              </div>

            <div className="requests-grid">
                {loading ? (
                <div className="loading-state"><div className="loading-spinner"></div><p>Loading material requests...</p></div>
                ) : error ? (
                <div className="error-state"><p>{error}</p></div>
              ) : paginatedRequests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <h3>No material requests found</h3>
                  <p>No requests match your current filters. Try adjusting your search criteria.</p>
                  </div>
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {paginatedRequests.map(request => (
                    <div key={request._id} style={{ 
                      background: '#f8fafc', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '6px', 
                      padding: '12px',
                      fontSize: '13px',
                      position: 'relative'
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
                          <span style={{ fontWeight: '500' }}>{request.createdBy?.name || 'Unknown'}</span> • {new Date(request.createdAt).toLocaleDateString()}
                          {request.project?.projectName && (
                            <span> • Project: {request.project.projectName}</span>
              )}
            </div>
          </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Link to={`/ceo/material-request/${request._id}`} className="view-details-btn">View Details</Link>
                        <button 
                          className="edit-btn" 
                          onClick={() => openEdit(request)}
                          title="Edit Request"
                          style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          className="delete-btn" 
                          onClick={(e) => deleteRequest(request._id, e)}
                          title="Delete Request"
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          🗑️ Delete
                        </button>
                  </div>
                </div>
              ))}
            </div>
              )}
      </div>

            {filteredRequests.length > 0 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries
                </div>
                <div className="pagination-controls">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="pagination-btn">Previous</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} className={`pagination-btn ${page === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                  ))}
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="pagination-btn">Next</button>
          </div>
        </div>
      )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CeoMaterialList;
