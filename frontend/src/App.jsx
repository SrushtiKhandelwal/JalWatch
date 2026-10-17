import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import AlertsView from './components/AlertsView';
import IncidentsView from './components/IncidentsView';
import MapView from './components/MapView';
import ComplaintsView from './components/ComplaintsView';
import PredictionsView from './components/PredictionsView';
import NewIncidentModal from './components/NewIncidentModal';
import { api } from './api';
import { Droplet, ExternalLink, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [prefillIncidentData, setPrefillIncidentData] = useState(null);
  const [selectedMapWardId, setSelectedMapWardId] = useState(null);

  // Poll or load alert count for navbar badge
  const updateAlertCount = async () => {
    try {
      const alerts = await api.getAlerts({ status: 'active', limit: 100 });
      setActiveAlertCount(alerts.length);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    updateAlertCount();
    const interval = setInterval(updateAlertCount, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  const handleEscalateToIncident = (alertItem) => {
    setPrefillIncidentData(alertItem);
    setIsIncidentModalOpen(true);
  };

  const handleSelectWardFromDashboard = (wardId) => {
    setSelectedMapWardId(wardId);
    setActiveTab('map');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={activeAlertCount}
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
            onOpenNewIncidentModal={() => {
              setPrefillIncidentData(null);
              setIsIncidentModalOpen(true);
            }}
          />
        )}

        {activeTab === 'map' && (
          <MapView
            selectedWardId={selectedMapWardId}
          />
        )}

        {activeTab === 'complaints' && (
          <ComplaintsView />
        )}

        {activeTab === 'predictions' && (
          <PredictionsView />
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
          if (activeTab === 'incidents') {
            // refresh happens inside IncidentsView
          }
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
              <span style={{ color: '#34d399' }}>Core Telemetry Online</span>
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <span>Spatial Engine: OpenGIS WGS84</span>
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
