// hooks/usePendingDistributors.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';
import { withMinimumDelay } from '../utils/withDelay';

export const usePendingDistributors = (setPermanentMessage) => {
    const [pendingDistributors, setPendingDistributors] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchPendingDistributors = async ({
                                                nameFilter = '',
                                                emailFilter = '',
                                                orderFilter = '',
                                                statusFilter = '',
                                                linkTypeFilter = ''
                                            } = {}) => {
        setIsLoading(true);
        try {
            const token = authService.getToken();

            const response = await withMinimumDelay(async () => {
                return await axios.get(`${API_ENDPOINT}/get-distributors`, {
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
                        'Authorization': `Bearer ${token}`
                    },
                    withCredentials: false // Add this to prevent credentials warning
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
            setIsLoading(false);
        }
    };

    return {
        pendingDistributors,
        isLoading,
        fetchPendingDistributors
    };
};