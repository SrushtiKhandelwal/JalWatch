import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Flame, 
  TrendingUp, 
  Droplet,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { api } from '../api';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#0ea5e9',
  low: '#64748b'
};

const CATEGORY_COLORS = [
  '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'
];

export default function DashboardView({ onSelectWard, onNavigateTab }) {
  const [summary, setSummary] = useState(null);
  const [types, setTypes] = useState([]);
  const [severities, setSeverities] = useState([]);
  const [trend, setTrend] = useState([]);
  const [wardRisks, setWardRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [sumRes, typeRes, sevRes, trendRes, wardRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getComplaintsByType(),
        api.getComplaintsBySeverity(),
        api.getDailyTrend(30),
        api.getWardRiskOverview(6), // Top 6 wards for clean layout
      ]);
      setSummary(sumRes);
      setTypes((typeRes || []).slice(0, 6).map(t => ({
        category: (t.complaint_type || t.category || '').replace(/_/g, ' '),
        count: t.count
      })));
      setSeverities(sevRes || []);
      setTrend(trendRes || []);
      setWardRisks((wardRes || []).map(w => ({
        ...w,
        risk_score: Math.round(w.risk_score <= 1.0 ? w.risk_score * 100 : w.risk_score),
        complaint_count: w.total_complaints !== undefined ? w.total_complaints : w.complaint_count
      })));
    } catch (err) {
      console.error('Failed to load dashboard analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <RefreshCw size={28} className="spin" color="var(--primary)" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading municipal telemetry...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 40 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Municipal Water Command Center
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Nagpur city-wide telemetry, grievance velocity, and spatial risk distribution across 38 wards.
          </p>
        </div>

        <button 
          onClick={loadData} 
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
          style={{ gap: 8 }}
        >
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* 4 Clean Executive KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
      }}>
        {/* KPI 1 */}
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Total Grievances
              </span>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginTop: 4, letterSpacing: '-0.03em' }}>
                {summary?.total_complaints?.toLocaleString() || 0}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8' }}>
              <Droplet size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: '#34d399', fontWeight: 600 }}>{summary?.resolved_complaints?.toLocaleString()}</span> resolved · {summary?.in_progress_complaints?.toLocaleString()} active
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Active Warnings
              </span>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f87171', marginTop: 4, letterSpacing: '-0.03em' }}>
                {summary?.active_alerts || 0}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{summary?.critical_alerts || 0} critical priority</span>
            <span 
              onClick={() => onNavigateTab('alerts')} 
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
            >
              View Feed
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Active Incidents
              </span>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#fbbf24', marginTop: 4, letterSpacing: '-0.03em' }}>
                {summary?.open_incidents || 0}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
              <Flame size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Crews deployed in field</span>
            <span 
              onClick={() => onNavigateTab('incidents')} 
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Work Orders
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Resolution SLA
              </span>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#34d399', marginTop: 4, letterSpacing: '-0.03em' }}>
                {summary?.avg_resolution_hours ? `${summary.avg_resolution_hours}h` : '48h'}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            City standard compliant (Target: ≤ 72h)
          </div>
        </div>
      </div>

      {/* Row 1: Main Velocity Trend & Category Distribution */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: 20,
      }}>
        {/* Trend Area Chart */}
        <div className="glass-card" style={{ padding: 24, minHeight: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Grievance Velocity (30 Days)</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Daily citizen reports registered across Nagpur zones</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#38bdf8' }}>
              <TrendingUp size={14} />
              <span>Telemetry Feed</span>
            </div>
          </div>

          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.04)" />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-muted)" 
                  fontSize={11}
                  tickFormatter={(val) => val.slice(5)}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0c1322', 
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="Reports" 
                  stroke="#38bdf8" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#trendGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Complaints Breakdown Bar Chart */}
        <div className="glass-card" style={{ padding: 24, minHeight: 340 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Grievances by Category</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Root cause distribution of citizen complaints</p>
          </div>

          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={types} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.04)" />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis 
                  type="category" 
                  dataKey="category" 
                  stroke="var(--text-secondary)" 
                  fontSize={11}
                  width={110}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0c1322', 
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    fontSize: 12
                  }} 
                />
                <Bar dataKey="count" name="Complaints" radius={[0, 4, 4, 0]}>
                  {types.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Severity Triage + High Risk Ward Focus */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 360px) 1fr',
        gap: 20,
      }}>
        {/* Severity Donut */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1.05rem', color: '#ffffff', marginBottom: 2 }}>Severity Triage</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>Priority classification</p>

          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={severities}
                  dataKey="count"
                  nameKey="severity"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {severities.map((entry, index) => (
                    <Cell key={`sev-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0c1322', 
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    fontSize: 12
                  }} 
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={32} 
                  formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: 11, textTransform: 'capitalize' }}>{val}</span>} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Ward Matrix (Top 5 Focus) */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>High-Risk Ward Prioritization</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Top municipal sectors requiring proactive mitigation</p>
            </div>
            <button 
              onClick={() => onNavigateTab('map')} 
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              <span>Open GIS Map</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ward Sector</th>
                  <th>Zone</th>
                  <th>Complaints</th>
                  <th>Risk Index</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {wardRisks.map((w) => {
                  const isHigh = w.risk_score >= 70;
                  const isMed = w.risk_score >= 40 && w.risk_score < 70;
                  return (
                    <tr key={w.ward_id}>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        {w.ward_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({w.ward_id})</span>
                      </td>
                      <td>{w.zone_name}</td>
                      <td>{w.complaint_count}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1,
                            height: 5,
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: 4,
                            overflow: 'hidden',
                            maxWidth: 70
                          }}>
                            <div style={{
                              width: `${w.risk_score}%`,
                              height: '100%',
                              background: isHigh ? 'var(--rose)' : isMed ? 'var(--amber)' : 'var(--emerald)',
                              borderRadius: 4
                            }} />
                          </div>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: isHigh ? '#f87171' : isMed ? '#fbbf24' : '#34d399'
                          }}>
                            {w.risk_score}
                          </span>
                        </div>
                      </td>
                      <td>
                        {w.active_alerts > 0 ? (
                          <span className="badge badge-critical" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                            {w.active_alerts} Alerts
                          </span>
                        ) : (
                          <span className="badge badge-low" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                            Optimal
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            if (onSelectWard) onSelectWard(w.ward_id);
                            onNavigateTab('map');
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          Locate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
