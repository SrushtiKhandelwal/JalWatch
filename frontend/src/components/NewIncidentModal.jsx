import React, { useState, useEffect } from 'react';
import { ShieldAlert, Send } from 'lucide-react';
import { api } from '../api';
import { CREW_TEAMS, INCIDENT_TYPES } from '../incidentConstants';

export default function NewIncidentModal({ isOpen, onClose, prefillData, onIncidentCreated }) {
  const [title, setTitle] = useState('');
  const [wardId, setWardId] = useState('');
  const [severity, setSeverity] = useState('high');
  const [incidentType, setIncidentType] = useState('supply_failure');
  const [assignedTeam, setAssignedTeam] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
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
        setTitle(`Escalated: ${prefillData.title}`);
        setDescription(prefillData.description || '');
        if (prefillData.ward_id) setWardId(prefillData.ward_id);
        if (prefillData.severity) setSeverity(prefillData.severity);
      } else {
        setTitle('');
        setDescription('');
        setSeverity('high');
      }
      setIncidentType('supply_failure');
      setAssignedTeam('');
      setLatitude('');
      setLongitude('');
      setError('');
    }
  }, [isOpen, prefillData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !wardId || latitude === '' || longitude === '') return;

    try {
      setSubmitting(true);
      await api.createIncident({
        title,
        description,
        ward_id: wardId,
        severity,
        incident_type: incidentType,
        latitude: Number(latitude),
        longitude: Number(longitude),
        assigned_to: assignedTeam || null,
        related_alert_id: prefillData?.id || null,
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

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Location coordinates</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="input" aria-label="Latitude" type="number" step="any" min="-90" max="90" required placeholder="Latitude" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              <input className="input" aria-label="Longitude" type="number" step="any" min="-180" max="180" required placeholder="Longitude" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </div>
            <p style={{ fontSize: '0.75rem', marginTop: 5 }}>Enter the reported location. Coordinates are required so incidents are not silently placed at the city center.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Dispatch Maintenance Crew
            </label>
            <input
              value={assignedTeam}
              onChange={(e) => setAssignedTeam(e.target.value)}
              className="input"
              list="new-incident-crew-suggestions"
              maxLength={120}
              placeholder="Optional: enter the assigned crew"
              style={{ width: '100%' }}
            />
            <datalist id="new-incident-crew-suggestions">
              {CREW_TEAMS.map((team) => <option key={team} value={team} />)}
            </datalist>
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
