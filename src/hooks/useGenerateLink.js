// hooks/useGenerateLink.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { withMinimumDelay } from '../utils/withDelay';

export const useGenerateLink = (setPermanentMessage) => {
    const [uniqueLink, setUniqueLink] = useState('');
    const [genericLink, setGenericLink] = useState('');
    const [copiedUnique, setCopiedUnique] = useState(false);
    const [copiedGeneric, setCopiedGeneric] = useState(false);
    const [generatingStates, setGeneratingStates] = useState({
        unique: false,
        generic: false
    });

    const generateLink = async (linkType) => {
        setGeneratingStates(prev => ({ ...prev, [linkType]: true }));
        try {
            const response = await withMinimumDelay(async () => {
                const result = await axios.post(`${API_ENDPOINT}/create-distributor`,
                    { linkType },
                    {
                        params: { action: 'generateToken' },
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
                return result;
            });

            if (response.data.token) {
                const registrationLink = `${window.location.origin}/register/${linkType}/${response.data.token}`;
                if (linkType === 'unique') {
                    setUniqueLink(registrationLink);
                    setCopiedUnique(false);
                } else {
                    setGenericLink(registrationLink);
                    setCopiedGeneric(false);
                }
            }
        } catch (error) {
            console.error('Error generating link:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to generate link. Please try again.'
            });
        } finally {
            setGeneratingStates(prev => ({ ...prev, [linkType]: false }));
        }
    };

    const copyToClipboard = (link, setCopied) => {
        navigator.clipboard.writeText(link)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
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
        uniqueLink,
        genericLink,
        copiedUnique,
        copiedGeneric,
        setCopiedUnique,
        setCopiedGeneric,
        generateLink,
        copyToClipboard,
        generatingStates
    };
};