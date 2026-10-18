import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import AlertsView from './components/AlertsView';
import IncidentsView from './components/IncidentsView';
import MapView from './components/MapView';
import ComplaintsView from './components/ComplaintsView';
import NewIncidentModal from './components/NewIncidentModal';
import { api } from './api';
import { Droplet, ExternalLink } from 'lucide-react';

export default function App() {
  const [authStatus, setAuthStatus] = useState('loading');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [prefillIncidentData, setPrefillIncidentData] = useState(null);
  const [selectedMapWardId, setSelectedMapWardId] = useState(null);
  const [incidentRevision, setIncidentRevision] = useState(0);

  useEffect(() => {
    api.getSession()
      .then(() => setAuthStatus('authenticated'))
      .catch((err) => {
        setAuthError(err.message.includes('Sign in') ? '' : err.message);
        setAuthStatus('signed-out');
      });
    const expireSession = () => setAuthStatus('signed-out');
    window.addEventListener('jalwatch:unauthorized', expireSession);
    return () => window.removeEventListener('jalwatch:unauthorized', expireSession);
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSigningIn(true);
    setAuthError('');
    try {
      await api.login(password);
      setPassword('');
      setAuthStatus('authenticated');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSigningIn(false);
    }
  };

  // Poll or load alert count for navbar badge
  const updateAlertCount = async () => {
    try {
      const result = await api.getActiveAlertCount();
      setActiveAlertCount(result.active_alerts);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    updateAlertCount();
    const interval = setInterval(updateAlertCount, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [authStatus]);

  const handleEscalateToIncident = (alertItem) => {
    setPrefillIncidentData(alertItem);
    setIsIncidentModalOpen(true);
  };

  const handleSelectWardFromDashboard = (wardId) => {
    setSelectedMapWardId(wardId);
    setActiveTab('map');
  };

  if (authStatus !== 'authenticated') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
          <h1 style={{ marginBottom: 8 }}>JalWatch</h1>
          <p style={{ marginBottom: 24 }}>Administrator sign in</p>
          {authStatus === 'loading' ? <p>Checking session…</p> : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label htmlFor="admin-password">Administrator password</label>
              <input id="admin-password" className="input" type="password" autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)} required />
              {authError && <p role="alert" style={{ color: '#fca5a5' }}>{authError}</p>}
              <button className="btn btn-primary" type="submit" disabled={signingIn}>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={activeAlertCount}
        onLogout={async () => {
          try { await api.logout(); } catch (err) { console.error(err); }
          setAuthStatus('signed-out');
        }}
        openNewIncidentModal={() => {
          setPrefillIncidentData(null);
          setIsIncidentModalOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main style={{
        maxWidth: 1440,
        margin: '0 auto',
        width: '100%',
        padding: '24px 24px 60px',
        flex: 1
      }}>
        {activeTab === 'dashboard' && (
          <DashboardView
            onSelectWard={handleSelectWardFromDashboard}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsView
            onEscalateToIncident={handleEscalateToIncident}
          />
        )}

        {activeTab === 'incidents' && (
          <IncidentsView
            revision={incidentRevision}
            onOpenNewIncidentModal={() => {
              setPrefillIncidentData(null);
              setIsIncidentModalOpen(true);
            }}
          />
        )}

        {activeTab === 'map' && (
          <>
            <p style={{ marginBottom: 16 }}>
              Map preview: ward centers and sampled complaint pins. Network layers and validated boundaries are pending Member 2’s data integration.
            </p>
            <MapView selectedWardId={selectedMapWardId} />
          </>
        )}

        {activeTab === 'complaints' && (
          <ComplaintsView />
        )}

        {activeTab === 'predictions' && (
          <div className="glass-card" style={{ padding: 32 }}>
            <h1>Risk model integration pending</h1>
            <p style={{ marginTop: 12 }}>
              Member 1 will provide validated incident risk predictions. The alert evaluator accepts those results through the documented model signal contract.
            </p>
          </div>
        )}
      </main>

      {/* New Incident / Escalation Modal */}
      <NewIncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => {
          setIsIncidentModalOpen(false);
          setPrefillIncidentData(null);
        }}
        prefillData={prefillIncidentData}
        onIncidentCreated={() => {
          updateAlertCount();
          setIncidentRevision((current) => current + 1);
          setActiveTab('incidents');
        }}
      />

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(8, 12, 20, 0.95)',
        padding: '20px 24px',
        marginTop: 'auto',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{
          maxWidth: 1440,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Droplet size={16} color="var(--primary)" />
            <span style={{ color: '#ffffff', fontWeight: 700 }}>JalWatch</span>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <span>Nagpur Municipal Corporation Water Intelligence Platform</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="live-pulse" style={{ width: 6, height: 6 }} />
              <span style={{ color: '#34d399' }}>API Connected</span>
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <span>Map layers pending validation</span>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span>API Gateway</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
