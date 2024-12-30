import { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import { API_ENDPOINT } from '../config';
import authService from '../services/authService';

export const useAppOrdersUpload = (setPermanentMessage, onSuccess, fileInputRef) => {
    const [isUploading, setIsUploading] = useState(false);
    const [csvFile, setCsvFile] = useState(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        setCsvFile(file);
    };

    const processAndUploadCSV = async () => {
        if (!csvFile) {
            setPermanentMessage({
                type: 'error',
                content: 'Please select a CSV file first.'
            });
            return;
        }

        setIsUploading(true);
        const token = authService.getToken();

        Papa.parse(csvFile, {
            skipEmptyLines: true,
            complete: async (result) => {
                try {
                    // Extract order numbers from each row
                    const orderNumbers = result.data
                        .map(row => row[0]?.trim())
                        .filter(Boolean);

                    if (orderNumbers.length === 0) {
                        setPermanentMessage({
                            type: 'error',
                            content: 'No valid order numbers found in file.'
                        });
                        setIsUploading(false);
                        return;
                    }

                    const response = await axios.post(
                        `${API_ENDPOINT}/create-distributor`,
                        { orderNumbers },
                        {
                            params: { action: 'bulkInsertAppPurchaseOrder' },
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        }
                    );

                    setPermanentMessage({
                        type: 'success',
                        content: response.data.message
                    });

                    // Reset state
                    setCsvFile(null);
                    if (fileInputRef?.current) {
                        fileInputRef.current.value = '';
                    }

                    // Callback for parent component
                    onSuccess?.();
                } catch (error) {
                    console.error('Error uploading app purchase orders:', error);
                    setPermanentMessage({
                        type: 'error',
                        content: error.response?.data?.message ||
                            'Failed to upload orders. Please try again.'
                    });
                } finally {
                    setIsUploading(false);
                }
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                setPermanentMessage({
                    type: 'error',
                    content: 'Failed to parse CSV file. Please check the format.'
                });
                setIsUploading(false);
            }
        });
    };

    return {
        csvFile,
        isUploading,
        handleFileChange,
        processAndUploadCSV
    };
};