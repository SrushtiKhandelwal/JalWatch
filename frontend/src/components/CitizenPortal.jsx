import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin, Plus } from 'lucide-react';
import { api } from '../api';

const sections = [
  { id: 'home', label: 'Home' },
  { id: 'report', label: 'Report a problem' },
  { id: 'complaints', label: 'My complaints' },
  { id: 'notices', label: 'Service notices' },
  { id: 'profile', label: 'Profile & address' },
];
const categories = [
  ['leakage', 'Water leakage'], ['water_shortage', 'No water supply'],
  ['low_pressure', 'Low water pressure'], ['dirty_water', 'Dirty water'],
  ['bad_smell', 'Water smell'],
];
const displayDate = (value) => value ? new Date(value).toLocaleString() : '—';

export default function CitizenPortal({ profile, onProfileChange, onLogout }) {
  const [section, setSection] = useState('home');
  const [summary, setSummary] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [wards, setWards] = useState([]);
  const [localities, setLocalities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [serviceNotices, setServiceNotices] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [report, setReport] = useState({
    title: '', description: '', complaint_type: '',
    address: profile.address, ward_id: profile.ward_id,
    locality_id: profile.locality_id, observed_at: '',
  });
  const [location, setLocation] = useState({
    address: profile.address, ward_id: profile.ward_id, locality_id: profile.locality_id,
  });

  useEffect(() => {
    api.getPublicWards().then(setWards).catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    const wardId = section === 'profile' ? location.ward_id : report.ward_id;
    if (!wardId) return;
    api.getPublicLocalities(wardId).then(setLocalities).catch((err) => setError(err.message));
  }, [section, location.ward_id, report.ward_id]);
  useEffect(() => {
    api.getCitizenSummary().then(setSummary).catch((err) => setError(err.message));
  }, [revision]);
  useEffect(() => {
    if (section !== 'complaints' && section !== 'home') return;
    api.getMyComplaints(page)
      .then((result) => { setComplaints(result.complaints); setTotalPages(result.total_pages); })
      .catch((err) => setError(err.message));
  }, [section, page, revision]);
  useEffect(() => {
    if (section !== 'notices' && section !== 'home') return;
    api.getCitizenNotices().then(setServiceNotices).catch((err) => setError(err.message));
  }, [section, revision, profile.ward_id]);

  const readNotice = async (id) => {
    try {
      const updated = await api.markCitizenNoticeRead(id);
      setServiceNotices((items) => items.map((item) => item.id === id ? updated : item));
    } catch (err) { setError(err.message); }
  };

  const openDetail = async (id) => {
    setLoadingDetail(true);
    setError('');
    try { setSelected(await api.getMyComplaint(id)); }
    catch (err) { setError(err.message); }
    finally { setLoadingDetail(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await api.submitCitizenComplaint({
        title: report.title, description: report.description,
        complaint_type: report.complaint_type, address: report.address,
        ward_id: report.ward_id,
        locality_id: report.locality_id,
        observed_at: report.observed_at ? new Date(report.observed_at).toISOString() : null,
      });
      setReport((current) => ({ ...current, title: '', description: '', observed_at: '' }));
      setRevision((value) => value + 1);
      setPage(1);
      setSection('complaints');
      setNotice(`Complaint ${created.complaint_id} was submitted.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const updateLocation = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await api.updateCitizenLocation(location);
      onProfileChange(next);
      setReport((current) => ({ ...current, ward_id: next.ward_id, locality_id: next.locality_id, address: next.address }));
      setNotice('Your selected area was updated. The address is still unverified.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const navigate = (id) => { setSection(id); if (id === 'home') setPage(1); setError(''); setNotice(''); setSelected(null); };
  const wardName = (id) => wards.find((ward) => ward.ward_id === id)?.ward_name || id;

  return <div className="app-shell">
    <header className="site-header">
      <div className="site-header-inner citizen-header">
        <button className="wordmark" type="button" onClick={() => navigate('home')}>Jal<span>Watch</span></button>
        <nav className="primary-nav" aria-label="Citizen navigation">
          {sections.map((item) => <button key={item.id} type="button" className={`nav-link ${section === item.id ? 'is-active' : ''}`}
            aria-current={section === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>{item.label}</button>)}
        </nav>
        <button className="sign-out-button" type="button" onClick={onLogout}>Sign out</button>
      </div>
    </header>
    <main className="app-main citizen-main">
      {notice && <div className="citizen-feedback" role="status"><CheckCircle2 size={18} /> {notice}</div>}
      {error && <div className="citizen-feedback is-error" role="alert">{error}</div>}

      {section === 'home' && <div className="page-stack">
        <div className="page-header"><div><span className="eyebrow">Citizen portal</span><h1>Hello, {profile.full_name.split(' ')[0]}.</h1>
          <p>Your water complaints and updates in one place.</p></div></div>
        <div className="metric-grid">
          <div className="glass-card metric-card"><span className="metric-label">Submitted</span><strong className="metric-value">{summary?.total_complaints ?? '—'}</strong></div>
          <div className="glass-card metric-card"><span className="metric-label">Open or in progress</span><strong className="metric-value">{summary?.open_complaints ?? '—'}</strong></div>
          <div className="glass-card metric-card"><span className="metric-label">Resolved or closed</span><strong className="metric-value">{summary?.resolved_complaints ?? '—'}</strong></div>
        </div>
        <div className="glass-card content-card citizen-home-card">
          <div><h2>Need to report a water problem?</h2><p>Send the details to the JalWatch operations team and keep your tracking ID.</p></div>
          <button className="btn btn-primary" type="button" onClick={() => navigate('report')}><Plus size={16} /> Report a problem</button>
        </div>
        <section className="glass-card content-card"><div className="section-heading"><h2>Recent complaints</h2>
          <button className="text-action" type="button" onClick={() => navigate('complaints')}>View all <ArrowRight size={14} /></button></div>
          {complaints.length ? complaints.slice(0, 3).map((item) => <button className="citizen-list-row" type="button" key={item.complaint_id} onClick={() => { navigate('complaints'); openDetail(item.complaint_id); }}>
            <span><strong>{item.title || item.complaint_type.replaceAll('_', ' ')}</strong><small>{item.complaint_id}</small></span><span className="badge badge-low">{item.status.replaceAll('_', ' ')}</span>
          </button>) : <p className="quiet-note">No complaints submitted yet.</p>}
        </section>
        {serviceNotices.length > 0 && <section className="glass-card content-card"><div className="section-heading"><h2>Service notices</h2>
          <button className="text-action" type="button" onClick={() => navigate('notices')}>View all <ArrowRight size={14} /></button></div>
          {serviceNotices.slice(0, 2).map((item) => <button className="citizen-list-row" type="button" key={item.id} onClick={() => navigate('notices')}>
            <span><strong>{item.title}</strong><small>{item.status} · {displayDate(item.published_at)}</small></span>{!item.is_read && <span className="badge badge-high">New</span>}
          </button>)}</section>}
      </div>}

      {section === 'report' && <div className="page-stack">
        <div className="page-header"><div><span className="eyebrow">Citizen portal / Report</span><h1>Report a water problem.</h1>
          <p>Describe what happened and select the affected area.</p></div></div>
        <form className="glass-card content-card citizen-form" onSubmit={submit}>
          <label htmlFor="report-category">Problem type</label>
          <select id="report-category" className="select" required value={report.complaint_type} onChange={(e) => setReport({ ...report, complaint_type: e.target.value })}>
            <option value="">Select a category</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label htmlFor="report-title">Short title</label>
          <input id="report-title" className="input" required minLength={5} maxLength={200} value={report.title} onChange={(e) => setReport({ ...report, title: e.target.value })} />
          <label htmlFor="report-description">What happened?</label>
          <textarea id="report-description" className="input" required minLength={10} maxLength={5000} rows={5} value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} />
          <label htmlFor="report-address">Affected address or landmark</label>
          <input id="report-address" className="input" required minLength={5} maxLength={500} value={report.address} onChange={(e) => setReport({ ...report, address: e.target.value })} />
          <div className="citizen-form-pair"><div><label htmlFor="report-ward">Ward</label>
            <select id="report-ward" className="select" required value={report.ward_id} onChange={(e) => setReport({ ...report, ward_id: e.target.value, locality_id: '' })}>
              <option value="">Select ward</option>{wards.map((ward) => <option key={ward.ward_id} value={ward.ward_id}>{ward.ward_name} · {ward.zone_name}</option>)}
            </select></div><div><label htmlFor="report-locality">Locality</label>
            <select id="report-locality" className="select" required value={report.locality_id} onChange={(e) => setReport({ ...report, locality_id: e.target.value })}>
              <option value="">Select locality</option>{localities.filter((item) => item.ward_id === report.ward_id).map((item) => <option key={item.locality_id} value={item.locality_id}>{item.locality_name}</option>)}
            </select></div></div>
          <label htmlFor="report-observed">When did you notice it? (optional)</label>
          <input id="report-observed" className="input" type="datetime-local" value={report.observed_at} onChange={(e) => setReport({ ...report, observed_at: e.target.value })} />
          <p className="quiet-note"><MapPin size={14} /> The map can show the selected ward’s representative point. Your address is kept as text; the marker is not an exact property location.</p>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button>
        </form>
      </div>}

      {section === 'complaints' && <div className="page-stack">
        <div className="page-header"><div><span className="eyebrow">Citizen portal / Tracking</span><h1>My complaints</h1>
          <p>Only complaints submitted from your account appear here.</p></div></div>
        <div className="glass-card content-card">
          {complaints.length ? complaints.map((item) => <button className="citizen-list-row" type="button" key={item.complaint_id} onClick={() => openDetail(item.complaint_id)}>
            <span><strong>{item.title || item.complaint_type.replaceAll('_', ' ')}</strong><small>{item.complaint_id} · {wardName(item.ward_id)} · {displayDate(item.reported_at)}</small></span>
            <span className="badge badge-low">{item.status.replaceAll('_', ' ')}</span>
          </button>) : <p className="quiet-note">You have not submitted a complaint yet.</p>}
          {totalPages > 1 && <div className="citizen-pagination"><button className="btn btn-secondary btn-sm" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span><button className="btn btn-secondary btn-sm" type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}
        </div>
        {loadingDetail && <p className="quiet-note">Loading complaint details…</p>}
        {selected && <section className="glass-card content-card citizen-detail"><div className="section-heading"><div><span className="eyebrow">{selected.complaint_id}</span><h2>{selected.title || selected.complaint_type.replaceAll('_', ' ')}</h2></div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSelected(null)}>Close</button></div>
          <p>{selected.description}</p><p className="quiet-note">{selected.address || 'Address unavailable'} · {wardName(selected.ward_id)}</p>
          <h3>Updates</h3>{selected.events.length ? <ol className="citizen-timeline">{selected.events.map((event) => <li key={event.id}><strong>{event.to_status.replaceAll('_', ' ')}</strong> · {displayDate(event.occurred_at)}<p>{event.note}</p></li>)}</ol>
            : <p className="quiet-note">No status updates have been recorded for this imported complaint.</p>}
        </section>}
      </div>}

      {section === 'notices' && <div className="page-stack"><div className="page-header"><div><span className="eyebrow">Citizen portal / Service</span><h1>Service notices</h1>
        <p>Published updates for your selected ward or zone, plus citywide announcements.</p></div></div>
        <section className="glass-card content-card">
          {serviceNotices.length ? serviceNotices.map((item) => <article className={`citizen-notice ${item.is_read ? '' : 'is-unread'}`} key={item.id}>
            <div className="section-heading"><div><span className="eyebrow">{item.notice_type.replaceAll('_', ' ')} · {item.status}</span><h2>{item.title}</h2></div>
              {!item.is_read && <button className="btn btn-secondary btn-sm" type="button" onClick={() => readNotice(item.id)}>Mark read</button>}</div>
            <p>{item.message}</p><p className="quiet-note">{item.target_kind === 'citywide' ? 'Citywide' : `${item.target_kind}: ${item.target_ids.join(', ')}`}
              {item.starts_at && ` · From ${displayDate(item.starts_at)}`}{item.ends_at && ` · Until ${displayDate(item.ends_at)}`}</p>
            {item.status === 'cancelled' && <p className="quiet-note">This notice has been cancelled.</p>}
          </article>) : <p className="quiet-note">No service notices for your selected area.</p>}
        </section>
      </div>}

      {section === 'profile' && <div className="page-stack"><div className="page-header"><div><span className="eyebrow">Citizen portal / Account</span><h1>Profile & address</h1>
        <p>Review your selected service area and request a correction by changing it here.</p></div></div>
        <div className="glass-card content-card citizen-form"><h2>{profile.full_name}</h2><p>{profile.email}</p>
          <p className="quiet-note">Area status: self-selected, unverified against official boundaries.</p>
          <form onSubmit={updateLocation} className="citizen-profile-form">
            <label htmlFor="profile-address">Residential address</label><input id="profile-address" className="input" required minLength={5} maxLength={500} value={location.address} onChange={(e) => setLocation({ ...location, address: e.target.value })} />
            <label htmlFor="profile-ward">Ward</label><select id="profile-ward" className="select" required value={location.ward_id} onChange={(e) => setLocation({ ...location, ward_id: e.target.value, locality_id: '' })}>
              <option value="">Select ward</option>{wards.map((ward) => <option key={ward.ward_id} value={ward.ward_id}>{ward.ward_name} · {ward.zone_name}</option>)}</select>
            <label htmlFor="profile-locality">Locality</label><select id="profile-locality" className="select" required value={location.locality_id} onChange={(e) => setLocation({ ...location, locality_id: e.target.value })}>
              <option value="">Select locality</option>{localities.filter((item) => item.ward_id === location.ward_id).map((item) => <option key={item.locality_id} value={item.locality_id}>{item.locality_name}</option>)}</select>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update selected area'}</button>
          </form>
        </div>
      </div>}
    </main>
  </div>;
}
