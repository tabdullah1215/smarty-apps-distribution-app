// hooks/useOrderInsert.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';

export const useOrderInsert = (setPermanentMessage, onSuccess) => {
    const [isInserting, setIsInserting] = useState(false);

    const insertOrderNumber = async (orderNumber) => {
        const url = `${API_ENDPOINT}/app-manager`;
        setIsInserting(true);
        try {
            setPermanentMessage({ type: '', content: '' });

            const response = await axios.post(
                url,
                { orderNumber },
                {
                    params: { action: 'insertOrder' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data && response.data.message) {
                setPermanentMessage({
                    type: 'success',
                    content: `${response.data.message} - Order number: ${orderNumber}`
                });
                onSuccess?.();
            } else {
                setPermanentMessage({
                    type: 'error',
                    content: 'Unexpected response from server. Please try again.'
                });
            }
        } catch (error) {
            console.error('Error inserting order number:', error);
            setPermanentMessage({
                type: 'error',
                content: error.response?.data?.message || 'Failed to insert order number. Please try again.'
            });
        } finally {
            setIsInserting(false);
        }
    };

    return {
        insertOrderNumber,
        isInserting
    };
};