import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  AlertCircle,
  Eye
} from 'lucide-react';
import { api } from '../api';

export default function ComplaintsView() {
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectComplaint, setInspectComplaint] = useState(null);

  const PAGE_SIZE = 25;

  const loadWards = async () => {
    try {
      const data = await api.getWards();
      setWards(data);
    } catch (err) {
      console.error(err);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
            Nagpur Citizen Grievance Explorer
          </h1>
          <span className="badge badge-low" style={{ textTransform: 'none' }}>
            Seeded Complaint Records
          </span>
        </div>
        <p style={{ fontSize: '0.875rem', marginTop: 4 }}>
          Browse, filter, and audit citizen grievances sourced from the NMC water grievance database.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              placeholder="Search by ID or locality..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="input"
              style={{ width: '100%', paddingLeft: 36 }}
            />
          </div>

          {/* Ward filter */}
          <select
            value={selectedWard}
            onChange={(e) => { setSelectedWard(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '1 1 160px' }}
          >
            <option value="">All Wards (38)</option>
            {wards.map((w) => (
              <option key={w.ward_id} value={w.ward_id}>
                {w.ward_name} ({w.ward_id})
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '1 1 160px' }}
          >
            <option value="">All Categories</option>
            <option value="low_pressure">Low Pressure</option>
            <option value="dirty_water">Dirty Water</option>
            <option value="leakage">Leakage</option>
            <option value="water_shortage">Water Shortage</option>
            <option value="bad_smell">Bad Smell</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '0 1 140px' }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          {/* Severity filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => { setSelectedSeverity(e.target.value); setPage(0); }}
            className="select"
            style={{ flex: '0 1 140px' }}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="glass-card" style={{ padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Retrieving complaints dataset...
          </div>
        ) : complaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            No complaints match the selected filter criteria.
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Locality</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Reported Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.complaint_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {c.complaint_id}
                    </td>
                    <td style={{ color: '#ffffff' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{c.locality_id || c.locality || 'Nagpur Ward Area'}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.ward_id}</span>
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
                        {c.status}
                      </span>
                    </td>
                    <td>{new Date(c.reported_at || c.created_at || Date.now()).toLocaleDateString()}</td>
                    <td>
                      <button
                        onClick={() => setInspectComplaint(c)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
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
            Showing page {page + 1} of {totalPages} ({total} matching records)
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
                <h3 style={{ color: '#ffffff', marginTop: 4, textTransform: 'capitalize' }}>
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

              <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Citizen Description / Grievance Text:
                </span>
                <p style={{ color: '#ffffff' }}>
                  {inspectComplaint.description || 'No additional citizen remarks recorded.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Locality:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>
                    {inspectComplaint.locality_id || inspectComplaint.locality || 'Nagpur Ward Area'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Ward ID:</span>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{inspectComplaint.ward_id}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Coordinates:</span>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>
                    {inspectComplaint.latitude?.toFixed(4)}, {inspectComplaint.longitude?.toFixed(4)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Lodged Date:</span>
                  <div>{new Date(inspectComplaint.reported_at || inspectComplaint.created_at || Date.now()).toLocaleString()}</div>
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
