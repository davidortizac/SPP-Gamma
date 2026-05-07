// public/js/api.js — Cliente HTTP centralizado con JWT

import { authState } from './auth-state.js';

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authState.token) headers['Authorization'] = `Bearer ${authState.token}`;

  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(path, init);

  if (res.status === 401) {
    authState.clear();
    window.location.hash = '#/login';
    throw new Error('Sesión expirada. Inicia sesión nuevamente.');
  }

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : { message: await res.text() };

  if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);
  return data;
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
  patch:  (path, body)  => request('PATCH',  path, body),
};
