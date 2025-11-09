import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_REGISTRATION_API_URL || 'https://sol-circle.vercel.app',
  withCredentials: true, // IMPORTANT: Send cookies with every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (optional - for adding auth headers, logging, etc.)
api.interceptors.request.use(
  (config) => {
    // You can add custom headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (optional - for error handling)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors here
    if (error.response?.status === 401) {
      // Unauthorized - could redirect to login
      console.error('Unauthorized request');
    }
    return Promise.reject(error);
  }
);

export default api;
