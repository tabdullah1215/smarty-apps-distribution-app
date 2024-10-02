import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useHistory } from 'react-router-dom';
import { API_ENDPOINT } from '../config';

function DistributorRegistration() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { token } = useParams();
    const history = useHistory();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_ENDPOINT}/create-distributor`, {
                username,
                password,
                token
            });
            history.push('/distributor');
        } catch (error) {
            console.error('Error registering distributor:', error);
        }
    };

    return (
        <div>
            <h1>Distributor Registration</h1>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit">Register</button>
            </form>
        </div>
    );
}

export default DistributorRegistration;