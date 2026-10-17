import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  TrendingUp, 
  ShieldCheck,
  RefreshCw,
  Layers,
  Wrench,
  Download
} from 'lucide-react';
import { api } from '../api';

export default function PredictionsView() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWardPred, setSelectedWardPred] = useState(null);

  const loadPredictions = async () => {
    try {
      setLoading(true);
      const data = await api.getPredictionsRisk();
      setPredictions(data);
      if (data.length > 0) setSelectedWardPred(data[0]);
    } catch (err) {
      console.error('Failed to load predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 40 }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              AI Infrastructure Risk Forecasting
            </h1>
            <span className="badge badge-medium" style={{ textTransform: 'none', fontSize: '0.75rem' }}>
              Predictive Telemetry
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Predictive machine learning models assessing pipeline stress, pressure anomalies, and proactive failure risks.
          </p>
        </div>

        <button onClick={loadPredictions} className="btn btn-secondary btn-sm" style={{ gap: 8 }}>
          <RefreshCw size={13} />
          <span>Recompute Model Inference</span>
        </button>
      </div>

      {/* Model Performance / Pipeline Highlights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16
      }}>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8' }}>
              <Cpu size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Model Ensemble
              </span>
              <h4 style={{ fontSize: '1.1rem', color: '#ffffff', marginTop: 2 }}>
                XGBoost + Gradient Boost
              </h4>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            94.2% ROC-AUC validation score on historical NMC telemetry
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
              <Layers size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Monitored Network
              </span>
              <h4 style={{ fontSize: '1.1rem', color: '#ffffff', marginTop: 2 }}>
                38 Ward Sectors
              </h4>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Continuous spatial telemetry over 1,420 km pipeline network
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
              <Zap size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Proactive Mitigation
              </span>
              <h4 style={{ fontSize: '1.1rem', color: '#ffffff', marginTop: 2 }}>
                1.8M L / Day Saved
              </h4>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Estimated non-revenue water loss averted by early intervention
          </div>
        </div>
      </div>

      {/* Main Predictions Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Computing predictive inference across municipal grid...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 20 }}>
          {/* Ward Risk Ranking Table */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                  Ward Sector Risk Index
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Ranked by failure probability
                </p>
              </div>
              <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>
                {predictions.length} Wards
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
              {predictions.map((p) => {
                const isSelected = selectedWardPred?.ward_id === p.ward_id;
                const isHigh = p.risk_score >= 70;
                const isMed = p.risk_score >= 40 && p.risk_score < 70;

                return (
                  <div
                    key={p.ward_id}
                    onClick={() => setSelectedWardPred(p)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: isSelected ? 'rgba(14, 165, 233, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.85rem' }}>
                          {p.ward_name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {p.ward_id}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Confidence: {(p.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: isHigh ? '#f87171' : isMed ? '#fbbf24' : '#34d399'
                      }}>
                        {p.risk_score}/100
                      </span>
                      <span className={`badge badge-${p.severity_prediction}`} style={{ fontSize: '0.65rem' }}>
                        {p.severity_prediction}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Ward Diagnostic Dossier */}
          {selectedWardPred && (
            <div className="glass-card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Infrastructure Risk Assessment
                  </span>
                  <h3 style={{ fontSize: '1.45rem', color: '#ffffff', marginTop: 4 }}>
                    {selectedWardPred.ward_name} ({selectedWardPred.ward_id})
                  </h3>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: selectedWardPred.risk_score >= 70 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: selectedWardPred.risk_score >= 70 ? '#f87171' : '#fbbf24',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: `1px solid ${selectedWardPred.risk_score >= 70 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                }}>
                  Risk Index: {selectedWardPred.risk_score}/100
                </div>
              </div>

              {/* Forecast Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Predicted Priority</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', textTransform: 'capitalize', marginTop: 2, display: 'block' }}>
                    {selectedWardPred.severity_prediction}
                  </span>
                </div>
                <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Model Confidence</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8', marginTop: 2, display: 'block' }}>
                    {(selectedWardPred.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Primary Factor</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fbbf24', marginTop: 2, display: 'block' }}>
                    Pressure Fatigue
                  </span>
                </div>
              </div>

              {/* Recommended Action Protocol */}
              <div style={{
                padding: 18,
                borderRadius: 10,
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
                  <Wrench size={16} />
                  <span>Automated Mitigation Protocol</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                  {selectedWardPred.recommended_action}
                </p>
              </div>

              {/* Infrastructure Details */}
              <div style={{
                padding: 16,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Sector Physical Assets Overview
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Pipeline Age</span>
                    <strong style={{ color: '#ffffff' }}>18-24 Years</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Material</span>
                    <strong style={{ color: '#ffffff' }}>Ductile Iron (DI)</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Average Head</span>
                    <strong style={{ color: '#ffffff' }}>2.4 bar</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
