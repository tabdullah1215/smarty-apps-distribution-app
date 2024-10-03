import React, { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { ClipboardCopy } from 'lucide-react';

function OwnerDashboard() {
    const [link, setLink] = useState('');
    const [copied, setCopied] = useState(false);

    const generateLink = async () => {
        try {
            const result = await axios.post(API_ENDPOINT);
            console.log('result:', result);
            if (result.data && result.data.token) {
                setLink(`${window.location.origin}/register/${result.data.token}`);
            } else {
                console.error('No token received from API');
            }
        } catch (error) {
            console.error('Error generating link:', error);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-center">Owner Dashboard</h1>
            <button
                onClick={generateLink}
                className="w-full py-4 px-6 text-xl font-semibold bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition duration-300"
            >
                Generate Distributor Link
            </button>
            {link && (
                <div className="mt-8 p-6 bg-gray-100 rounded-lg shadow-md">
                    <p className="text-xl font-semibold mb-4">Distributor Registration Link:</p>
                    <div className="flex items-center">
                        <div className="flex-grow p-4 bg-white rounded-l-lg border-2 border-r-0 border-gray-300 overflow-x-auto">
                            <p className="text-lg whitespace-nowrap">{link}</p>
                        </div>
                        <button
                            onClick={copyToClipboard}
                            className="p-4 bg-gray-200 rounded-r-lg border-2 border-l-0 border-gray-300 hover:bg-gray-300 transition duration-300"
                            title="Copy to clipboard"
                        >
                            <ClipboardCopy size={24} />
                        </button>
                    </div>
                    {copied && (
                        <p className="mt-2 text-green-600 font-semibold">Copied to clipboard!</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default OwnerDashboard;