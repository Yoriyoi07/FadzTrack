import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import {
  FaSearch,
  FaFilter,
  FaSortAmountDown,
  FaSortAmountUp,
  FaEye,
  FaCheck,
  FaTimes,
  FaUsers,
  FaTachometerAlt,
  FaComments,
  FaBoxes,
  FaClipboardList,
  FaChartBar,
  FaCalendarAlt,
} from 'react-icons/fa';

/**
 * PM Manpower Request List
 * - Shows all "Pending" requests to any user with role "Project Manager"
 * - Inline approve (enter manpower IDs to assign) OR navigate to a detail page
 */
export default function PM_Manpower_Request_List() {
  const navigate = useNavigate();

  // Get logged-in user first (avoid TDZ)
  const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const user = stored ? JSON.parse(stored) : null;

  // UI state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userName] = useState(() => (user?.name ? user.name : 'ALECK'));
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  // Filters & table state
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Pending'); // default show Pending
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Inline approval
  const inlineApproval = true; // set false if you want to navigate to a detail page instead
  const [manpowerInput, setManpowerInput] = useState({}); // { [requestId]: "id1, id2" }
  const [busyId, setBusyId] = useState(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (!e.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Fetch PM inbox
  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/manpower-requests/pm');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('❌ Failed loading PM inbox', e);
      setError(e?.response?.data?.message || 'Failed to load requests.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived table rows with filters, search, sort
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    let items = rows;

    if (status && status !== 'All') {
      items = items.filter((r) => (r.status || 'Pending') === status);
    }
    if (text) {
      items = items.filter((r) => {
        const proj = r.project?.projectName || '';
        const by = r.createdBy?.name || '';
        const reqSummary = (r.manpowers || []).map((m) => `${m.quantity} ${m.type}`).join(', ');
        return (
          proj.toLowerCase().includes(text) ||
          by.toLowerCase().includes(text) ||
          reqSummary.toLowerCase().includes(text) ||
          (r.description || '').toLowerCase().includes(text)
        );
      });
    }
    items = [...items].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortDesc ? bTime - aTime : aTime - bTime;
    });
    return items;
  }, [rows, q, status, sortDesc]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Handlers
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const onApprove = async (item) => {
    if (!inlineApproval) {
      navigate(`/pm/manpower-requests/${item._id}`);
      return;
    }
    const raw = manpowerInput[item._id] || '';
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      alert('Please enter at least one manpower ID to assign.');
      return;
    }
    setBusyId(item._id);
    try {
      await api.put(`/manpower-requests/${item._id}/approve`, {
        manpowerProvided: ids,
        project: item.project?._id,
        area: item.project?.location,
      });
      alert('✅ Approved');
      await fetchList();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  };

  const onDeny = async (item) => {
    if (!window.confirm('Deny this request?')) return;
    setBusyId(item._id);
    try {
      await api.put(`/manpower-requests/${item._id}`, { status: 'Rejected' });
      alert('Request denied.');
      await fetchList();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Failed to deny.');
    } finally {
      setBusyId(null);
    }
  };

  if (!user || user.role !== 'Project Manager') {
    return (
      <div style={{ padding: 24 }}>
        <h2>Forbidden</h2>
        <p>You must be a Project Manager to view this page.</p>
      </div>
    );
  }

  return (
    <div className="fadztrack-app">
      {/* Header (kept consistent with your style) */}
      <header className="header">
        <div className="logo-container">
          <img
            src={require('../../assets/images/FadzLogo1.png')}
            alt="FadzTrack Logo"
            className="logo-img"
          />
          <h1 className="brand-name">FadzTrack</h1>
        </div>

        <nav className="nav-menu">
          <Link to="/pm" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
          <Link to="/pm/chat" className="nav-link"><FaComments /> Chat</Link>
          <Link to="/pm/request/:id" className="nav-link"><FaBoxes /> Material</Link>
          <Link to="/pm/manpower-list" className="nav-link"><FaUsers /> Manpower</Link>
          <Link to="/pm/daily-logs" className="nav-link"><FaClipboardList /> Logs</Link>
          <Link to="/pm/progress-report" className="nav-link"><FaChartBar /> Reports</Link>
          <Link to="/pm/daily-logs-list" className="nav-link"><FaCalendarAlt /> Daily Logs</Link>
        </nav>

        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName ? userName.charAt(0).toUpperCase() : 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Controls */}
      <div style={{ padding: 16, display: 'grid', gap: 12, gridTemplateColumns: '1fr auto auto auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaSearch />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search project, requestor, items, description…"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaFilter />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}
          >
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="All">All</option>
          </select>
        </div>

        <button
          onClick={() => setSortDesc((s) => !s)}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '10px 12px',
            background: '#fff',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          title="Toggle sort by Created date"
        >
          {sortDesc ? <FaSortAmountDown /> : <FaSortAmountUp />} Sort
        </button>

        <div style={{ alignSelf: 'center', textAlign: 'right', opacity: 0.7 }}>
          {filtered.length} results
        </div>
      </div>

      {/* Content */}
      <main style={{ padding: 16 }}>
        {loading && (
          <div style={{ padding: 24 }}>Loading requests…</div>
        )}
        {!loading && error && (
          <div style={{ padding: 24, color: '#c0392b', fontWeight: 600 }}>{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 24 }}>No requests found.</div>
        )}

        {!loading && !error && pageRows.map((item) => {
          const summary = (item.manpowers || [])
            .map((m) => `${m.quantity} ${m.type}`)
            .join(', ');

          return (
            <div
              key={item._id}
              style={{
                border: '1px solid #ececec',
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                background: '#fff',
                boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {item.project?.projectName || '(No Project Name)'}
                  </div>
                  <div style={{ color: '#666' }}>
                    Requested by {item.createdBy?.name || 'Unknown'} • {new Date(item.createdAt).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Need:</b> {summary || '—'}
                  </div>
                  <div>
                    <b>Target Acquisition:</b> {item.acquisitionDate ? new Date(item.acquisitionDate).toLocaleDateString() : '—'} •{' '}
                    <b>Duration:</b> {item.duration || '—'} day(s)
                  </div>
                  <div style={{ marginTop: 6, color: '#444' }}>
                    <b>Description:</b> {item.description || '—'}
                  </div>
                </div>

                <div style={{ minWidth: 260, maxWidth: 360 }}>
                  {item.status === 'Pending' ? (
                    inlineApproval ? (
                      <>
                        <label style={{ fontWeight: 700 }}>Manpower IDs to assign</label>
                        <input
                          type="text"
                          value={manpowerInput[item._id] || ''}
                          onChange={(e) =>
                            setManpowerInput((p) => ({ ...p, [item._id]: e.target.value }))
                          }
                          placeholder="e.g. 668f0..., 668f1..."
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #e5e7eb',
                            marginTop: 6,
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            onClick={() => onApprove(item)}
                            disabled={busyId === item._id}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: 'none',
                              background: '#2e7d32',
                              color: '#fff',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                            }}
                            title="Approve"
                          >
                            <FaCheck /> {busyId === item._id ? 'Processing…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => onDeny(item)}
                            disabled={busyId === item._id}
                            style={{
                              width: 46,
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: 'none',
                              background: '#c0392b',
                              color: '#fff',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Deny"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link
                          to={`/pm/manpower-requests/${item._id}`}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: '#0d6efd',
                            color: '#fff',
                            textDecoration: 'none',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                          title="Open details"
                        >
                          <FaEye /> Review & Approve
                        </Link>
                        <button
                          onClick={() => onDeny(item)}
                          style={{
                            width: 46,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: 'none',
                            background: '#c0392b',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                          title="Deny"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    )
                  ) : (
                    <div
                      style={{
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontWeight: 800,
                        textAlign: 'center',
                        background: item.status === 'Approved' ? '#e8f5e9' : '#fdecea',
                        color: item.status === 'Approved' ? '#1b5e20' : '#b71c1c',
                        marginTop: 8,
                      }}
                    >
                      {item.status}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Prev
            </button>
            <div style={{ padding: '8px 12px', alignSelf: 'center' }}>
              Page {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
