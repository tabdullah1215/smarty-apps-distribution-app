// hooks/useGenerateLink.js
import { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';

export const useGenerateLink = (setPermanentMessage) => {
    const [uniqueLink, setUniqueLink] = useState('');
    const [genericLink, setGenericLink] = useState('');
    const [copiedUnique, setCopiedUnique] = useState(false);
    const [copiedGeneric, setCopiedGeneric] = useState(false);

    const generateLink = async (type) => {
        try {
            setPermanentMessage({ type: '', content: '' });
            const result = await axios.post(`${API_ENDPOINT}/create-distributor`,
                { linkType: type },
                {
                    params: { action: 'generateToken' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (result.data && result.data.token) {
                const link = `${window.location.origin}/register/${type}/${result.data.token}`;
                if (type === 'unique') {
                    setUniqueLink(link);
                } else {
                    setGenericLink(link);
                }
                setPermanentMessage({ type: 'success', content: `${type.charAt(0).toUpperCase() + type.slice(1)} link generated successfully.` });
            } else {
                setPermanentMessage({ type: 'error', content: 'Failed to generate link. Please try again.' });
            }
        } catch (error) {
            console.error('Error generating link:', error);
            setPermanentMessage({ type: 'error', content: 'An error occurred while generating the link. Please try again.' });
        }
    };

    const copyToClipboard = (link, setCopied) => {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            setPermanentMessage({ type: 'success', content: 'Link copied to clipboard.' });
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
        copyToClipboard
    };
};