// src/components/hrSite/HrSiteAttendanceReport.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axiosInstance";
import NotificationBell from "../NotificationBell";
import '../style/hr_style/HrSite_Report.css';

/**
 * HR-Site — Attendance Report
 *
 * UX mirrors the screenshot provided:
 *  - Header with brand + nav (hr-site)
 *  - "This Period's Attendance Report" section: bi-weekly period, upload multiple files, Generate→Submit flow
 *  - Previous Attendance Reports list below with downloads + timestamps
 *
 * Backend expectations (adjust endpoints as needed):
 *  - GET   /hr-site/attendance/reports?userId=:id                    → [{ id, periodStart, periodEnd, reportUrl, reportName, submittedAt, dataFiles:[{name,url}] }]
 *  - POST  /hr-site/attendance/generate                               → FormData { userId, periodStart, periodEnd, files[] } → { reportUrl, reportName }
 *  - POST  /hr-site/attendance/submit                                 → { userId, periodStart, periodEnd, reportUrl, reportName, dataFiles:[{name,url}] }
 */

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function fmtDate(d){ return new Date(d).toLocaleDateString(); }
function fmtDateTime(d){ return new Date(d).toLocaleString(); }

// Determine the current 2-week period (Mon–Sun x2) containing today
function getCurrentBiweeklyPeriod(today = new Date()){
  const t = startOfDay(today);
  // Align to Monday as week start
  const dow = (t.getDay()+6)%7; // 0=Mon
  const monday = new Date(t); monday.setDate(t.getDate()-dow);
  // Find which biweekly window: if we measure from an epoch Monday (e.g., 2024-01-01 Monday)
  const epoch = new Date(2024,0,1); // Jan 1, 2024 (Mon)
  const diffDays = Math.floor((monday - startOfDay(epoch)) / 86400000);
  const biweekIndex = Math.floor(diffDays/14);
  const start = new Date(epoch); start.setDate(epoch.getDate() + biweekIndex*14);
  const end = new Date(start); end.setDate(start.getDate()+13); // 14 days window
  return { start, end };
}

const HrSiteAttendanceReport = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // auth/user
  const stored = localStorage.getItem("user");
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id || user?.id;
  const userName = user?.name || "";

  // header
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // period (biweekly)
  const { start: pStart, end: pEnd } = useMemo(() => getCurrentBiweeklyPeriod(), []);

  // uploads
  const [files, setFiles] = useState([]); // File[]

  // generation / submission
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null); // { reportUrl, reportName }
  const [error, setError] = useState("");

  // previous reports
  const [previousReports, setPreviousReports] = useState([]);
  const [loadingPrev, setLoadingPrev] = useState(true);

  useEffect(() => {
    const outside = (e) => { if (!e.target.closest('.profile-menu-container')) setProfileMenuOpen(false); };
    document.addEventListener('click', outside);
    return () => document.removeEventListener('click', outside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrev(){
      if (!userId) return;
      setLoadingPrev(true);
      try{
        const { data } = await api.get(`/hr-site/attendance/reports`, { params:{ userId } });
        if (!cancelled) setPreviousReports(Array.isArray(data)? data : []);
      }catch(e){ if(!cancelled) setPreviousReports([]); }
      finally{ if(!cancelled) setLoadingPrev(false); }
    }
    fetchPrev();
  }, [userId]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleOpenFileDialog = () => fileInputRef.current?.click();

  const handleFilesSelected = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    // de-dupe by name+size
    const key = (f)=>`${f.name}:${f.size}`;
    const next = [...files];
    const seen = new Set(next.map(key));
    for(const f of picked){ if(!seen.has(key(f))){ next.push(f); seen.add(key(f)); } }
    setFiles(next);
    // clear input so same file can be re-picked
    e.target.value = "";
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_,i)=>i!==idx));

  const handleGenerate = async () => {
    if (!userId || !files.length) return;
    setIsGenerating(true); setError("");
    try{
      const fd = new FormData();
      fd.append('userId', userId);
      fd.append('periodStart', pStart.toISOString());
      fd.append('periodEnd', pEnd.toISOString());
      files.forEach(f => fd.append('files', f));
      const { data } = await api.post('/hr-site/attendance/generate', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      // expect { reportUrl, reportName }
      if (data?.reportUrl && data?.reportName){
        setGeneratedReport({ reportUrl: data.reportUrl, reportName: data.reportName });
      } else {
        throw new Error('Invalid response from generator');
      }
    }catch(e){
      setError(e?.response?.data?.msg || e.message || 'Failed to generate report');
      setGeneratedReport(null);
    }finally{
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId || !generatedReport) return;
    setIsGenerating(true); setError("");
    try{
      // Optionally upload the data files first and get URLs back; for now send names only.
      const payload = {
        userId,
        periodStart: pStart.toISOString(),
        periodEnd: pEnd.toISOString(),
        reportUrl: generatedReport.reportUrl,
        reportName: generatedReport.reportName,
        dataFiles: files.map(f => ({ name: f.name }))
      };
      const { data } = await api.post('/hr-site/attendance/submit', payload);
      // expect saved record returned
      const saved = data && (data.id ? data : { ...payload, id: Date.now(), submittedAt: new Date().toISOString() });
      setPreviousReports(prev => [{
        id: saved.id,
        periodStart: saved.periodStart,
        periodEnd: saved.periodEnd,
        reportUrl: saved.reportUrl,
        reportName: saved.reportName,
        submittedAt: saved.submittedAt || new Date().toISOString(),
        dataFiles: saved.dataFiles || []
      }, ...prev]);
      // reset current
      setFiles([]);
      setGeneratedReport(null);
    }catch(e){
      setError(e?.response?.data?.msg || e.message || 'Failed to submit report');
    }finally{
      setIsGenerating(false);
    }
  };

  const actionPrimaryLabel = generatedReport ? 'Submit' : 'Generate';
  const actionPrimaryHandler = generatedReport ? handleSubmit : handleGenerate;
  const periodLabel = `${fmtDate(pStart)} - ${fmtDate(pEnd)}`;

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/hr-site/current-project" className="nav-link">Dashboard</Link>
          <Link to="/hr-site/all-projects" className="nav-link">Projects</Link>
          <Link to="/hr-site/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {(userName?.[0] || 'Z').toUpperCase()}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); }}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* PAGE */}
      <div className="attendance-page">
        <div className="card">
          <h1 className="page-title">Attendance Report</h1>

          {error && <div className="inline-error" role="alert">{error}</div>}

          {/* Current Period */}
          <section className="current-period">
            <h3 className="section-title">This Period's Attendance Report</h3>

            <div className="row">
              <div className="col label">Report Period</div>
              <div className="col value">{periodLabel}</div>
            </div>

            <div className="row file-row">
              <div className="col label">Files</div>
              <div className="col value">
                {files.length === 0 ? (
                  <span className="muted">No files added yet.</span>
                ) : (
                  <ul className="file-list">
                    {files.map((f, idx) => (
                      <li key={`${f.name}-${idx}`} className="file-item">
                        <span className="file-name">{f.name}</span>
                        <button className="link-btn" onClick={() => removeFile(idx)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="col actions">
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFilesSelected} />
                <button className="btn ghost" onClick={handleOpenFileDialog}>Upload</button>
                <button className="btn primary" onClick={actionPrimaryHandler} disabled={isGenerating || (!generatedReport && files.length===0)}>
                  {isGenerating ? 'Working…' : actionPrimaryLabel}
                </button>
              </div>
            </div>
          </section>

          {/* Previous Reports */}
          <section className="previous-reports">
            <h3 className="section-title">Previous Attendance Reports</h3>
            {loadingPrev ? (
              <div className="muted" style={{ padding: 12 }}>Loading…</div>
            ) : previousReports.length === 0 ? (
              <div className="muted" style={{ padding: 12 }}>No previous reports yet.</div>
            ) : (
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Report Period</th>
                    <th>File</th>
                    <th>Source Data</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {previousReports.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.periodStart)} - {fmtDate(r.periodEnd)}</td>
                      <td>
                        {r.reportUrl ? (
                          <a className="btn small" href={r.reportUrl} target="_blank" rel="noreferrer">Download</a>
                        ) : (
                          <span className="muted">Unavailable</span>
                        )}
                      </td>
                      <td className="data-links">
                        {(r.dataFiles || []).map((df, i) => (
                          df.url ? (
                            <a key={i} href={df.url} target="_blank" rel="noreferrer" className="link-inline">{df.name}</a>
                          ) : (
                            <span key={i} className="muted link-inline">{df.name}</span>
                          )
                        ))}
                      </td>
                      <td>{fmtDateTime(r.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="back-row">
              <button className="btn" onClick={() => navigate(-1)}>Back</button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default HrSiteAttendanceReport;
