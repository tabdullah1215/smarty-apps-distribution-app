import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';

export const usePendingAppUsers = (setPermanentMessage) => {
    const [pendingAppUsers, setPendingAppUsers] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchPendingAppUsers = async ({
                                            appFilter = '',
                                            emailFilter = '',
                                            orderFilter = '',
                                            dateFilter = '',
                                            statusFilter = '',
                                            linkTypeFilter = ''  // Make sure linkTypeFilter is included
                                        } = {}, isFromSync = false) => {
        setIsRefreshing(true);

        try {
            const token = authService.getToken();
            const API_KEY = process.env.REACT_APP_API_KEY;
            console.log('Fetching with filters:', { appFilter, emailFilter, orderFilter, statusFilter, linkTypeFilter }); // Debug log

            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/app-manager`,
                    {},
                    {
                        params: {
                            action: 'getPendingAppUsers',
                            appFilter,
                            emailFilter,
                            orderFilter,
                            dateFilter,
                            statusFilter,
                            linkTypeFilter  // Add to params
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
                setPendingAppUsers(response.data);
            }
        } catch (error) {
            console.error('Error fetching pending app users:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to fetch pending app users'
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    return {
        pendingAppUsers,
        isRefreshing,
        fetchPendingAppUsers
    };
};