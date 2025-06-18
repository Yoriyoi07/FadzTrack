import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';

const gridCardStyle = {
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
  maxWidth: 900,
  margin: "30px auto",
  padding: "32px 30px 24px 30px",
  display: "flex",
  flexDirection: "column",
  gap: "24px"
};

const flexBetween = { display: "flex", justifyContent: "space-between", alignItems: "flex-start" };

const gridBox = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 22,
  marginBottom: 12
};

const sectionTitle = {
  fontWeight: 600,
  fontSize: 17,
  color: "#222",
  margin: "10px 0 4px"
};

function capitalize(str) {
  if (!str) return "";
  return str[0].toUpperCase() + str.slice(1);
}

const PmViewDailyLogs = () => {
  const { id } = useParams();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/daily-reports/${id}`)
      .then(res => {
        setLog(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: 60, color: '#888' }}>
        Loading Daily Log...
      </div>
    );
  }

  if (!log) {
    return (
      <div style={{ textAlign: 'center', marginTop: 60, color: '#888' }}>
        Daily Log not found.
      </div>
    );
  }

  // Extract attendance summary
  const present = (log.siteAttendance || []).filter(a => a.status === 'Present').map(a =>
    a.manpower?.name || a.manpower?.fullName || a.manpower || ''
  );
  const absent = (log.siteAttendance || []).filter(a => a.status === 'Absent').map(a =>
    a.manpower?.name || a.manpower?.fullName || a.manpower || ''
  );

  // Extract images (attachmentProof is assumed as an array of image URLs)
  const attachments = log.attachmentProof || [];

  return (
    <div>
      {/* Header / Nav */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          <Link to="/pm/viewprojects" className="nav-link">View Project</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/pm/daily-logs" className="nav-link">Logs</Link>
          <Link to="/pm/progress-report/:id" className="nav-link">Reports</Link>
          <Link to="/pm/daily-logs-list" className="nav-link">Daily Logs</Link>
        </nav>
      </header>

      <div style={gridCardStyle}>
        <h1 style={{ textAlign: 'center', margin: 0, fontSize: 36, fontWeight: 700 }}>
          {log.title || log.logTitle || `Daily Log No. ${log.logNumber || ''}`}
        </h1>
        <div style={{ textAlign: 'center', fontWeight: 600, color: "#191970", fontSize: 17 }}>
          {log.project?.projectName || log.projectName || "—"}
          {log.site && ` | ${log.site}`}
          {log.engineer && <> | Engr. {log.engineer}</>}
        </div>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 6 }}>
          <div><span style={{ fontWeight: 600 }}>Date:</span> {log.date ? new Date(log.date).toLocaleDateString('en-US') : '—'}</div>
          <div><span style={{ fontWeight: 600 }}>Weather:</span> {capitalize(log.weatherCondition) || '—'}</div>
        </div>

        {/* Attendance & Material Deliveries */}
        <div style={gridBox}>
          {/* Attendance */}
          <div>
            <div style={sectionTitle}>Attendance Summary</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              <div style={{ flex: 1, textAlign: 'center', background: "#fafbff", borderRadius: 9, padding: 10, border: "1px solid #ececec" }}>
                <div style={{ fontWeight: 600, color: "#43af43", marginBottom: 4 }}>Present</div>
                {present.length === 0 ? <span style={{ color: "#aaa" }}>—</span> : present.map((p, i) => <div key={i}>{p}</div>)}
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: "#fafbff", borderRadius: 9, padding: 10, border: "1px solid #ececec" }}>
                <div style={{ fontWeight: 600, color: "#b34e2c", marginBottom: 4 }}>Absent</div>
                {absent.length === 0 ? <span style={{ color: "#aaa" }}>—</span> : absent.map((a, i) => <div key={i}>{a}</div>)}
              </div>
            </div>
          </div>
          {/* Material Deliveries */}
          <div>
            <div style={sectionTitle}>Material Deliveries</div>
            <div style={{
              background: "#fafbff", borderRadius: 9, padding: 10, minHeight: 50, border: "1px solid #ececec",
              display: "flex", alignItems: "center", minWidth: 0
            }}>
              {(log.materialDeliveries || []).length === 0
                ? <span style={{ color: "#aaa" }}>—</span>
                : log.materialDeliveries.map((del, i) => (
                  <div key={i}>
                    {del.delivery?.requestNumber
                      ? <>Request number {del.delivery.requestNumber} - {del.delivery.poNumber}</>
                      : typeof del.delivery === "string"
                        ? del.delivery
                        : "—"
                    }
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Work performed and remarks */}
        <div style={flexBetween}>
          <div style={{ flex: 1, marginRight: 18 }}>
            <div style={sectionTitle}>Work Performed Today</div>
            <div style={{
              background: "#fafbff", borderRadius: 9, padding: 10, minHeight: 60, border: "1px solid #ececec",
              whiteSpace: "pre-line"
            }}>
              {(log.workPerformed || []).length === 0
                ? <span style={{ color: "#aaa" }}>—</span>
                : log.workPerformed.map((work, i) =>
                  <div key={i}>{work.task} - {capitalize(work.status)}</div>
                )
              }
            </div>
          </div>
          <div style={{ flex: 1, marginLeft: 18 }}>
            <div style={sectionTitle}>Additional Remarks</div>
            <div style={{
              background: "#fafbff", borderRadius: 9, padding: 10, minHeight: 60, border: "1px solid #ececec",
              maxHeight: 90, overflow: "auto"
            }}>
              {log.remarks || <span style={{ color: "#aaa" }}>—</span>}
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div>
          <div style={sectionTitle}>Attachment Proof</div>
          <div style={{
            display: 'flex', gap: 24, justifyContent: 'flex-start',
            marginTop: 8, flexWrap: 'wrap'
          }}>
            {attachments.length === 0
              ? <span style={{ color: "#aaa" }}>—</span>
              : attachments.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`proof-${idx}`}
                  style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 9, border: "1px solid #e6e6e6" }}
                />
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default PmViewDailyLogs;
