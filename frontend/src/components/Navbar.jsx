import React from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  FileText, 
  BrainCircuit, 
  Droplets,
  Activity,
  Plus
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, activeAlertCount, openNewIncidentModal }) {
  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: BarChart3 },
    { id: 'alerts', label: 'Alerts & Early Warning', icon: AlertTriangle, badge: activeAlertCount },
    { id: 'incidents', label: 'Incident Redressal', icon: ShieldAlert },
    { id: 'map', label: 'GIS Network Map', icon: MapPin },
    { id: 'complaints', label: 'Grievance Explorer', icon: FileText },
    { id: 'predictions', label: 'AI Risk Models', icon: BrainCircuit },
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(8, 12, 20, 0.85)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)'
          }}>
            <Droplets size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                JalWatch
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(14, 165, 233, 0.2)',
                color: '#38bdf8',
                border: '1px solid rgba(14, 165, 233, 0.4)'
              }}>
                NMC
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Nagpur Water Grievance Redressal & Intelligence
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.6)',
          padding: 4,
          borderRadius: 'var(--radius-lg)',
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
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.825rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  background: isActive ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.3), rgba(2, 132, 199, 0.2))' : 'transparent',
                  border: isActive ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Icon size={16} color={isActive ? '#38bdf8' : 'currentColor'} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{
                    background: 'var(--rose)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
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
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: '#34d399',
            fontWeight: 600
          }}>
            <div className="live-pulse" />
            <span>NMC Telemetry Online</span>
          </div>

          <button
            onClick={openNewIncidentModal}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            <Plus size={16} />
            <span>Log Incident</span>
          </button>
        </div>
      </div>
    </header>
  );
}
