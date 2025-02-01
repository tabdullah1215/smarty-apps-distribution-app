import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';
import { handleLoginError } from '../utils/loginErrorHandler';

export const useLogin = (setPermanentMessage) => {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (email, password) => {
        setIsLoading(true);
        setPermanentMessage({ type: '', content: '' });

        try {
            const response = await axios.post(`${API_ENDPOINT}/app-manager`,
                { email, password },
                {
                    params: { action: 'verifyCredentials' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data.token) {
                authService.setToken(response.data.token);
                setPermanentMessage({ type: 'success', content: 'Login successful!' });

                const userInfo = authService.getUserInfo();
                if (userInfo) {
                    localStorage.setItem('distributor_username', userInfo.email);
                }

                if (userInfo.role === 'Distributor') {
                    navigate('/distributor');
                } else {
                    navigate('/');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            handleLoginError(error, setPermanentMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        handleLogin
    };
};