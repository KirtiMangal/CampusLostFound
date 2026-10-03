import axios from 'axios';

const TOKEN_KEY = 'campus-found-token';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    window.localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('campus-auth-expired'));
  } else if (error.response?.status === 403) {
    window.dispatchEvent(new CustomEvent('campus-api-feedback', { detail: 'You do not have permission to do that.' }));
  } else if (error.response?.status === 429) {
    window.dispatchEvent(new CustomEvent('campus-api-feedback', { detail: error.response.data?.message || 'Please wait before trying again.' }));
  }
  return Promise.reject(error);
});

export const authToken = {
  get: () => window.localStorage.getItem(TOKEN_KEY),
  set: (token) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export async function getHealth() {
  return (await api.get('/health')).data;
}

export const authApi = {
  register: async (values) => (await api.post('/auth/register', values)).data,
  login: async (values) => (await api.post('/auth/login', values)).data,
  me: async () => (await api.get('/auth/me')).data,
};

export const itemApi = {
  create: async (values, images = []) => {
    const payload = images.length ? makeItemFormData(values, images) : values;
    return (await api.post('/items', payload, images.length ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)).data;
  },
  list: async (params) => (await api.get('/items', { params })).data,
  get: async (id) => (await api.get(`/items/${id}`)).data,
  matches: async (id) => (await api.get(`/items/${id}/matches`)).data,
  claims: async (id) => (await api.get(`/items/${id}/claims`)).data,
  createClaim: async (id, values) => (await api.post(`/items/${id}/claims`, values)).data,
  update: async (id, values, images = [], removeImages = []) => {
    const multipart = images.length > 0 || removeImages.length > 0;
    const payload = multipart ? makeItemFormData(values, images, removeImages) : values;
    return (await api.put(`/items/${id}`, payload, multipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)).data;
  },
  delete: async (id) => (await api.delete(`/items/${id}`)).data,
};

export const claimApi = {
  mine: async () => (await api.get('/claims/mine')).data,
  received: async () => (await api.get('/claims/received')).data,
  detail: async (id) => (await api.get(`/claims/${id}`)).data,
  approve: async (id) => (await api.patch(`/claims/${id}/approve`)).data,
  reject: async (id, rejectionReason = '') => (await api.patch(`/claims/${id}/reject`, { rejectionReason })).data,
  cancel: async (id) => (await api.patch(`/claims/${id}/cancel`)).data,
  contact: async (id) => (await api.get(`/claims/${id}/contact`)).data,
};

export const notificationApi = {
  list: async (params = {}) => (await api.get('/notifications', { params })).data,
  unreadCount: async () => (await api.get('/notifications/unread-count')).data,
  markRead: async (id) => (await api.patch(`/notifications/${id}/read`)).data,
  markAllRead: async () => (await api.patch('/notifications/read-all')).data,
  delete: async (id) => (await api.delete(`/notifications/${id}`)).data,
};

export const analyticsApi = {
  overview: async () => (await api.get('/admin/analytics/overview')).data,
  trends: async () => (await api.get('/admin/analytics/trends')).data,
  categories: async () => (await api.get('/admin/analytics/categories')).data,
  locations: async () => (await api.get('/admin/analytics/locations')).data,
};

export const reportApi = {
  create: async (values) => (await api.post('/reports', values)).data,
};

export const moderationApi = {
  reports: async (params = {}) => (await api.get('/admin/reports', { params })).data,
  report: async (id) => (await api.get(`/admin/reports/${id}`)).data,
  reviewReport: async (id, values) => (await api.patch(`/admin/reports/${id}/review`, values)).data,
  moderateItem: async (id, action) => (await api.patch(`/admin/items/${id}/moderation`, { action })).data,
  users: async (params = {}) => (await api.get('/admin/users', { params })).data,
  suspendUser: async (id, reason) => (await api.patch(`/admin/users/${id}/suspend`, { reason })).data,
  unsuspendUser: async (id) => (await api.patch(`/admin/users/${id}/unsuspend`)).data,
};

export const aiApi = {
  describe: async (values) => (await api.post('/ai/describe', values)).data,
};

function makeItemFormData(values, images, removeImages = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) form.append(key, value instanceof Date ? value.toISOString().slice(0, 10) : String(value));
  }
  for (const image of images) form.append('images', image);
  if (removeImages.length) form.append('removeImages', JSON.stringify(removeImages));
  return form;
}
