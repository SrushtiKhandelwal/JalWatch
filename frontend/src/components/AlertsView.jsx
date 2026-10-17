import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Radio, 
  Filter, 
  Plus, 
  MapPin, 
  Clock, 
  Send
} from 'lucide-react';
import { api } from '../api';

export default function AlertsView({ onEscalateToIncident }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [wards, setWards] = useState([]);

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
        limit: 50
      });
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
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
  }, [filterSeverity, filterStatus]);

  const handleAcknowledge = async (id) => {
    try {
      await api.acknowledgeAlert(id);
      loadAlerts();
    } catch (err) {
      alert('Failed to acknowledge alert: ' + err.message);
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.resolveAlert(id);
      loadAlerts();
    } catch (err) {
      alert('Failed to resolve alert: ' + err.message);
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
      loadAlerts();
    } catch (err) {
      alert('Failed to broadcast alert: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
              Early Warning & Alert System
            </h1>
            <span className="badge badge-critical" style={{ textTransform: 'none' }}>
              Module 5
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>
            Automated cluster detection, telemetry threshold breaches, and zone notifications for Nagpur.
          </p>
        </div>

        <button 
          onClick={() => setIsCreatingAlert(true)}
          className="btn btn-danger"
        >
          <Radio size={16} />
          <span>Broadcast Warning Alert</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <Filter size={16} />
          <span>Filters:</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select"
          >
            <option value="">All Statuses</option>
            <option value="active">Active (Pending)</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Severity:</label>
          <select 
            value={filterSeverity} 
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="select"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <strong>{alerts.length}</strong> alerts
        </div>
      </div>

      {/* Alerts Stream List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading active alert stream...
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <CheckCircle size={44} color="#10b981" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#ffffff' }}>No matching alerts found</h3>
          <p style={{ marginTop: 6 }}>All monitored thresholds in this category are operating within acceptable parameters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map((alertItem) => {
            const isCrit = alertItem.severity === 'critical';
            const isHigh = alertItem.severity === 'high';
            const isResolved = alertItem.status === 'resolved';

            return (
              <div 
                key={alertItem.id} 
                className="glass-card" 
                style={{
                  padding: '18px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  borderLeft: `4px solid ${
                    isCrit ? '#ef4444' : isHigh ? '#f59e0b' : '#38bdf8'
                  }`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flex: 1, minWidth: 280 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    background: isCrit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isCrit ? '#ef4444' : '#f59e0b'
                  }}>
                    {isCrit ? <AlertTriangle size={20} /> : <ShieldAlert size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <h4 style={{ fontSize: '1rem', color: '#ffffff', margin: 0 }}>
                        {alertItem.title}
                      </h4>
                      <span className={`badge badge-${alertItem.severity}`}>
                        {alertItem.severity}
                      </span>
                      <span className={`badge ${isResolved ? 'badge-success' : 'badge-low'}`}>
                        {alertItem.status}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {alertItem.description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} />
                        {alertItem.ward ? `${alertItem.ward.ward_name} (${alertItem.ward.zone_name})` : `Ward ${alertItem.ward_id}`}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        {new Date(alertItem.triggered_at || alertItem.created_at || Date.now()).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {alertItem.status === 'active' && (
                    <button
                      onClick={() => handleAcknowledge(alertItem.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      Acknowledge
                    </button>
                  )}

                  {!isResolved && (
                    <button
                      onClick={() => handleResolve(alertItem.id)}
                      className="btn btn-success btn-sm"
                    >
                      Resolve
                    </button>
                  )}

                  {!isResolved && onEscalateToIncident && (
                    <button
                      onClick={() => onEscalateToIncident(alertItem)}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus size={14} />
                      <span>Escalate to Incident</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Broadcast Alert */}
      {isCreatingAlert && (
        <div className="modal-backdrop" onClick={() => setIsCreatingAlert(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Radio size={20} color="#ef4444" />
                <h3 style={{ color: '#ffffff' }}>Broadcast Telemetry Warning Alert</h3>
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
                  Alert Headline / Trigger
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
                  <span>Broadcast Alert</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
