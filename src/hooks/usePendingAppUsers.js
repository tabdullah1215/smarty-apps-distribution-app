import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';

export const usePendingAppUsers = (setPermanentMessage) => {
    const [pendingAppUsers, setPendingAppUsers] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchPendingAppUsers = async ({
                                            appFilter = '',
                                            emailFilter = '',
                                            orderFilter = '',
                                            dateFilter = '',
                                            statusFilter = ''
                                        } = {}, isFromSync = false) => {
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
                            action: 'getPendingAppUsers',
                            appFilter,
                            emailFilter,
                            orderFilter,
                            dateFilter,
                            statusFilter
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
                setPendingAppUsers(response.data);
            }
        } catch (error) {
            console.error('Error fetching pending app users:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to fetch pending app users'
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
        pendingAppUsers,
        isRefreshing,
        isSyncing,
        fetchPendingAppUsers
    };
};