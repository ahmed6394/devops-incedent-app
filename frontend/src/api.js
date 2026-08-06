function requirePositiveId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid id');
  }
  return id;
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export const api = {
  me: () => request('/api/auth/me'),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  incidents: (source) =>
    request(
      source && source !== 'all' ? `/api/incidents?source=${source}` : '/api/incidents',
    ),
  createIncident: (incident) =>
    request('/api/incidents', { method: 'POST', body: incident }),
  updateStatus: (id, status) =>
    request(`/api/incidents/${requirePositiveId(id)}/status`, { method: 'PATCH', body: { status } }),
  deleteIncident: (id) =>
    request(`/api/incidents/${requirePositiveId(id)}`, { method: 'DELETE' }),

  users: () => request('/api/users'),
  createUser: (user) => request('/api/users', { method: 'POST', body: user }),
  deleteUser: (id) => request(`/api/users/${requirePositiveId(id)}`, { method: 'DELETE' }),
};
