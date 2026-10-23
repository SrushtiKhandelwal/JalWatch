import React, { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
  title: '', notice_type: 'interruption', message: '', target_kind: 'wards',
  target_ids: [], starts_at: '', ends_at: '', publish_at: '', publication: 'draft',
};
const toInput = (value) => value ? new Date(value).toLocaleString('sv-SE').slice(0, 16).replace(' ', 'T') : '';
const toApi = (value) => value ? new Date(value).toISOString() : null;
const dateText = (value) => value ? new Date(value).toLocaleString() : '—';

export default function ServiceNoticesView() {
  const [items, setItems] = useState([]);
  const [wards, setWards] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    try { setItems(await api.getServiceNotices()); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => {
    load();
    api.getWards().then(setWards).catch((err) => setError(err.message));
  }, []);

  const beginEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title, notice_type: item.notice_type, message: item.message,
      target_kind: item.target_kind, target_ids: item.target_ids,
      starts_at: toInput(item.starts_at), ends_at: toInput(item.ends_at),
      publish_at: item.status === 'published' ? '' : toInput(item.publish_at), publication: item.status === 'draft' ? 'draft' : 'publish',
    });
    setError(''); setFeedback('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setFeedback('');
    try {
      const data = { ...form, target_ids: form.target_kind === 'citywide' ? [] : form.target_ids,
        starts_at: toApi(form.starts_at), ends_at: toApi(form.ends_at), publish_at: toApi(form.publish_at) };
      if (editingId) await api.editServiceNotice(editingId, data);
      else await api.createServiceNotice(data);
      setFeedback(editingId ? 'Notice updated.' : 'Notice created.');
      setEditingId(null); setForm(emptyForm);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const act = async (id, action) => {
    setBusy(true); setError(''); setFeedback('');
    try {
      await api.actOnServiceNotice(id, action);
      setFeedback(action === 'cancel' ? 'Notice cancelled.' : 'Notice published.');
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const choices = form.target_kind === 'wards'
    ? wards.map((item) => [item.ward_id, `${item.ward_name} · ${item.zone_name}`])
    : [...new Map(wards.map((item) => [item.zone_id, [item.zone_id, item.zone_name]])).values()];
  const toggleTarget = (id) => setForm((current) => ({ ...current,
    target_ids: current.target_ids.includes(id) ? current.target_ids.filter((item) => item !== id) : [...current.target_ids, id],
  }));

  return <div className="page-stack">
    <div className="page-header"><div><span className="eyebrow">Communication</span><h1>Service notices</h1>
      <p>Publish water-service information to the affected wards or zones. Internal findings stay in Risk signals.</p></div></div>
    {error && <div className="citizen-feedback is-error" role="alert">{error}</div>}
    {feedback && <div className="citizen-feedback" role="status">{feedback}</div>}
    <form className="glass-card content-card notice-form" onSubmit={save}>
      <div className="section-heading"><h2>{editingId ? `Edit notice #${editingId}` : 'New service notice'}</h2>
        {editingId && <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel editing</button>}</div>
      <div className="citizen-form-pair"><div><label htmlFor="notice-title">Title</label><input id="notice-title" className="input" required minLength={5} maxLength={200}
        value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
        <div><label htmlFor="notice-type">Type</label><select id="notice-type" className="select" value={form.notice_type} onChange={(event) => setForm({ ...form, notice_type: event.target.value })}>
          {['planned_cut', 'interruption', 'emergency_repair', 'quality_advisory', 'restoration', 'general'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></div></div>
      <label htmlFor="notice-message">Message</label><textarea id="notice-message" className="input" rows={4} required minLength={10} maxLength={5000}
        value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      <label htmlFor="notice-target">Audience</label><select id="notice-target" className="select" value={form.target_kind}
        onChange={(event) => setForm({ ...form, target_kind: event.target.value, target_ids: [] })}>
        <option value="wards">Selected wards</option><option value="zones">Selected zones</option><option value="citywide">Citywide</option></select>
      {form.target_kind !== 'citywide' && <div className="notice-targets" aria-label="Affected areas">
        {choices.map(([id, label]) => <label key={id}><input type="checkbox" checked={form.target_ids.includes(id)} onChange={() => toggleTarget(id)} /> {label}</label>)}
      </div>}
      <div className="citizen-form-pair"><div><label htmlFor="notice-start">Service starts (optional)</label><input id="notice-start" className="input" type="datetime-local" value={form.starts_at}
        onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></div>
        <div><label htmlFor="notice-end">Service ends (optional)</label><input id="notice-end" className="input" type="datetime-local" value={form.ends_at}
          onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></div></div>
      <div className="citizen-form-pair"><div><label htmlFor="notice-publication">Publication</label><select id="notice-publication" className="select" value={form.publication}
        onChange={(event) => setForm({ ...form, publication: event.target.value })} disabled={editingId && items.find((item) => item.id === editingId)?.status === 'published'}>
          <option value="draft">Save draft</option><option value="publish">Publish</option></select></div>
        <div><label htmlFor="notice-publish-at">Publish at (optional; future time)</label><input id="notice-publish-at" className="input" type="datetime-local" value={form.publish_at}
          onChange={(event) => setForm({ ...form, publish_at: event.target.value })} disabled={form.publication === 'draft'} /></div></div>
      <button className="btn btn-primary" disabled={busy || (form.target_kind !== 'citywide' && !form.target_ids.length)}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create notice'}</button>
    </form>
    <section className="glass-card content-card"><h2>Notice history</h2>
      {items.length ? items.map((item) => <article key={item.id} className="citizen-notice">
        <div className="section-heading"><div><span className="eyebrow">#{item.id} · {item.notice_type.replaceAll('_', ' ')} · {item.status}</span><h3>{item.title}</h3></div>
          <div className="notice-actions">{item.status !== 'cancelled' && <button className="btn btn-secondary btn-sm" type="button" onClick={() => beginEdit(item)}>Edit</button>}
            {item.status === 'draft' && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => act(item.id, 'publish')}>Publish</button>}
            {item.status !== 'cancelled' && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => act(item.id, 'cancel')}>Cancel notice</button>}</div></div>
        <p>{item.message}</p><p className="quiet-note">{item.target_kind === 'citywide' ? 'Citywide' : `${item.target_kind}: ${item.target_ids.join(', ')}`}
          {item.starts_at && ` · Starts ${dateText(item.starts_at)}`}{item.publish_at && ` · Publish ${dateText(item.publish_at)}`}</p>
      </article>) : <p className="quiet-note">No service notices yet.</p>}
    </section>
  </div>;
}
