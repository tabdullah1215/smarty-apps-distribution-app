import React, { useState } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';

function OwnerDashboard() {
    const [link, setLink] = useState('');

    const generateLink = async () => {
        try {
            const result = await axios.post(`${API_ENDPOINT}`);
            setLink(`${window.location.origin}/register/${result.data.token}`);
        } catch (error) {
            console.error('Error generating link:', error);
        }
    };

    return (
        <div>
            <h1>Owner Dashboard</h1>
            <button onClick={generateLink}>Generate Distributor Link</button>
            {link && (
                <div>
                    <p>Distributor Registration Link:</p>
                    <input type="text" value={link} readOnly />
                </div>
            )}
        </div>
    );
}

export default OwnerDashboard;