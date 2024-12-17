const InsertAppPurchaseOrder = ({
                                    orderNumber,
                                    onOrderNumberChange,
                                    onSubmit,
                                    isInserting
                                }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Insert App Purchase Order Number</h2>
            <form onSubmit={onSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
                <input
                    type="text"
                    value={orderNumber}
                    onChange={onOrderNumberChange}
                    placeholder="Enter order number"
                    className="flex-grow p-2 border rounded sm:rounded-r-none"
                    disabled={isInserting}
                    required
                />
                <button
                    type="submit"
                    className="w-full md:w-fit py-2 px-4 bg-blue-500 text-white rounded sm:rounded-l-none disabled:bg-blue-300"
                    disabled={isInserting}
                >
                    {isInserting ? 'Inserting...' : 'Insert'}
                </button>
            </form>
        </div>
    );
};

export default InsertAppPurchaseOrder;