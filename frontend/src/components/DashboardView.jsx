import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  FileWarning, 
  Flame, 
  TrendingUp, 
  Droplet,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { api } from '../api';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#38bdf8',
  low: '#94a3b8'
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
        api.getWardRiskOverview(10),
      ]);
      setSummary(sumRes);
      setTypes((typeRes || []).map(t => ({
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
        <RefreshCw size={32} className="spin" color="var(--primary)" />
        <p style={{ color: 'var(--text-secondary)' }}>Aggregating 10,000+ NMC water complaints and spatial risk scores...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Top Header / Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: 4 }}>
            Nagpur Water Utility Command Center
          </h1>
          <p style={{ fontSize: '0.875rem' }}>
            Real-time analytics across 38 municipal wards, telemetry alert feeds, and grievance redressal workflows.
          </p>
        </div>

        <button 
          onClick={loadData} 
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Updating...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Total Grievances
              </p>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                {summary?.total_complaints?.toLocaleString() || 0}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8' }}>
              <Droplet size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.75rem', display: 'flex', gap: 12 }}>
            <span style={{ color: '#34d399' }}>✓ {summary?.resolved_complaints} Resolved</span>
            <span style={{ color: '#fbbf24' }}>⏳ {summary?.in_progress_complaints} In Progress</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Active Alerts
              </p>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#f87171', marginTop: 4 }}>
                {summary?.active_alerts || 0}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{summary?.critical_alerts} Critical Alerts</span>
            <span 
              onClick={() => onNavigateTab('alerts')} 
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
            >
              View Feed →
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Active Incidents
              </p>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {summary?.open_incidents || 0}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Flame size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{summary?.total_incidents} Total Logged</span>
            <span 
              onClick={() => onNavigateTab('incidents')} 
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Track Pipeline →
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Avg Resolution SLA
              </p>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {summary?.avg_resolution_hours ? `${summary.avg_resolution_hours}h` : '48h'}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Within target standard for NMC zone teams
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                High-Risk Wards
              </p>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#c084fc', marginTop: 4 }}>
                {summary?.high_risk_wards || 0}
              </h2>
            </div>
            <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <FileWarning size={20} />
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Risk Score &gt; 70 requiring early intervention
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
        gap: 20,
      }}>
        {/* Trend Area Chart */}
        <div className="glass-card" style={{ padding: 24, minHeight: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>Grievance Inflow Velocity (30 Days)</h3>
              <p style={{ fontSize: '0.8rem' }}>Daily citizen complaints registered across Nagpur zones</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#38bdf8' }}>
              <TrendingUp size={14} />
              <span>30-Day Trend</span>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-muted)" 
                  fontSize={11}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderColor: 'var(--border-subtle)',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="Complaints" 
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
        <div className="glass-card" style={{ padding: 24, minHeight: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>Complaints by Root Category</h3>
              <p style={{ fontSize: '0.8rem' }}>Distribution of reported water utility issues</p>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={types} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
                <YAxis 
                  type="category" 
                  dataKey="category" 
                  stroke="var(--text-secondary)" 
                  fontSize={11}
                  width={110}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderColor: 'var(--border-subtle)',
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

      {/* Second Charts / Table Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 20,
      }}>
        {/* Severity Donut Chart */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: 4 }}>Severity Distribution</h3>
          <p style={{ fontSize: '0.8rem', marginBottom: 16 }}>Grievance triage priority classification</p>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={severities}
                  dataKey="count"
                  nameKey="severity"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {severities.map((entry, index) => (
                    <Cell key={`sev-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderColor: 'var(--border-subtle)',
                    borderRadius: 8,
                    fontSize: 12
                  }} 
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'capitalize' }}>{val}</span>} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High-Risk Ward Matrix */}
        <div className="glass-card" style={{ padding: 24, gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>High-Risk Ward Prioritization</h3>
              <p style={{ fontSize: '0.8rem' }}>AI risk ranking combining complaint clusters & pipe age</p>
            </div>
            <button 
              onClick={() => onNavigateTab('map')} 
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={14} />
              <span>Explore on GIS Map</span>
            </button>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ward ID</th>
                  <th>Ward Name</th>
                  <th>Zone</th>
                  <th>Complaints</th>
                  <th>Risk Score</th>
                  <th>Active Alerts</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {wardRisks.map((w) => {
                  const isHigh = w.risk_score >= 70;
                  const isMed = w.risk_score >= 40 && w.risk_score < 70;
                  return (
                    <tr key={w.ward_id}>
                      <td style={{ fontWeight: 700, color: '#ffffff' }}>{w.ward_id}</td>
                      <td>{w.ward_name}</td>
                      <td>{w.zone_name}</td>
                      <td>{w.complaint_count}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1,
                            height: 6,
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 4,
                            overflow: 'hidden',
                            maxWidth: 80
                          }}>
                            <div style={{
                              width: `${w.risk_score}%`,
                              height: '100%',
                              background: isHigh ? 'var(--rose)' : isMed ? 'var(--amber)' : 'var(--emerald)',
                              borderRadius: 4
                            }} />
                          </div>
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: isHigh ? '#f87171' : isMed ? '#fbbf24' : '#34d399'
                          }}>
                            {w.risk_score}
                          </span>
                        </div>
                      </td>
                      <td>
                        {w.active_alerts > 0 ? (
                          <span className="badge badge-critical">{w.active_alerts} Alerts</span>
                        ) : (
                          <span className="badge badge-low">Normal</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            if (onSelectWard) onSelectWard(w.ward_id);
                            onNavigateTab('map');
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
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
