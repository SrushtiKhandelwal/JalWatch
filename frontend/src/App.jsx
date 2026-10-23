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
const CitizenPortal = lazy(() => import('./components/CitizenPortal'));
const CitizenAccess = lazy(() => import('./components/CitizenAccess'));
const ClustersView = lazy(() => import('./components/ClustersView'));
const ServiceNoticesView = lazy(() => import('./components/ServiceNoticesView'));

export default function App() {
  const [authStatus, setAuthStatus] = useState('loading');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [authMode, setAuthMode] = useState('admin');
  const [citizenProfile, setCitizenProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [prefillIncidentData, setPrefillIncidentData] = useState(null);
  const [selectedMapWardId, setSelectedMapWardId] = useState(null);
  const [focusComplaintId, setFocusComplaintId] = useState(null);
  const [focusComplaintWardId, setFocusComplaintWardId] = useState(null);
  const [focusIncidentId, setFocusIncidentId] = useState(null);
  const [clusterWardId, setClusterWardId] = useState(null);
  const [incidentRevision, setIncidentRevision] = useState(0);

  useEffect(() => {
    Promise.allSettled([api.getSession(), api.getCitizenSession()]).then(([admin, citizen]) => {
      if (admin.status === 'fulfilled') setAuthStatus('admin');
      else if (citizen.status === 'fulfilled') {
        setCitizenProfile(citizen.value);
        setAuthStatus('citizen');
      } else setAuthStatus('signed-out');
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
      setCitizenProfile(null);
      setAuthStatus('admin');
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
    if (authStatus !== 'admin') return;
    updateAlertCount();
    const interval = setInterval(updateAlertCount, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [authStatus]);

  const handleEscalateToIncident = (alertItem) => {
    setPrefillIncidentData({ ...alertItem, kind: 'alert' });
    setIsIncidentModalOpen(true);
  };

  const handleCreateIncidentFromComplaint = (complaint) => {
    setPrefillIncidentData({ ...complaint, kind: 'complaint' });
    setIsIncidentModalOpen(true);
  };

  const handleSelectWardFromDashboard = (wardId) => {
    setSelectedMapWardId(wardId);
    setActiveTab('map');
  };

  if (authStatus === 'citizen' && citizenProfile) {
    return <Suspense fallback={<main className="auth-page">Loading citizen portal…</main>}><CitizenPortal
      profile={citizenProfile}
      onProfileChange={setCitizenProfile}
      onLogout={async () => {
        try { await api.citizenLogout(); } catch (err) { console.error(err); }
        setCitizenProfile(null);
        setAuthStatus('signed-out');
      }}
    /></Suspense>;
  }

  if (authStatus !== 'admin') {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-wordmark">Jal<span>Watch</span></div>
          <div className="auth-role-switch" role="group" aria-label="Choose sign-in area">
            <button type="button" className={authMode === 'admin' ? 'is-active' : ''} onClick={() => { setAuthMode('admin'); setAuthError(''); }}>NMC admin</button>
            <button type="button" className={authMode === 'citizen' ? 'is-active' : ''} onClick={() => { setAuthMode('citizen'); setAuthError(''); }}>Citizen</button>
          </div>
          {authStatus === 'loading' ? <p>Checking session…</p> : authMode === 'citizen' ? (
            <Suspense fallback={<p>Loading sign in…</p>}><CitizenAccess onAuthenticated={(profile) => {
              setCitizenProfile(profile);
              setAuthStatus('citizen');
            }} /></Suspense>
          ) : <>
            <h1>Administrator sign in</h1>
            <p>Sign in to your water operations workspace.</p>
            <form onSubmit={handleLogin} className="auth-form">
              <label htmlFor="admin-password">Administrator password</label>
              <input id="admin-password" className="input" type="password" autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)} required />
              {authError && <p role="alert" style={{ color: 'var(--rose)' }}>{authError}</p>}
              <button className="btn btn-primary auth-submit" type="submit" disabled={signingIn}>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>}
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
            focusIncidentId={focusIncidentId}
            onOpenComplaint={(id) => { setFocusComplaintWardId(null); setFocusComplaintId(id); setActiveTab('complaints'); }}
          />
        )}

        {activeTab === 'map' && <MapView selectedWardId={selectedMapWardId}
          onOpenComplaint={(id) => { setFocusComplaintWardId(null); setFocusComplaintId(id); setActiveTab('complaints'); }}
          onOpenIncident={(id) => { setFocusIncidentId(id); setActiveTab('incidents'); }} />}

        {activeTab === 'complaints' && (
          <ComplaintsView onCreateIncident={handleCreateIncidentFromComplaint} focusComplaintId={focusComplaintId} focusWardId={focusComplaintWardId} />
        )}

        {activeTab === 'clusters' && <ClustersView wardId={clusterWardId}
          onCreateIncident={(cluster) => {
            setPrefillIncidentData({ ...cluster, kind: 'cluster' });
            setIsIncidentModalOpen(true);
          }}
          onOpenComplaint={(id) => { setFocusComplaintWardId(null); setFocusComplaintId(id); setActiveTab('complaints'); }}
          onOpenMap={handleSelectWardFromDashboard}
        />}

        {activeTab === 'notices' && <ServiceNoticesView />}

        {activeTab === 'predictions' && (
          <PredictionsView onAlertsChanged={updateAlertCount} onNavigateAlerts={() => setActiveTab('alerts')}
            onOpenMap={handleSelectWardFromDashboard}
            onOpenComplaints={(id) => { setFocusComplaintId(null); setFocusComplaintWardId(id); setActiveTab('complaints'); }}
            onOpenClusters={(id) => { setClusterWardId(id); setActiveTab('clusters'); }}
            onCreateIncident={async (risk) => {
              let ward = null;
              try {
                ward = (await api.getWards()).find((item) => item.ward_id === risk.ward_id);
              } catch (err) { console.error(err); }
              setPrefillIncidentData({
                kind: 'risk', title: `Investigate elevated risk in ${risk.ward_name}`,
                description: `Experimental score ${Math.round((risk.risk_score || 0) * 100)}/100, based on synthetic labels. Review complaints and field conditions before confirming a cause.`,
                ward_id: risk.ward_id, latitude: ward?.representative_latitude,
                longitude: ward?.representative_longitude, severity: risk.risk_level,
              });
              setIsIncidentModalOpen(true);
            }} />
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
