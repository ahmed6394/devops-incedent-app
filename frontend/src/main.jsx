import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const emptyForm = {
  title: '',
  description: '',
  severity: 'medium',
  source: 'manual',
  source_ref: '',
};

function App() {
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openCount = useMemo(
    () => incidents.filter((incident) => incident.status !== 'resolved').length,
    [incidents],
  );

  async function loadIncidents() {
    try {
      setError('');
      const query = filter === 'all' ? '' : `?source=${filter}`;
      const response = await fetch(`/api/incidents${query}`);
      if (!response.ok) throw new Error('Could not load incidents');
      setIncidents(await response.json());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncidents();
  }, [filter]);

  async function createIncident(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Could not create incident');

      setIncidents((current) => [payload, ...current]);
      setForm(emptyForm);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, status) {
    setError('');

    try {
      const response = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Could not update incident');

      setIncidents((current) =>
        current.map((incident) => (incident.id === id ? payload : incident)),
      );
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  async function deleteIncident(id) {
    setError('');

    try {
      const response = await fetch(`/api/incidents/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete incident');
      setIncidents((current) => current.filter((incident) => incident.id !== id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">DevOps Practice Lab</p>
          <h1>Incident Command Center</h1>
          <p>React frontend · Express API · PostgreSQL database</p>
        </div>
        <div className="summary-card">
          <strong>{openCount}</strong>
          <span>active incidents</span>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="grid">
        <form className="panel" onSubmit={createIncident}>
          <h2>Create incident</h2>

          <label>
            Title
            <input
              required
              minLength="3"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Example: Checkout API unavailable"
            />
          </label>

          <label>
            Description
            <textarea
              rows="4"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Describe impact and current symptoms"
            />
          </label>

          <label>
            Severity
            <select
              value={form.severity}
              onChange={(event) =>
                setForm({ ...form, severity: event.target.value })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label>
            Source
            <select
              value={form.source}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
            >
              <option value="manual">Manual</option>
              <option value="docker">Docker</option>
              <option value="kubernetes">Kubernetes</option>
            </select>
          </label>

          <label>
            Source reference
            <input
              value={form.source_ref}
              onChange={(event) =>
                setForm({ ...form, source_ref: event.target.value })
              }
              placeholder="e.g. web-api, payments/payments-7d8f6c9b55"
            />
          </label>

          <button disabled={saving}>{saving ? 'Creating…' : 'Create incident'}</button>
        </form>

        <section className="panel incidents-panel">
          <div className="panel-heading">
            <h2>Current incidents</h2>
            <div className="filter-row">
              <select
                aria-label="Filter by source"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All sources</option>
                <option value="manual">Manual</option>
                <option value="docker">Docker</option>
                <option value="kubernetes">Kubernetes</option>
              </select>
              <button className="secondary" type="button" onClick={loadIncidents}>
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <p>Loading incidents…</p>
          ) : incidents.length === 0 ? (
            <p>No incidents found.</p>
          ) : (
            <div className="incident-list">
              {incidents.map((incident) => (
                <article className="incident-card" key={incident.id}>
                  <div className="incident-title-row">
                    <div>
                      <span className={`badge ${incident.severity}`}>
                        {incident.severity}
                      </span>
                      <span className={`badge source-${incident.source}`}>
                        {incident.source}
                      </span>
                      <h3>{incident.title}</h3>
                    </div>
                    <button
                      className="danger-link"
                      type="button"
                      onClick={() => deleteIncident(incident.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <p>{incident.description || 'No description provided.'}</p>
                  <div className="incident-footer">
                    {incident.source_ref && (
                      <span className="source-ref">{incident.source_ref}</span>
                    )}
                    <select
                      value={incident.status}
                      onChange={(event) =>
                        changeStatus(incident.id, event.target.value)
                      }
                    >
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <time>{new Date(incident.created_at).toLocaleString()}</time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
