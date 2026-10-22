import React, { lazy, Suspense, useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import { api } from './api';

const DashboardView = lazy(() => import('./components/DashboardView'));
const AlertsView = lazy(() => import('./components/AlertsView'));
const IncidentsView = lazy(() => import('./components/IncidentsView'));
const MapView = lazy(() => import('./components/MapView'));
const ComplaintsView = lazy(() => import('./components/ComplaintsView'));
const PredictionsView = lazy(() => import('./components/PredictionsView'));
const NewIncidentModal = lazy(() => import('./components/NewIncidentModal'));

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
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-wordmark">Jal<span>Watch</span></div>
          <h1>Welcome back</h1>
          <p>Sign in to your water operations workspace.</p>
          {authStatus === 'loading' ? <p>Checking session…</p> : (
            <form onSubmit={handleLogin} className="auth-form">
              <label htmlFor="admin-password">Administrator password</label>
              <input id="admin-password" className="input" type="password" autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)} required />
              {authError && <p role="alert" style={{ color: 'var(--rose)' }}>{authError}</p>}
              <button className="btn btn-primary auth-submit" type="submit" disabled={signingIn}>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
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

      <main className="app-main">
        <Suspense fallback={<p>Loading view…</p>}>
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
          />
        )}

        {activeTab === 'map' && <MapView selectedWardId={selectedMapWardId} />}

        {activeTab === 'complaints' && (
          <ComplaintsView />
        )}

        {activeTab === 'predictions' && (
          <PredictionsView onAlertsChanged={updateAlertCount} onNavigateAlerts={() => setActiveTab('alerts')} />
        )}
        </Suspense>
      </main>

      {isIncidentModalOpen && <Suspense fallback={null}><NewIncidentModal
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
      /></Suspense>}
    </div>
  );
}
