import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function ClustersView({ wardId, onCreateIncident, onOpenComplaint, onOpenMap }) {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    try { setClusters(await api.getComplaintClusters(30, wardId)); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [wardId]);
  useEffect(() => { reload(); }, [reload]);

  return <div className="page-stack"><div className="page-header"><div><span className="eyebrow">Investigation</span><h1>Related reports</h1>
    <p>Possible groups of unresolved citizen reports in the last 30 days{wardId ? ` for ${wardId}` : ''}. Review each report before opening an incident. The rule checks up to 5,000 recent reports.</p></div>
    <button className="btn btn-secondary" type="button" onClick={reload}>Refresh</button></div>
    {error && <div className="citizen-feedback is-error" role="alert">{error}</div>}
    {loading ? <p className="quiet-note">Checking recent reports…</p> : clusters.length ? clusters.map((cluster) =>
      <section className="glass-card content-card" key={cluster.cluster_id}>
        <div className="section-heading"><div><span className="eyebrow">{cluster.cluster_id} · {cluster.ward_id} / {cluster.locality_id}</span>
          <h2>{cluster.complaint_count} reports of {cluster.complaint_type.replaceAll('_', ' ')}</h2></div>
          <span className="badge badge-medium">Review suggested</span></div>
        <p>{cluster.explanation}</p>
        <p className="quiet-note">First {new Date(cluster.first_reported_at).toLocaleString()} · Latest {new Date(cluster.last_reported_at).toLocaleString()}</p>
        <div className="cluster-records">{cluster.complaint_ids.map((id) => <button className="btn btn-secondary btn-sm" type="button" key={id} onClick={() => onOpenComplaint(id)}>{id}</button>)}</div>
        <div className="notice-actions"><button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpenMap(cluster.ward_id)}>Inspect ward on map</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => onCreateIncident(cluster)}>Create incident from reports</button></div>
      </section>) : <section className="glass-card content-card"><p className="quiet-note">No recent groups meet the review rule yet. Two or more unresolved citizen reports must share a locality and category within 48 hours.</p></section>}
  </div>;
}
