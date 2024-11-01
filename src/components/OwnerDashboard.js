import React, { useState, useEffect, useRef } from 'react';
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
import { usePendingDistributors } from '../hooks/usePendingDistributors';
import { useDebounce } from '../hooks/useDebounce';
import DashboardHeader from './DashboardHeader';

export default function OwnerDashboard() {

    const [orderNumber, setOrderNumber] = useState('');
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
        pendingDistributors,
        isLoading: isLoadingDistributors,
        fetchPendingDistributors
    } = usePendingDistributors(setPermanentMessage);

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

    useEffect(() => {
        fetchPendingDistributors({
            nameFilter,
            emailFilter,
            orderFilter,
            statusFilter,
            linkTypeFilter
        });
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
            <DashboardHeader
                title="Owner Dashboard"
                permanentMessage={permanentMessage}
            />
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
                    onRefresh={() => fetchPendingDistributors({
                        nameFilter,
                        emailFilter,
                        orderFilter,
                        statusFilter,
                        linkTypeFilter
                    })}
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
                    isLoading={isLoadingDistributors}
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