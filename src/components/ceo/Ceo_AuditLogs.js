import React, { useEffect, useState } from "react";

const Ceo_AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("http://localhost:5000/api/audit-logs", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not authorized or failed to fetch");
        return res.json();
      })
      .then((data) => {
        console.log("Fetched logs:", data);
        setLogs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    return (
      (!roleFilter || log.performedByRole.toLowerCase().includes(roleFilter.toLowerCase())) &&
      (!actionFilter || log.action.toLowerCase().includes(actionFilter.toLowerCase())) &&
      (
        !search ||
        log.description?.toLowerCase().includes(search.toLowerCase()) ||
        log.performedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.performedByRole?.toLowerCase().includes(search.toLowerCase()) ||
        log.action?.toLowerCase().includes(search.toLowerCase())
      )
    );
  });

  return (
    <div style={{ maxWidth: 1200, margin: "30px auto", padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 2px 16px #0001" }}>
      <h2 style={{ marginBottom: 24 }}>Audit Log</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Search anything..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: 180, padding: 8, borderRadius: 6, border: "1px solid #bbb" }}
        />
        <input
          placeholder="Filter by role"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ flex: 1, minWidth: 120, padding: 8, borderRadius: 6, border: "1px solid #bbb" }}
        />
        <input
          placeholder="Filter by action"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ flex: 1, minWidth: 120, padding: 8, borderRadius: 6, border: "1px solid #bbb" }}
        />
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead>
              <tr style={{ background: "#f6f6f6" }}>
                <th style={th}>Date/Time</th>
                <th style={th}>Action</th>
                <th style={th}>Performed By</th>
                <th style={th}>Role</th>
                <th style={th}>Description</th>
                <th style={th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#888" }}>No logs found.</td></tr>
              ) : (
                filteredLogs.map((log, i) => (
                  <tr key={log._id || i} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                    <td style={td}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={td}><span style={{ background: "#f3f6ff", borderRadius: 4, padding: "2px 8px" }}>{log.action}</span></td>
                    <td style={td}>{log.performedBy?.name || "Unknown"}</td>
                    <td style={td}>{log.performedByRole}</td>
                    <td style={td}>{log.description}</td>
                    <td style={td}>
                      <details>
                        <summary style={{ cursor: "pointer" }}>View</summary>
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#f8f8f8", padding: 8, borderRadius: 6 }}>{JSON.stringify(log.meta, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const th = {
  textAlign: "left",
  padding: "10px 8px",
  fontWeight: 600,
  borderBottom: "2px solid #eee",
};
const td = {
  padding: "8px 8px",
  borderBottom: "1px solid #eee",
};

export default Ceo_AuditLogs;
