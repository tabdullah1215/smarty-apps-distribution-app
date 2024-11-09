// hooks/useIncomingOrders.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';  // Add this import

export const useIncomingOrders = (setPermanentMessage) => {
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchIncomingOrders = async (filters = {}) => {
        setIsLoading(true);
        try {
            const token = authService.getToken();  // Use authService instead of localStorage

            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/create-distributor`,
                    {},
                    {
                        params: {
                            action: 'getIncomingOrders',
                            ...filters
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        withCredentials: false
                    }
                );
            });

            if (response.data) {
                setIncomingOrders(response.data);
            }
        } catch (error) {
            console.error('Error fetching incoming orders:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to fetch incoming orders'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return {
        incomingOrders,
        isLoading,
        fetchIncomingOrders
    };
};