// MINIMAL FIX: usePendingAppUsers.js - Only adds subAppFilter, preserves original behavior
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
                                            linkTypeFilter = '',
                                            subAppFilter = '' // NEW: Only addition
                                        } = {}, isFromSync = false) => {
        setIsRefreshing(true);

        try {
            const token = authService.getToken();
            const API_KEY = process.env.REACT_APP_API_KEY;

            // ENHANCED: Include subAppFilter in logging
            console.log('Fetching with filters:', {
                appFilter,
                emailFilter,
                orderFilter,
                statusFilter,
                linkTypeFilter,
                subAppFilter // NEW: Include in logs
            });

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
                            linkTypeFilter,
                            subAppFilter // NEW: Include subAppFilter in API call
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

            // PRESERVED: Original response handling (expects array directly)
            if (response.data && response.data.users) {
                setPendingAppUsers(response.data.users);
            } else if (Array.isArray(response.data)) {
                setPendingAppUsers(response.data);
            } else {
                console.warn('Unexpected API response structure:', response.data);
                setPendingAppUsers([]);
            }
        } catch (error) {
            // PRESERVED: Original error handling
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