// API Service — All backend API calls
const SERVER_URL = 'http://100.121.10.37:3000';

const apiCall = async (endpoint, options = {}) => {
  const url = `${SERVER_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) throw { status: response.status, message: data.error || 'Something went wrong', data };
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw { status: 0, message: 'Cannot connect to server. Is it running?' };
  }
};

export const authAPI = {
  login: (mobile, password) => apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ mobile, password }) }),
  register: (mobile, username, name, password) => apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ mobile, username, name, password }) }),
};

export const galleryAPI = {
  getMyPhotos: (token) => apiCall('/gallery', { headers: { Authorization: `Bearer ${token}` } }),
  deletePhoto: (token, filename) => apiCall(`/file/${filename}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
};

export const uploadAPI = {
  uploadImage: async (token, imageUri, filename) => {
    const formData = new FormData();
    formData.append('image', { uri: imageUri, name: filename || 'photo.jpg', type: 'image/jpeg' });
    const response = await fetch(`${SERVER_URL}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw { status: response.status, message: data.error || 'Upload failed' };
    return data;
  },
};

export const adminAPI = {
  // Users & pending
  getUsers: (token) => apiCall('/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
  getPendingUsers: (token) => apiCall('/admin/pending-users', { headers: { Authorization: `Bearer ${token}` } }),
  approveUser: (token, username, quota) => apiCall('/admin/approve-user', { method: 'POST', body: JSON.stringify({ username, quota }), headers: { Authorization: `Bearer ${token}` } }),
  rejectUser: (token, username) => apiCall('/admin/reject-user', { method: 'POST', body: JSON.stringify({ username }), headers: { Authorization: `Bearer ${token}` } }),
  deleteUser: (token, username) => apiCall(`/admin/user/${username}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),

  // Storage management
  setQuota: (token, username, quota) => apiCall('/admin/set-quota', { method: 'PATCH', body: JSON.stringify({ username, quota }), headers: { Authorization: `Bearer ${token}` } }),
  reallocate: (token, fromUser, toUser, amount) => apiCall('/admin/reallocate', { method: 'PATCH', body: JSON.stringify({ fromUser, toUser, amount }), headers: { Authorization: `Bearer ${token}` } }),

  // User files
  getUserFiles: (token, username) => apiCall(`/admin/user/${username}/files`, { headers: { Authorization: `Bearer ${token}` } }),

  // Delete any user's file (uses gallery route with ?user= param)
  deleteUserFile: (token, username, filename) => apiCall(`/file/${filename}?user=${username}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),

  // Sync
  syncStorage: (token) => apiCall('/admin/sync-storage', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
};

export { SERVER_URL };
