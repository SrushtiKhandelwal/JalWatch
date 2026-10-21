import React, { useEffect, useState } from 'react';
import { AlertTriangle, BrainCircuit, RefreshCw } from 'lucide-react';
import { api } from '../api';

const percent = (value) => value == null ? 'No data' : `${(value * 100).toFixed(1)}%`;

export default function PredictionsView({ onAlertsChanged, onNavigateAlerts }) {
  const [predictions, setPredictions] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedWardId, setSelectedWardId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wards, evaluation] = await Promise.all([
        api.getPredictionsRisk(),
        api.getModelReport(),
      ]);
      setPredictions(wards);
      setReport(evaluation);
      setSelectedWardId((current) => current || wards[0]?.ward_id || null);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const scanAlerts = async () => {
    try {
      setScanning(true);
      setError('');
      const result = await api.scanPredictionAlerts({ allow_stale_demo_data: true });
      setScanResult(result);
      onAlertsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const selected = predictions.find((item) => item.ward_id === selectedWardId);
  const anomalousCount = predictions.filter((item) => item.is_anomalous).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', color: '#fff' }}>Complaint risk model</h1>
          <p style={{ marginTop: 6, maxWidth: 720 }}>
            Demonstration scores trained on synthetic heuristic labels. These are not verified
            probabilities of future incidents or live infrastructure telemetry.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={scanAlerts} disabled={loading || scanning || predictions.length === 0}>
            <AlertTriangle size={16} /> {scanning ? 'Scanning…' : 'Create demo model alerts'}
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
      {scanResult && (
        <div className="glass-card" style={{ padding: 16 }} role="status">
          Created {scanResult.created_alerts} demo alerts; {scanResult.deduplicated_alerts} already open;
          {' '}{scanResult.below_threshold} below threshold.
          {' '}<button className="btn btn-secondary btn-sm" onClick={onNavigateAlerts}>View alerts</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Held-out accuracy</div>
          <strong style={{ fontSize: '1.5rem' }}>{percent(report?.holdout?.accuracy)}</strong>
          <p style={{ fontSize: '0.75rem' }}>On synthetic labels, using a later time period</p>
        </div>
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Held-out F1</div>
          <strong style={{ fontSize: '1.5rem' }}>{percent(report?.holdout?.f1)}</strong>
          <p style={{ fontSize: '0.75rem' }}>Model {report?.model_version || 'unavailable'}</p>
        </div>
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Complaint spikes</div>
          <strong style={{ fontSize: '1.5rem' }}>{anomalousCount}</strong>
          <p style={{ fontSize: '0.75rem' }}>Seven days versus four prior weeks</p>
        </div>
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Data through</div>
          <strong style={{ fontSize: '1rem' }}>
            {predictions[0]?.data_through ? new Date(predictions[0].data_through).toLocaleDateString() : 'No data'}
          </strong>
          <p style={{ fontSize: '0.75rem' }}>Demo scans permit stale source data explicitly</p>
        </div>
      </div>

      {loading ? <p>Loading model results…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(290px, 390px) minmax(300px, 1fr)', gap: 18 }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: '1rem', marginBottom: 6 }}>Ward ranking</h2>
            <p style={{ fontSize: '0.8rem', marginBottom: 16 }}>
              Mean model score for complaints in the latest 30 data days
            </p>
            <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {predictions.map((ward) => (
                <button key={ward.ward_id} className="btn btn-secondary"
                  onClick={() => setSelectedWardId(ward.ward_id)}
                  style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left',
                    borderColor: selectedWardId === ward.ward_id ? 'var(--primary)' : undefined }}>
                  <span>{ward.ward_name} <small>({ward.ward_id})</small></span>
                  <span>{percent(ward.risk_score)} {ward.is_anomalous ? '⚠' : ''}</span>
                </button>
              ))}
            </div>
          </div>
          {selected && (
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <BrainCircuit size={20} color="var(--primary)" />
                <h2 style={{ fontSize: '1.15rem' }}>{selected.ward_name}</h2>
                <span className={`badge badge-${selected.risk_level === 'unknown' ? 'low' : selected.risk_level}`}>
                  {selected.risk_level}
                </span>
              </div>
              <p style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: 16 }}>
                Mean score: {percent(selected.risk_score)}
              </p>
              <p>{selected.complaint_count} recent complaints, including {selected.critical_count} marked critical.</p>
              <p style={{ marginTop: 8 }}>
                Latest seven days: {selected.recent_7_day_count}; prior weekly average: {selected.baseline_weekly_count}.
              </p>
              {selected.is_anomalous && (
                <p role="status" style={{ color: '#fbbf24', marginTop: 10 }}>
                  An unusual complaint count was detected for this ward.
                </p>
              )}
              <h3 style={{ fontSize: '0.9rem', marginTop: 24, marginBottom: 8 }}>Observed factors</h3>
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selected.contributing_factors.map((factor) => <li key={factor}>{factor}</li>)}
              </ul>
              <p style={{ fontSize: '0.75rem', marginTop: 24 }}>
                Verify field conditions before taking action. The underlying labels and infrastructure data are synthetic.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
