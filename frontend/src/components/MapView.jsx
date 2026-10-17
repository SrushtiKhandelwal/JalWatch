import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Filter, Layers, AlertTriangle, Droplets, Info } from 'lucide-react';
import { api } from '../api';

// Fix Leaflet default marker icons in React
const customWardIcon = (riskScore) => {
  const color = riskScore >= 70 ? '#ef4444' : riskScore >= 40 ? '#f59e0b' : '#0ea5e9';
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 10px;
        color: #ffffff;
      ">
        ${riskScore || '!'}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

function ChangeMapView({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView(coords, zoom || 13);
    }
  }, [coords, zoom]);
  return null;
}

export default function MapView({ selectedWardId }) {
  const [wards, setWards] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedWard, setSelectedWard] = useState(null);
  const [loading, setLoading] = useState(true);

  const NAGPUR_CENTER = [21.1458, 79.0882];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [wardsData, complaintsData] = await Promise.all([
          api.getWards(),
          api.getComplaints({ limit: 120, category: activeCategory || undefined })
        ]);
        setWards(wardsData);
        setComplaints(complaintsData);

        if (selectedWardId) {
          const matched = wardsData.find(w => w.ward_id === selectedWardId);
          if (matched) setSelectedWard(matched);
        }
      } catch (err) {
        console.error('Failed to load map spatial layers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeCategory, selectedWardId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      {/* Map Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
              GIS Water Network & Grievance Heatmap
            </h1>
            <span className="badge badge-medium" style={{ textTransform: 'none' }}>
              Nagpur Municipal Spatial View
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>
            Geospatial representation of 38 municipal wards, grievance incidents, and pipeline vulnerability zones.
          </p>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Filter size={14} />
            <span>Layer Filter:</span>
          </div>
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="select"
          >
            <option value="">All Categories (120 Sample Pins)</option>
            <option value="Low Pressure">Low Pressure</option>
            <option value="Water Contamination">Water Contamination</option>
            <option value="Pipeline Leakage">Pipeline Leakage</option>
            <option value="No Water Supply">No Water Supply</option>
            <option value="Burst Pipe">Burst Pipe</option>
          </select>
        </div>
      </div>

      {/* Main Map Box & Side Panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedWard ? '1fr 340px' : '1fr',
        gap: 20,
        height: '70vh',
        minHeight: 520
      }}>
        {/* Map Canvas */}
        <div className="glass-card" style={{ overflow: 'hidden', position: 'relative', height: '100%' }}>
          <MapContainer
            center={selectedWard ? [selectedWard.representative_latitude, selectedWard.representative_longitude] : NAGPUR_CENTER}
            zoom={12}
            style={{ width: '100%', height: '100%', background: '#0a0f1d' }}
          >
            <ChangeMapView 
              coords={selectedWard ? [selectedWard.representative_latitude, selectedWard.representative_longitude] : null} 
              zoom={14}
            />

            {/* Dark Mode CartoDB Tile Layer */}
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {/* Ward Representative Markers */}
            {wards.map((ward) => {
              const riskMock = ((ward.ward_number * 17) % 75) + 25; // deterministic preview risk score
              return (
                <Marker
                  key={ward.ward_id}
                  position={[ward.representative_latitude, ward.representative_longitude]}
                  icon={customWardIcon(riskMock)}
                  eventHandlers={{
                    click: () => setSelectedWard(ward),
                  }}
                >
                  <Popup>
                    <div style={{ color: '#0f172a', padding: 4 }}>
                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '0.95rem' }}>
                        {ward.ward_name} ({ward.ward_id})
                      </h4>
                      <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#475569' }}>
                        Zone: <strong>{ward.zone_name}</strong>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#475569' }}>
                        Localities: <strong>{ward.locality_count}</strong>
                      </p>
                      <div style={{
                        marginTop: 6,
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: riskMock >= 70 ? '#fee2e2' : '#fef3c7',
                        color: riskMock >= 70 ? '#b91c1c' : '#b45309'
                      }}>
                        Risk Index: {riskMock}/100
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Complaint Geocoded Pins */}
            {complaints.map((comp) => {
              const lat = comp.latitude;
              const lon = comp.longitude;
              if (!lat || !lon) return null;

              const type = comp.complaint_type || comp.category || '';
              const isContam = type.toLowerCase().includes('contam') || type.toLowerCase().includes('dirty');
              const isLeak = type.toLowerCase().includes('leak');
              const color = isContam ? '#ef4444' : isLeak ? '#06b6d4' : '#f59e0b';

              return (
                <CircleMarker
                  key={comp.complaint_id}
                  center={[lat, lon]}
                  radius={5}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.8,
                    color: '#ffffff',
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div style={{ color: '#0f172a', fontSize: '0.8rem', padding: 2 }}>
                      <strong style={{ textTransform: 'capitalize' }}>{type.replace(/_/g, ' ')}</strong>
                      <p style={{ margin: '4px 0', color: '#334155' }}>{comp.locality_id || comp.locality || 'Nagpur Area'}</p>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Status: {comp.status} | {comp.severity}
                      </span>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Map Legend Overlay */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            background: 'rgba(8, 12, 20, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <span style={{ fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>Spatial Legend</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
              <span>High Risk Ward / Contamination</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
              <span>Moderate Risk / Pressure Drops</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0ea5e9' }} />
              <span>Standard Ward / Pipeline Flow</span>
            </div>
          </div>
        </div>

        {/* Selected Ward Detail Drawer */}
        {selectedWard && (
          <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {selectedWard.ward_id}
                </span>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff', marginTop: 2 }}>
                  {selectedWard.ward_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedWard(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Administrative Zone</span>
                <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedWard.zone_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Locality Count</span>
                <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedWard.locality_count} Areas</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Center Coordinates</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {selectedWard.representative_latitude.toFixed(3)}, {selectedWard.representative_longitude.toFixed(3)}
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(14, 165, 233, 0.08)',
              border: '1px solid rgba(14, 165, 233, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              fontSize: '0.8rem',
              color: '#38bdf8'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                <Info size={14} />
                <span>GIS Integration Note</span>
              </div>
              <span>Member 2 (GIS Developer) can swap in exact shapefile polygon GeoJSON layers using the Ward model’s <code>boundary_geojson</code> field.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
