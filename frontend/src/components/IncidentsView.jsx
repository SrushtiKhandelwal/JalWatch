import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  LayoutGrid, 
  Table as TableIcon
} from 'lucide-react';
import { api } from '../api';
import { CREW_TEAMS, INCIDENT_STAGES } from '../incidentConstants';

export default function IncidentsView({ revision }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() =>
    window.matchMedia('(max-width: 1050px)').matches ? 'kanban' : 'table'
  );
  const [filterSeverity, setFilterSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [pendingTransition, setPendingTransition] = useState(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [savingTransition, setSavingTransition] = useState(false);
  const [historyIncident, setHistoryIncident] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (incident) => {
    setHistoryIncident(incident);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      setHistoryEvents(await api.getIncidentEvents(incident.incident_id));
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const data = await api.getIncidents({
        severity: filterSeverity || undefined,
        page,
        page_size: 50
      });
      setIncidents(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [filterSeverity, page, revision]);

  const applyTransition = async (incident, nextStatus, notes = '', crew = '') => {
    try {
      setSavingTransition(true);
      setError('');
      await api.updateIncidentStatus(incident.incident_id, nextStatus, notes, crew);
      setPendingTransition(null);
      await loadIncidents();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTransition(false);
    }
  };

  const handleAdvanceStatus = (incident) => {
    const currentIndex = INCIDENT_STAGES.findIndex((stage) => stage.id === incident.status);
    if (currentIndex < 0 || currentIndex >= INCIDENT_STAGES.length - 1) return;
    const nextStatus = INCIDENT_STAGES[currentIndex + 1].id;
    if (nextStatus === 'assigned' || nextStatus === 'resolved') {
      setAssignedTo(incident.assigned_to || '');
      setResolutionNotes('');
      setError('');
      setPendingTransition({ incident, nextStatus });
      return;
    }
    applyTransition(incident, nextStatus);
  };

  return (
    <div className="page-stack">
      {/* View Header */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Operations / Incidents</span>
          <h1>Incidents</h1>
          <p>Track assignments and resolution in one place.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* View mode toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            padding: 4,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                background: viewMode === 'kanban' ? 'var(--emerald-bg)' : 'transparent',
                border: 'none',
                color: viewMode === 'kanban' ? 'var(--primary)' : 'var(--text-muted)',
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
                background: viewMode === 'table' ? 'var(--emerald-bg)' : 'transparent',
                border: 'none',
                color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
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

        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filterSeverity}
          onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}
          className="select"
          aria-label="Filter incidents by priority"
        >
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <span className="quiet-note" style={{ marginLeft: 'auto' }}>{incidents.length} shown</span>
      </div>

      {/* Content Rendering: Kanban or Table */}
      {error && !pendingTransition && <p role="alert" style={{ color: 'var(--rose)' }}>{error}</p>}
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
          {INCIDENT_STAGES.map((stage) => {
            const stageIncidents = incidents.filter(i => i.status === stage.id);
            return (
              <div 
                key={stage.id} 
                style={{
                  background: 'var(--bg-surface-elevated)',
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
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {stage.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'var(--bg-surface)',
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
                    const isNextAvailable = stage.id !== 'closed';
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

                        <h4 style={{ fontSize: '0.875rem', lineHeight: 1.3 }}>
                          {incident.title}
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} />
                            {incident.ward ? incident.ward.ward_name : `Ward ${incident.ward_id}`}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Users size={12} />
                            {incident.assigned_to || 'Crew pending'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            {incident.reported_at ? new Date(incident.reported_at).toLocaleDateString() : 'Date unavailable'}
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
                        <button onClick={() => openHistory(incident)} className="btn btn-secondary btn-sm">View History</button>
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
            <table className="data-table incident-table">
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
                      {incident.incident_id}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{incident.title}<small className="mobile-incident-id">{incident.incident_id}</small></td>
                    <td>{incident.ward ? incident.ward.ward_name : `Ward ${Number(incident.ward_id?.slice(1)) || incident.ward_id}`}</td>
                    <td>
                      <span className={`badge badge-${incident.severity}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-low">{incident.status.replaceAll('_', ' ')}</span>
                    </td>
                    <td>{incident.assigned_to || 'Pending Crew'}</td>
                    <td>{new Date(incident.reported_at).toLocaleDateString()}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      {incident.status !== 'closed' ? (
                        <button
                          onClick={() => handleAdvanceStatus(incident)}
                          className="btn btn-secondary btn-sm"
                        >
                          Advance
                        </button>
                      ) : (
                        <span style={{ color: 'var(--emerald)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={14} /> Closed
                        </span>
                      )}
                      <button onClick={() => openHistory(incident)} className="btn btn-secondary btn-sm">History</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-secondary btn-sm" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="btn btn-secondary btn-sm" disabled={loading || incidents.length < 50} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>

      {pendingTransition && (
        <div className="modal-backdrop" onClick={() => !savingTransition && setPendingTransition(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>
              {pendingTransition.nextStatus === 'assigned' ? 'Assign response crew' : 'Resolve incident'}
            </h3>
            <p style={{ marginBottom: 20 }}>{pendingTransition.incident.incident_id}: {pendingTransition.incident.title}</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              applyTransition(
                pendingTransition.incident,
                pendingTransition.nextStatus,
                resolutionNotes,
                assignedTo,
              );
            }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pendingTransition.nextStatus === 'assigned' ? (
                <>
                  <label htmlFor="transition-crew">Response crew</label>
                  <input id="transition-crew" className="input" list="incident-crew-suggestions" required maxLength={120}
                    value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Enter the assigned crew" />
                  <datalist id="incident-crew-suggestions">
                    {CREW_TEAMS.map((team) => <option key={team} value={team} />)}
                  </datalist>
                </>
              ) : (
                <>
                  <label htmlFor="resolution-notes">Resolution notes</label>
                  <textarea id="resolution-notes" className="input" required minLength={3} maxLength={5000} rows={4}
                    value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)}
                    placeholder="Describe the work completed and service restored" />
                </>
              )}
              {error && <p role="alert" style={{ color: 'var(--rose)' }}>{error}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" disabled={savingTransition} onClick={() => setPendingTransition(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingTransition}>
                  {savingTransition ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyIncident && (
        <div className="modal-backdrop" onClick={() => setHistoryIncident(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>Incident History</h3>
            <p style={{ marginBottom: 16 }}>{historyIncident.incident_id}: {historyIncident.title}</p>
            {historyLoading ? <p>Loading history…</p> : historyError ? (
              <p role="alert" style={{ color: 'var(--rose)' }}>{historyError}</p>
            ) : (
              <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {historyEvents.map((event) => (
                  <li key={event.id}>
                    <strong>{event.to_status.replace(/_/g, ' ')}</strong>
                    {' · '}{new Date(event.occurred_at).toLocaleString()}
                    {event.assigned_to && <div>Crew: {event.assigned_to}</div>}
                    {event.note && <div>{event.note}</div>}
                  </li>
                ))}
              </ol>
            )}
            <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={() => setHistoryIncident(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
