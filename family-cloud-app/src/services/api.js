// ============================================
// API Service — All backend API calls
// ============================================
// Change SERVER_URL to your S10's Tailscale IP!
// ============================================

// 🔧 SET YOUR S10's TAILSCALE IP HERE
const SERVER_URL = 'http://100.64.0.1:3000';  // ← Change this!

// --- Helper: make API requests ---
const apiCall = async (endpoint, options = {}) => {
  const url = `${SERVER_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw { status: response.status, message: data.error || 'Something went wrong', data };
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    throw { status: 0, message: 'Cannot connect to server. Is it running?' };
  }
};

// --- Auth API ---
export const authAPI = {
  login: (mobile, password) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password }),
    }),

  register: (mobile, username, name, password) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ mobile, username, name, password }),
    }),
};

// --- Gallery API ---
export const galleryAPI = {
  getMyPhotos: (token) =>
    apiCall('/gallery', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  deletePhoto: (token, filename) =>
    apiCall(`/file/${filename}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// --- Upload API ---
export const uploadAPI = {
  uploadImage: async (token, imageUri, filename) => {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: filename || 'photo.jpg',
      type: 'image/jpeg',
    });

    const response = await fetch(`${SERVER_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw { status: response.status, message: data.error || 'Upload failed' };
    }

    return data;
  },
};

// --- Admin API ---
export const adminAPI = {
  getUsers: (token) =>
    apiCall('/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPendingUsers: (token) =>
    apiCall('/admin/pending-users', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  approveUser: (token, username, quota) =>
    apiCall('/admin/approve-user', {
      method: 'POST',
      body: JSON.stringify({ username, quota }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  rejectUser: (token, username) =>
    apiCall('/admin/reject-user', {
      method: 'POST',
      body: JSON.stringify({ username }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  setQuota: (token, username, quota) =>
    apiCall('/admin/set-quota', {
      method: 'PATCH',
      body: JSON.stringify({ username, quota }),
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// --- System API ---
export const systemAPI = {
  health: () => apiCall('/health'),

  getOverview: (token) =>
    apiCall('/system', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export { SERVER_URL };
