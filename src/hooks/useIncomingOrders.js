import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';

export const useIncomingOrders = (setPermanentMessage) => {
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchIncomingOrders = async (params = {}) => {
        const { orderFilter = '', dateFilter = '', statusFilter = '' } = params;
        setIsLoading(true);
        try {
            const token = authService.getToken();  // Get token consistently from authService

            const response = await axios.get(`${API_ENDPOINT}/get-incoming-orders`, {
                params: {
                    action: 'getIncomingOrders',
                    orderFilter,
                    dateFilter,
                    statusFilter},
                headers: {
                    'Authorization': `Bearer ${token}`  // Add Authorization header
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
