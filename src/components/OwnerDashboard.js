import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import LinkGenerator from './LinkGenerator';  // Adjust the path as needed
import { useGenerateLink } from '../hooks/useGenerateLink';
import DistributorEditModal from './DistributorEditModal';  // Adjust path as needed
import { useDistributorUpdate } from '../hooks/useDistributorUpdate';
import DistributorGrid from './DistributorGrid';
import OrderGrid from './OrderGrid';
import InsertOrder from './InsertOrder';
import SyncOrdersAndDistributors from "./SyncOrdersAndDistributors";
import { useIncomingOrders } from '../hooks/useIncomingOrders';
import Pagination from './Pagination';
import { useOrderInsert } from '../hooks/useOrderInsert';
import { useCSVUpload } from '../hooks/useCSVUpload';
import { useSyncOrders } from '../hooks/useSyncOrders';

const useDebounce = (callback, delay) => {
    const timeoutRef = React.useRef(null);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const debouncedCallback = React.useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]);

    return debouncedCallback;
};

export default function OwnerDashboard() {

    const [orderNumber, setOrderNumber] = useState('');
    const [pendingDistributors, setPendingDistributors] = useState([]);
    const [nameFilter, setNameFilter] = useState('');
    const [orderFilter, setOrderFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [linkTypeFilter, setLinkTypeFilter] = useState('');
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });
    const [incomingOrderFilter, setIncomingOrderFilter] = useState('');
    const [incomingDateFilter, setIncomingDateFilter] = useState('');
    const [incomingStatusFilter, setIncomingStatusFilter] = useState('');
    const [distributorsPage, setDistributorsPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [emailFilter, setEmailFilter] = useState('');
    const [selectedDistributor, setSelectedDistributor] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const [nameFilterImmediate, setNameFilterImmediate] = useState('');
    const [emailFilterImmediate, setEmailFilterImmediate] = useState('');
    const [orderFilterImmediate, setOrderFilterImmediate] = useState('');
    const [incomingOrderFilterImmediate, setIncomingOrderFilterImmediate] = useState('');

    const setNameFilterDebounced = useDebounce((value) => setNameFilter(value), 500);
    const setEmailFilterDebounced = useDebounce((value) => setEmailFilter(value), 500);
    const setOrderFilterDebounced = useDebounce((value) => setOrderFilter(value), 500);
    const setIncomingOrderFilterDebounced = useDebounce((value) => setIncomingOrderFilter(value), 500);
    const itemsPerPage = 10;

    const fileInputRef = useRef(null);

    const {
        incomingOrders,
        isLoading: isLoadingOrders,
        fetchIncomingOrders
    } = useIncomingOrders(setPermanentMessage);

    const { insertOrderNumber, isInserting } = useOrderInsert(
        setPermanentMessage,
        () => {
            setOrderNumber('');
            fetchIncomingOrders({});
        }
    );

    const {
        csvFile,
        isUploading,
        handleFileChange,
        processAndUploadCSV
    } = useCSVUpload(setPermanentMessage, () => {
        fetchIncomingOrders({});
    }, fileInputRef);

    const handleOrderSubmit = (e) => {
        e.preventDefault();
        insertOrderNumber(orderNumber);
    };

    const { syncOrdersAndDistributors, isSyncing } = useSyncOrders(
        setPermanentMessage,
        () => {
            fetchPendingDistributors();
            fetchIncomingOrders({});
        }
    );

    useEffect(() => {
        const totalPages = Math.ceil(pendingDistributors.length / itemsPerPage);
        if (distributorsPage > totalPages && totalPages > 0) {
            setDistributorsPage(totalPages);
        }
    }, [pendingDistributors, distributorsPage]);

    useEffect(() => {
        const totalPages = Math.ceil(incomingOrders.length / itemsPerPage);
        if (ordersPage > totalPages && totalPages > 0) {
            setOrdersPage(totalPages);
        }
    }, [incomingOrders, ordersPage]);

    const {
        uniqueLink,
        genericLink,
        copiedUnique,
        copiedGeneric,
        setCopiedUnique,
        setCopiedGeneric,
        generateLink,
        copyToClipboard
    } = useGenerateLink(setPermanentMessage);

    const { handleDistributorUpdate, isUpdating } = useDistributorUpdate(
        // onSuccess callback
        (message, updatedData) => {
            setPermanentMessage({ type: 'success', content: message });
            if (updatedData.status) {
                setStatusFilter(updatedData.status);
            }
            fetchPendingDistributors();
            setShowEditModal(false);
        },
        // onError callback
        (errorMessage) => {
            setPermanentMessage({ type: 'error', content: errorMessage });
            setShowEditModal(false);
            setSelectedDistributor(null);
        }
    );

    const fetchPendingDistributors = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINT}/get-distributors`, {
                params: {
                    action: 'getDistributors',
                    nameFilter,
                    emailFilter,
                    orderFilter,
                    statusFilter,
                    linkTypeFilter
                }
            });
            setPendingDistributors(response.data);
        } catch (error) {
            console.error('Error fetching pending distributors:', error);
            setPermanentMessage({ type: 'error', content: 'Failed to fetch pending distributors. Please try again.' });
        }
    };

    useEffect(() => {
        fetchPendingDistributors();
        setDistributorsPage(1);
    }, [nameFilter, emailFilter, orderFilter, statusFilter, linkTypeFilter]);

    useEffect(() => {
        fetchIncomingOrders({
            orderFilter: incomingOrderFilter,
            dateFilter: incomingDateFilter,
            statusFilter: incomingStatusFilter
        });
        setOrdersPage(1);
    }, [incomingOrderFilter, incomingDateFilter, incomingStatusFilter]);

    return (
        <div className="relative font-roboto bg-gray-200">
            <div className="fixed top-0 left-0 right-0 bg-white z-10 shadow-md">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex flex-col items-start md:items-center">
                        <div
                            className="w-full flex flex-col md:flex-row items-start md:items-center md:justify-between mb-2">
                            <div className="flex flex-col md:flex-row w-full md:items-center">
                                <div className="flex justify-center md:justify-start">
                                    <img
                                        src="/images/smartyapps-logo.png"
                                        alt="SmartyApps.AI Logo"
                                        className="h-20 md:h-32 mb-1 md:mb-0"
                                    />
                                </div>
                                <div className="flex-grow flex justify-center">
                                    <div className="md:ml-4 flex flex-col md:border-l md:pl-4 text-center">
                                        <h2 className="text-lg md:text-xl text-gray-600 font-semibold">App Manager</h2>
                                        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Owner Dashboard</h1>
                                    </div>
                                </div>

                                <div className="hidden md:block" style={{width: '128px'}}></div>
                            </div>
                        </div>
                        <div className="w-full max-w-2xl mt-1 md:mt-2">
                            <div
                                className={`p-2 rounded-lg w-full text-center text-sm min-h-[2rem] md:min-h-[2.5rem] flex items-center justify-center ${
                                    permanentMessage.content
                                        ? (permanentMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                                        : 'bg-gray-50 text-gray-400'
                                }`}>
                                {permanentMessage.content || 'No messages'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-8 max-w-6xl mx-auto pt-48 md:pt-48">
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
                <InsertOrder
                    orderNumber={orderNumber}
                    onOrderNumberChange={(e) => setOrderNumber(e.target.value)}
                    onSubmit={handleOrderSubmit}
                    csvFile={csvFile}
                    onCsvUpload={handleFileChange}
                    onProcessCsv={processAndUploadCSV}
                    isInserting={isInserting}
                    isUploading={isUploading}
                    fileInputRef={fileInputRef}  // Pass the ref to InsertOrder
                />
                <SyncOrdersAndDistributors
                    onSync={syncOrdersAndDistributors}
                    isSyncing={isSyncing}  // Pass the loading state to the component
                />
                <DistributorGrid
                    distributors={pendingDistributors}
                    onDistributorClick={(distributor) => {
                        setSelectedDistributor(distributor);
                        setShowEditModal(true);
                    }}
                    onRefresh={fetchPendingDistributors}
                    nameFilterImmediate={nameFilterImmediate}
                    emailFilterImmediate={emailFilterImmediate}
                    orderFilterImmediate={orderFilterImmediate}
                    statusFilter={statusFilter}
                    linkTypeFilter={linkTypeFilter}
                    onNameFilterChange={(e) => {
                        setNameFilterImmediate(e.target.value);
                        setNameFilterDebounced(e.target.value);
                    }}
                    onEmailFilterChange={(e) => {
                        setEmailFilterImmediate(e.target.value);
                        setEmailFilterDebounced(e.target.value);
                    }}
                    onOrderFilterChange={(e) => {
                        setOrderFilterImmediate(e.target.value);
                        setOrderFilterDebounced(e.target.value);
                    }}
                    onStatusFilterChange={(e) => setStatusFilter(e.target.value)}
                    onLinkTypeFilterChange={(e) => setLinkTypeFilter(e.target.value)}
                    currentPage={distributorsPage}
                    itemsPerPage={itemsPerPage}
                    Pagination={
                        <Pagination
                            currentPage={distributorsPage}
                            setCurrentPage={setDistributorsPage}
                            totalItems={pendingDistributors.length}
                            itemsPerPage={itemsPerPage}
                        />
                    }
                />
                <OrderGrid
                    orders={incomingOrders}
                    onRefresh={() => fetchIncomingOrders({
                        orderFilter: incomingOrderFilter,
                        dateFilter: incomingDateFilter,
                        statusFilter: incomingStatusFilter
                    })}
                    orderFilterImmediate={incomingOrderFilterImmediate}
                    dateFilter={incomingDateFilter}
                    statusFilter={incomingStatusFilter}
                    onOrderFilterChange={(e) => {
                        setIncomingOrderFilterImmediate(e.target.value);
                        setIncomingOrderFilterDebounced(e.target.value);
                    }}
                    onDateFilterChange={(e) => setIncomingDateFilter(e.target.value)}
                    onStatusFilterChange={(e) => setIncomingStatusFilter(e.target.value)}
                    currentPage={ordersPage}
                    itemsPerPage={itemsPerPage}
                    isLoading={isLoadingOrders}
                    Pagination={
                        <Pagination
                            currentPage={ordersPage}
                            setCurrentPage={setOrdersPage}
                            totalItems={incomingOrders.length}
                            itemsPerPage={itemsPerPage}
                        />
                    }
                />

            </div>
            {showEditModal && selectedDistributor && (
                <DistributorEditModal
                    distributor={selectedDistributor}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedDistributor(null);
                    }}
                    onSubmit={(formData) => handleDistributorUpdate(selectedDistributor.DistributorId, formData)}
                    isSubmitting={isUpdating}
                />
            )}
        </div>
    );
}