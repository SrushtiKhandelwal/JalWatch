import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Terminal, 
  TrendingUp, 
  ShieldCheck,
  RefreshCw
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
              AI Incident Risk Prediction Engine
            </h1>
            <span className="badge badge-medium" style={{ textTransform: 'none' }}>
              Module 3 & 4 Interface
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>
            Predictive intelligence interface mapping complaints, pipeline stress, and early incident likelihood.
          </p>
        </div>

        <button onClick={loadPredictions} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} />
          <span>Recompute Inference</span>
        </button>
      </div>

      {/* Member 1 Integration Contract Banner */}
      <div className="glass-card" style={{
        padding: '16px 20px',
        borderLeft: '4px solid var(--purple)',
        background: 'rgba(168, 85, 247, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
            <Cpu size={22} />
          </div>
          <div>
            <h4 style={{ color: '#ffffff', margin: 0 }}>
              Member 1 (AI/ML Developer) Integration Contract
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Endpoint: <code>/api/predictions/risk</code> & <code>/api/predictions/risk/&#123;ward_id&#125;</code>.
              Currently serving baseline density heuristics; swap with your trained Scikit-Learn / XGBoost pipeline in <code>backend/app/routers/predictions.py</code>.
            </p>
          </div>
        </div>
        <span className="badge badge-success">
          Ready for Model Swap
        </span>
      </div>

      {/* Predictions Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Computing predictive inference across 38 wards...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Ward Risk Ranking Table */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', color: '#ffffff', marginBottom: 12 }}>
              Ward Risk Prediction Ranking
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
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
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(14, 165, 233, 0.15)' : 'rgba(255, 255, 255, 0.03)',
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
                        <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem' }}>
                          {p.ward_name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {p.ward_id}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Confidence: {(p.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
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

          {/* Selected Ward Prediction Breakdown */}
          {selectedWardPred && (
            <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                    AI Diagnostics & Forecast
                  </span>
                  <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginTop: 2 }}>
                    {selectedWardPred.ward_name} ({selectedWardPred.ward_id})
                  </h3>
                </div>
                <div style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: selectedWardPred.risk_score >= 70 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: selectedWardPred.risk_score >= 70 ? '#f87171' : '#fbbf24',
                  fontWeight: 800,
                  fontSize: '0.875rem'
                }}>
                  Score: {selectedWardPred.risk_score}
                </div>
              </div>

              {/* Forecast Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Predicted Severity</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', textTransform: 'capitalize' }}>
                    {selectedWardPred.severity_prediction}
                  </span>
                </div>
                <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Model Confidence</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                    {(selectedWardPred.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Recommended Action */}
              <div style={{
                padding: 16,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
                  <Zap size={16} />
                  <span>AI Recommended Preventive Action</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#ffffff' }}>
                  {selectedWardPred.recommended_action}
                </p>
              </div>

              {/* JSON Payload preview for Developer 1 */}
              <div style={{ marginTop: 'auto' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Live API Contract Response Shape:
                </span>
                <pre style={{
                  background: '#04070d',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#94a3b8',
                  overflowX: 'auto',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {JSON.stringify(selectedWardPred, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
