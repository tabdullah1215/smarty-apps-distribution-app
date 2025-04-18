// hooks/useAppPurchaseLink.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';
import authService from '../services/authService';

export const useAppPurchaseLink = (setPermanentMessage) => {
    const [uniquePurchaseLink, setUniquePurchaseLink] = useState('');
    const [genericPurchaseLink, setGenericPurchaseLink] = useState('');
    const [copiedUnique, setCopiedUnique] = useState(false);
    const [copiedGeneric, setCopiedGeneric] = useState(false);
    const [generatingStates, setGeneratingStates] = useState({
        unique: false,
        generic: false
    });

    const API_KEY = process.env.REACT_APP_API_KEY;

    const generatePurchaseLink = async (linkType, appId, subAppId) => {
        if (!appId) {
            setPermanentMessage({
                type: 'error',
                content: 'Please select an app first'
            });
            return;
        }

        if (!subAppId) {
            setPermanentMessage({
                type: 'error',
                content: 'Please select a sub app first'
            });
            return;
        }

        setGeneratingStates(prev => ({ ...prev, [linkType]: true }));
        try {
            setPermanentMessage({ type: '', content: '' });

            const userInfo = authService.getUserInfo();
            const token = authService.getToken();

            if (!userInfo?.sub) {
                throw new Error('Authentication required. Please log in again.');
            }

            console.log('Generating purchase link with params:', {
                linkType,
                appId,
                subAppId,
                distributorId: userInfo.sub
            });

            const response = await withMinimumDelay(async () => {
                return await axios.post(
                    `${API_ENDPOINT}/app-manager`,
                    {
                        linkType,
                        appId,
                        subAppId,
                        distributorId: userInfo.sub
                    },
                    {
                        params: { action: 'generatePurchaseToken' },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'X-Api-Key': API_KEY
                        }
                    }
                );
            });

            if (response?.data?.token && response?.data?.appDomain) {
                const purchaseLink = `${response.data.appDomain}/register/${appId}/${subAppId}/${linkType}/${response.data.token}`;
                if (linkType === 'unique') {
                    setUniquePurchaseLink(purchaseLink);
                    setCopiedUnique(false);
                } else {
                    setGenericPurchaseLink(purchaseLink);
                    setCopiedGeneric(false);
                }
                setPermanentMessage({
                    type: 'success',
                    content: `${linkType.charAt(0).toUpperCase() + linkType.slice(1)} purchase link generated successfully`
                });
            } else {
                throw new Error('Invalid response format - missing token');
            }
        } catch (error) {
            console.error('Error generating purchase link:', error);
            let errorMessage = 'Failed to generate purchase link. Please try again.';

            if (error.response) {
                console.error('Server Error Response:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
                errorMessage = error.response.data?.message || error.response.data?.error || errorMessage;
            } else if (error.request) {
                console.error('No Response Received:', error.request);
                errorMessage = 'No response received from server. Please check your connection.';
            } else {
                console.error('Request Setup Error:', error.message);
                errorMessage = error.message;
            }

            setPermanentMessage({
                type: 'error',
                content: errorMessage
            });
        } finally {
            setGeneratingStates(prev => ({ ...prev, [linkType]: false }));
        }
    };

    const copyToClipboard = (link, setCopied) => {
        setPermanentMessage({ type: '', content: '' });

        navigator.clipboard.writeText(link)
            .then(() => {
                setCopied(true);
                setPermanentMessage({
                    type: 'success',
                    content: 'Purchase link copied to clipboard successfully'
                });
                setTimeout(() => {
                    setCopied(false);
                    setPermanentMessage({ type: '', content: '' });
                }, 3000);
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                setPermanentMessage({
                    type: 'error',
                    content: 'Failed to copy to clipboard'
                });
            });
    };

    return {
        uniquePurchaseLink,
        genericPurchaseLink,
        copiedUnique,
        copiedGeneric,
        setCopiedUnique,
        setCopiedGeneric,
        generatePurchaseLink,
        copyToClipboard,
        generatingStates
    };
};