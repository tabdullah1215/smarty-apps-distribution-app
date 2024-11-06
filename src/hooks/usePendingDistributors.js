
// hooks/usePendingDistributors.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';

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
            const token = authService.getToken();  // Get token consistently from authService

            const response = await axios.get(`${API_ENDPOINT}/get-distributors`, {
                params: {
                    action: 'getDistributors',
                    nameFilter,
                    emailFilter,
                    orderFilter,
                    statusFilter,
                    linkTypeFilter
                },
                headers: {
                    'Authorization': `Bearer ${token}`  // Add Authorization header
                }
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