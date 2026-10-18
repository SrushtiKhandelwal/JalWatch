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
  // Dashboard & Analytics Services
  getDashboardSummary: () => fetchJson(`${BASE_URL}/dashboard/summary`),
  getComplaintsByType: () => fetchJson(`${BASE_URL}/dashboard/complaints-by-type`),
  getComplaintsBySeverity: () => fetchJson(`${BASE_URL}/dashboard/complaints-by-severity`),
  getDailyTrend: (days = 30) => fetchJson(`${BASE_URL}/dashboard/daily-trend?days=${days}`),
  getWardPriorities: (days = 30) => fetchJson(`${BASE_URL}/dashboard/ward-priorities?days=${days}`),

  // Complaints
  getComplaintsPage: (params = {}) => fetchJson(complaintQuery(params)),
  getComplaints: async (params = {}) => (await fetchJson(complaintQuery(params))).complaints,
  getComplaintById: (id) => fetchJson(`${BASE_URL}/complaints/${id}`),

  // Wards & Spatial GIS
  getWards: () => fetchJson(`${BASE_URL}/wards`),
  getWardById: (id) => fetchJson(`${BASE_URL}/wards/${id}`),
  getWardStats: (id) => fetchJson(`${BASE_URL}/wards/${id}/stats`),

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
};
