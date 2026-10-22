import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BellRing, MapPinned, MessageSquareText, RefreshCw, Wrench } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';

const formatNumber = (value) => (value ?? 0).toLocaleString();
const formatDate = (value) => value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : 'No records';
const formatChartDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const typeColors = ['#157b68', '#5ea995', '#d5a65b', '#c87f6d', '#9aac8f'];

export default function DashboardView({ onSelectWard, onNavigateTab }) {
  const [summary, setSummary] = useState(null);
  const [types, setTypes] = useState([]);
  const [riskWards, setRiskWards] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [nextSummary, nextTypes, nextWards] = await Promise.all([
        api.getDashboardSummary(),
        api.getComplaintsByType(),
        api.getPredictionsRisk().catch(() => []),
      ]);
      setSummary(nextSummary);
      setTypes(nextTypes || []);
      setRiskWards((nextWards || []).filter((ward) => ward.risk_score != null).slice(0, 5));
      const asOf = nextSummary.latest_complaint_at?.slice(0, 10);
      const nextTrend = await api.getDailyTrend(90, asOf).catch(() => []);
      setTrend(asOf ? nextTrend.filter((point) => point.date <= asOf).slice(-30) : nextTrend.slice(-30));
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const visibleTypes = [...types].sort((a, b) => b.count - a.count).slice(0, 5);
  const typeTotal = visibleTypes.reduce((sum, type) => sum + type.count, 0);
  const trendTotal = trend.reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">JalWatch / Overview</span>
          <h1>Water operations, at a glance.</h1>
          <p>Complaints, alerts, and response work in one place.</p>
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {summary?.latest_complaint_at && (
        <div className="quiet-note">Dataset through {formatDate(summary.latest_complaint_at)}</div>
      )}
      {error && <div role="alert" className="glass-card content-card">Unable to load the overview: {error}</div>}

      <div className="metric-grid" aria-busy={loading}>
        <div className="glass-card metric-card">
          <div className="metric-top"><span className="metric-label">Complaints</span><span className="metric-icon"><MessageSquareText size={18} /></span></div>
          <strong className="metric-value">{loading ? '—' : formatNumber(summary?.total_complaints)}</strong>
          <span className="metric-subtext">{formatNumber(summary?.resolved_complaints)} resolved</span>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-top"><span className="metric-label">Open alerts</span><span className="metric-icon"><BellRing size={18} /></span></div>
          <strong className="metric-value">{loading ? '—' : formatNumber(summary?.active_alerts)}</strong>
          <span className="metric-subtext">Waiting for review</span>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-top"><span className="metric-label">Active incidents</span><span className="metric-icon"><Wrench size={18} /></span></div>
          <strong className="metric-value">{loading ? '—' : formatNumber(summary?.open_incidents)}</strong>
          <span className="metric-subtext">Response in progress</span>
        </div>
      </div>

      <section className="glass-card content-card trend-card" aria-label="Complaint trend">
        <div className="section-heading">
          <div>
            <h2>Complaint activity</h2>
            <p className="quiet-note">Daily reports in the last 30 days of the dataset</p>
          </div>
          <span className="chart-summary">{formatNumber(trendTotal)} reports</span>
        </div>
        {trend.length ? (
          <div className="trend-chart" role="img" aria-label={`Daily complaint activity, ${formatNumber(trendTotal)} reports over 30 days`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <defs><linearGradient id="complaintTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#157b68" stopOpacity={0.22} /><stop offset="100%" stopColor="#157b68" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e7ece8" />
                <XAxis dataKey="date" tickFormatter={formatChartDate} tickLine={false} axisLine={false} interval={5} tick={{ fill: '#71817a', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: '#71817a', fontSize: 11 }} />
                <Tooltip labelFormatter={formatChartDate} formatter={(value) => [formatNumber(value), 'Complaints']} contentStyle={{ border: '1px solid #e2e9e3', borderRadius: 10, boxShadow: '0 12px 32px rgba(18, 38, 31, 0.1)' }} />
                <Area type="monotone" dataKey="count" stroke="#157b68" strokeWidth={2.5} fill="url(#complaintTrendFill)" activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="quiet-note">{loading ? 'Loading activity…' : 'No activity data available.'}</p>}
      </section>

      <div className="overview-grid">
        <section className="glass-card content-card" aria-label="Wards to review">
          <div className="section-heading">
            <div>
              <h2>Wards to review</h2>
              <p className="quiet-note">Ranked by model score in the latest data window</p>
            </div>
            <button className="text-action" type="button" onClick={() => onNavigateTab('predictions')}>All insights <ArrowUpRight size={14} /></button>
          </div>
          <div className="ward-list">
            {riskWards.length ? riskWards.map((ward) => (
              <button className="ward-row" type="button" key={ward.ward_id} onClick={() => onSelectWard(ward.ward_id)}>
                <span><strong>{ward.ward_name}</strong><small>{ward.ward_id} · {ward.complaint_count} reports</small></span>
                <span className="row-score">{Math.round(ward.risk_score * 100)} / 100</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            )) : <p className="quiet-note">{loading ? 'Loading ward scores…' : 'No ward scores available.'}</p>}
          </div>
        </section>

        <section className="glass-card content-card" aria-label="Complaint types">
          <div className="section-heading">
            <h2>Complaint types</h2>
            <button className="text-action" type="button" onClick={() => onNavigateTab('complaints')}>Explore <ArrowUpRight size={14} /></button>
          </div>
          {visibleTypes.length ? <div className="type-chart-layout">
            <div className="donut-wrap" role="img" aria-label="Complaint counts by type">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visibleTypes} dataKey="count" nameKey="complaint_type" innerRadius={64} outerRadius={88} stroke="none" paddingAngle={2}>
                    {visibleTypes.map((type, index) => <Cell key={type.complaint_type} fill={typeColors[index % typeColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatNumber(value)} contentStyle={{ border: '1px solid #e2e9e3', borderRadius: 10, boxShadow: '0 12px 32px rgba(18, 38, 31, 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><strong>{formatNumber(typeTotal)}</strong><small>total</small></div>
            </div>
            <div className="type-legend">
              {visibleTypes.map((type, index) => <div className="type-legend-row" key={type.complaint_type}>
                <span className="type-dot" style={{ background: typeColors[index % typeColors.length] }} />
                <span>{type.complaint_type.replaceAll('_', ' ')}</span>
                <strong>{typeTotal ? Math.round(type.count / typeTotal * 100) : 0}%</strong>
              </div>)}
            </div>
          </div> : <p className="quiet-note">{loading ? 'Loading categories…' : 'No category data available.'}</p>}
        </section>
      </div>

      <div className="quick-links" aria-label="Quick actions">
        <button className="quick-link" type="button" onClick={() => onNavigateTab('alerts')}><BellRing size={16} /> Review alerts <ArrowUpRight size={14} /></button>
        <button className="quick-link" type="button" onClick={() => onNavigateTab('incidents')}><Wrench size={16} /> Track incidents <ArrowUpRight size={14} /></button>
        <button className="quick-link" type="button" onClick={() => onNavigateTab('map')}><MapPinned size={16} /> Open map <ArrowUpRight size={14} /></button>
      </div>
    </div>
  );
}
