import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINT } from '../config';

function DistributorRegistration() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await axios.post(API_ENDPOINT, {
                username,
                password,
                token
            });
            console.log('Registration response:', response);
            if (response.data.message === 'Distributor registered successfully') {
                navigate('/distributor');
            } else {
                setError('Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Error registering distributor:', error);
            setError('An error occurred during registration. Please try again.');
        }
    };

    return (
        <div className="p-8 max-w-md mx-auto">
            <h1 className="text-3xl font-bold mb-6">Distributor Registration</h1>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                    required
                />
                <button type="submit" className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Register
                </button>
            </form>
        </div>
    );
}

export default DistributorRegistration;