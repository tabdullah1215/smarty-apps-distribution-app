// hooks/useAppPurchaseLink.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';

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

            const response = await withMinimumDelay(async () => {
                const result = await axios.post(`${API_ENDPOINT}/app-purchase`,
                    {
                        linkType,
                        appId
                    },
                    {
                        params: { action: 'generatePurchaseToken' },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`  // Include distributor's token
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