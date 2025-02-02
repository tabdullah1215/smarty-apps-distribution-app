// hooks/usePendingDistributors.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';
import { withMinimumDelay } from '../utils/withDelay';

// hooks/useIncomingOrders.js
export const useIncomingOrders = (setPermanentMessage) => {
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);  // Renamed from isLoading
    const [isSyncing, setIsSyncing] = useState(false);        // New state for sync

    const API_KEY = process.env.REACT_APP_API_KEY;

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
                            'Authorization': `Bearer ${token}`,
                            'X-Api-Key': API_KEY
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

// hooks/usePendingDistributors.js
export const usePendingDistributors = (setPermanentMessage) => {
    const [pendingDistributors, setPendingDistributors] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);  // Renamed from isLoading
    const [isSyncing, setIsSyncing] = useState(false);        // New state for sync

    const API_KEY = process.env.REACT_APP_API_KEY;

    const fetchPendingDistributors = async ({
                                                nameFilter = '',
                                                emailFilter = '',
                                                orderFilter = '',
                                                statusFilter = '',
                                                linkTypeFilter = ''
                                            } = {}, isFromSync = false) => {
        // Set appropriate loading state
        if (isFromSync) {
            setIsSyncing(true);
        } else {
            setIsRefreshing(true);
        }

        try {
            const token = authService.getToken();

            const response = await withMinimumDelay(async () => {
                return await axios.post(`${API_ENDPOINT}/app-manager`, {}, {
                    params: {
                        action: 'getDistributors',
                        nameFilter,
                        emailFilter,
                        orderFilter,
                        statusFilter,
                        linkTypeFilter
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'X-Api-Key': API_KEY
                    },
                    withCredentials: false
                });
            });

            setPendingDistributors(response.data);
        } catch (error) {
            console.error('Error fetching pending distributors:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to fetch pending distributors. Please try again.'
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
        pendingDistributors,
        isRefreshing,  // Renamed from isLoading
        isSyncing,     // New state
        fetchPendingDistributors
    };
};