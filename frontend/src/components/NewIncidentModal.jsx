import React, { useState, useEffect } from 'react';
import { ShieldAlert, Send } from 'lucide-react';
import { api } from '../api';

const CREW_TEAMS = [
  'NMC Quick Response Team 1 (Central)',
  'Zone 9 AshiNagar Pipeline Crew',
  'Zone 8 Lakadganj Emergency Leakage Squad',
  'Dharampeth Water Quality Field Lab',
  'Heavy Valve & Booster Maintenance Unit',
];

export default function NewIncidentModal({ isOpen, onClose, prefillData, onIncidentCreated }) {
  const [title, setTitle] = useState('');
  const [wardId, setWardId] = useState('');
  const [severity, setSeverity] = useState('high');
  const [assignedTeam, setAssignedTeam] = useState(CREW_TEAMS[0]);
  const [description, setDescription] = useState('');
  const [wards, setWards] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadWards = async () => {
      try {
        const data = await api.getWards();
        setWards(data);
        if (data.length > 0 && !wardId) {
          setWardId(data[0].ward_id);
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
      }
    }
  }, [isOpen, prefillData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !wardId) return;

    try {
      setSubmitting(true);
      await api.createIncident({
        title,
        description,
        ward_id: wardId,
        severity,
        assigned_team: assignedTeam,
      });
      if (onIncidentCreated) onIncidentCreated();
      onClose();
    } catch (err) {
      alert('Failed to log incident ticket: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <ShieldAlert size={20} />
            </div>
            <h3 style={{ color: '#ffffff', margin: 0 }}>Create Incident Response Ticket</h3>
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
                <option value="critical">Critical (Immediate SLA)</option>
                <option value="high">High (&lt; 12h SLA)</option>
                <option value="medium">Medium (&lt; 24h SLA)</option>
                <option value="low">Low (&lt; 48h SLA)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Dispatch Maintenance Crew
            </label>
            <select
              value={assignedTeam}
              onChange={(e) => setAssignedTeam(e.target.value)}
              className="select"
              style={{ width: '100%' }}
            >
              {CREW_TEAMS.map((team, idx) => (
                <option key={idx} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

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
              <span>{submitting ? 'Dispatching...' : 'Dispatch & Log Incident'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
