import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, SlidersHorizontal } from 'lucide-react';
import { api } from '../api';

const displayDate = (value, includeTime = false) => value
  ? (includeTime ? new Date(value).toLocaleString() : new Date(value).toLocaleDateString())
  : 'Unknown';

export default function ComplaintsView() {
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [wards, setWards] = useState([]);
  const [localities, setLocalities] = useState({});
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [inspectComplaint, setInspectComplaint] = useState(null);

  const PAGE_SIZE = 25;

  const loadWards = async () => {
    try {
      setWards(await api.getWards());
    } catch (err) {
      console.error('Failed to load wards:', err);
    }
    try {
      const localityData = await api.getLocalities();
      setLocalities(Object.fromEntries(localityData.map((locality) => [locality.locality_id, locality.locality_name])));
    } catch (err) {
      console.error('Failed to load locality names:', err);
    }
  };

  const loadComplaints = async () => {
    try {
      setLoading(true);
      const data = await api.getComplaintsPage({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        ward_id: selectedWard || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        severity: selectedSeverity || undefined,
        search: searchQuery.trim() || undefined,
      });
      setComplaints(data.complaints);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWards();
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [page, selectedWard, selectedCategory, selectedStatus, selectedSeverity, searchQuery]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Explore / Complaints</span>
          <h1>Complaints</h1>
          <p>Browse the reported issues in the provided dataset.</p>
        </div>
        <span className="quiet-note">{total.toLocaleString()} records</span>
      </div>

      <div className="glass-card complaint-filter-card">
        <div className="complaint-filter-row">
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              placeholder="Search by ID, locality, or type..."
              aria-label="Search complaints"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="input"
              style={{ width: '100%', paddingLeft: 36 }}
            />
          </div>

          <select
            value={selectedWard}
            onChange={(e) => { setSelectedWard(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '1 1 190px' }}
            aria-label="Filter by ward"
          >
            <option value="">All wards</option>
            {wards.map((w) => (
              <option key={w.ward_id} value={w.ward_id}>
                {w.ward_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowMoreFilters((current) => !current)}
            aria-expanded={showMoreFilters}
          >
            <SlidersHorizontal size={16} />
            <span>More filters{[selectedCategory, selectedStatus, selectedSeverity].filter(Boolean).length > 0 ? ` (${[selectedCategory, selectedStatus, selectedSeverity].filter(Boolean).length})` : ''}</span>
          </button>
        </div>
        {showMoreFilters && <div className="complaint-filter-row">
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '1 1 160px' }}
            aria-label="Filter by complaint type"
          >
            <option value="">All types</option>
            <option value="low_pressure">Low Pressure</option>
            <option value="dirty_water">Dirty Water</option>
            <option value="leakage">Leakage</option>
            <option value="water_shortage">Water Shortage</option>
            <option value="bad_smell">Bad Smell</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '1 1 140px' }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => { setSelectedSeverity(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '1 1 140px' }}
            aria-label="Filter by severity"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {(selectedCategory || selectedStatus || selectedSeverity) && (
            <button type="button" className="text-action" onClick={() => { setSelectedCategory(''); setSelectedStatus(''); setSelectedSeverity(''); setPage(0); }}>Clear</button>
          )}
        </div>}
      </div>

      {/* Complaints Table */}
      <div className="glass-card" style={{ padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Loading complaints...
          </div>
        ) : complaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            No complaints match these filters.
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table complaint-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Locality</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.complaint_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {c.complaint_id}
                    </td>
                    <td style={{ color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{localities[c.locality_id] || c.locality || c.locality_id || 'Ward area'}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{wards.find((w) => w.ward_id === c.ward_id)?.ward_name || c.ward_id}</span>
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {(c.complaint_type || c.category || '').replace(/_/g, ' ')}
                    </td>
                    <td>
                      <span className={`badge badge-${c.severity}`}>
                        {c.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'resolved' ? 'badge-success' : 'badge-low'}`}>
                        {c.status?.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>{displayDate(c.reported_at || c.created_at)}</td>
                    <td>
                      <button
                        onClick={() => setInspectComplaint(c)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Page {page + 1} of {totalPages}
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page + 1 >= totalPages || loading}
              className="btn btn-secondary btn-sm"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Complaint Detail Modal */}
      {inspectComplaint && (
        <div className="modal-backdrop" onClick={() => setInspectComplaint(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  {inspectComplaint.complaint_id}
                </span>
                <h3 style={{ marginTop: 4, textTransform: 'capitalize' }}>
                  {(inspectComplaint.complaint_type || inspectComplaint.category || '').replace(/_/g, ' ')}
                </h3>
              </div>
              <button 
                onClick={() => setInspectComplaint(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`badge badge-${inspectComplaint.severity}`}>
                  Priority: {inspectComplaint.severity}
                </span>
                <span className={`badge ${inspectComplaint.status === 'resolved' ? 'badge-success' : 'badge-low'}`}>
                  Status: {inspectComplaint.status}
                </span>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-surface-elevated)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Description
                </span>
                <p style={{ color: 'var(--text-primary)' }}>
                  {inspectComplaint.description || 'No description recorded.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Locality:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {localities[inspectComplaint.locality_id] || inspectComplaint.locality || inspectComplaint.locality_id || 'Ward area'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Ward ID:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inspectComplaint.ward_id}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Coordinates:</span>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>
                    {inspectComplaint.latitude?.toFixed(4)}, {inspectComplaint.longitude?.toFixed(4)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Lodged Date:</span>
                  <div>{displayDate(inspectComplaint.reported_at || inspectComplaint.created_at, true)}</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setInspectComplaint(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
