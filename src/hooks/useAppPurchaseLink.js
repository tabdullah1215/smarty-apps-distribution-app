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

    const generatePurchaseLink = async (linkType, appId) => {
        setGeneratingStates(prev => ({ ...prev, [linkType]: true }));
        try {
            setPermanentMessage({ type: '', content: '' });

            const token = authService.getToken();
            const distributorId = authService.getUserInfo()?.distributorId;

            if (!token || !distributorId) {
                throw new Error('Authentication required');
            }

            const response = await withMinimumDelay(async () => {
                const result = await axios.post(`${API_ENDPOINT}/create-distributor`,
                    {
                        linkType,
                        appId,
                        distributorId
                    },
                    {
                        params: { action: 'generatePurchaseToken' },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
                return result;
            });

            if (response.data.token) {
                const purchaseLink = `${window.location.origin}/purchase-app/${appId}/${linkType}/${response.data.token}`;
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
                throw new Error('Failed to generate purchase link');
            }
        } catch (error) {
            console.error('Error generating purchase link:', error);
            setPermanentMessage({
                type: 'error',
                content: error.response?.data?.message || 'Failed to generate purchase link. Please try again.'
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