/**
 * JalWatch Frontend API Client
 * Connects to the FastAPI backend via the Vite proxy (/api)
 */

const BASE_URL = '/api';

function complaintQuery(params = {}) {
  const searchParams = new URLSearchParams();
  const page = params.page || (params.skip !== undefined ? Math.floor(params.skip / (params.limit || 20)) + 1 : 1);
  const pageSize = params.page_size || params.limit || 25;
  searchParams.set('page', page);
  searchParams.set('page_size', pageSize);
  if (params.ward_id) searchParams.set('ward_id', params.ward_id);
  if (params.category || params.complaint_type) searchParams.set('complaint_type', params.category || params.complaint_type);
  if (params.status) searchParams.set('status', params.status);
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.source) searchParams.set('source', params.source);
  if (params.zone_id) searchParams.set('zone_id', params.zone_id);
  if (params.from_date) searchParams.set('from_date', params.from_date);
  if (params.to_date) searchParams.set('to_date', params.to_date);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.search) searchParams.set('search', params.search);
  return `${BASE_URL}/complaints?${searchParams}`;
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 401 && !url.includes('/auth/')) {
        window.dispatchEvent(new Event('jalwatch:unauthorized'));
      }
      throw new Error(typeof errorData.detail === 'string' ? errorData.detail : `Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    throw err;
  }
}

export const api = {
  getSession: () => fetchJson(`${BASE_URL}/auth/me`),
  login: (password) => fetchJson(`${BASE_URL}/auth/login`, {
    method: 'POST', body: JSON.stringify({ password }),
  }),
  logout: () => fetchJson(`${BASE_URL}/auth/logout`, { method: 'POST' }),
  getCitizenSession: () => fetchJson(`${BASE_URL}/auth/citizen/me`),
  citizenLogin: (email, password) => fetchJson(`${BASE_URL}/auth/citizen/login`, {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),
  citizenRegister: (data) => fetchJson(`${BASE_URL}/auth/citizen/register`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  citizenLogout: () => fetchJson(`${BASE_URL}/auth/citizen/logout`, { method: 'POST' }),
  getPublicWards: () => fetchJson(`${BASE_URL}/public/wards`),
  getPublicLocalities: (wardId) => fetchJson(`${BASE_URL}/public/wards/${encodeURIComponent(wardId)}/localities`),
  updateCitizenLocation: (data) => fetchJson(`${BASE_URL}/auth/citizen/location`, {
    method: 'PATCH', body: JSON.stringify(data),
  }),
  getCitizenSummary: () => fetchJson(`${BASE_URL}/citizen/summary`),
  getMyComplaints: (page = 1) => fetchJson(`${BASE_URL}/citizen/complaints?page=${page}`),
  getMyComplaint: (id) => fetchJson(`${BASE_URL}/citizen/complaints/${encodeURIComponent(id)}`),
  submitCitizenComplaint: (data) => fetchJson(`${BASE_URL}/citizen/complaints`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  getCitizenNotices: () => fetchJson(`${BASE_URL}/citizen/notices`),
  markCitizenNoticeRead: (id) => fetchJson(`${BASE_URL}/citizen/notices/${id}/read`, { method: 'POST' }),
  getServiceNotices: () => fetchJson(`${BASE_URL}/service-notices`),
  createServiceNotice: (data) => fetchJson(`${BASE_URL}/service-notices`, { method: 'POST', body: JSON.stringify(data) }),
  editServiceNotice: (id, data) => fetchJson(`${BASE_URL}/service-notices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  actOnServiceNotice: (id, action) => fetchJson(`${BASE_URL}/service-notices/${id}/action`, {
    method: 'POST', body: JSON.stringify({ action }),
  }),
  getComplaintClusters: (days = 30, wardId) => fetchJson(`${BASE_URL}/clusters?${new URLSearchParams({ days: String(days), ...(wardId ? { ward_id: wardId } : {}) })}`),
  // Dashboard & Analytics Services
  getDashboardSummary: () => fetchJson(`${BASE_URL}/dashboard/summary`),
  getComplaintsByType: () => fetchJson(`${BASE_URL}/dashboard/complaints-by-type`),
  getComplaintsBySeverity: () => fetchJson(`${BASE_URL}/dashboard/complaints-by-severity`),
  getDailyTrend: (days = 30, asOf) => {
    const params = new URLSearchParams({ days: String(days) });
    if (asOf) params.set('as_of', asOf);
    return fetchJson(`${BASE_URL}/dashboard/daily-trend?${params}`);
  },
  getWardPriorities: (days = 30) => fetchJson(`${BASE_URL}/dashboard/ward-priorities?days=${days}`),

  // Complaints
  getComplaintsPage: (params = {}) => fetchJson(complaintQuery(params)),
  getComplaints: async (params = {}) => (await fetchJson(complaintQuery(params))).complaints,
  getComplaintById: (id) => fetchJson(`${BASE_URL}/complaints/${id}`),
  updateComplaintStatus: (id, status, note) => fetchJson(`${BASE_URL}/complaints/${encodeURIComponent(id)}/status`, {
    method: 'PATCH', body: JSON.stringify({ status, note }),
  }),
  addComplaintNote: (id, note) => fetchJson(`${BASE_URL}/complaints/${encodeURIComponent(id)}/notes`, {
    method: 'POST', body: JSON.stringify({ note }),
  }),
  linkComplaintIncident: (id, incidentId) => fetchJson(`${BASE_URL}/complaints/${encodeURIComponent(id)}/incident`, {
    method: 'POST', body: JSON.stringify({ incident_id: incidentId }),
  }),
  addIncidentNote: (id, note, shareWithCitizens = false) => fetchJson(`${BASE_URL}/incidents/${encodeURIComponent(id)}/notes`, {
    method: 'POST', body: JSON.stringify({ note, share_with_citizens: shareWithCitizens }),
  }),

  // Wards & Spatial GIS
  getWards: () => fetchJson(`${BASE_URL}/wards`),
  getLocalities: () => fetchJson(`${BASE_URL}/wards/localities`),
  getWardById: (id) => fetchJson(`${BASE_URL}/wards/${id}`),
  getWardStats: (id) => fetchJson(`${BASE_URL}/wards/${id}/stats`),
  getWardLocalities: (id) => fetchJson(`${BASE_URL}/wards/${encodeURIComponent(id)}/localities`),
  getNetworkNodes: (params = {}) => {
    const sp = new URLSearchParams();
    if (params.ward_id) sp.set('ward_id', params.ward_id);
    if (params.node_type) sp.set('node_type', params.node_type);
    const qs = sp.toString();
    return fetchJson(`${BASE_URL}/network/nodes${qs ? `?${qs}` : ''}`);
  },
  getNetworkPipes: (params = {}) => {
    const sp = new URLSearchParams();
    if (params.ward_id) sp.set('ward_id', params.ward_id);
    if (params.valve_status) sp.set('valve_status', params.valve_status);
    if (params.material) sp.set('material', params.material);
    const qs = sp.toString();
    return fetchJson(`${BASE_URL}/network/pipes${qs ? `?${qs}` : ''}`);
  },
  getNetworkSummary: () => fetchJson(`${BASE_URL}/network/summary`),

  // Alerts System
  getAlerts: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.severity) searchParams.set('severity', params.severity);
    if (params.ward_id) searchParams.set('ward_id', params.ward_id);
    if (params.page_size || params.limit) searchParams.set('page_size', params.page_size || params.limit);
    if (params.page) searchParams.set('page', params.page);
    const qs = searchParams.toString();
    return fetchJson(`${BASE_URL}/alerts${qs ? `?${qs}` : ''}`);
  },
  getActiveAlertCount: () => fetchJson(`${BASE_URL}/alerts/active-count`),
  createAlert: (data) =>
    fetchJson(`${BASE_URL}/alerts`, {
      method: 'POST',
      body: JSON.stringify({
        alert_type: data.alert_type || 'early_warning',
        severity: data.severity || 'high',
        ward_id: data.ward_id,
        locality_id: data.locality_id || null,
        title: data.title,
        description: data.description || '',
        risk_score: data.risk_score ?? 0,
      }),
    }),
  acknowledgeAlert: (id) =>
    fetchJson(`${BASE_URL}/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'acknowledged' }),
    }),
  resolveAlert: (id) =>
    fetchJson(`${BASE_URL}/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
    }),
  dismissAlert: (id) =>
    fetchJson(`${BASE_URL}/alerts/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }),
    }),
  getAlertEvents: (id) => fetchJson(`${BASE_URL}/alerts/${id}/events`),

  // Incidents Response & Work Orders
  getIncidents: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.severity) searchParams.set('severity', params.severity);
    if (params.ward_id) searchParams.set('ward_id', params.ward_id);
    if (params.page_size || params.limit) searchParams.set('page_size', params.page_size || params.limit);
    if (params.page) searchParams.set('page', params.page);
    const qs = searchParams.toString();
    return fetchJson(`${BASE_URL}/incidents${qs ? `?${qs}` : ''}`);
  },
  getIncidentEvents: (incidentId) => fetchJson(`${BASE_URL}/incidents/${encodeURIComponent(incidentId)}/events`),
  getIncident: (incidentId) => fetchJson(`${BASE_URL}/incidents/${encodeURIComponent(incidentId)}`),
  createIncident: (data) =>
    fetchJson(`${BASE_URL}/incidents`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        description: data.description || '',
        ward_id: data.ward_id,
        locality_id: data.locality_id || null,
        latitude: data.latitude,
        longitude: data.longitude,
        incident_type: data.incident_type,
        severity: data.severity,
        assigned_to: data.assigned_to || null,
        related_alert_id: data.related_alert_id || null,
        related_complaint_ids: data.related_complaint_ids || [],
      }),
    }),
  updateIncidentStatus: (incidentId, status, notes = '', assignedTo = '') =>
    fetchJson(`${BASE_URL}/incidents/${incidentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        resolution_notes: notes || undefined,
        assigned_to: assignedTo || undefined,
      }),
    }),

  // AI/ML Predictive Risk Models
  getPredictionsRisk: () => fetchJson(`${BASE_URL}/predictions/risk`),
  getWardRiskPrediction: (wardId) => fetchJson(`${BASE_URL}/predictions/risk/${wardId}`),
  getModelReport: () => fetchJson(`${BASE_URL}/predictions/model`),
  getComplaintAnomalies: () => fetchJson(`${BASE_URL}/predictions/anomalies`),
  scanPredictionAlerts: (data) => fetchJson(`${BASE_URL}/predictions/scan-alerts`, {
    method: 'POST', body: JSON.stringify(data),
  }),
};
