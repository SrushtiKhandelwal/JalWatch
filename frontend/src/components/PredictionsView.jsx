import React, { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { api } from '../api';

const scoreLabel = (value) => value == null ? '—' : `${Math.round(value * 100)} / 100`;
const formattedDate = (value) => value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : 'No records';

export default function PredictionsView({ onAlertsChanged, onNavigateAlerts }) {
  const [wards, setWards] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedWardId, setSelectedWardId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nextWards, nextReport] = await Promise.all([
        api.getPredictionsRisk(),
        api.getModelReport().catch(() => null),
      ]);
      setWards(nextWards);
      setReport(nextReport);
      setSelectedWardId((current) => current && nextWards.some((ward) => ward.ward_id === current)
        ? current : nextWards[0]?.ward_id ?? null);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const scanAlerts = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await api.scanPredictionAlerts({ allow_stale_demo_data: true });
      setScanResult(result);
      onAlertsChanged?.();
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setScanning(false);
    }
  };

  const selected = wards.find((ward) => ward.ward_id === selectedWardId);
  const visibleWards = showAll ? wards : wards.slice(0, 8);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Analysis / Insights</span>
          <h1>Find where attention is needed.</h1>
          <p>Ward scores from the complaint records in this dataset.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" type="button" onClick={loadData} disabled={loading} aria-label="Refresh insights">
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={scanAlerts} disabled={loading || scanning || !wards.length}>
            {scanning ? 'Creating…' : 'Create alerts from scores'}
          </button>
        </div>
      </div>

      {wards[0]?.data_through && <p className="quiet-note">Dataset through {formattedDate(wards[0].data_through)} · Scores use the latest 30 days in the dataset</p>}
      {error && <p role="alert" style={{ color: 'var(--rose)' }}>{error}</p>}
      {scanResult && (
        <div className="glass-card content-card" role="status">
          {scanResult.created_alerts} alerts created · {scanResult.deduplicated_alerts} already open
          <button className="text-action" type="button" style={{ marginLeft: 16 }} onClick={onNavigateAlerts}>Review alerts <ArrowUpRight size={14} /></button>
        </div>
      )}

      <div className="insights-grid">
        <section className="glass-card content-card" aria-label="Ward ranking">
          <div className="section-heading"><h2>Ward ranking</h2><span className="quiet-note">Model score</span></div>
          {loading && <p className="quiet-note">Loading scores…</p>}
          <div className="risk-list">
            {visibleWards.map((ward) => (
              <button
                className={`risk-row ${ward.ward_id === selectedWardId ? 'is-selected' : ''}`}
                type="button"
                key={ward.ward_id}
                onClick={() => setSelectedWardId(ward.ward_id)}
                aria-pressed={ward.ward_id === selectedWardId}
              >
                <span><strong>{ward.ward_name}</strong><small>{ward.ward_id} · {ward.complaint_count} reports{ward.is_anomalous ? ' · Count spike' : ''}</small></span>
                <span className="row-score">{scoreLabel(ward.risk_score)}</span>
              </button>
            ))}
          </div>
          {wards.length > 8 && (
            <button className="text-action" type="button" style={{ marginTop: 12 }} onClick={() => setShowAll((value) => !value)}>
              {showAll ? 'Show fewer wards' : `Show all ${wards.length} wards`}
            </button>
          )}
        </section>

        <section className="glass-card content-card risk-detail" aria-label="Selected ward insight">
          {selected ? <>
            <span className="eyebrow">{selected.ward_id} / {selected.risk_level} score</span>
            <h2>{selected.ward_name}</h2>
            <div className="risk-score-large">{scoreLabel(selected.risk_score)}</div>
            <p>{selected.complaint_count} complaints in the selected data window, including {selected.critical_count} marked critical.</p>
            {selected.is_anomalous && <p style={{ color: 'var(--amber)', marginTop: 8 }}>The latest seven-day complaint count is above its previous weekly average.</p>}
            <div style={{ marginTop: 28, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
              <h3 style={{ fontSize: '0.92rem' }}>What contributes to this view</h3>
              <ul className="risk-factors">{selected.contributing_factors.map((factor) => <li key={factor}>{factor}</li>)}</ul>
            </div>
          </> : <p className="quiet-note">Select a ward to see its details.</p>}
        </section>
      </div>

      <details className="model-details">
        <summary>About these scores</summary>
        <p style={{ marginTop: 12, maxWidth: 760 }}>
          This model was trained on supplied synthetic labels. Scores help compare the provided records; they are not verified probabilities of future water incidents. Confirm conditions before taking action.
        </p>
        {report?.holdout && <p style={{ marginTop: 8 }}>Later-period holdout: {Math.round(report.holdout.accuracy * 100)}% accuracy and {Math.round(report.holdout.f1 * 100)}% F1 on those synthetic labels.</p>}
      </details>
    </div>
  );
}
