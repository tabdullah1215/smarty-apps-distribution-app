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
            const response = await axios.post(API_ENDPOINT, {
                username,
                password,
                token,
                distributorName,
                companyName
            });
            console.log('Registration response:', response);
            if (response.data.message === 'Distributor registered successfully') {
                navigate('/distributor');
            } else {
                setError('Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Error registering distributor:', error);
            if (error.response && error.response.data && error.response.data.message) {
                setError(error.response.data.message);
            } else {
                setError('An error occurred during registration. Please try again.');
            }
        }
    };

    return (
        <div className="p-8 max-w-md mx-auto">
            <h1 className="text-3xl font-bold mb-6">Distributor Registration</h1>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Form inputs remain the same */}
                <button type="submit" className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Register
                </button>
            </form>
        </div>
    );
}

export default DistributorRegistration;