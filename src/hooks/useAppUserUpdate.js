// src/hooks/useAppUserUpdate.js - CLEAN MINIMAL FIX preserving original functionality
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';

export const useAppUserUpdate = (onSuccess, onError) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const API_KEY = process.env.REACT_APP_API_KEY;

    // ENHANCED: Only minimal changes to support new table structure
    const handleAppUserUpdate = async (appId, email, updatedData) => {
        setIsUpdating(true);
        try {
            const token = authService.getToken();

            // NEW: Extract SubAppId for new table structure (backwards compatible)
            const { subAppId, originalEmailSubAppId, ...otherData } = updatedData;

            // ENHANCED: Include SubAppId fields required by new Lambda function
            const payload = {
                appId,
                email,
                ...otherData,
                ...(subAppId && { subAppId }),
                ...(originalEmailSubAppId && { emailSubAppId: originalEmailSubAppId })
            };

            // PRESERVED: Original axios call structure
            const response = await axios.post(`${API_ENDPOINT}/app-manager`,
                payload,
                {
                    params: { action: 'updateAppUser' },
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'X-Api-Key': API_KEY
                    }
                }
            );

            // PRESERVED: Original success handling
            if (response.data && response.data.message) {
                onSuccess?.(response.data.message, updatedData);
            }
        } catch (error) {
            console.error('Error updating app user:', error);
            // PRESERVED: Original error handling pattern
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