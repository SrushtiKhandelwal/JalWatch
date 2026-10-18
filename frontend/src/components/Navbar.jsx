import React from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  FileText, 
  BrainCircuit, 
  Droplets,
  Plus
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, activeAlertCount, openNewIncidentModal, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: BarChart3 },
    { id: 'alerts', label: 'Early Warning', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'incidents', label: 'Operations', icon: ShieldAlert },
    { id: 'map', label: 'Map Preview', icon: MapPin },
    { id: 'complaints', label: 'Grievances', icon: FileText },
    { id: 'predictions', label: 'Model Pending', icon: BrainCircuit },
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(7, 11, 20, 0.92)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1440,
        margin: '0 auto',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {/* Brand identity */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} 
          onClick={() => setActiveTab('dashboard')}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(14, 165, 233, 0.35)'
          }}>
            <Droplets size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                JalWatch
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(14, 165, 233, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(14, 165, 233, 0.3)'
              }}>
                NMC
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Nagpur Municipal Water Command
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(12, 19, 34, 0.7)',
          padding: '4px 6px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: '0.825rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                  border: isActive ? '1px solid rgba(14, 165, 233, 0.35)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} color={isActive ? '#38bdf8' : 'currentColor'} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{
                    background: 'var(--rose)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    lineHeight: 1
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Action buttons & status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 11px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: '#34d399',
            fontWeight: 600
          }}>
            <div className="live-pulse" style={{ width: 6, height: 6 }} />
            <span>API Connected</span>
          </div>

          <button
            onClick={openNewIncidentModal}
            className="btn btn-primary"
            style={{ padding: '7px 14px', fontSize: '0.8rem', borderRadius: 8 }}
          >
            <Plus size={15} />
            <span>Log Incident</span>
          </button>
          <button onClick={onLogout} className="btn btn-secondary btn-sm">Sign out</button>
        </div>
      </div>
    </header>
  );
}
