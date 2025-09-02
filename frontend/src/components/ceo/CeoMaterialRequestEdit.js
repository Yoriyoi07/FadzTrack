import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import '../style/ceo_style/CeoMaterialRequestDetail.css';
import { FaPlus, FaTrash, FaSave, FaPaperclip, FaDownload } from 'react-icons/fa';

const CeoMaterialRequestEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [materialRequest, setMaterialRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Header/profile removed (AppHeader used)
  
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Editable form state
  const [formData, setFormData] = useState({ description: '', materials: [], attachments: [] });
  const [newFiles, setNewFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);

  useEffect(() => {
    // Fetch the material request data
    api.get(`/requests/${id}`)
      .then(res => {
        console.log('Material Request Data for Edit:', res.data);
        const data = res.data;
        setMaterialRequest(data);
        
        // Initialize form data
        setFormData({
          description: data.description || '',
          materials: (data.materials || []).map((m, idx) => ({
            id: idx + 1,
            materialName: m.materialName || '',
            quantity: m.quantity || '',
            unit: m.unit || ''
          })),
          attachments: data.attachments || []
        });
        
        setError('');
      })
      .catch((err) => {
        console.error('Error fetching request:', err);
        setError('Failed to load request details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(()=>{},[]); // placeholder

  // Cleanup preview URLs
  useEffect(()=>{
    return ()=>{ previewURLs.forEach(url=> URL.revokeObjectURL(url)); };
  },[previewURLs]);

  const handleBack = () => navigate(`/ceo/material-request/${id}`);

  // Handlers
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev=>({...prev,[name]:value}));
  };

  const handleMaterialChange = (rowId, field, value) => {
    setFormData(prev=>({
      ...prev,
      materials: prev.materials.map(m=> m.id===rowId ? { ...m, [field]: field==='quantity' ? value.replace(/[^0-9.]/g,'').slice(0,10) : value } : m )
    }));
  };

  const addMaterialRow = () => {
    setFormData(prev=>({
      ...prev,
      materials:[...prev.materials, { id: (prev.materials.at(-1)?.id || 0)+1, materialName:'', quantity:'', unit:'' }]
    }));
  };

  const removeMaterialRow = (rowId) => {
    setFormData(prev=>({
      ...prev,
      materials: prev.materials.length>1 ? prev.materials.filter(m=>m.id!==rowId) : prev.materials
    }));
  };

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    const previews = files.map(f=> URL.createObjectURL(f));
    setNewFiles(prev=>[...prev,...files]);
    setPreviewURLs(prev=>[...prev,...previews]);
  };

  const removeNewFile = (idx) => {
    setNewFiles(prev=> prev.filter((_,i)=> i!==idx));
    setPreviewURLs(prev=> {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_,i)=> i!==idx);
    });
  };

  const removeExistingAttachment = (idx) => {
    setFormData(prev=>({
      ...prev,
      attachments: prev.attachments.filter((_,i)=> i!==idx)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanMaterials = formData.materials.filter(m=> m.materialName.trim() && m.quantity.trim() && m.unit.trim());
    if(!formData.description.trim()) return setError('Description required');
    if(!cleanMaterials.length) return setError('At least one material entry complete');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('description', formData.description.trim());
      fd.append('materials', JSON.stringify(cleanMaterials.map(({materialName,quantity,unit})=>({materialName,quantity,unit}))));
      fd.append('attachments', JSON.stringify(formData.attachments));
      newFiles.forEach(f=> fd.append('newAttachments', f));
      await api.put(`/requests/${id}`, fd, { headers: { 'Content-Type':'multipart/form-data' } });
      navigate(`/ceo/material-request/${id}`);
    } catch(err){
      console.error(err);
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // Loading & missing states (minimal, reused styles)
  if (loading) return <div className="mr-loading"><div className="mr-spinner"/><p>Loading request…</p></div>;
  if (!materialRequest) return <div className="mr-loading"><p>{error||'Request not found'}</p><button onClick={handleBack} className="mr-btn ghost" type="button">Back</button></div>;

  const statusClass = `priority-badge-CEO priority-${(materialRequest.status || 'pending').toLowerCase().replace(/\s+/g,'-')}`;

  return (
    <div className="mr-edit-page">
      <AppHeader roleSegment="ceo" />
      <div className="mr-container">
        <div className="mr-page-head">
          <div className="mr-head-text">
            <h1>Edit Material Request</h1>
            <div className="mr-meta-line">
              <span className="mr-id">ID: {materialRequest._id}</span>
              <span className={statusClass}>{materialRequest.status}</span>
              <span className="mr-project">Project: <strong>{materialRequest.project?.projectName||'—'}</strong></span>
            </div>
          </div>
          <div className="mr-head-actions">
            <button type="button" onClick={handleBack} className="mr-btn ghost">Cancel</button>
            <button type="submit" form="mr-form" className="mr-btn primary" disabled={saving}>{saving? 'Saving…':'Save Changes'}</button>
          </div>
        </div>

        {error && <div className="mr-alert error">{error}</div>}

        <form id="mr-form" onSubmit={handleSubmit} className="mr-form" autoComplete="off">
          <div className="mr-grid">
            <section className="mr-section">
              <header><h2>Request Information</h2></header>
              <div className="mr-field">
                <label htmlFor="mr-desc">Description</label>
                <textarea id="mr-desc" name="description" value={formData.description} onChange={handleChange} rows={5} placeholder="Describe the requested materials, purpose, urgency…" />
                <div className="mr-hint">Provide enough context for approvers.</div>
              </div>
              <div className="mr-inline-info">
                <div><span className="lbl">Current Status</span><span className={statusClass}>{materialRequest.status}</span></div>
                <div><span className="lbl">Project</span><span className="val">{materialRequest.project?.projectName||'—'}</span></div>
              </div>
            </section>

            <section className="mr-section">
              <header><h2>Materials</h2></header>
              <div className="mr-materials-wrap">
                <table className="mr-materials-table">
                  <thead>
                    <tr>
                      <th style={{width:'55%'}}>Name</th>
                      <th style={{width:'15%'}}>Qty</th>
                      <th style={{width:'20%'}}>Unit</th>
                      <th style={{width:'10%'}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.materials.map(row=> (
                      <tr key={row.id}>
                        <td>
                          <input type="text" value={row.materialName} onChange={e=>handleMaterialChange(row.id,'materialName',e.target.value)} placeholder="e.g. Cement Type 1" />
                        </td>
                        <td>
                          <input type="text" value={row.quantity} onChange={e=>handleMaterialChange(row.id,'quantity',e.target.value)} placeholder="0" />
                        </td>
                        <td>
                          <select value={row.unit} onChange={e=>handleMaterialChange(row.id,'unit',e.target.value)}>
                            <option value="">Select</option>
                            <option value="pcs">pcs</option>
                            <option value="kg">kg</option>
                            <option value="m">m</option>
                            <option value="l">l</option>
                            <option value="box">box</option>
                            <option value="roll">roll</option>
                            <option value="set">set</option>
                            <option value="pair">pair</option>
                            <option value="unit">unit</option>
                            <option value="bundle">bundle</option>
                          </select>
                        </td>
                        <td className="mr-actions-cell">
                          <button type="button" className="mr-icon-btn danger" onClick={()=>removeMaterialRow(row.id)} disabled={formData.materials.length===1} title="Remove">
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={addMaterialRow} className="mr-btn subtle" style={{marginTop:12}}><FaPlus/> Add Material</button>
              </div>
            </section>

            <section className="mr-section full">
              <header><h2>Attachments</h2></header>
              <div className="mr-attachments">
                {formData.attachments.length===0 && <div className="mr-empty">No attachments.</div>}
                {formData.attachments.length>0 && (
                  <ul className="mr-attachment-list">
                    {formData.attachments.map((att,idx)=>(
                      <li key={idx} className="mr-attachment-item">
                        <a href={`${process.env.REACT_APP_API_BASE_URL||''}/uploads/${att}`} target="_blank" rel="noopener noreferrer" className="file">
                          <FaDownload/> <span>{att}</span>
                        </a>
                        <button type="button" className="mr-icon-btn danger" onClick={()=>removeExistingAttachment(idx)} title="Remove"><FaTrash/></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mr-file-add">
                  <label className="mr-file-drop">
                    <FaPaperclip/> <span>Select Files</span>
                    <input type="file" multiple onChange={onFilesSelected} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" />
                  </label>
                  {newFiles.length>0 && (
                    <ul className="mr-attachment-list new">
                      {newFiles.map((f,i)=>(
                        <li key={i} className="mr-attachment-item">
                          <span className="file"><FaPaperclip/> {f.name}</span>
                          <button type="button" className="mr-icon-btn danger" onClick={()=>removeNewFile(i)}><FaTrash/></button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>
          <div className="mr-floating-bar">
            <div className="inner">
              <span className="hint">Review before saving.</span>
              <div className="actions">
                <button type="button" onClick={handleBack} className="mr-btn ghost">Cancel</button>
                <button type="submit" className="mr-btn primary" disabled={saving}><FaSave/>{saving? 'Saving…':'Save Changes'}</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CeoMaterialRequestEdit;
