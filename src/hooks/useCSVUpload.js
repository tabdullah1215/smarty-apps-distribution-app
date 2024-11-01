// hooks/useCSVUpload.js
import { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import { API_ENDPOINT } from '../config';

export const useCSVUpload = (setPermanentMessage, onSuccess, fileInputRef) => {
    const [isUploading, setIsUploading] = useState(false);
    const [csvFile, setCsvFile] = useState(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        setCsvFile(file);
    };

    const processAndUploadCSV = async () => {
        if (!csvFile) {
            setPermanentMessage({ type: 'error', content: 'Please select a CSV file first.' });
            return;
        }

        setIsUploading(true);

        Papa.parse(csvFile, {
            complete: async (result) => {
                const orders = result.data
                    .map(row => ({
                        orderNumber: row[0],
                        createdAt: row[1]
                    }))
                    .filter(order => order.orderNumber && order.createdAt);

                try {
                    const response = await axios.post(
                        `${API_ENDPOINT}/bulk-insert-orders`,
                        { orders },
                        {
                            params: { action: 'bulkInsertOrders' },
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                    setPermanentMessage({ type: 'success', content: response.data.message });
                    // Reset states and input
                    setCsvFile(null);
                    if (fileInputRef?.current) {
                        fileInputRef.current.value = '';
                    }
                    // Call success callback
                    onSuccess?.();
                } catch (error) {
                    console.error('Error uploading orders:', error);
                    setPermanentMessage({
                        type: 'error',
                        content: 'Failed to upload orders. Please try again.'
                    });
                } finally {
                    setIsUploading(false);
                }
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                setPermanentMessage({
                    type: 'error',
                    content: 'Failed to parse CSV file. Please check the file format.'
                });
                setIsUploading(false);
            },
            header: false
        });
    };

    return {
        csvFile,
        isUploading,
        handleFileChange,
        processAndUploadCSV
    };
};