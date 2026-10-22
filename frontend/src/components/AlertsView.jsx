import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Radio, 
  Plus, 
  Send
} from 'lucide-react';
import { api } from '../api';

export default function AlertsView({ onEscalateToIncident }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [wards, setWards] = useState([]);
  const [error, setError] = useState('');
  const [historyAlert, setHistoryAlert] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [expandedAlertId, setExpandedAlertId] = useState(null);

  const openHistory = async (alertItem) => {
    setHistoryAlert(alertItem);
    setHistoryEvents([]);
    setHistoryError('');
    try {
      setHistoryEvents(await api.getAlertEvents(alertItem.id));
    } catch (err) {
      setHistoryError(err.message);
    }
  };

  // New Alert form state
  const [newTitle, setNewTitle] = useState('');
  const [newWardId, setNewWardId] = useState('');
  const [newSeverity, setNewSeverity] = useState('critical');
  const [newDesc, setNewDesc] = useState('');

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await api.getAlerts({
        severity: filterSeverity || undefined,
        status: filterStatus || undefined,
        page,
        page_size: 50
      });
      setAlerts(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadWards = async () => {
    try {
      const data = await api.getWards();
      setWards(data);
      if (data.length > 0) setNewWardId(data[0].ward_id);
    } catch (err) {
      console.error('Failed to load wards:', err);
    }
  };

  useEffect(() => {
    loadAlerts();
    loadWards();
  }, [filterSeverity, filterStatus, page]);

  const handleAcknowledge = async (id) => {
    try {
      await api.acknowledgeAlert(id);
      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.resolveAlert(id);
      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.dismissAlert(id);
      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newWardId) return;

    try {
      await api.createAlert({
        title: newTitle,
        description: newDesc,
        ward_id: newWardId,
        severity: newSeverity,
        alert_type: 'early_warning',
      });
      setIsCreatingAlert(false);
      setNewTitle('');
      setNewDesc('');
      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-stack">
      {/* View Header */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Operations / Alerts</span>
          <h1>Alerts</h1>
          <p>Review signals and decide what needs a response.</p>
        </div>

        <button 
          onClick={() => setIsCreatingAlert(true)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>New alert</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <select 
            value={filterStatus} 
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="select"
            aria-label="Filter alerts by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div>
          <select 
            value={filterSeverity} 
            onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}
            className="select"
            aria-label="Filter alerts by severity"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <span className="quiet-note" style={{ marginLeft: 'auto' }}>{alerts.length} shown</span>
      </div>

      {error && !isCreatingAlert && <p role="alert" style={{ color: 'var(--rose)' }}>{error}</p>}

      {/* Alerts Stream List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading active alert stream...
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <CheckCircle size={44} color="#10b981" style={{ margin: '0 auto 12px' }} />
          <h3>No matching alerts found</h3>
          <p style={{ marginTop: 6 }}>No records match the selected filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map((alertItem) => {
            const isResolved = alertItem.status === 'resolved';
            const isClosed = isResolved || alertItem.status === 'dismissed';
            const isExpanded = expandedAlertId === alertItem.id;

            return (
              <article key={alertItem.id} className="glass-card alert-card">
                <div className="alert-card-summary">
                  <div>
                    <h2>{alertItem.title.replace(/^Demo\s+/i, '').replace(/^model/, 'Model')}</h2>
                    <p>{alertItem.ward?.ward_name || `Ward ${Number(alertItem.ward_id?.slice(1)) || alertItem.ward_id}`} · {alertItem.triggered_at ? new Date(alertItem.triggered_at).toLocaleDateString() : 'Date unavailable'}</p>
                  </div>
                  <div className="alert-card-status">
                    <span className={`badge badge-${alertItem.severity}`}>{alertItem.severity}</span>
                    <span className={`badge ${isResolved ? 'badge-success' : 'badge-low'}`}>{alertItem.status}</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExpandedAlertId(isExpanded ? null : alertItem.id)} aria-expanded={isExpanded}>
                      {isExpanded ? 'Hide details' : 'Review'}
                    </button>
                  </div>
                </div>
                {isExpanded && <div className="alert-card-detail">
                  {alertItem.description && <p>{alertItem.description}</p>}
                  <div className="alert-card-actions">
                    <button onClick={() => openHistory(alertItem)} className="btn btn-secondary btn-sm">History</button>
                  {alertItem.status === 'active' && (
                    <button
                      onClick={() => handleAcknowledge(alertItem.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      Acknowledge
                    </button>
                  )}

                  {!isClosed && (
                    <button
                      onClick={() => handleResolve(alertItem.id)}
                      className="btn btn-success btn-sm"
                    >
                      Resolve
                    </button>
                  )}

                  {!isClosed && (
                    <button onClick={() => handleDismiss(alertItem.id)} className="btn btn-secondary btn-sm">Dismiss</button>
                  )}

                  {!isClosed && onEscalateToIncident && (
                    <button
                      onClick={() => onEscalateToIncident(alertItem)}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus size={14} />
                      <span>Create incident</span>
                    </button>
                  )}
                  </div>
                </div>}
              </article>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-secondary btn-sm" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="btn btn-secondary btn-sm" disabled={loading || alerts.length < 50} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>

      {/* Modal: Create Alert */}
      {isCreatingAlert && (
        <div className="modal-backdrop" onClick={() => setIsCreatingAlert(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Radio size={20} color="#ef4444" />
                <h3>New alert</h3>
              </div>
              <button 
                onClick={() => setIsCreatingAlert(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Turbidity Spike in Dharampeth Feeder"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Affected Ward
                  </label>
                  <select
                    value={newWardId}
                    onChange={(e) => setNewWardId(e.target.value)}
                    className="select"
                    style={{ width: '100%' }}
                  >
                    {wards.map((w) => (
                      <option key={w.ward_id} value={w.ward_id}>
                        {w.ward_id} - {w.ward_name} ({w.zone_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Severity
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    className="select"
                    style={{ width: '100%' }}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Detailed Observations / Action Required
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe citizen impact, sensor readings, and recommended emergency dispatch..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {error && <p role="alert" style={{ color: 'var(--rose)' }}>{error}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingAlert(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  <Send size={14} />
                  <span>Create Alert</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyAlert && (
        <div className="modal-backdrop" onClick={() => setHistoryAlert(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>Alert History</h3>
            <p style={{ marginBottom: 16 }}>{historyAlert.title}</p>
            {historyError ? <p role="alert" style={{ color: 'var(--rose)' }}>{historyError}</p> : (
              <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {historyEvents.map((event) => (
                  <li key={event.id}>
                    <strong>{event.to_status}</strong>
                    {' · '}{new Date(event.occurred_at).toLocaleString()}
                  </li>
                ))}
              </ol>
            )}
            <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={() => setHistoryAlert(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
