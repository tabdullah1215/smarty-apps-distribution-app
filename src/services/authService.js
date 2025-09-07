// src/services/authService.js
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';  // You'll need to install this: npm install jwt-decode

const TOKEN_KEY = 'auth_token';

axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // Clear auth data
            localStorage.removeItem(TOKEN_KEY);
            delete axios.defaults.headers.common['Authorization'];

            // Only redirect if we're not already on the login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

axios.interceptors.request.use((config) => {
    // console.log('Request Headers:', config.headers);
    return config;
}, (error) => Promise.reject(error));

const authService = {
    setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
        // Add token to axios default headers
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    },

    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    },

    removeToken() {
        localStorage.removeItem(TOKEN_KEY);
        delete axios.defaults.headers.common['Authorization'];
    },

    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;

        try {
            const decoded = jwtDecode(token);
            // Check if token is expired
            return decoded.exp > Date.now() / 1000;
        } catch (error) {
            return false;
        }
    },

    // Get user info from token
    getUserInfo() {
        try {
            const token = this.getToken();
            if (!token) return null;
            return jwtDecode(token);
        } catch {
            return null;
        }
    },

    // Initialize axios with token if it exists
    initializeAuth() {
        const token = this.getToken();
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
    }
};

export default authService;