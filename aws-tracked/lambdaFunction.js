//LAMBDA POST-UPLOAD CSV FEATURE

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, TransactWriteCommand, UpdateCommand, BatchWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Content-Type": "application/json"
};

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        const action = event.queryStringParameters?.action;

        if (!action) {
            return createResponse(400, { message: 'Missing action parameter' });
        }

        let body = {};
        if (event.httpMethod === 'POST') {
            body = JSON.parse(event.body || '{}');
            console.log('Parsed body:', JSON.stringify(body, null, 2));
        }

        switch (action) {
            case 'insertOrder':
                return await handleInsertOrder(body);
            case 'generateToken':
                return await handleGenerateToken(body);
            case 'registerDistributor':
                return await handleRegisterDistributor(body);
            case 'syncOrdersAndDistributors':
                return await handleSyncOrdersAndDistributors();
            case 'getIncomingOrders':
                return await handleFetchIncomingOrders();
            case 'getDistributors':
                return await handleFetchPendingDistributors(event);
            case 'bulkInsertOrders':
                return await handleBulkInsertOrders(body);
            default:
                return createResponse(400, { message: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        if (error instanceof SyntaxError) {
            return createResponse(400, { message: 'Invalid JSON in request body' });
        }
        return createResponse(500, { message: 'Internal Server Error', error: error.message });
    }
};

function sanitizeOrderNumber(orderNumber) {
    orderNumber = String(orderNumber);
    orderNumber = orderNumber.trim();
    if (orderNumber === '0') {
        throw new Error('Order number cannot be zero');
    }
    const MAX_LENGTH = 50;
    if (orderNumber.length > MAX_LENGTH) {
        throw new Error(`Order number exceeds maximum length of ${MAX_LENGTH} characters`);
    }
    const validPattern = /^[a-zA-Z0-9-_.]+$/;
    if (!validPattern.test(orderNumber)) {
        throw new Error('Order number contains invalid characters. Only alphanumeric characters, hyphens, underscores, and periods are allowed.');
    }
    return orderNumber;
}

async function handleInsertOrder(body) {
    console.log('Processing insert-order request');
    try {
        if (!body.orderNumber) {
            return createResponse(400, { message: 'Order number is required' });
        }

        let sanitizedOrderNumber;
        try {
            sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
        } catch (sanitizationError) {
            return createResponse(400, { message: sanitizationError.message });
        }

        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'IncomingOrders',
            FilterExpression: 'OrderNumber = :orderNumber',
            ExpressionAttributeValues: {
                ':orderNumber': sanitizedOrderNumber
            }
        }));

        if (scanResult.Items && scanResult.Items.length > 0) {
            console.log('Order number already exists:', sanitizedOrderNumber);
            return createResponse(409, { message: 'Order number already exists' });
        }

        console.log('Attempting to insert order:', sanitizedOrderNumber);
        await ddbDocClient.send(new PutCommand({
            TableName: 'IncomingOrders',
            Item: {
                OrderNumber: sanitizedOrderNumber,
                CreatedAt: new Date().toISOString(),
                Status: 'pending'
            }
        }));

        console.log('Order number inserted successfully:', sanitizedOrderNumber);
        return createResponse(200, {
            message: 'Order number inserted successfully',
            orderNumber: sanitizedOrderNumber,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error inserting order:', error);
        return createResponse(500, { message: 'Error inserting order', error: error.message });
    }
}

async function handleGenerateToken(body) {
    console.log('Generating new token');
    try {
        if (!body.linkType) {
            return createResponse(400, { message: 'Link type is required' });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const createdAt = new Date().toISOString();

        await ddbDocClient.send(new PutCommand({
            TableName: 'Tokens',
            Item: {
                Token: token,
                CreatedAt: createdAt,
                LinkType: body.linkType,
                Status: body.linkType === 'unique' ? 'pending' : 'active'
            }
        }));

        console.log('Token generated:', token);
        return createResponse(200, { token });
    } catch (error) {
        console.error('Error generating token:', error);
        return createResponse(500, { message: 'Error generating token', error: error.message });
    }
}

async function handleRegisterDistributor(body) {
    console.log('Processing distributor registration');
    try {
        if (!body.token || !body.username || !body.password || !body.distributorName || !body.companyName) {
            return createResponse(400, { message: 'Missing required fields' });
        }

        const tokenResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Tokens',
            Key: { Token: body.token }
        }));

        if (!tokenResult.Item) {
            return createResponse(400, { message: 'Invalid token' });
        }

        if ((tokenResult.Item.LinkType === 'unique' && tokenResult.Item.Status !== 'pending') ||
            (tokenResult.Item.LinkType === 'generic' && tokenResult.Item.Status !== 'active')) {
            return createResponse(400, { message: 'Link is invalid or inactive. Please request a new registration link from administrator.' });
        }

        const distributorId = crypto.randomBytes(16).toString('hex');
        const linkType = tokenResult.Item.LinkType;
        const tokenCreatedAt = tokenResult.Item.CreatedAt;
        const registrationDate = new Date().toISOString();

        let sanitizedOrderNumber;
        let distributorStatus = linkType === 'unique' ? 'active' : 'pending';
        let orderMatchFound = false;

        if (linkType === 'generic' && body.orderNumber) {
            try {
                sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
            } catch (sanitizationError) {
                return createResponse(400, { message: sanitizationError.message });
            }

            const orderResult = await ddbDocClient.send(new GetCommand({
                TableName: 'IncomingOrders',
                Key: { OrderNumber: sanitizedOrderNumber }
            }));

            if (orderResult.Item &&
                (orderResult.Item.Status === 'pending' || !orderResult.Item.Status)) {
                orderMatchFound = true;
                distributorStatus = 'active';
            } else {
                const scanResult = await ddbDocClient.send(new ScanCommand({
                    TableName: 'Distributors',
                    FilterExpression: 'OrderNumber = :orderNumber',
                    ExpressionAttributeValues: {
                        ':orderNumber': sanitizedOrderNumber
                    }
                }));

                if (scanResult.Items && scanResult.Items.length > 0) {
                    return createResponse(400, { message: 'Order number already exists. Please use a different order number.' });
                }
            }
        }

        const distributorItem = {
            DistributorId: distributorId,
            Username: body.username,
            Password: body.password,
            Token: body.token,
            DistributorName: body.distributorName,
            CompanyName: body.companyName,
            Role: 'Distributor',
            LinkType: linkType,
            TokenCreatedAt: tokenCreatedAt,
            RegistrationDate: registrationDate,
            Status: distributorStatus
        };

        if (sanitizedOrderNumber) {
            distributorItem.OrderNumber = sanitizedOrderNumber;
        }

        const transactItems = [
            {
                Put: {
                    TableName: 'Distributors',
                    Item: distributorItem
                }
            }
        ];

        if (linkType === 'unique') {
            transactItems.push({
                Update: {
                    TableName: 'Tokens',
                    Key: { Token: body.token },
                    UpdateExpression: 'SET #status = :statusValue',
                    ExpressionAttributeNames: { '#status': 'Status' },
                    ExpressionAttributeValues: { ':statusValue': 'used' }
                }
            });
        }

        if (orderMatchFound) {
            transactItems.push({
                Update: {
                    TableName: 'IncomingOrders',
                    Key: { OrderNumber: sanitizedOrderNumber },
                    UpdateExpression: 'SET #status = :statusValue',
                    ExpressionAttributeNames: { '#status': 'Status' },
                    ExpressionAttributeValues: { ':statusValue': 'used' }
                }
            });
        }

        await ddbDocClient.send(new TransactWriteCommand({
            TransactItems: transactItems
        }));

        console.log('Successfully registered distributor');
        return createResponse(200, { message: 'Distributor registered successfully' });
    } catch (error) {
        console.error('Error registering distributor:', error);
        if (error.name === 'TransactionCanceledException') {
            return createResponse(409, { message: 'Registration failed due to a conflict. Please try again.' });
        }
        return createResponse(500, { message: 'Error registering distributor', error: error.message });
    }
}

async function handleSyncOrdersAndDistributors() {
    try {
        const pendingOrdersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'IncomingOrders',
            FilterExpression: 'attribute_not_exists(#status) OR #status = :pendingStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':pendingStatus': 'pending' }
        }));

        const pendingDistributorsResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'Distributors',
            FilterExpression: '#status = :pendingStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':pendingStatus': 'pending' }
        }));

        const updates = [];

        for (const order of pendingOrdersResult.Items) {
            const matchingDistributor = pendingDistributorsResult.Items.find(
                distributor => distributor.OrderNumber === order.OrderNumber
            );

            if (matchingDistributor) {
                updates.push(
                    ddbDocClient.send(new UpdateCommand({
                        TableName: 'IncomingOrders',
                        Key: { OrderNumber: order.OrderNumber },
                        UpdateExpression: 'SET #status = :usedStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':usedStatus': 'used' }
                    }))
                );

                updates.push(
                    ddbDocClient.send(new UpdateCommand({
                        TableName: 'Distributors',
                        Key: { DistributorId: matchingDistributor.DistributorId },
                        UpdateExpression: 'SET #status = :activeStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':activeStatus': 'active' }
                    }))
                );
            }
        }

        await Promise.all(updates);

        return createResponse(200, { message: `Sync completed. Updated ${updates.length / 2} pairs.` });
    } catch (error) {
        console.error('Error syncing orders and distributors:', error);
        return createResponse(500, { message: 'Error syncing orders and distributors', error: error.message });
    }
}

async function handleFetchIncomingOrders() {
    try {
        console.log('Fetching incoming orders');
        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'IncomingOrders',
            FilterExpression: '#status = :statusValue',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':statusValue': 'pending' }
        }));

        console.log('Incoming orders fetched:', scanResult.Items.length);
        return createResponse(200, scanResult.Items);
    } catch (error) {
        console.error('Error fetching incoming orders:', error);
        return createResponse(500, { message: 'Error fetching incoming orders', error: error.message });
    }
}

async function handleFetchPendingDistributors(event) {
    try {
        console.log('Fetching distributors');
        const { nameFilter, orderFilter, statusFilter, linkTypeFilter } = event.queryStringParameters || {};

        let filterExpression = [];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {};

        if (nameFilter) {
            filterExpression.push('contains(#distributorName, :nameFilter)');
            expressionAttributeNames['#distributorName'] = 'DistributorName';
            expressionAttributeValues[':nameFilter'] = nameFilter;
        }

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (statusFilter) {
            filterExpression.push('#status = :statusFilter');
            expressionAttributeNames['#status'] = 'Status';
            expressionAttributeValues[':statusFilter'] = statusFilter;
        }

        if (linkTypeFilter) {
            filterExpression.push('LinkType = :linkTypeFilter');
            expressionAttributeValues[':linkTypeFilter'] = linkTypeFilter;
        }

        const scanParams = {
            TableName: 'Distributors',
            FilterExpression: filterExpression.length > 0 ? filterExpression.join(' AND ') : undefined,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined
        };

        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

        console.log('Distributors fetched:', scanResult.Items.length);
        return createResponse(200, scanResult.Items);
    } catch (error) {
        console.error('Error fetching distributors:', error);
        return createResponse(500, { message: 'Error fetching distributors', error: error.message });
    }
}

async function handleBulkInsertOrders(body) {
    console.log('Processing bulk insert orders request');
    try {
        if (!body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
            return createResponse(400, { message: 'Invalid or empty orders array' });
        }

        // Step 1: Sanitize and deduplicate order numbers
        const sanitizedOrders = body.orders.map(order => {
            try {
                return {
                    ...order,
                    orderNumber: sanitizeOrderNumber(order.orderNumber)
                };
            } catch (sanitizationError) {
                console.error('Error sanitizing order number:', sanitizationError);
                return null;
            }
        }).filter(order => order !== null);

        const uniqueOrders = Array.from(new Set(sanitizedOrders.map(o => o.orderNumber)))
            .map(orderNumber => sanitizedOrders.find(o => o.orderNumber === orderNumber));

        // Step 2: Check for existing order numbers
        const existingOrders = await checkExistingOrders(uniqueOrders.map(o => o.orderNumber));

        // Step 3: Filter out existing orders
        const newOrders = uniqueOrders.filter(order => !existingOrders.includes(order.orderNumber));

        // Step 4: Insert new orders in batches
        const batchSize = 25; // DynamoDB allows up to 25 items per batch write
        const batches = [];

        for (let i = 0; i < newOrders.length; i += batchSize) {
            const batch = newOrders.slice(i, i + batchSize);
            const putRequests = batch.map(order => ({
                PutRequest: {
                    Item: {
                        OrderNumber: order.orderNumber,
                        CreatedAt: order.createdAt,
                        Status: 'pending' // Default status
                    }
                }
            }));

            if (putRequests.length > 0) {
                batches.push(
                    ddbDocClient.send(new BatchWriteCommand({
                        RequestItems: {
                            'IncomingOrders': putRequests
                        }
                    }))
                );
            }
        }

        await Promise.all(batches);

        console.log(`Successfully inserted ${newOrders.length} new orders. ${existingOrders.length} duplicates were skipped.`);
        return createResponse(200, {
            message: `Successfully inserted ${newOrders.length} new orders. ${existingOrders.length} duplicates were skipped.`,
            insertedCount: newOrders.length,
            skippedCount: existingOrders.length
        });
    } catch (error) {
        console.error('Error bulk inserting orders:', error);
        return createResponse(500, { message: 'Error bulk inserting orders', error: error.message });
    }
}

async function checkExistingOrders(orderNumbers) {
    const existingOrders = [];
    const batchSize = 100; // DynamoDB allows up to 100 items per batch get

    for (let i = 0; i < orderNumbers.length; i += batchSize) {
        const batch = orderNumbers.slice(i, i + batchSize);
        const keys = batch.map(orderNumber => ({ OrderNumber: orderNumber }));

        const result = await ddbDocClient.send(new BatchGetCommand({
            RequestItems: {
                'IncomingOrders': {
                    Keys: keys
                }
            }
        }));

        existingOrders.push(...result.Responses.IncomingOrders.map(item => item.OrderNumber));
    }

    return existingOrders;
}
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers,
        body: JSON.stringify(body),
    };
}