import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  MapPin, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Plus, 
  Filter, 
  LayoutGrid, 
  Table as TableIcon
} from 'lucide-react';
import { api } from '../api';

const PIPELINE_STAGES = [
  { id: 'reported', label: 'Reported', color: '#94a3b8' },
  { id: 'investigating', label: 'Investigating', color: '#38bdf8' },
  { id: 'dispatched', label: 'Crew Dispatched', color: '#f59e0b' },
  { id: 'in_progress', label: 'In Progress', color: '#a855f7' },
  { id: 'resolved', label: 'Resolved', color: '#10b981' },
];

export default function IncidentsView({ onOpenNewIncidentModal }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'table'
  const [filterSeverity, setFilterSeverity] = useState('');

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const data = await api.getIncidents({
        severity: filterSeverity || undefined,
        limit: 50
      });
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [filterSeverity]);

  const handleAdvanceStatus = async (incident) => {
    const currentIndex = PIPELINE_STAGES.findIndex(s => s.id === incident.status);
    if (currentIndex < PIPELINE_STAGES.length - 1) {
      const nextStatus = PIPELINE_STAGES[currentIndex + 1].id;
      try {
        await api.updateIncidentStatus(incident.incident_id || incident.id, nextStatus, `Advanced to ${nextStatus} via Command Center`);
        loadIncidents();
      } catch (err) {
        alert('Failed to update status: ' + err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Incident Response & Crew Dispatch
            </h1>
            <span className="badge badge-medium" style={{ textTransform: 'none', fontSize: '0.75rem' }}>
              Operations Command
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>
            End-to-end incident lifecycle tracking, maintenance crew deployment, and SLA enforcement.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* View mode toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: 4,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                background: viewMode === 'kanban' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: 'none',
                color: viewMode === 'kanban' ? '#fff' : 'var(--text-muted)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.8rem'
              }}
            >
              <LayoutGrid size={14} />
              <span>Pipeline</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: 'none',
                color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.8rem'
              }}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          <button onClick={onOpenNewIncidentModal} className="btn btn-primary">
            <Plus size={16} />
            <span>Create Incident Ticket</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Filter size={16} />
          <span>Priority Filter:</span>
        </div>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="select"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Active Tickets: <strong>{incidents.filter(i => i.status !== 'resolved').length}</strong> / Total: {incidents.length}
        </div>
      </div>

      {/* Content Rendering: Kanban or Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading incident pipeline...
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          alignItems: 'flex-start',
        }}>
          {PIPELINE_STAGES.map((stage) => {
            const stageIncidents = incidents.filter(i => i.status === stage.id);
            return (
              <div 
                key={stage.id} 
                style={{
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minHeight: 480
                }}
              >
                {/* Column header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#ffffff' }}>
                      {stage.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--text-secondary)'
                  }}>
                    {stageIncidents.length}
                  </span>
                </div>

                {/* Cards in this stage */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stageIncidents.map((incident) => {
                    const isNextAvailable = stage.id !== 'resolved';
                    return (
                      <div
                        key={incident.id}
                        className="glass-card"
                        style={{
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          borderColor: incident.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {incident.incident_id || `INC-${String(incident.id).padStart(4, '0')}`}
                          </span>
                          <span className={`badge badge-${incident.severity}`} style={{ fontSize: '0.65rem' }}>
                            {incident.severity}
                          </span>
                        </div>

                        <h4 style={{ fontSize: '0.875rem', color: '#ffffff', lineHeight: 1.3 }}>
                          {incident.title}
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} />
                            {incident.ward ? incident.ward.ward_name : `Ward ${incident.ward_id}`}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Users size={12} />
                            {incident.assigned_to || incident.assigned_team || 'Zone Crew Pending'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            {new Date(incident.reported_at || incident.created_at || Date.now()).toLocaleDateString()}
                          </span>
                        </div>

                        {isNextAvailable && (
                          <button
                            onClick={() => handleAdvanceStatus(incident)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              marginTop: 4,
                              width: '100%',
                              justifyContent: 'space-between',
                              fontSize: '0.75rem',
                              padding: '6px 10px'
                            }}
                          >
                            <span>Advance Stage</span>
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="glass-card" style={{ padding: 20 }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Title</th>
                  <th>Ward</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Assigned Team</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      INC-{String(incident.id).padStart(4, '0')}
                    </td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{incident.title}</td>
                    <td>{incident.ward ? incident.ward.ward_name : `Ward ${incident.ward_id}`}</td>
                    <td>
                      <span className={`badge badge-${incident.severity}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-low">{incident.status}</span>
                    </td>
                    <td>{incident.assigned_team || 'Pending Crew'}</td>
                    <td>{new Date(incident.created_at).toLocaleDateString()}</td>
                    <td>
                      {incident.status !== 'resolved' ? (
                        <button
                          onClick={() => handleAdvanceStatus(incident)}
                          className="btn btn-secondary btn-sm"
                        >
                          Advance
                        </button>
                      ) : (
                        <span style={{ color: '#34d399', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={14} /> Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
