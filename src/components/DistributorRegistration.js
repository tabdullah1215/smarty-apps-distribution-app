import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINT } from '../config';

function DistributorRegistration() {
    const [username, setUsername] = useState('testuser');
    const [password, setPassword] = useState('password123');
    const [distributorName, setDistributorName] = useState('John Doe');
    const [companyName, setCompanyName] = useState('Acme Corp');
    const [error, setError] = useState('');
    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const requestBody = {
                username,
                password,
                token,
                distributorName,
                companyName
            };
            console.log('Submitting registration with data:', { ...requestBody, password: '[REDACTED]' });

            const response = await axios.post(API_ENDPOINT, requestBody);

            console.log('Registration response:', response);
            if (response.data.message === 'Distributor registered successfully') {
                navigate('/distributor');
            } else {
                setError(response.data.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Error registering distributor:', error);
            if (error.response) {
                console.error('Error response:', error.response);
                console.error('Error response data:', error.response.data);
                console.error('Error type:', error.response.headers['x-error-type']);

                const errorType = error.response.headers['x-error-type'];
                if (errorType === 'TokenAlreadyUsed') {
                    setError('Your link has been already used. Please request a new registration link from administrator.');
                } else if (errorType === 'InvalidRequest') {
                    setError('Invalid request: ' + (error.response.data.message || 'Please check all fields and try again.'));
                } else if (error.response.data && error.response.data.message) {
                    setError(error.response.data.message);
                } else {
                    setError(`Error ${error.response.status}: ${error.response.statusText}`);
                }
            } else if (error.request) {
                console.error('Error request:', error.request);
                setError('No response received from the server. Please try again.');
            } else {
                console.error('Error message:', error.message);
                setError('An error occurred during registration. Please try again.');
            }
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
                <input
                    type="text"
                    placeholder="Distributor Name"
                    value={distributorName}
                    onChange={(e) => setDistributorName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                    required
                />
                <input
                    type="text"
                    placeholder="Company Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
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