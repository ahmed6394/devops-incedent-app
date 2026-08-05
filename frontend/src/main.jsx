import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';
import './styles.css';

const emptyForm = {
  title: '',
  description: '',
  severity: 'medium',
  source: 'manual',
  source_ref: '',
};

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const user = await api.login(username, password);
      onLogin(user);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="panel login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">DevOps Practice Lab</p>
        <h1>DevOps Incident Management</h1>
        <p className="login-sub">Sign in to manage operational incidents.</p>

        {error && <div className="error-banner">{error}</div>}

        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadUsers() {
    try {
      setError('');
      setUsers(await api.users());
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.createUser(form);
      setForm({ username: '', password: '', role: 'user' });
      setMessage(`User '${form.username}' created.`);
      await loadUsers();
    } catch (addError) {
      setError(addError.message);
    }
  }

  async function removeUser(id) {
    setError('');
    setMessage('');

    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (removeError) {
      setError(removeError.message);
    }
  }

  return (
    <section className="panel admin-panel">
      <div className="panel-heading">
        <h2>Users</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="message-banner">{message}</div>}

      <div className="user-list">
        {users.map((user) => (
          <div className="user-row" key={user.id}>
            <div>
              <strong>{user.username}</strong>
              <span className={`badge role-${user.role}`}>{user.role}</span>
            </div>
            <button
              className="danger-link"
              type="button"
              onClick={() => removeUser(user.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <form className="add-user-form" onSubmit={addUser}>
        <label>
          Username
          <input
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            minLength="3"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            minLength="6"
            required
          />
        </label>
        <label>
          Role
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit">Add user</button>
      </form>
    </section>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
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

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  async function loadIncidents() {
    try {
      setError('');
      setIncidents(await api.incidents(filter));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadIncidents();
    }
  }, [filter, user]);

  async function handleLogout() {
    try {
      await api.logout();
    } catch (_logoutError) {
      // session still cleared locally
    }
    setUser(null);
    setIncidents([]);
  }

  async function createIncident(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const incident = await api.createIncident(form);
      setIncidents((current) => [incident, ...current]);
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
      const incident = await api.updateStatus(id, status);
      setIncidents((current) =>
        current.map((item) => (item.id === id ? incident : item)),
      );
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  async function deleteIncident(id) {
    setError('');

    try {
      await api.deleteIncident(id);
      setIncidents((current) => current.filter((incident) => incident.id !== id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  if (checking) {
    return <main className="page-shell"><p>Loading…</p></main>;
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <>
      <header className="topbar">
        <span className="topbar-user">
          Signed in as <strong>{user.username}</strong>
        </span>
        <button className="secondary" type="button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <main className="page-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">DevOps Incident Management</p>
            <h1>DevOps Incident Management</h1>
            <p>React frontend · Express API · PostgreSQL database</p>
          </div>
          <div className="summary-card">
            <strong>{openCount}</strong>
            <span>active incidents</span>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <section className="grid">
          <div>
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

              <button disabled={saving}>
                {saving ? 'Creating…' : 'Create incident'}
              </button>
            </form>

            {user.role === 'admin' && <AdminPanel />}
          </div>

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
                    <p className="attribution">
                      Registered by {incident.createdBy || 'Unknown'}
                    </p>
                    {incident.status === 'resolved' && incident.resolvedBy && (
                      <p className="attribution">
                        Resolved by {incident.resolvedBy}
                      </p>
                    )}
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
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
