import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';

export const useAppUserUpdate = (onSuccess, onError) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleAppUserUpdate = async (appId, email, updatedData) => {
        setIsUpdating(true);
        try {
            const token = authService.getToken();

            const response = await axios.post(`${API_ENDPOINT}/app-manager`,
                {
                    appId,
                    email,
                    ...updatedData
                },
                {
                    params: { action: 'updateAppUser' },
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.data && response.data.message) {
                onSuccess?.(response.data.message, updatedData);
            }
        } catch (error) {
            console.error('Error updating app user:', error);
            const errorMessage = error.response?.data?.message || 'Failed to update app user';
            onError?.(errorMessage);
        } finally {
            setIsUpdating(false);
        }
    };

    return {
        handleAppUserUpdate,
        isUpdating
    };
};