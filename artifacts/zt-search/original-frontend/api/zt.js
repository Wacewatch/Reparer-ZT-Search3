import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const searchContent = async (query, type = 'movie') => {
  const res = await axios.get(`${API}/search`, {
    params: { q: query, type },
    timeout: 30000,
  });
  return res.data;
};

export const getDetail = async (urls) => {
  const res = await axios.get(`${API}/detail`, {
    params: { urls: urls.join(',') },
    timeout: 45000,
  });
  return res.data;
};

export const getLatest = async (type = 'movie', limit = 24) => {
  const res = await axios.get(`${API}/latest`, {
    params: { type, limit },
    timeout: 30000,
  });
  return res.data;
};

export const getLinksByTmdbId = async (tmdbId, mediaType = 'film', title = null) => {
  const params = {};
  if (title) params.title = title;
  const res = await axios.get(`${API}/liens/${mediaType}/${tmdbId}`, {
    params,
    timeout: 60000,
  });
  return res.data;
};

export const getCategories = async () => {
  const res = await axios.get(`${API}/categories`);
  return res.data;
};

const adminHeaders = (adminKey) => ({ headers: { 'X-Admin-Key': adminKey } });

export const getStatus = async () => (await axios.get(`${API}/status`)).data;

export const getSettings = async (adminKey) =>
  (await axios.get(`${API}/settings`, adminHeaders(adminKey))).data;

export const saveSettings = async (adminKey, settings) =>
  (await axios.put(`${API}/settings`, settings, adminHeaders(adminKey))).data;

export const testSources = async (adminKey) =>
  (await axios.post(`${API}/status/test`, {}, { ...adminHeaders(adminKey), timeout: 120000 })).data;

export const relayFileUrl = (name) => `${API}/relay/${name}`;

// .org-hosted images 403 on direct browser hotlink (Cloudflare); route them
// through the backend image proxy. External CDNs (postimg, etc.) load directly.
export const posterUrl = (url) => {
  if (!url) return url;
  const low = url.toLowerCase();
  if (low.includes('zone-telechargement') || low.includes('zone-images')) {
    return `${API}/img?u=${encodeURIComponent(url)}`;
  }
  return url;
};
