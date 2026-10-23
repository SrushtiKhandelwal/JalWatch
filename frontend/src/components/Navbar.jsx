import React from 'react';
import { Plus } from 'lucide-react';

const navigation = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'clusters', label: 'Related reports' },
  { id: 'map', label: 'Map' },
  { id: 'predictions', label: 'Insights' },
  { id: 'alerts', label: 'Risk signals' },
  { id: 'notices', label: 'Notices' },
  { id: 'incidents', label: 'Incidents' },
];

export default function Navbar({ activeTab, setActiveTab, activeAlertCount, openNewIncidentModal, onLogout }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="wordmark" type="button" onClick={() => setActiveTab('dashboard')} aria-label="JalWatch overview">
          Jal<span>Watch</span>
        </button>

        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ id, label }) => (
            <button
              key={id}
              className={`nav-link ${activeTab === id ? 'is-active' : ''}`}
              type="button"
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => setActiveTab(id)}
            >
              {label}
              {id === 'alerts' && activeAlertCount > 0 && <span className="nav-count">{activeAlertCount}</span>}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="btn btn-primary new-incident-button" type="button" onClick={openNewIncidentModal}>
            <Plus size={16} /> New incident
          </button>
          <button className="sign-out-button" type="button" onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
