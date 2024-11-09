// hooks/useIncomingOrders.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';

export const useIncomingOrders = (setPermanentMessage) => {
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchIncomingOrders = async (filters = {}) => {
        setIsLoading(true);
        try {
            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/create-distributor`,
                    {},
                    {
                        params: {
                            action: 'getIncomingOrders',
                            ...filters
                        }
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