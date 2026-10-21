import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Filter,
  Layers,
  AlertTriangle,
  Info,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api';

// Center coordinate for Nagpur Municipal Corporation area
const NAGPUR_CENTER = [21.1458, 79.0882];

// Ward pin marker icon
const customWardIcon = (wardNumber, isSelected) => {
  return L.divIcon({
    className: 'custom-ward-pin',
    html: `
      <div style="
        background: ${isSelected ? '#38bdf8' : '#0284c7'};
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 ${isSelected ? '12px #38bdf8' : '6px rgba(0,0,0,0.5)'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 10px;
        color: #ffffff;
        cursor: pointer;
      ">
        W${wardNumber}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

// Node colors based on infrastructure type
const NODE_COLORS = {
  junction: { fill: '#64748b', stroke: '#cbd5e1', label: 'Junction', radius: 4 },
  valve: { fill: '#f59e0b', stroke: '#fde68a', label: 'Control Valve', radius: 5 },
  pump_station: { fill: '#10b981', stroke: '#a7f3d0', label: 'Pump Station', radius: 6 },
  tank: { fill: '#a855f7', stroke: '#e9d5ff', label: 'Overhead Tank', radius: 6 },
  reservoir: { fill: '#2563eb', stroke: '#bfdbfe', label: 'Reservoir', radius: 7 },
};

// Complaint colors based on complaint type
const getComplaintColor = (type) => {
  const t = (type || '').toLowerCase();
  if (t.includes('contam') || t.includes('dirty') || t.includes('smell')) return '#ef4444'; // Red
  if (t.includes('leak') || t.includes('burst')) return '#06b6d4'; // Cyan
  if (t.includes('shortage') || t.includes('no_water')) return '#f97316'; // Orange
  if (t.includes('pressure')) return '#eab308'; // Yellow
  return '#a855f7'; // Purple fallback
};

// Pipe colors based on valve status
const getPipeColor = (valveStatus) => {
  if (valveStatus === 'closed') return '#ef4444'; // Red for closed valve
  return '#06b6d4'; // Cyan for flowing pipe
};

function ChangeMapView({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords[0] && coords[1]) {
      map.setView(coords, zoom || 13, { animate: true });
    }
  }, [coords, zoom, map]);
  return null;
}

export default function MapView({ selectedWardId: initialWardId }) {
  // Spatial layer data
  const [wards, setWards] = useState([]);
  const [localities, setLocalities] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [pipes, setPipes] = useState([]);
  const [totalComplaintsCount, setTotalComplaintsCount] = useState(0);

  // Layer visibility toggles
  const [showWards, setShowWards] = useState(true);
  const [showComplaints, setShowComplaints] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const [showPipes, setShowPipes] = useState(true);

  // Filters & selection
  const [selectedWardId, setSelectedWardId] = useState(initialWardId || '');
  const [complaintType, setComplaintType] = useState('');
  const [complaintLimit, setComplaintLimit] = useState(250);
  const [selectedFeature, setSelectedFeature] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [legendOpen, setLegendOpen] = useState(true);

  // Sync prop changes to state
  useEffect(() => {
    if (initialWardId) {
      setSelectedWardId(initialWardId);
    }
  }, [initialWardId]);

  // Load wards once on mount
  useEffect(() => {
    let isMounted = true;
    api.getWards()
      .then((data) => {
        if (isMounted) setWards(data || []);
      })
      .catch((err) => {
        if (isMounted) setError(`Failed to load wards: ${err.message}`);
      });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedWardId) return;
    let isMounted = true;
    api.getWardLocalities(selectedWardId)
      .then((data) => { if (isMounted) setLocalities(data); })
      .catch((err) => { if (isMounted) setError(`Failed to load localities: ${err.message}`); });
    return () => { isMounted = false; };
  }, [selectedWardId]);

  // Fetch layer data based on filters
  const fetchLayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wardParam = selectedWardId || undefined;

      const [nodesGeoJson, pipesGeoJson, complaintsRes] = await Promise.all([
        api.getNetworkNodes({ ward_id: wardParam }),
        api.getNetworkPipes({ ward_id: wardParam }),
        api.getComplaintsPage({
          ward_id: wardParam,
          complaint_type: complaintType || undefined,
          page_size: complaintLimit,
          page: 1,
        }),
      ]);

      setNodes(nodesGeoJson?.features || []);
      setPipes(pipesGeoJson?.features || []);
      setComplaints(complaintsRes?.complaints || []);
      setTotalComplaintsCount(complaintsRes?.total || 0);
    } catch (err) {
      console.error('Failed to load GIS layers:', err);
      setError(`Failed to load spatial layers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedWardId, complaintType, complaintLimit]);

  useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  // Find active selected ward object for zooming
  const activeWard = useMemo(() => {
    if (!selectedWardId) return null;
    return wards.find((w) => w.ward_id === selectedWardId) || null;
  }, [selectedWardId, wards]);

  const mapCenter = useMemo(() => {
    if (activeWard && activeWard.representative_latitude && activeWard.representative_longitude) {
      return [activeWard.representative_latitude, activeWard.representative_longitude];
    }
    return NAGPUR_CENTER;
  }, [activeWard]);

  const mapZoom = useMemo(() => {
    return activeWard ? 14 : 12;
  }, [activeWard]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
              GIS Water Network & Complaint Map
            </h1>
            <span className="badge badge-medium" style={{ textTransform: 'none' }}>
              Nagpur Demo Spatial View
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', marginTop: 4, color: 'var(--text-secondary)' }}>
            Integrated geospatial layers: 38 municipal ward centers, citizen grievances, and preview water network distribution infrastructure.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Ward filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} style={{ color: 'var(--primary)' }} />
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              className="select"
              aria-label="Filter by Ward"
              style={{ minWidth: 160 }}
            >
              <option value="">All 38 Wards</option>
              {wards.map((w) => (
                <option key={w.ward_id} value={w.ward_id}>
                  {w.ward_id}: {w.ward_name} ({w.zone_name})
                </option>
              ))}
            </select>
          </div>

          {/* Complaint category filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={complaintType}
              onChange={(e) => setComplaintType(e.target.value)}
              className="select"
              aria-label="Filter Complaint Type"
            >
              <option value="">All Complaint Types</option>
              <option value="leakage">Leakage</option>
              <option value="water_shortage">Water Shortage</option>
              <option value="low_pressure">Low Pressure</option>
              <option value="dirty_water">Dirty Water</option>
              <option value="bad_smell">Bad Smell</option>
            </select>
          </div>

          {/* Sample Limit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pins:</span>
            <select
              value={complaintLimit}
              onChange={(e) => setComplaintLimit(Number(e.target.value))}
              className="select"
              aria-label="Complaint pin sample size"
              style={{ width: 85 }}
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(selectedWardId || complaintType) && (
            <button
              onClick={() => { setSelectedWardId(''); setComplaintType(''); }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Reset all spatial filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Layer Toggles Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: 'rgba(12, 19, 34, 0.85)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        fontSize: '0.85rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#ffffff' }}>
            <Layers size={16} style={{ color: 'var(--primary)' }} />
            Active Layers:
          </span>

          {/* Wards Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showWards}
              onChange={(e) => setShowWards(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: showWards ? '#ffffff' : 'var(--text-muted)' }}>
              Ward Centers ({wards.length})
            </span>
          </label>

          {/* Complaints Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showComplaints}
              onChange={(e) => setShowComplaints(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: showComplaints ? '#ffffff' : 'var(--text-muted)' }}>
              Complaints ({complaints.length})
            </span>
          </label>

          {/* Network Pipes Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showPipes}
              onChange={(e) => setShowPipes(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: showPipes ? '#38bdf8' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              Distribution Pipes ({pipes.length})
              <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8' }}>
                DEMO
              </span>
            </span>
          </label>

          {/* Network Nodes Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showNodes}
              onChange={(e) => setShowNodes(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: showNodes ? '#34d399' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              Network Nodes ({nodes.length})
              <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                DEMO
              </span>
            </span>
          </label>
        </div>

        {/* Data Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {loading ? (
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity size={12} className="spin" /> Loading spatial layers...
            </span>
          ) : (
            <span>
              Rendering <strong>{complaints.length}</strong> of <strong>{totalComplaintsCount.toLocaleString()}</strong> complaints
              {selectedWardId && ` in ${selectedWardId}`}
            </span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          color: '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={fetchLayers} className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Main Map Box & Side Details Panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedFeature ? '1fr 350px' : '1fr',
        gap: 16,
        height: '72vh',
        minHeight: 560,
      }}>
        {/* Leaflet Map Canvas */}
        <div className="glass-card" style={{ overflow: 'hidden', position: 'relative', height: '100%', borderRadius: 'var(--radius-lg)' }}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%', background: '#0a0f1d' }}
          >
            <ChangeMapView coords={mapCenter} zoom={mapZoom} />

            {/* Dark Gray Base Tiles */}
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, OpenStreetMap contributors'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />

            {/* 1. Water Network Distribution Pipes (Synthetic Demo) */}
            {showPipes && pipes.map((pipe) => {
              const geom = pipe.geometry;
              if (!geom || geom.type !== 'LineString' || !geom.coordinates) return null;
              // GeoJSON coordinates are [longitude, latitude]; Leaflet expects [latitude, longitude]
              const positions = geom.coordinates.map((pt) => [pt[1], pt[0]]);
              const props = pipe.properties || {};
              const isClosed = props.valve_status === 'closed';
              const color = getPipeColor(props.valve_status);

              return (
                <Polyline
                  key={pipe.id || props.pipe_id}
                  positions={positions}
                  pathOptions={{
                    color: color,
                    weight: Math.min(6, Math.max(2, (props.diameter_mm || 100) / 40)),
                    opacity: 0.85,
                    dashArray: isClosed ? '5, 8' : undefined,
                  }}
                  eventHandlers={{
                    click: () => setSelectedFeature({ type: 'pipe', data: props }),
                  }}
                >
                  <Popup>
                    <div style={{ color: '#0f172a', fontSize: '0.8rem', padding: 2, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ color: '#0284c7' }}>{props.pipe_id}</strong>
                        <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                          DEMO PIPE
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div>Ward: <strong>{props.ward_id}</strong></div>
                        <div>Material: <strong>{props.material || 'Standard'}</strong></div>
                        <div>Diameter: <strong>{props.diameter_mm} mm</strong></div>
                        <div>Length: <strong>{props.length_m ? `${props.length_m} m` : 'N/A'}</strong></div>
                        <div>Valve Status: <strong style={{ color: isClosed ? '#b91c1c' : '#15803d' }}>{props.valve_status || 'open'}</strong></div>
                        <div>Flow: <strong>{props.flow_direction || 'forward'}</strong></div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                        Synthetic demonstration pipe layer.
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}

            {/* 2. Water Network Nodes (Synthetic Demo) */}
            {showNodes && nodes.map((node) => {
              const geom = node.geometry;
              if (!geom || geom.type !== 'Point' || !geom.coordinates) return null;
              const lon = geom.coordinates[0];
              const lat = geom.coordinates[1];
              const props = node.properties || {};
              const nodeCfg = NODE_COLORS[props.node_type] || NODE_COLORS.junction;

              return (
                <CircleMarker
                  key={node.id || props.node_id}
                  center={[lat, lon]}
                  radius={nodeCfg.radius}
                  pathOptions={{
                    fillColor: nodeCfg.fill,
                    fillOpacity: 0.9,
                    color: nodeCfg.stroke,
                    weight: 1.5,
                  }}
                  eventHandlers={{
                    click: () => setSelectedFeature({ type: 'node', data: props }),
                  }}
                >
                  <Popup>
                    <div style={{ color: '#0f172a', fontSize: '0.8rem', padding: 2, minWidth: 170 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ color: nodeCfg.fill }}>{props.node_id}</strong>
                        <span style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#334155', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                          DEMO NODE
                        </span>
                      </div>
                      <div>Type: <strong style={{ textTransform: 'capitalize' }}>{nodeCfg.label}</strong></div>
                      <div>Ward: <strong>{props.ward_id}</strong></div>
                      {props.elevation_m != null && <div>Elevation: <strong>{props.elevation_m} m</strong></div>}
                      <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                        Synthetic demonstration node.
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* 3. Citizen Grievance Complaints */}
            {showComplaints && complaints.map((comp) => {
              const lat = comp.latitude;
              const lon = comp.longitude;
              if (!lat || !lon) return null;
              const color = getComplaintColor(comp.complaint_type);

              return (
                <CircleMarker
                  key={comp.complaint_id}
                  center={[lat, lon]}
                  radius={5}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.85,
                    color: '#ffffff',
                    weight: 1,
                  }}
                  eventHandlers={{
                    click: () => setSelectedFeature({ type: 'complaint', data: comp }),
                  }}
                >
                  <Popup>
                    <div style={{ color: '#0f172a', fontSize: '0.8rem', padding: 2, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ textTransform: 'capitalize', color }}>
                          {(comp.complaint_type || 'Grievance').replace(/_/g, ' ')}
                        </strong>
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontWeight: 700,
                          background: comp.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                          color: comp.severity === 'critical' ? '#b91c1c' : '#b45309',
                        }}>
                          {comp.severity}
                        </span>
                      </div>
                      <div>ID: <span style={{ fontFamily: 'monospace' }}>{comp.complaint_id}</span></div>
                      <div>Locality: <strong>{comp.locality_id || 'Nagpur Area'}</strong></div>
                      <div>Ward: <strong>{comp.ward_id}</strong></div>
                      <div>Status: <strong style={{ textTransform: 'capitalize' }}>{comp.status}</strong></div>
                      {comp.reported_at && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                          Reported: {new Date(comp.reported_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* 4. Municipal Ward Centroid Markers */}
            {showWards && wards.map((ward) => {
              const lat = ward.representative_latitude;
              const lon = ward.representative_longitude;
              if (!lat || !lon) return null;
              const isSelected = ward.ward_id === selectedWardId;

              return (
                <Marker
                  key={ward.ward_id}
                  position={[lat, lon]}
                  icon={customWardIcon(ward.ward_number, isSelected)}
                  eventHandlers={{
                    click: () => {
                      setSelectedWardId(ward.ward_id);
                      setSelectedFeature({ type: 'ward', data: ward });
                    },
                  }}
                >
                  <Popup>
                    <div style={{ color: '#0f172a', padding: 4, minWidth: 200 }}>
                      <h4 style={{ margin: 0, color: '#0284c7', fontSize: '0.95rem' }}>
                        {ward.ward_name} ({ward.ward_id})
                      </h4>
                      <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#475569' }}>
                        Zone: <strong>{ward.zone_name}</strong>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#475569' }}>
                        Localities: <strong>{ward.locality_count} Areas</strong>
                      </p>
                      <div style={{
                        marginTop: 6,
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                      }}>
                        Ward representative point. No boundary polygon is included in the dataset.
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Interactive Legend Box */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            background: 'rgba(8, 12, 20, 0.92)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: '0.75rem',
            maxWidth: 320,
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}
              onClick={() => setLegendOpen(!legendOpen)}>
              <span style={{ fontWeight: 800, color: '#ffffff', letterSpacing: 0.5 }}>
                SPATIAL MAP LEGEND
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>
                {legendOpen ? 'Hide' : 'Show'}
              </span>
            </div>

            {legendOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Wards & Complaints */}
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, fontSize: '0.7rem', textTransform: 'uppercase' }}>
                    Administrative & Grievances
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0284c7', border: '1px solid #fff' }} />
                      <span>Ward Centroid</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                      <span>Contamination</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} />
                      <span>Leakage / Burst</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />
                      <span>Water Shortage</span>
                    </div>
                  </div>
                </div>

                {/* Network Infrastructure (Demo) */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                      Water Network Infrastructure
                    </span>
                    <span style={{ fontSize: '0.62rem', background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>
                      DEMO
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 14, height: 3, background: '#06b6d4', borderRadius: 2 }} />
                      <span>Pipeline (Active)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 14, height: 3, background: '#ef4444', borderRadius: 2 }} />
                      <span>Pipeline (Closed)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
                      <span>Junction</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      <span>Valve</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      <span>Pump Station</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} />
                      <span>Overhead Tank</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Feature / Ward Inspector Drawer */}
        {selectedFeature && (
          <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  {selectedFeature.type === 'ward' && 'Municipal Ward'}
                  {selectedFeature.type === 'complaint' && 'Citizen Grievance'}
                  {selectedFeature.type === 'node' && 'Network Node (Demo)'}
                  {selectedFeature.type === 'pipe' && 'Distribution Pipe (Demo)'}
                </span>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff', marginTop: 2 }}>
                  {selectedFeature.type === 'ward' && selectedFeature.data.ward_name}
                  {selectedFeature.type === 'complaint' && (selectedFeature.data.complaint_type || 'Grievance').replace(/_/g, ' ')}
                  {selectedFeature.type === 'node' && selectedFeature.data.node_id}
                  {selectedFeature.type === 'pipe' && selectedFeature.data.pipe_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFeature(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
                aria-label="Close Inspector"
              >
                ✕
              </button>
            </div>

            {/* Ward Details */}
            {selectedFeature.type === 'ward' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ward ID</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.ward_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Administrative Zone</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.zone_name} ({selectedFeature.data.zone_id})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Localities Count</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.locality_count} Areas</span>
                </div>
                <div>
                  <strong>Named localities</strong>
                  <p style={{ fontSize: '0.72rem', marginTop: 4 }}>
                    Locality coordinates in the source are ward representative points, not precise locality positions.
                  </p>
                  <ul style={{ maxHeight: 180, overflowY: 'auto', paddingLeft: 18, marginTop: 8 }}>
                    {localities.map((locality) => (
                      <li key={locality.locality_id}>
                        {locality.locality_name} <span style={{ color: 'var(--text-muted)' }}>({locality.locality_id})</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Center Coordinates</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {selectedFeature.data.representative_latitude?.toFixed(4)}, {selectedFeature.data.representative_longitude?.toFixed(4)}
                  </span>
                </div>

                <div style={{
                  background: 'rgba(14, 165, 233, 0.08)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  fontSize: '0.8rem',
                  color: '#38bdf8',
                  marginTop: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                    <Info size={14} />
                    <span>Boundary Geometry Status</span>
                  </div>
                  <span>
                    The bundled boundary field contains PDF links, not polygon geometry.
                    Ward markers use the representative coordinates supplied in the dataset.
                  </span>
                </div>
              </div>
            )}

            {/* Complaint Details */}
            {selectedFeature.type === 'complaint' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Complaint ID</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.complaint_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ward ID</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.ward_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Locality</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.locality_id || 'Nagpur Area'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Severity</span>
                  <span className={`badge badge-${selectedFeature.data.severity === 'critical' ? 'critical' : selectedFeature.data.severity === 'high' ? 'high' : 'medium'}`}>
                    {selectedFeature.data.severity}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedFeature.data.status}</span>
                </div>
                {selectedFeature.data.description && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Citizen Note:</span>
                    <p style={{ marginTop: 2, color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      "{selectedFeature.data.description}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Network Pipe Details */}
            {selectedFeature.type === 'pipe' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pipe ID</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.pipe_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ward ID</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.ward_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>From / To Nodes</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {selectedFeature.data.from_node_id} → {selectedFeature.data.to_node_id}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Diameter & Material</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.diameter_mm} mm ({selectedFeature.data.material || 'Standard'})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Length</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.length_m ? `${selectedFeature.data.length_m} m` : 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Valve Status</span>
                  <span style={{ fontWeight: 600, color: selectedFeature.data.valve_status === 'closed' ? '#ef4444' : '#10b981' }}>
                    {selectedFeature.data.valve_status || 'open'}
                  </span>
                </div>

                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: 10,
                  fontSize: '0.75rem',
                  color: '#fbbf24',
                  marginTop: 6,
                }}>
                  Synthetic demonstration pipeline. Not live telemetry or verified municipal GIS.
                </div>
              </div>
            )}

            {/* Network Node Details */}
            {selectedFeature.type === 'node' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Node ID</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.node_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Node Type</span>
                  <span style={{ fontWeight: 600, color: '#ffffff', textTransform: 'capitalize' }}>{selectedFeature.data.node_type}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ward ID</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.ward_id}</span>
                </div>
                {selectedFeature.data.elevation_m != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Elevation</span>
                    <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFeature.data.elevation_m} meters</span>
                  </div>
                )}

                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: 10,
                  fontSize: '0.75rem',
                  color: '#fbbf24',
                  marginTop: 6,
                }}>
                  Synthetic demonstration node. Not live telemetry or verified municipal GIS.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
