import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function CitizenAccess({ onAuthenticated }) {
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', password_confirm: '',
    address: '', ward_id: '', locality_id: '',
  });
  const [wards, setWards] = useState([]);
  const [localities, setLocalities] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!registering) return;
    api.getPublicWards().then(setWards).catch((err) => setError(err.message));
  }, [registering]);

  useEffect(() => {
    if (!registering || !form.ward_id) return;
    api.getPublicLocalities(form.ward_id)
      .then(setLocalities)
      .catch((err) => setError(err.message));
  }, [registering, form.ward_id]);

  const change = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current, [field]: value,
      ...(field === 'ward_id' ? { locality_id: '' } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const profile = registering
        ? await api.citizenRegister(form)
        : await api.citizenLogin(form.email, form.password);
      onAuthenticated(profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <>
    <h1>{registering ? 'Create your account' : 'Citizen sign in'}</h1>
    <p>{registering ? 'Report water problems and follow their progress.' : 'View your complaints and local service information.'}</p>
    <form onSubmit={submit} className="auth-form citizen-access-form">
      {registering && <>
        <label htmlFor="citizen-name">Full name</label>
        <input id="citizen-name" className="input" required minLength={2} maxLength={120} value={form.full_name} onChange={change('full_name')} />
      </>}
      <label htmlFor="citizen-email">Email</label>
      <input id="citizen-email" className="input" type="email" required autoComplete="email" value={form.email} onChange={change('email')} />
      <label htmlFor="citizen-password">Password</label>
      <input id="citizen-password" className="input" type="password" required minLength={registering ? 12 : undefined}
        autoComplete={registering ? 'new-password' : 'current-password'} value={form.password} onChange={change('password')} />
      {registering && <>
        <label htmlFor="citizen-confirm">Confirm password</label>
        <input id="citizen-confirm" className="input" type="password" required minLength={12} autoComplete="new-password"
          value={form.password_confirm} onChange={change('password_confirm')} />
        <label htmlFor="citizen-address">Residential address</label>
        <input id="citizen-address" className="input" required minLength={5} maxLength={500} autoComplete="street-address"
          value={form.address} onChange={change('address')} />
        <label htmlFor="citizen-ward">Ward</label>
        <select id="citizen-ward" className="select" required value={form.ward_id} onChange={change('ward_id')}>
          <option value="">Select a ward</option>
          {wards.map((ward) => <option key={ward.ward_id} value={ward.ward_id}>{ward.ward_name} · {ward.zone_name}</option>)}
        </select>
        <label htmlFor="citizen-locality">Locality</label>
        <select id="citizen-locality" className="select" required disabled={!form.ward_id} value={form.locality_id} onChange={change('locality_id')}>
          <option value="">Select a locality</option>
          {localities.filter((locality) => locality.ward_id === form.ward_id).map((locality) => <option key={locality.locality_id} value={locality.locality_id}>{locality.locality_name}</option>)}
        </select>
        <p className="quiet-note">Your ward and locality are self-selected. JalWatch cannot verify an address against official boundary geometry yet.</p>
      </>}
      {error && <p role="alert" style={{ color: 'var(--rose)' }}>{error}</p>}
      <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
    </form>
    <button className="text-action auth-alternate" type="button" onClick={() => { setRegistering((value) => !value); setError(''); }}>
      {registering ? 'Already have an account? Sign in' : 'New here? Create an account'}
    </button>
  </>;
}
