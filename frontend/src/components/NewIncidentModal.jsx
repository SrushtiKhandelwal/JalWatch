import React, { useState, useEffect } from 'react';
import { MapPin, ShieldAlert, Send } from 'lucide-react';
import { api } from '../api';
import { INCIDENT_TYPES } from '../incidentConstants';

export default function NewIncidentModal({ isOpen, onClose, prefillData, onIncidentCreated }) {
  const [title, setTitle] = useState('');
  const [wardId, setWardId] = useState('');
  const [severity, setSeverity] = useState('high');
  const [incidentType, setIncidentType] = useState('supply_failure');
  const [assignedTeam, setAssignedTeam] = useState('');
  const [description, setDescription] = useState('');
  const [wards, setWards] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadWards = async () => {
      try {
        const data = await api.getWards();
        setWards(data);
        if (data.length > 0) {
          setWardId(prefillData?.ward_id || data[0].ward_id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (isOpen) {
      loadWards();
      if (prefillData) {
        setTitle(prefillData.kind === 'risk'
          ? `Investigate elevated risk in ${prefillData.ward_name}`
          : prefillData.kind === 'cluster'
          ? `Investigate ${prefillData.complaint_type.replaceAll('_', ' ')} reports in ${prefillData.ward_id}`
          : prefillData.kind === 'complaint'
            ? `Investigate: ${prefillData.title || prefillData.complaint_type.replaceAll('_', ' ')}`
            : `Escalated: ${prefillData.title}`);
        setDescription(prefillData.description || (prefillData.kind === 'cluster' ? prefillData.explanation : ''));
        if (prefillData.ward_id) setWardId(prefillData.ward_id);
        if (prefillData.severity) setSeverity(prefillData.severity);
      } else {
        setTitle('');
        setDescription('');
        setSeverity('high');
      }
      setIncidentType('supply_failure');
      setAssignedTeam('');
      setError('');
    }
  }, [isOpen, prefillData]);

  if (!isOpen) return null;

  const selectedWard = wards.find((ward) => ward.ward_id === wardId);
  const sourceHasLocation = ['complaint', 'cluster'].includes(prefillData?.kind)
    && prefillData?.ward_id === wardId
    && prefillData.latitude != null && prefillData.longitude != null
    && Number.isFinite(Number(prefillData.latitude)) && Number.isFinite(Number(prefillData.longitude));
  const location = sourceHasLocation
    ? { latitude: Number(prefillData.latitude), longitude: Number(prefillData.longitude) }
    : selectedWard?.representative_latitude != null && selectedWard?.representative_longitude != null
      ? { latitude: selectedWard.representative_latitude, longitude: selectedWard.representative_longitude }
      : null;
  const linkedSource = ['complaint', 'cluster', 'alert'].includes(prefillData?.kind);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !wardId || !location) {
      setError('A map reference point is unavailable for this ward. Check the area data.');
      return;
    }

    try {
      setSubmitting(true);
      await api.createIncident({
        title,
        description,
        ward_id: wardId,
        severity,
        incident_type: incidentType,
        latitude: location.latitude,
        longitude: location.longitude,
        assigned_to: assignedTeam || null,
        related_alert_id: prefillData?.kind === 'alert' ? prefillData.id : null,
        related_complaint_ids: prefillData?.kind === 'complaint' ? [prefillData.complaint_id]
          : prefillData?.kind === 'cluster' ? prefillData.complaint_ids : [],
      });
      if (onIncidentCreated) onIncidentCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'var(--amber-bg)', color: 'var(--amber)' }}>
              <ShieldAlert size={20} />
            </div>
            <h3 style={{ margin: 0 }}>New incident</h3>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Incident Headline
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 300mm Main Pipeline Rupture near Medical Square"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Jurisdiction Ward
              </label>
              <select
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                className="select"
                disabled={linkedSource}
                style={{ width: '100%' }}
              >
                {wards.map((w) => (
                  <option key={w.ward_id} value={w.ward_id}>
                    {w.ward_id} - {w.ward_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Priority Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
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
            <label htmlFor="incident-type" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Incident Type</label>
            <select id="incident-type" className="select" value={incidentType} onChange={(e) => setIncidentType(e.target.value)} style={{ width: '100%' }}>
              {INCIDENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="incident-location-note" role="status">
            <MapPin size={18} aria-hidden="true" />
            <div>
              <strong>Approximate map location</strong>
              <p>{sourceHasLocation
                ? 'Using the source report’s map point. It has not been verified as the exact incident location.'
                : `Using ${selectedWard?.ward_name || 'the selected ward'}’s representative point. Add the street or landmark in the notes if known.`}</p>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Dispatch Maintenance Crew
            </label>
            <input
              value={assignedTeam}
              onChange={(e) => setAssignedTeam(e.target.value)}
              className="input"
              maxLength={120}
              placeholder="Optional: enter the assigned crew"
              style={{ width: '100%' }}
            />
          </div>

          {error && <p role="alert" style={{ color: 'var(--rose)' }}>{error}</p>}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Incident Scope / Dispatch Notes
            </label>
            <textarea
              rows={3}
              placeholder="Specify ground location, pressure gauges, affected population, and valves to shut down..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              <Send size={14} />
              <span>{submitting ? 'Saving...' : assignedTeam ? 'Create & Assign Incident' : 'Create Incident'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
