
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';

export const useIncomingOrders = (setPermanentMessage) => {
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);  // Renamed from isLoading
    const [isSyncing, setIsSyncing] = useState(false);        // New state for sync

    const fetchIncomingOrders = async (filters = {}, isFromSync = false) => {
        // Set appropriate loading state
        if (isFromSync) {
            setIsSyncing(true);
        } else {
            setIsRefreshing(true);
        }

        try {
            const token = authService.getToken();

            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/app-manager`,
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
            if (isFromSync) {
                setIsSyncing(false);
            } else {
                setIsRefreshing(false);
            }
        }
    };

    return {
        incomingOrders,
        isRefreshing,  // Renamed from isLoading
        isSyncing,     // New state
        fetchIncomingOrders
    };
};