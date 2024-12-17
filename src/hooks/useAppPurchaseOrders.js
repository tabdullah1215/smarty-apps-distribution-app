

import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';

export const useAppPurchaseOrders = (setPermanentMessage) => {
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchPurchaseOrders = async (filters = {}, isFromSync = false) => {
        if (isFromSync) {
            setIsSyncing(true);
        } else {
            setIsRefreshing(true);
        }

        try {
            const token = authService.getToken();
            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/create-distributor`,
                    {},
                    {
                        params: {
                            action: 'getAppPurchaseOrders',
                            ...filters
                        },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
            });

            if (response.data) {
                setPurchaseOrders(response.data);
            }
        } catch (error) {
            console.error('Error fetching app purchase orders:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to fetch app purchase orders'
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
        purchaseOrders,
        isRefreshing,
        isSyncing,
        fetchPurchaseOrders
    };
};