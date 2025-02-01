// hooks/useDistributorUpdate.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';

export const useDistributorUpdate = (onSuccess, onError) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleDistributorUpdate = async (distributorId, updatedData) => {
        setIsUpdating(true);
        try {
            const response = await axios.post(`${API_ENDPOINT}/app-manager`,
                {
                    distributorId,
                    ...updatedData
                },
                {
                    params: { action: 'updateDistributor' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data && response.data.message) {
                onSuccess?.(response.data.message, updatedData);
            }
        } catch (error) {
            console.error('Error updating distributor:', error);
            onError?.(error.response?.data?.message || 'Failed to update distributor');
        } finally {
            setIsUpdating(false);
        }
    };

    return {
        handleDistributorUpdate,
        isUpdating
    };
};