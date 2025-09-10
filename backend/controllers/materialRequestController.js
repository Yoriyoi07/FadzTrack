const MaterialRequest = require('../models/MaterialRequest');
const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');
const { createAndEmitNotification } = require('./notificationController');
const User = require('../models/User');
const supabase = require('../utils/supabaseClient');
const path = require('path');
const { v4: uuid } = require('uuid');
const MR_BUCKET = 'material-request-photos';
const ALT_MR_BUCKET = 'material-photos'; // legacy / mobile possible bucket
// Simple in-memory submission debounce to reduce accidental double-click duplicates
const recentCreateFingerprints = new Map(); // key -> timestamp
const CREATE_DEBOUNCE_MS = 5000; // 5 seconds

// ========== NUDGE PENDING APPROVER ==========
exports.nudgePendingApprover = async (req, res) => {
  try {
    const reqId = req.params.id;
  // Normalize IDs to strings for reliable comparison
  const picId = req.user.id?.toString();
    const request = await MaterialRequest.findById(reqId).populate('project').populate('createdBy');
    if (!request) return res.status(404).json({ message: 'Request not found' });
  console.log('[NUDGE] Incoming nudge', { reqId, picId, status: request.status });

    const project = request.project;
    let pendingUserId = null, pendingRole = null;

    // Always ensure a single recipient
    if (request.status === 'Pending Project Manager' && project.projectmanager) {
      let pmId = project.projectmanager;
      if (Array.isArray(pmId)) {
        console.error('[FATAL] projectmanager is array! Using first:', pmId);
        pmId = pmId[0];
      }
      pendingUserId = pmId?.toString();
      pendingRole = 'Project Manager';
    } else if (request.status === 'Pending Area Manager' && project.areamanager) {
      let amId = project.areamanager;
      if (Array.isArray(amId)) {
        console.error('[FATAL] areamanager is array! Using first:', amId);
        amId = amId[0];
      }
      pendingUserId = amId?.toString();
      pendingRole = 'Area Manager';
    }

    if (!pendingUserId) return res.status(400).json({ message: 'No pending approver to nudge.' });

    // Cooldown: Only 1 nudge per PIC → Approver → Role → Request per hour
    const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
    if (!request.lastNudges) request.lastNudges = [];
    const now = new Date();
    const matching = request.lastNudges.filter(n =>
      n.pic && n.pic.toString() === picId &&
      n.to && n.to.toString() === pendingUserId &&
      (n.role || '').trim().toLowerCase() === pendingRole.toLowerCase()
    );
    let latest = null;
    for (const rec of matching) {
      if (!latest || (rec.timestamp && rec.timestamp > latest.timestamp)) latest = rec;
    }
    console.log('[NUDGE] Matching records count:', matching.length, 'latest:', latest?.timestamp, 'diffMs:', latest? (now - latest.timestamp): null);
    if (latest && latest.timestamp && (now - latest.timestamp) < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (now - latest.timestamp);
      const minutes = Math.ceil(remainingMs / (60 * 1000));
      return res.status(429).json({
        message: `You can only nudge every 1 hour. Try again in ${minutes} minute(s).`,
        nextAllowedAt: latest.timestamp.getTime() + COOLDOWN_MS
      });
    }
    // Prune duplicates: keep only non-matching or the latest one
    if (matching.length > 1 && latest) {
      request.lastNudges = [ ...request.lastNudges.filter(n => !matching.includes(n)), latest ];
    }
    // Record new nudge
    request.lastNudges.push({ pic: picId, to: pendingUserId, role: pendingRole, timestamp: now });
  await request.save();
  console.log('[NUDGE] Updated lastNudges', request.lastNudges.map(n=>({pic:n.pic,to:n.to,role:n.role,ts:n.timestamp,tsMs:n.timestamp?.getTime()})));

    // --- DEBUG PRINT ---
    console.log('[NUDGE] Sending nudge notification to:', pendingUserId, 'role:', pendingRole);

    const message = `You have a pending material request to approve for project "${project.projectName}".`;

    await createAndEmitNotification({
      type: 'nudge',
      toUserId: pendingUserId,
      fromUserId: req.user.id,
      message,
      projectId: project._id,
      requestId: reqId,
      meta: { pendingRole, nudgedBy: req.user.name },
      req
    });

  res.json({ message: `Reminder sent to ${pendingRole}`, nextAllowedAt: now.getTime() + COOLDOWN_MS });
  } catch (err) {
    console.error('Nudge error:', err);
    res.status(500).json({ message: 'Failed to nudge pending approver.' });
  }
};

// ========== CREATE MATERIAL REQUEST ==========
exports.createMaterialRequest = async (req, res) => {
  try {
    const { materials, description, project } = req.body;
    const materialsArray = JSON.parse(materials);
    const missingUnit = materialsArray.some(m => !m.unit || m.unit.trim() === '');
    let attachments = [];
      // Accept pre-uploaded (mobile) attachment URLs/paths: attachmentUrls OR attachments in body
      const rawBodyAttachments = (()=>{
        for(const key of ['attachmentUrls','attachments','files','urls','photos']){
          if(req.body[key]){
            try { const arr = JSON.parse(req.body[key]); if(Array.isArray(arr)) return arr; } catch { if(Array.isArray(req.body[key])) return req.body[key]; }
          }
        }
        // Fallback: scan all body values for supabase public URLs
        const candidates = [];
        const PUBLIC_RX = /https?:\/\/[^\s]+\/storage\/v1\/object\/public\/(material-request-photos|material-photos)\/[^\s]+/i;
        for(const [k,v] of Object.entries(req.body||{})){
          if(typeof v === 'string' && PUBLIC_RX.test(v)) candidates.push(v.trim());
          if(Array.isArray(v)){
            v.forEach(it=>{ if(typeof it==='string' && PUBLIC_RX.test(it)) candidates.push(it.trim()); });
          }
        }
        return candidates.length? candidates : [];
      })();
      const normalizeKey = (val)=>{
        if(!val) return null;
        // If full public URL, strip prefix to store relative key; keep full as fallback copy
        if(/^https?:\/\//i.test(val)){
          // both material-request-photos or legacy material-photos
          const m = val.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
          if(m){
            const bucket = m[1];
            if(bucket === MR_BUCKET){
              return m[2]; // relative key inside bucket
            }
          }
          // If can't parse, store URL directly
          return val;
        }
        return val;
      };
      if(rawBodyAttachments.length){
        const normalized = rawBodyAttachments.map(normalizeKey).filter(Boolean);
        attachments.push(...normalized);
        console.log('[MR CREATE] Collected pre-upload attachments from body:', normalized);
      } else {
        console.log('[MR CREATE] No pre-upload attachment fields detected in body keys:', Object.keys(req.body||{}));
      }

    if(!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required.' });
    }

    // Build a lightweight fingerprint (user+project+desc+first material names) to detect accidental rapid duplicates
    const firstNames = materialsArray.slice(0,3).map(m=> (m.materialName||'').trim().toLowerCase()).join('|');
    const fp = `${req.user.id}|${project}|${description.trim().toLowerCase()}|${firstNames}`;
    const now = Date.now();
    const lastTs = recentCreateFingerprints.get(fp) || 0;
    if (now - lastTs < CREATE_DEBOUNCE_MS) {
      return res.status(429).json({ message: 'Duplicate submission detected. Please wait a moment.' });
    }
    recentCreateFingerprints.set(fp, now);
    if (recentCreateFingerprints.size > 200) {
      for (const [k,ts] of recentCreateFingerprints) if (now - ts > CREATE_DEBOUNCE_MS) recentCreateFingerprints.delete(k);
    }

    if (missingUnit) {
      return res.status(400).json({ message: 'Each material must have a unit.' });
    }

    // Create the request FIRST so we can use its _id in the storage path (folder structure per request per project)
    const newRequest = new MaterialRequest({
        materials: materialsArray,
        description,
        attachments, // may already include pre-uploaded mobile URLs/keys
        project,
        createdBy: req.user.id,
      });
  await newRequest.save();
  console.log('[MR CREATE] Initial request saved with attachments:', newRequest.attachments);

  // Desired structure (per bucket view): <projectId>/material-requests/<file>
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const ext = path.extname(f.originalname) || '';
        // Align with mobile pattern: material-requests/<userId>/<file>
        const key = `material-requests/${req.user.id}/${Date.now()}-${uuid()}${ext}`;
        const { error: upErr } = await supabase.storage.from(MR_BUCKET).upload(key, f.buffer, { upsert:false, contentType: f.mimetype });
        if (upErr) {
          console.error('[MR UPLOAD] Failed upload', f.originalname, upErr.message);
          continue; // skip failing file
        }
        attachments.push(key);
      }
      if (attachments.length) {
        newRequest.attachments = Array.from(new Set([...(newRequest.attachments||[]), ...attachments]));
        await newRequest.save();
        console.log('[MR CREATE] After file uploads, final attachments:', newRequest.attachments);
      } else {
        console.log('[MR CREATE] No server-side file uploads present');
      }
    }

    const projectDoc = await Project.findById(project);
    const projectName = projectDoc ? projectDoc.projectName : 'Unknown Project';

    // Defensive: Only send to a single projectmanager
    if (projectDoc && projectDoc.projectmanager) {
      let pmId = projectDoc.projectmanager;
      if (Array.isArray(pmId)) {
        console.error('[FATAL NOTIFY] Project.projectmanager is array! Using first:', pmId);
        pmId = pmId[0];
      }
      if (pmId) {
        console.log('[DEBUG] Will send notification to:', pmId);
        await createAndEmitNotification({
          type: 'material_request_created',
          toUserId: pmId,
          fromUserId: req.user.id,
          message: `New material request for project: ${projectName}`,
          projectId: projectDoc._id,
          requestId: newRequest._id,
          meta: { description },
          req
        });
      }
    }

    await logAction({
      action: 'CREATE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Created material request for project ${projectName}`,
      meta: { requestId: newRequest._id, projectId: projectDoc?._id, projectName, context: 'material' }
    });

    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_CREATE_MATERIAL_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO created material request for project ${projectName}`,
    meta: { requestId: newRequest._id, projectId: projectDoc?._id, projectName, context: 'material' }
      });
    }

    res.status(201).json(newRequest);
  } catch (error) {
    console.error('❌ Error creating material request:', error);
    res.status(500).json({ message: 'Failed to create material request' });
  }
};

// ========== GET ALL MATERIAL REQUESTS ==========
exports.getAllMaterialRequests = async (req, res) => {
  try {
    await exports.updateRequestStatuses();
    const requests = await MaterialRequest.find()
      .sort({ createdAt: -1 })
      .populate('project', 'projectName')
      .populate('createdBy', 'name role');
    res.status(200).json(requests);
  } catch (error) {
    console.error('❌ Error fetching material requests:', error);
    res.status(500).json({ message: 'Failed to fetch material requests' });
  }
};

// ========== GET SINGLE MATERIAL REQUEST ==========
exports.getMaterialRequestById = async (req, res) => {
  try {
    await exports.updateRequestStatuses();
    const request = await MaterialRequest.findById(req.params.id)
      .populate({ path: 'project', select: 'projectName location budget', populate: { path: 'location', select: 'name region' } })
      .populate('createdBy', 'name role email')
      .populate('approvals.user', 'name role');
    if (!request) return res.status(404).json({ message: 'Not found' });
    // If there's a purchaseOrder stored, generate a signed URL (short-lived) for client preview/downloading
    let poSignedUrl = null;
    try {
      if (request.purchaseOrder) {
        const { data, error } = await supabase.storage.from(MR_BUCKET).createSignedUrl(request.purchaseOrder, 60 * 10); // 10 min
        if (!error) poSignedUrl = data?.signedUrl || null; else console.warn('[PO SIGNED URL] failed', error.message);
      }
    } catch (e) { console.warn('[PO SIGNED URL] exception', e); }
    const json = request.toObject();
    if (poSignedUrl) json.purchaseOrderSignedUrl = poSignedUrl;
    res.json(json);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching material request' });
  }
};

// ========== UPDATE MATERIAL REQUEST ==========
exports.updateMaterialRequest = async (req, res) => {
  try {
  const { materials, description, attachments } = req.body;
    const materialsArray = JSON.parse(materials);
    const missingUnit = materialsArray.some(m => !m.unit || m.unit.trim() === '');
    let updatedAttachments = [];

    if (missingUnit) {
      return res.status(400).json({ message: 'Each material must have a unit.' });
    }
    try {
      updatedAttachments = JSON.parse(attachments || '[]');
    } catch { updatedAttachments = Array.isArray(attachments)? attachments: []; }
    if((!updatedAttachments || !updatedAttachments.length)){
      for(const key of ['attachmentUrls','files','urls','photos']){
        if(req.body[key]){
          try { const arr = JSON.parse(req.body[key]); if(Array.isArray(arr)) { updatedAttachments = arr; break; } }
          catch { if(Array.isArray(req.body[key])) { updatedAttachments = req.body[key]; break; } }
        }
      }
    }
    const normalizeKey = (val)=>{
      if(!val) return null;
      if(/^https?:\/\//i.test(val)){
        const m = val.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
        if(m && m[1] === MR_BUCKET) return m[2];
        return val; // keep as-is if can't parse
      }
      return val;
    };
    updatedAttachments = updatedAttachments.map(normalizeKey).filter(Boolean);
    // Fetch existing request to know its project for pathing
    let existingForPath = null;
    try { existingForPath = await MaterialRequest.findById(req.params.id).select('project'); } catch {}
  const projectIdForPath = existingForPath?.project?.toString() || 'orphan'; // kept for potential future use
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const ext = path.extname(f.originalname) || '';
        const key = `material-requests/${req.user.id}/${Date.now()}-${uuid()}${ext}`;
        const { error: upErr } = await supabase.storage.from(MR_BUCKET).upload(key, f.buffer, { upsert:false, contentType: f.mimetype });
        if (upErr) {
          console.error('[MR UPDATE UPLOAD] Failed upload', f.originalname, upErr.message);
          continue;
        }
        updatedAttachments.push(key);
      }
    }
    // Normalize any provided attachment keys that are full public URLs
    const PUBLIC_PREFIX = '/storage/v1/object/public/material-request-photos/';
    updatedAttachments = updatedAttachments.map(k=>{
      if(!k) return k;
      if(k.startsWith('http')){
        const idx = k.indexOf(PUBLIC_PREFIX);
        if(idx!==-1) return k.slice(idx+PUBLIC_PREFIX.length);
        // Legacy alternate bucket name typo handling
        const alt = '/storage/v1/object/public/material-photos/';
        const idx2 = k.indexOf(alt); if(idx2!==-1) return k.slice(idx2+alt.length);
      }
      return k;
    });
    const updated = await MaterialRequest.findByIdAndUpdate(
      req.params.id,
      {
        materials: JSON.parse(materials),
        description,
        attachments: updatedAttachments,
      },
      { new: true }
    ).populate('project', 'projectName')
     .populate('createdBy', 'name role');

    await logAction({
      action: 'UPDATE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Updated material request for project ${updated?.project?.projectName || updated?.project}`,
      meta: { requestId: updated?._id }
    });

    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_UPDATE_MATERIAL_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO updated material request for project ${updated?.project?.projectName || updated?.project}`,
        meta: { requestId: updated?._id }
      });
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating request:', err);
    res.status(500).json({ message: 'Failed to update material request' });
  }
};

// ========== DELETE MATERIAL REQUEST ==========
exports.deleteMaterialRequest = async (req, res) => {
  try {
    const result = await MaterialRequest.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Request not found' });

    await logAction({
      action: 'DELETE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Deleted material request for project ${result?.project}`,
      meta: { requestId: result?._id }
    });

    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_DELETE_MATERIAL_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO deleted material request for project ${result?.project}`,
        meta: { requestId: result?._id }
      });
    }

    res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling request', err });
  }
};

// ========== SIGNED URLS FOR ATTACHMENTS ==========
exports.getMaterialRequestAttachmentSignedUrls = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Not found' });
    const output = [];
  console.log('[MR SIGNED] Request attachments raw:', request.attachments);
  const SUPABASE_PUBLIC_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const PUBLIC_PREFIX = SUPABASE_PUBLIC_BASE ? `${SUPABASE_PUBLIC_BASE}/storage/v1/object/public/${MR_BUCKET}/` : null;
    const ALT_PUBLIC_PREFIX = SUPABASE_PUBLIC_BASE ? `${SUPABASE_PUBLIC_BASE}/storage/v1/object/public/${ALT_MR_BUCKET}/` : null;
    // One-time normalization: convert stored full URLs (our bucket) into relative keys and persist
  let mutated = false;
  const originalMap = new Map();
    if(PUBLIC_PREFIX){
      const newAtt = (request.attachments||[]).map(a=>{
        if(typeof a === 'string' && a.startsWith(PUBLIC_PREFIX)) { mutated = true; const rel=a.slice(PUBLIC_PREFIX.length); originalMap.set(rel,a); return rel; }
        if(ALT_PUBLIC_PREFIX && typeof a==='string' && a.startsWith(ALT_PUBLIC_PREFIX)) { mutated = true; const rel=a.slice(ALT_PUBLIC_PREFIX.length); originalMap.set(rel,a); return rel; }
        return a;
      });
      if(mutated){
        request.attachments = newAtt;
        try { await request.save(); console.log('[MR SIGNED] Normalized and saved attachment keys:', newAtt); }
        catch(e){ console.warn('[MR SIGNED] Failed to save normalized attachments', e?.message); }
      }
    }
    const buildAltCandidates = (raw)=>{
      const set = new Set();
      if(!raw) return [];
      // original
      set.add(raw);
      // Remove any leading slash
      if(raw.startsWith('/')) set.add(raw.slice(1));
      const noBackslash = raw.replace(/\\/g,'/');
      set.add(noBackslash);
      // If raw contains full domain, strip to after bucket markers (already handled but re-add)
      const domainMatch = noBackslash.match(/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if(domainMatch){ set.add(domainMatch[2]); }
      // If path includes projectId/material-requests/... try with and without projectId
      const projStrip = noBackslash.replace(/^[^/]+\/material-requests\//,'material-requests/');
      set.add(projStrip);
      // If it already has material-requests/<user>/file try collapsing user folder
      const parts = noBackslash.split('/');
      if(parts.length>=3 && parts[0]==='material-requests'){
        set.add(`material-requests/${parts[parts.length-1]}`);
      }
      // Generate tail combinations (take last 2 segments)
      if(parts.length>2){
        const last2 = parts.slice(-2).join('/');
        set.add(last2);
        set.add(`material-requests/${last2}`);
      }
      // Replace underscores vs hyphens in first segment
      set.add(noBackslash.replace(/material[_]requests/,'material-requests'));
      set.add(noBackslash.replace(/material[-]requests/,'material-requests'));
      // Remove duplicate 'material-requests/material-requests'
      set.add(noBackslash.replace(/material-requests\/material-requests\//,'material-requests/'));
      return Array.from(set).filter(Boolean);
    };
    for (let originalKey of request.attachments || []) {
      let a = originalKey; const originalFull = originalMap.get(a) || null;
      // After normalization above, any full bucket URL should already be relative. Only handle external full URLs now.
      if(/^https?:\/\//i.test(a)){
        output.push({ key: a, signedUrl: a, external:true });
        continue;
      }
      // Primary attempt
  let { data, error } = await supabase.storage.from(MR_BUCKET).createSignedUrl(a, 60 * 10);
      if (!error) {
        output.push({ key: a, signedUrl: data?.signedUrl, bucket: MR_BUCKET, originalFull });
        continue;
      }
      // Build exhaustive alt candidates
      const altKeys = buildAltCandidates(a);
  console.log('[MR SIGNED] Primary failed for', a, 'trying candidates:', altKeys);
      const tried = new Set([a]);
      let success = false; let finalKey = a; let finalUrl = null; let finalBucket = MR_BUCKET;
      for(const alt of altKeys){
        if(tried.has(alt)) continue; tried.add(alt);
        const r = await supabase.storage.from(MR_BUCKET).createSignedUrl(alt, 60 * 10);
        if(!r.error){ success = true; finalKey = alt; finalUrl = r.data?.signedUrl; break; }
      }
      if(!success){
        // try alternate bucket
        for(const alt of altKeys){
          if(tried.has('ALT:'+alt)) continue; tried.add('ALT:'+alt);
          const r2 = await supabase.storage.from(ALT_MR_BUCKET).createSignedUrl(alt, 60 * 10);
          if(!r2.error){ success = true; finalKey = alt; finalUrl = r2.data?.signedUrl; finalBucket = ALT_MR_BUCKET; break; }
        }
      }
      if(!success){
        console.error('[MR SIGNED] still failed for', a, 'candidates tried', Array.from(tried));
        // Fallback: if we can construct a public URL (bucket might actually exist in mobile project), attempt to return a guess
        if(SUPABASE_PUBLIC_BASE && !/^https?:\/\//i.test(originalKey)){
          const guessUrl = `${SUPABASE_PUBLIC_BASE}/storage/v1/object/public/${MR_BUCKET}/${a}`;
          output.push({ key: a, signedUrl: guessUrl, bucket: MR_BUCKET, guessed:true });
          console.warn('[MR SIGNED] Provided guessed public URL for', a);
        }
        continue;
      }
  output.push({ key: finalKey, signedUrl: finalUrl, bucket: finalBucket, original: originalKey, originalFull });
    }
    res.json(output);
  } catch (e) {
    console.error('Signed URL error', e);
    res.status(500).json({ message: 'Failed to generate signed urls' });
  }
};

// ========== APPROVE MATERIAL REQUEST ==========
exports.approveMaterialRequest = async (req, res) => {
  const { decision, reason } = req.body;
  const userId = req.user.id.toString();
  const userRole = req.user.role;
  try {
    const request = await MaterialRequest.findById(req.params.id).populate('project');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // CEO no longer participates in approvals
    if (userRole === 'CEO') {
      return res.status(403).json({ message: 'CEO cannot approve material requests. View only.' });
    }

    const { project } = request;
    if (!project) return res.status(500).json({ message: 'No linked project.' });
    if (!project.projectmanager) return res.status(500).json({ message: 'Project has no projectmanager assigned.' });
    if (!project.areamanager) return res.status(500).json({ message: 'Project has no areamanager assigned.' });

    // --- Debug logs ---
    console.log("Approval Debug:");
    console.log("userId: ", userId);
    console.log("userRole: ", userRole);
    console.log("project.projectmanager: ", project.projectmanager);
    console.log("project.areamanager: ", project.areamanager);

    const idsEqual = (a, b) => String(a) === String(b);

    let pmId = project.projectmanager;
    let amId = project.areamanager;
    if (Array.isArray(pmId)) pmId = pmId[0];
    if (Array.isArray(amId)) amId = amId[0];

  const isPM = idsEqual(pmId, userId);
  const isAM = idsEqual(amId, userId);

    let nextStatus = '';
    let currentStatus = request.status;

    // Workflow status logic
    if (currentStatus === 'Pending Project Manager' && isPM) {
      nextStatus = decision === 'approved' ? 'Pending Area Manager' : 'Denied by Project Manager';
    } else if (currentStatus === 'Pending Area Manager' && isAM) {
      // After AM approval, directly mark as Approved (CEO removed). If approved and PO data provided, store it.
      nextStatus = decision === 'approved' ? 'Approved' : 'Denied by Area Manager';
    } else {
      console.log('403: Unauthorized or invalid state', {currentStatus, isPM, isAM});
      return res.status(403).json({ message: 'Unauthorized or invalid state' });
    }

    // Log this approval action
    request.approvals.push({
      role: userRole,
      user: userId,
      decision,
      reason,
      timestamp: new Date()
    });
    // Handle Purchase Order upload only when AM approves (final approval)
    let poStoredKey = null;
    let suppliedTotalValue = null;
    if (decision === 'approved' && isAM && nextStatus === 'Approved') {
      // Accept totalValue and purchase order file
      if (req.body.totalValue) {
        const parsed = Number(req.body.totalValue);
        if (!isNaN(parsed) && parsed >= 0) suppliedTotalValue = parsed; else suppliedTotalValue = null;
      }
      if (req.file) {
        try {
          const ext = path.extname(req.file.originalname) || '';
          const key = `purchase-orders/${Date.now()}-${uuid()}${ext}`;
          const { error: upErr } = await supabase.storage.from(MR_BUCKET).upload(key, req.file.buffer, { upsert:false, contentType: req.file.mimetype });
          if (upErr) {
            console.error('[PO UPLOAD] Failed upload', req.file.originalname, upErr.message);
          } else {
            poStoredKey = key;
          }
        } catch (e) { console.error('[PO UPLOAD] exception', e); }
      }
      if (poStoredKey) request.purchaseOrder = poStoredKey;
      if (typeof suppliedTotalValue === 'number') request.totalValue = suppliedTotalValue;
    }

    request.status = nextStatus;
    await request.save();

    // Deduct budget after final approval if we have a total value and project has a numeric budget
    // Track budgets for response payload
    let prevBudget = null; let newBudget = null;
  if (decision === 'approved' && isAM && nextStatus === 'Approved' && typeof request.totalValue === 'number') {
      try {
        if (typeof project.budget === 'number') {
          prevBudget = project.budget;
          project.budget = Math.max(0, prevBudget - request.totalValue);
          newBudget = project.budget;
          await project.save();
          await logAction({
            action: 'DEDUCT_PROJECT_BUDGET_PO',
            performedBy: req.user.id,
            performedByRole: req.user.role,
      description: `Deducted PO value ${request.totalValue} from project ${project.projectName} (prev ${prevBudget} new ${project.budget})${request.totalValue > prevBudget ? ' (OVER BUDGET)' : ''}`,
      meta: { requestId: request._id, projectId: project._id, poValue: request.totalValue, prevBudget, newBudget, overBudget: request.totalValue > prevBudget }
          });
        }
      } catch (bdErr) { console.error('[BUDGET DEDUCT] failed', bdErr); }
    }

    // NOTIFY NEXT APPROVER
    if (decision === 'approved') {
      if (nextStatus === 'Pending Area Manager' && project.areamanager) {
        let amId = project.areamanager;
        if (Array.isArray(amId)) amId = amId[0];
        if (amId) {
          await createAndEmitNotification({
            type: 'pending_approval',
            toUserId: amId,
            fromUserId: req.user.id,
            message: `You have a material request pending approval for project "${project.projectName}".`,
            projectId: project._id,
            requestId: request._id,
            meta: { pendingRole: 'Area Manager', fromRole: req.user.role, approvedBy: req.user.name },
            req
          });
        }
      }
    // CEO step removed; no further approver after AM
    // Notify PIC/requestor on final approval (status now 'Approved' meaning: waiting for PIC receipt)
      if (nextStatus === 'Approved') {
        const requestorId = request.createdBy;
        await createAndEmitNotification({
          type: 'approved',
          toUserId: requestorId,
          fromUserId: req.user.id,
      message: `Your material request for project "${project.projectName}" is fully approved and awaiting receipt confirmation.`,
          projectId: project._id,
          requestId: request._id,
          meta: { approvedBy: req.user.name },
          req
        });
      }
    }

    // NOTIFY PIC/REQUESTOR ON DENIED (any stage)
    if (decision === 'denied' && (
      nextStatus === 'Denied by Project Manager' ||
      nextStatus === 'Denied by Area Manager'
    )) {
      const requestorId = request.createdBy;
      await createAndEmitNotification({
        type: 'denied',
        toUserId: requestorId,
        fromUserId: req.user.id,
        message: `Your material request for project "${project.projectName}" was denied by the ${userRole}${reason ? `: ${reason}` : ''}.`,
        projectId: project._id,
        requestId: request._id,
        meta: { deniedBy: req.user.name, deniedRole: userRole, reason },
        req
      });
    }

    await logAction({
      action: 'APPROVE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Approved material request for project ${project.projectName}`,
      meta: { requestId: request._id }
    });

  // Include updated project budget snapshot (if available) & signed URL for PO if newly added
  let poSignedUrl = null;
  try {
    if (request.purchaseOrder) {
      const { data, error } = await supabase.storage.from(MR_BUCKET).createSignedUrl(request.purchaseOrder, 60 * 10);
      if (!error) poSignedUrl = data?.signedUrl || null;
    }
  } catch (e) { /* swallow */ }
  const deduction = (typeof request.totalValue === 'number') ? request.totalValue : null;
  res.status(200).json({
    message: `Request ${decision} by ${userRole}`,
    request,
    projectBudget: request.project?.budget,
    purchaseOrderSignedUrl: poSignedUrl,
    prevBudget,
    newBudget,
    deduction,
    overBudget: (typeof prevBudget === 'number' && typeof deduction === 'number') ? deduction > prevBudget : null
  });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ message: 'Failed to process approval' });
  }
};


// ========== GET MY MATERIAL REQUESTS ==========
exports.getMyMaterialRequests = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  try {
    await exports.updateRequestStatuses();
    let requests = [];
    if (userRole === 'PIC' || userRole === 'Person in Charge') {
      requests = await MaterialRequest.find({ createdBy: userId })
        .populate({ path: 'project', select: 'projectName location', populate: { path: 'location', select: 'name region' } })
        .populate('createdBy', 'name role email');
    } else if (userRole === 'PM' || userRole === 'Project Manager') {
      const projects = await Project.find({ projectmanager: userId });
      requests = await MaterialRequest.find({ project: { $in: projects.map(p => p._id) } })
        .populate({ path: 'project', select: 'projectName location', populate: { path: 'location', select: 'name region' } })
        .populate('createdBy', 'name role email');
    } else if (userRole === 'AM' || userRole === 'Area Manager') {
      const projects = await Project.find({ areamanager: userId });
      requests = await MaterialRequest.find({ project: { $in: projects.map(p => p._id) } })
        .populate({ path: 'project', select: 'projectName location', populate: { path: 'location', select: 'name region' } })
        .populate('createdBy', 'name role email');
    } else if (userRole === 'CEO') {
      requests = await MaterialRequest.find()
        .populate({ path: 'project', select: 'projectName location', populate: { path: 'location', select: 'name region' } })
        .populate('createdBy', 'name role email');
    } else {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching requests' });
  }
};

// ========== MARK AS RECEIVED ==========
exports.markReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Material request not found' });

    const userId = req.user.id.toString();
    const createdBy = request.createdBy.toString();

    if (createdBy !== userId) {
      return res.status(403).json({ message: 'Not your request.' });
    }

  if (request.status !== 'Approved') return res.status(400).json({ message: 'Request is not fully approved yet.' });
  if (request.receivedByPIC || request.status === 'Received') return res.status(400).json({ message: 'Already marked as received.' });

  request.receivedByPIC = true;
  request.receivedDate = new Date();
  request.status = 'Received';
  await request.save();
  res.json({ message: 'Marked as received. Status updated to Received.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as received', error: err.message });
  }
};

// ========== ARCHIVE REQUESTS FOR COMPLETED PROJECTS ==========
exports.archiveRequestsForCompletedProjects = async () => {
  try {
    console.log('[MATERIAL ARCHIVE] Starting archive check for completed projects...');
    
    // Find all completed projects
    const completedProjects = await Project.find({ 
      status: 'Completed',
      isDeleted: { $ne: true }
    });
    
    console.log(`[MATERIAL ARCHIVE] Found ${completedProjects.length} completed projects`);
    
    // Find all soft-deleted projects
    const softDeletedProjects = await Project.find({ 
      isDeleted: true 
    });
    
    console.log(`[MATERIAL ARCHIVE] Found ${softDeletedProjects.length} soft-deleted projects`);
    
    const allProjectsToArchive = [...completedProjects, ...softDeletedProjects];
    
    for (const project of allProjectsToArchive) {
      // Find all material requests for this project that are not already archived
      const requestsToArchive = await MaterialRequest.find({
        project: project._id,
        isArchived: { $ne: true },
        status: { $ne: 'Archived' }
      });
      
      console.log(`[MATERIAL ARCHIVE] Found ${requestsToArchive.length} requests to archive for project: ${project.projectName}`);
      
      for (const request of requestsToArchive) {
        // Preserve original project and request information
        request.originalProjectName = project.projectName;
        request.originalProjectEndDate = project.endDate;
        request.originalRequestStatus = request.status;
        request.originalRequestDetails = {
          description: request.description,
          materials: request.materials,
          attachments: request.attachments,
          createdBy: request.createdBy,
          approvals: request.approvals,
          receivedByPIC: request.receivedByPIC,
          purchaseOrder: request.purchaseOrder,
          totalValue: request.totalValue,
          receivedDate: request.receivedDate,
          receivedAt: request.receivedAt,
          receivedBy: request.receivedBy
        };
        
        // Set archived reason based on project status
        if (project.status === 'Completed') {
          request.archivedReason = `Project Completed - Request was ${request.status}`;
        } else if (project.isDeleted) {
          request.archivedReason = `Project Cancelled (${project.deletionReason || 'No reason provided'}) - Request was ${request.status}`;
        }
        
        request.isArchived = true;
        request.status = 'Archived';
        
        await request.save();
        console.log(`[MATERIAL ARCHIVE] Archived request ${request._id} for project: ${project.projectName}`);
      }
    }
    
    console.log('[MATERIAL ARCHIVE] Archive check completed');
  } catch (error) {
    console.error('[MATERIAL ARCHIVE] Error archiving requests:', error);
  }
};

// ========== UPDATE REQUEST STATUSES ==========
exports.updateRequestStatuses = async () => {
  try {
    await exports.archiveRequestsForCompletedProjects();
  } catch (error) {
    console.error('[MATERIAL STATUS UPDATE] Error updating request statuses:', error);
  }
};

// ========== MANUAL ARCHIVE MATERIAL REQUEST ==========
exports.archiveMaterialRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id);
    
    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }
    
    if (request.isArchived) {
      return res.status(400).json({ message: 'Request is already archived' });
    }
    
    // Preserve original information
    request.originalProjectName = request.project?.projectName || 'Unknown Project';
    request.originalRequestStatus = request.status;
    request.originalRequestDetails = {
      description: request.description,
      materials: request.materials,
      attachments: request.attachments,
      createdBy: request.createdBy,
      approvals: request.approvals,
      receivedByPIC: request.receivedByPIC,
      purchaseOrder: request.purchaseOrder,
      totalValue: request.totalValue,
      receivedDate: request.receivedDate,
      receivedAt: request.receivedAt,
      receivedBy: request.receivedBy
    };
    
    request.archivedReason = `Manually Archived - Request was ${request.status}`;
    request.isArchived = true;
    request.status = 'Archived';
    
    await request.save();
    
    await logAction({
      action: 'ARCHIVE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Manually archived material request`,
      meta: { requestId: request._id }
    });
    
    res.json({ message: 'Request archived successfully' });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ message: 'Failed to archive request' });
  }
};

// ========== DELETE ARCHIVED REQUEST ==========
exports.deleteArchivedRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id);
    
    if (!request) {
      return res.status(404).json({ message: 'Material request not found' });
    }
    
    if (!request.isArchived) {
      return res.status(400).json({ message: 'Only archived requests can be permanently deleted' });
    }
    
    await MaterialRequest.findByIdAndDelete(id);
    
    await logAction({
      action: 'DELETE_ARCHIVED_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Permanently deleted archived material request`,
      meta: { requestId: request._id }
    });
    
    res.json({ message: 'Archived request permanently deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Failed to delete archived request' });
  }
};
