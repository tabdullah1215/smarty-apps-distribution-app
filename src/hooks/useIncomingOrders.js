
// hooks/useIncomingOrders.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';

export const useIncomingOrders = (setPermanentMessage) => {
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchIncomingOrders = async ({ orderFilter, dateFilter, statusFilter }) => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_ENDPOINT}/get-incoming-orders`, {
                params: {
                    action: 'getIncomingOrders',
                    orderFilter,
                    dateFilter,
                    statusFilter
                }
            });
            setIncomingOrders(response.data);
        } catch (error) {
            console.error('Error fetching incoming orders:', error);
            setPermanentMessage?.({
                type: 'error',
                content: 'Failed to fetch incoming orders. Please try again.'
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