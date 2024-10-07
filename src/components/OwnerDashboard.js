import React, { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { Copy } from 'lucide-react';

export default function OwnerDashboard() {
    const [uniqueLink, setUniqueLink] = useState('');
    const [genericLink, setGenericLink] = useState('');
    const [copiedUnique, setCopiedUnique] = useState(false);
    const [copiedGeneric, setCopiedGeneric] = useState(false);

    const generateLink = async (type) => {
        try {
            const result = await axios.post(API_ENDPOINT, { linkType: type });
            console.log('result:', result);
            if (result.data && result.data.token) {
                const link = `${window.location.origin}/register/${type}/${result.data.token}`;
                if (type === 'unique') {
                    setUniqueLink(link);
                } else {
                    setGenericLink(link);
                }
            } else {
                console.error('No token received from API');
            }
        } catch (error) {
            console.error('Error generating link:', error);
        }
    };

    const copyToClipboard = (link, setCopied) => {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const LinkGenerator = ({ title, link, copied, generateFn, copyFn }) => (
        <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">{title}</h2>
            <button
                onClick={generateFn}
                className="w-full py-4 px-6 text-xl font-semibold bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition duration-300"
            >
                Generate {title}
            </button>
            {link && (
                <div className="mt-4 p-6 bg-gray-100 rounded-lg shadow-md">
                    <p className="text-xl font-semibold mb-4">Distributor Registration Link:</p>
                    <div className="flex items-stretch">
                        <div className="flex-grow p-4 bg-white rounded-l-lg border-2 border-r-0 border-gray-300 overflow-x-auto">
                            <p className="text-lg whitespace-nowrap">{link}</p>
                        </div>
                        <button
                            onClick={copyFn}
                            className="px-4 bg-gray-200 rounded-r-lg border-2 border-l-0 border-gray-300 hover:bg-gray-300 transition duration-300 flex items-center"
                            title="Copy to clipboard"
                        >
                            <Copy size={24} />
                        </button>
                    </div>
                    {copied && (
                        <p className="mt-2 text-green-600 font-semibold">Copied to clipboard!</p>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-center">Owner Dashboard</h1>
            <LinkGenerator
                title="Unique Link"
                link={uniqueLink}
                copied={copiedUnique}
                generateFn={() => generateLink('unique')}
                copyFn={() => copyToClipboard(uniqueLink, setCopiedUnique)}
            />
            <LinkGenerator
                title="Generic Link"
                link={genericLink}
                copied={copiedGeneric}
                generateFn={() => generateLink('generic')}
                copyFn={() => copyToClipboard(genericLink, setCopiedGeneric)}
            />
        </div>
    );
}