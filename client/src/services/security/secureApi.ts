"""Secure API client with request signing."""
import axios, { AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const secureApiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,  // Send cookies
  timeout: 10000,
});

// Request interceptor for CSRF and signing
secureApiClient.interceptors.request.use(async (config) => {
  // Add CSRF token for non-GET requests
  if (config.method !== 'get') {
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1];
    
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  
  // Add request timestamp
  const timestamp = Math.floor(Date.now() / 1000);
  config.headers['X-Request-Timestamp'] = timestamp;
  
  return config;
});

// Response interceptor for error handling
secureApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
