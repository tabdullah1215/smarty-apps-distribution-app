const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, TransactWriteCommand, UpdateCommand, QueryCommand, BatchWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// const DEFAULT_BUDGET_TYPE = 'paycheck';
// const bcrypt = require('bcryptjs');

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = {
    sendEmail: (params) => {
        const sesClient = new SESClient({});
        const command = new SendEmailCommand(params);
        return {
            promise: () => sesClient.send(command)
        };
    }
};

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = '24h';
// const SALT_ROUNDS = 10;

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
};

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'AppUsers';
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@smartylogos.com';
const TOKEN_EXPIRY_HOURS = parseInt(process.env.TOKEN_EXPIRY_HOURS) || 1;
const MAX_RESET_ATTEMPTS_PER_HOUR = parseInt(process.env.MAX_RESET_ATTEMPTS_PER_HOUR) || 3;

const actionConfig = {
    // Public actions (no auth required)
    verifyEmail: { public: true },
    verifyCredentials: { public: true },
    verifyAppPurchase: { public: true },
    registerDistributor: { public: true },
    verifyToken: { public: true },
    appLogin: { public: true },
    getPublicSubappInfo: { public: true },

    sendPasswordReset: { public: true },
    verifyResetToken: { public: true },
    resetPassword: { public: true },

    // Owner only actions
    syncOrdersAndDistributors: { role: 'Owner' },
    getDistributors: { role: 'Owner' },
    getIncomingOrders: { role: 'Owner' },
    bulkInsertOrders: { role: 'Owner' },
    updateDistributor: { role: 'Owner' },
    generateToken: { role: 'Owner' },
    insertOrder: { role: 'Owner' },

    // Distributor only actions
    syncAppUsers: { role: 'Distributor' },
    getPendingAppUsers: { role: 'Distributor' },
    fetchAvailableApps: { role: 'Distributor' },
    generatePurchaseToken: { role: 'Distributor' },
    generateEmailPurchaseToken: { role: 'Distributor' },
    insertAppPurchaseOrder: { role: 'Distributor' },
    insertStoreWebhookOrder: { role: 'Distributor' },
    getAppPurchaseOrders: { role: 'Distributor' },
    updateAppUser: { role: 'Distributor' },
    bulkInsertAppPurchaseOrder: { role: 'Distributor' },
    getSubAppsForApp: { role: 'Distributor' },
};

// Password hashing utilities
// async function hashPassword(password) {
//     return bcrypt.hash(password, SALT_ROUNDS);
// }


// JWT utilities
function generateToken(user) {
    return jwt.sign(
        {
            sub: user.DistributorId,
            email: user.Email,
            role: user.Role,
            distributorName: user.DistributorName,
            status: user.Status
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
    );
}

async function handleVerifyEmail(body) {
    console.log('Processing verify email request');
    try {
        if (!body.email || !body.appId) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Email and appId are required'
            });
        }
        const result = await ddbDocClient.send(new QueryCommand({
            TableName: 'AppUsers',
            IndexName: 'EmailIndex',
            KeyConditionExpression: 'Email = :email AND AppId = :appId',
            ExpressionAttributeValues: {
                ':email': body.email,
                ':appId': body.appId
            }
        }));

        return createResponse(200, {
            exists: !!(result.Items && result.Items.length > 0),
            user: result.Items && result.Items.length > 0,
            subAppCount: result.Items ? result.Items.length : 0  // NEW: Show how many subapps user is registered for
        });
    } catch (error) {
        return handleLambdaError(error, 'handleVerifyEmail');
    }
}

async function handleUpdateAppUser(body, event) {
    try {
        // ENHANCED: Add SubAppId requirement for new table structure
        if (!body.appId || !body.email || !body.subAppId) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'App ID, email, and SubApp ID are required'
            });
        }

        const distributorId = event.user.sub;

        // NEW: Construct EmailSubAppId composite key for new table structure
        const emailSubAppId = body.emailSubAppId || `${body.email}#${body.subAppId}`;

        // FIXED: Use new composite key structure (was: {AppId, Email})
        const currentUser = await ddbDocClient.send(new GetCommand({
            TableName: 'AppUsers',
            Key: {
                AppId: body.appId,
                EmailSubAppId: emailSubAppId // NEW: Composite key instead of Email
            }
        }));

        // PRESERVED: Original user not found logic
        if (!currentUser.Item) {
            return createResponse(404, {
                code: 'USER_NOT_FOUND',
                message: 'App user not found'
            });
        }

        // PRESERVED: Original distributor permission check
        if (currentUser.Item.DistributorId !== distributorId) {
            return createResponse(403, {
                code: 'FORBIDDEN',
                message: 'Cannot update app users belonging to other distributors'
            });
        }

        // PRESERVED: Original status change validation
        if (body.status === 'active' &&
            currentUser.Item.LinkType === 'generic' &&
            currentUser.Item.Status === 'pending') {
            return createResponse(400, {
                code: 'INVALID_STATUS_CHANGE',
                message: 'Generic registrations must be activated through order validation'
            });
        }

        // PRESERVED: Original update expression building logic
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};

        // PRESERVED: Original updatable fields mapping
        const updatableFields = {
            status: 'Status'
        };

        // PRESERVED: Original update expression construction
        Object.entries(updatableFields).forEach(([key, dbField]) => {
            if (body[key] !== undefined) {
                updateExpressions.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = dbField;
                expressionAttributeValues[`:${key}`] = body[key];
            }
        });

        // PRESERVED: Original validation for empty updates
        if (updateExpressions.length === 0) {
            return createResponse(400, { message: 'No fields to update' });
        }

        // FIXED: Update using new composite key structure (was: {AppId, Email})
        const result = await ddbDocClient.send(new UpdateCommand({
            TableName: 'AppUsers',
            Key: {
                AppId: body.appId,
                EmailSubAppId: emailSubAppId // NEW: Composite key instead of Email
            },
            UpdateExpression: 'SET ' + updateExpressions.join(', '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }));

        // PRESERVED: Original success response format
        return createResponse(200, {
            message: 'App user updated successfully',
            appId: body.appId,
            email: body.email,
            updatedUser: result.Attributes
        });
    } catch (error) {
        console.error('Error updating app user:', error);
        return handleLambdaError(error, 'handleUpdateAppUser');
    }
}
async function handleSyncAppUsers(event) {
    try {
        const distributorId = event.user.sub;
        const pendingOrdersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppPurchaseOrders',
            FilterExpression: '(attribute_not_exists(#status) OR #status = :pendingStatus) AND DistributorId = :distributorId',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: {
                ':pendingStatus': 'pending',
                ':distributorId': distributorId
            }
        }));
        const pendingUsersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppUsers',
            FilterExpression: '#status = :pendingStatus AND DistributorId = :distributorId',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: {
                ':pendingStatus': 'pending',
                ':distributorId': distributorId
            }
        }));

        const transactItems = [];
        let matchedPairs = 0;

        for (const order of pendingOrdersResult.Items) {
            const matchingUser = pendingUsersResult.Items.find(
                user => user.OrderNumber === order.OrderNumber &&
                    user.DistributorId === order.DistributorId
            );

            if (matchingUser) {
                transactItems.push({
                    Update: {
                        TableName: 'AppPurchaseOrders',
                        Key: {
                            DistributorId: order.DistributorId,
                            OrderNumber: order.OrderNumber
                        },
                        UpdateExpression: 'SET #status = :usedStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':usedStatus': 'used' }
                    }
                });

                transactItems.push({
                    Update: {
                        TableName: 'AppUsers',
                        Key: {
                            AppId: matchingUser.AppId,
                            EmailSubAppId: matchingUser.EmailSubAppId  // ✅ CORRECT - Use composite key
                        },
                        UpdateExpression: 'SET #status = :activeStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':activeStatus': 'active' }
                    }
                });

                matchedPairs++;

                if (transactItems.length === 25) {
                    await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
                    transactItems.length = 0;
                }
            }
        }

        if (transactItems.length > 0) {
            await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
        }
        return createResponse(200, {
            code: 'SYNC_SUCCESS',
            message: `Sync completed. Updated ${matchedPairs} pairs.`,
            stats: {
                processedOrders: pendingOrdersResult.Items.length,
                processedUsers: pendingUsersResult.Items.length,
                matchedPairs: matchedPairs
            }
        });

    } catch (error) {
        console.error('Error syncing app users:', error);
        return handleLambdaError(error, 'handleSyncAppUsers');
    }
}

// MINIMAL FIX: handleGetPendingAppUsers - Only adds subAppFilter, preserves ALL original logic
// Replace existing handleGetPendingAppUsers function in lambdaFunction.js

async function handleGetPendingAppUsers(event) {
    try {
        // PRESERVED: Original distributor auth
        const distributorId = event.user.sub;

        console.log('Fetching pending app users');

        // ENHANCED: Add subAppFilter to existing parameters (all others preserved)
        const {
            appFilter,
            emailFilter,
            orderFilter,
            dateFilter,
            statusFilter,
            linkTypeFilter,
            subAppFilter // NEW: Only addition
        } = event.queryStringParameters || {};

        // PRESERVED: Original filter building logic
        let filterExpression = ['DistributorId = :distributorId'];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {
            ':distributorId': distributorId
        };

        // PRESERVED: All original filter conditions exactly as-is
        if (appFilter) {
            filterExpression.push('AppId = :appFilter');
            expressionAttributeValues[':appFilter'] = appFilter;
        }

        if (emailFilter) {
            filterExpression.push('contains(Email, :emailFilter)');
            expressionAttributeValues[':emailFilter'] = emailFilter;
        }

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (dateFilter) {
            filterExpression.push('begins_with(CreatedAt, :dateFilter)');
            expressionAttributeValues[':dateFilter'] = dateFilter;
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

        // NEW: Only addition - SubApp filter (same pattern as others)
        if (subAppFilter) {
            filterExpression.push('SubAppId = :subAppFilter');
            expressionAttributeValues[':subAppFilter'] = subAppFilter;
        }

        // PRESERVED: Original scan parameters construction
        const scanParams = {
            TableName: 'AppUsers',
            FilterExpression: filterExpression.join(' AND '),
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ?
                expressionAttributeNames : undefined,
            ExpressionAttributeValues: expressionAttributeValues
        };

        // PRESERVED: Original logging
        console.log('Scan params:', JSON.stringify(scanParams, null, 2));

        // PRESERVED: Original scan operation
        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

        // PRESERVED: Original logging
        console.log('App users fetched:', scanResult.Items.length);

        // PRESERVED: Original return format (array directly, not wrapped in object)
        return createResponse(200, scanResult.Items);
    } catch (error) {
        // PRESERVED: Original error handling
        console.error('Error fetching app users:', error);
        return createResponse(500, { message: 'Error fetching app users', error: error.message });
    }
}

async function handleFetchAvailableApps(event) {
    try {
        console.log('Processing fetchAvailableApps request');
        console.log('Auth header:', event.headers.Authorization);

        const distributorId = event.user.sub;

        // Get apps assigned to this distributor
        const distributorAppsResult = await ddbDocClient.send(new QueryCommand({
            TableName: 'DistributorApps',
            KeyConditionExpression: 'DistributorId = :distributorId',
            ExpressionAttributeValues: {
                ':distributorId': distributorId
            }
        }));

        if (!distributorAppsResult.Items || distributorAppsResult.Items.length === 0) {
            return createResponse(200, { apps: [] });
        }

        // Get full app details
        const appIds = distributorAppsResult.Items.map(item => ({
            AppId: item.AppId
        }));

        const appsResult = await ddbDocClient.send(new BatchGetCommand({
            RequestItems: {
                'Apps': {
                    Keys: appIds
                }
            }
        }));

        const availableApps = appsResult.Responses.Apps
            .filter(app => app.Status === 'active')
            .map(app => ({
                ...app,
                commission: distributorAppsResult.Items.find(
                    da => da.AppId === app.AppId
                ).CommissionRate
            }));

        return createResponse(200, { apps: availableApps });
    } catch (error) {
        console.error('Error fetching available apps:', error);
        return handleLambdaError(error, 'handleFetchAvailableApps');
    }
}

async function handleGenerateAppPurchaseToken(body, event) {
    console.log('Generating new app purchase token', {
        receivedBody: body,
        distributorId: body.distributorId,
        hasAuth: !!event.headers.Authorization
    });

    try {
        if (!body.linkType || !body.appId || !body.distributorId || !body.subAppId) {
            console.log('Missing required fields:', {
                hasLinkType: !!body.linkType,
                hasAppId: !!body.appId,
                hasDistributorId: !!body.distributorId,
                hasSubAppId: !!body.subAppId
            });
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Link type, app ID, distributor ID, and subApp ID are required for purchase token generation'
            });
        }

        const distributorId = event.user.sub;

        if (distributorId !== body.distributorId) {
            return createResponse(403, {
                code: 'FORBIDDEN',
                message: 'Cannot generate token for another distributor'
            });
        }

        // Get app info
        const appResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Apps',
            Key: { AppId: body.appId }
        }));

        console.log('App lookup result:', {
            found: !!appResult.Item,
            status: appResult.Item?.Status
        });

        if (!appResult.Item || appResult.Item.Status !== 'active') {
            return createResponse(403, {
                code: 'APP_NOT_AVAILABLE',
                message: 'App is not currently available for purchase'
            });
        }

        // Verify the subAppId is valid for this app
        console.log('Verifying SubAppId validity using AppSubAppMapping table');
        const mappingResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppSubAppMapping',
            Key: {
                AppId: body.appId,
                SubAppId: body.subAppId
            }
        }));

        console.log('SubAppId mapping lookup result:', {
            found: !!mappingResult.Item,
            appId: body.appId,
            subAppId: body.subAppId
        });

        if (!mappingResult.Item) {
            return createResponse(400, {
                code: 'INVALID_SUBAPP_ID',
                message: 'The provided SubApp ID is not valid for this application'
            });
        }

        // Verify the specific app is available for this distributor
        const appDistributorResult = await ddbDocClient.send(new GetCommand({
            TableName: 'DistributorApps',
            Key: {
                DistributorId: body.distributorId,
                AppId: body.appId
            }
        }));

        console.log('Distributor-App relationship lookup result:', {
            found: !!appDistributorResult.Item,
            distributorId: body.distributorId,
            appId: body.appId
        });

        if (!appDistributorResult.Item) {
            return createResponse(403, {
                code: 'APP_NOT_AUTHORIZED',
                message: 'Distributor is not authorized to sell this app'
            });
        }

        // Generate token
        const token = crypto.randomBytes(16).toString('hex');
        const createdAt = new Date().toISOString();

        let expirationDays;
        if (body.linkType === 'generic') {
            expirationDays = 365; // 1 year for generic links
        } else if (body.linkType === 'unique') {
            expirationDays = 365;  // 3 months for unique links
        } else {
            expirationDays = 365;  // fallback
        }

        const expiresAt = new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000)).toISOString();

        const tokenItem = {
            Token: token,
            CreatedAt: createdAt,
            ExpiresAt: expiresAt,
            LinkType: body.linkType,
            AppId: body.appId,
            SubAppId: body.subAppId, // Add the SubAppId
            DistributorId: body.distributorId,
            Status: body.linkType === 'unique' ? 'pending' : 'active'
        };

        await ddbDocClient.send(new PutCommand({
            TableName: 'AppPurchaseTokens',
            Item: tokenItem
        }));

        console.log('App purchase token generated:', {
            token,
            appId: body.appId,
            subAppId: body.subAppId, // Log the SubAppId
            distributorId: body.distributorId,
            linkType: body.linkType,
            status: tokenItem.Status
        });

        return createResponse(200, {
            token,
            expiresAt,
            status: tokenItem.Status,
            appDomain: appResult.Item.AppDomain,
            subAppId: body.subAppId // Return the SubAppId in the response
        });

    } catch (error) {
        console.error('Error generating app purchase token:', error);
        if (error.name === 'ValidationException') {
            return createResponse(400, {
                code: 'VALIDATION_ERROR',
                message: 'Invalid data format provided'
            });
        }
        return handleLambdaError(error, 'handleGenerateAppPurchaseToken');
    }
}


// CRITICAL FIX: Replace existing handleAppLogin function in lambdaFunction.js
// This version handles multiple subapp registrations per email
async function handleAppLogin(body) {
    try {
        if (!body.appId || !body.email || !body.password) {
            return createResponse(400, {
                code: 'MISSING_CREDENTIALS',
                message: 'App ID, email and password are required'
            });
        }

        // Get app info
        const appResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Apps',
            Key: { AppId: body.appId }
        }));

        const appName = appResult.Item?.Name;

        // FIXED: Use EmailIndex GSI to find ALL registrations for this email in this app
        const userQueryResult = await ddbDocClient.send(new QueryCommand({
            TableName: 'AppUsers',
            IndexName: 'EmailIndex',
            KeyConditionExpression: 'Email = :email AND AppId = :appId',
            ExpressionAttributeValues: {
                ':email': body.email,
                ':appId': body.appId
            }
        }));

        console.log(`Found ${userQueryResult.Items?.length || 0} registrations for ${body.email} in app ${body.appId}`);

        if (!userQueryResult.Items || userQueryResult.Items.length === 0) {
            return createResponse(401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        // CRITICAL: Find the user registration with matching password
        const validUser = userQueryResult.Items.find(user => user.Password === body.password);

        if (!validUser) {
            console.log(`Password mismatch for ${body.email}. Found ${userQueryResult.Items.length} registrations but none match password.`);
            return createResponse(401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        console.log(`Login successful for ${body.email} with SubAppId: ${validUser.SubAppId}`);

        if (validUser.Status !== 'active' && validUser.Status !== 'pending') {
            return createResponse(403, {
                code: 'ACCOUNT_INACTIVE',
                message: 'Account is not active'
            });
        }

        // ENHANCED: Build JWT token based on user's registrations
        let tokenPayload = {
            sub: validUser.Email,
            appId: body.appId,
            appName: appName,
            status: validUser.Status
        };

        // Handle multiple subapp registrations
        if (userQueryResult.Items.length === 1) {
            // Single subapp registration - PRESERVED: original fallback logic
            tokenPayload.subAppId = validUser.SubAppId || 'all';
        } else {
            // Multiple subapp registrations - set to 'registered' mode
            tokenPayload.subAppId = 'registered';
            tokenPayload.userRegisteredSubApps = userQueryResult.Items.map(item => item.SubAppId || 'all');
        }

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

        return createResponse(200, {
            token,
            user: {
                email: validUser.Email,
                status: validUser.Status,
                appName: appName,
                subAppId: tokenPayload.subAppId,
                registeredSubApps: tokenPayload.userRegisteredSubApps || [validUser.SubAppId || 'all']
            }
        });
    } catch (error) {
        console.error('Error in handleAppLogin:', error);
        return handleLambdaError(error, 'handleAppLogin');
    }
}

async function handleFetchAppPurchaseOrders(event) {
    try {

        const distributorId = event.user.sub;

        console.log('Fetching app purchase orders');
        const { orderFilter, dateFilter, statusFilter, sourceFilter } = event.queryStringParameters || {};

        let filterExpression = ['DistributorId = :distributorId'];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {
            ':distributorId': distributorId
        };

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (dateFilter) {
            filterExpression.push('begins_with(CreatedAt, :dateFilter)');
            expressionAttributeValues[':dateFilter'] = dateFilter;
        }

        if (statusFilter) {
            filterExpression.push('#status = :statusFilter');
            expressionAttributeNames['#status'] = 'Status';
            expressionAttributeValues[':statusFilter'] = statusFilter;
        }

        if (sourceFilter) {
            filterExpression.push('#source = :sourceFilter');
            expressionAttributeNames['#source'] = 'Source';
            expressionAttributeValues[':sourceFilter'] = sourceFilter;
        }

        const scanParams = {
            TableName: 'AppPurchaseOrders',
            FilterExpression: filterExpression.join(' AND '),
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined
        };

        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

        console.log('App purchase orders fetched:', scanResult.Items.length);
        return createResponse(200, scanResult.Items);
    } catch (error) {
        console.error('Error fetching app purchase orders:', error);
        return handleLambdaError(error, 'handleFetchAppPurchaseOrders');
    }
}
async function handleInsertAppPurchaseOrder(body, event) {
    console.log('Processing insert app purchase order request');
    try {
        if (!body.orderNumber) {
            return createResponse(400, {
                code: 'MISSING_ORDER_NUMBER',
                message: 'Order number is required'
            });
        }

        let sanitizedOrderNumber;
        try {
            sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
        } catch (sanitizationError) {
            return createResponse(400, {
                code: 'INVALID_ORDER_NUMBER',
                message: sanitizationError.message
            });
        }

        let distributorId = event.user.sub;

        // First check for duplicate within distributor scope
        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppPurchaseOrders',
            FilterExpression: 'OrderNumber = :orderNumber AND DistributorId = :distributorId',
            ExpressionAttributeValues: {
                ':orderNumber': sanitizedOrderNumber,
                ':distributorId': distributorId
            }
        }));

        if (scanResult.Items && scanResult.Items.length > 0) {
            return createResponse(409, {
                code: 'DUPLICATE_ORDER',
                message: 'Order number already exists for this distributor'
            });
        }

        // Check for global uniqueness due to HASH key constraint
        try {
            console.log('Attempting to insert order:', {
                orderNumber: sanitizedOrderNumber,
                distributorId: distributorId
            });

            const putResult = await ddbDocClient.send(new PutCommand({
                TableName: 'AppPurchaseOrders',
                Item: {
                    OrderNumber: sanitizedOrderNumber,
                    CreatedAt: new Date().toISOString(),
                    Status: 'pending',
                    DistributorId: distributorId
                },
                ConditionExpression: 'attribute_not_exists(OrderNumber)'
            }));

            console.log('PutCommand result:', putResult);

            return createResponse(200, {
                code: 'SUCCESS',
                message: 'Order number inserted successfully',
                orderNumber: sanitizedOrderNumber,
                timestamp: new Date().toISOString()
            });

        } catch (putError) {
            console.error('PutCommand error details:', {
                name: putError.name,
                code: putError.code,
                message: putError.message,
                type: putError.$metadata?.httpStatusCode
            });

            if (putError.name === 'ConditionalCheckFailedException') {
                return createResponse(409, {
                    code: 'GLOBAL_DUPLICATE_ORDER',
                    message: 'Order number already exists in the system'
                });
            }

            throw putError; // Re-throw to be caught by outer catch and handled by handleLambdaError
        }

    } catch (error) {
        console.error('Error in handleInsertAppPurchaseOrder:', {
            errorName: error.name,
            errorMessage: error.message,
            errorCode: error.code,
            errorType: error.$metadata?.httpStatusCode
        });
        return handleLambdaError(error, 'handleInsertAppPurchaseOrder');
    }
}


// New separate handler for store webhooks (add to lambdaFunction.js)
async function handleStoreWebhookOrder(body, event) {
    console.log('Processing store webhook order');
    console.log('Store webhook data:', JSON.stringify(body, null, 2));

    try {
        // Simple validation - just the essentials
        if (!body.orderNumber) {
            return createResponse(400, {
                code: 'MISSING_ORDER_NUMBER',
                message: 'Order number is required'
            });
        }

        if (!body.email) {
            return createResponse(400, {
                code: 'MISSING_EMAIL',
                message: 'Email is required'
            });
        }

        if (!body.source) {
            return createResponse(400, {
                code: 'MISSING_SOURCE',
                message: 'Source is required'
            });
        }

        let sanitizedOrderNumber;
        try {
            sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
        } catch (sanitizationError) {
            return createResponse(400, {
                code: 'INVALID_ORDER_NUMBER',
                message: sanitizationError.message
            });
        }

        const distributorId = event.user.sub;

        // Check for duplicate
        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppPurchaseOrders',
            FilterExpression: 'OrderNumber = :orderNumber AND DistributorId = :distributorId',
            ExpressionAttributeValues: {
                ':orderNumber': sanitizedOrderNumber,
                ':distributorId': distributorId
            }
        }));

        if (scanResult.Items && scanResult.Items.length > 0) {
            return createResponse(409, {
                code: 'DUPLICATE_ORDER',
                message: 'Order number already exists for this distributor'
            });
        }

        // Build simple item with store webhook fields
        const itemToSave = {
            OrderNumber: sanitizedOrderNumber,
            CreatedAt: new Date().toISOString(),
            Status: 'completed', // Store webhooks are completed purchases
            DistributorId: distributorId,
            Email: body.email.toLowerCase(),
            Source: body.source
        };

        // Add optional fields if provided
        if (body.customerName) {
            itemToSave.CustomerName = body.customerName;
        }

        if (body.amount) {
            itemToSave.Amount = body.amount;
        }

        if (body.offerTitle) {
            itemToSave.ProductName = body.offerTitle;
        }

        if (body.transactionId) {
            itemToSave.OriginalTransactionId = body.transactionId;
        }

        if (body.currency) {
            itemToSave.Currency = body.currency;
        }

        // Create the order
        await ddbDocClient.send(new PutCommand({
            TableName: 'AppPurchaseOrders',
            Item: itemToSave,
            ConditionExpression: 'attribute_not_exists(OrderNumber)'
        }));

        console.log('✅ Store webhook order created:', {
            orderNumber: sanitizedOrderNumber,
            email: body.email,
            source: body.source,
            amount: body.amount
        });

        return createResponse(200, {
            code: 'SUCCESS',
            message: 'Store webhook order created successfully',
            orderNumber: sanitizedOrderNumber,
            email: body.email,
            source: body.source,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in handleStoreWebhookOrder:', error);
        return handleLambdaError(error, 'handleStoreWebhookOrder');
    }
}
async function handleGetSubAppsForApp(event) {
    console.log("getSubAppsForApp called with:", {
        queryStringParameters: event.queryStringParameters,
        body: JSON.parse(event.body || '{}'),
        httpMethod: event.httpMethod
    });
    try {
        const appId = event.queryStringParameters?.appId;

        if (!appId) {
            return createResponse(400, {
                code: 'MISSING_APP_ID',
                message: 'App ID is required'
            });
        }

        // Query the mapping table for all SubAppIds for this AppId
        const queryResult = await ddbDocClient.send(new QueryCommand({
            TableName: 'AppSubAppMapping',
            KeyConditionExpression: 'AppId = :appId',
            ExpressionAttributeValues: {
                ':appId': appId
            }
        }));

        // Return the list of SubAppIds with their metadata
        return createResponse(200, queryResult.Items || []);
    } catch (error) {
        console.error('Error fetching SubApps for App:', error);
        return handleLambdaError(error, 'handleGetSubAppsForApp');
    }
}

async function handleVerifyAppPurchase(body) {
    console.log('Processing app purchase verification');
    try {
        // PRESERVED: Original validation - NO CHANGES
        if (!body.token || !body.appId || !body.email || !body.password) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Token, app ID, email, and password are required'
            });
        }

        // PRESERVED: Original token verification - NO CHANGES
        const tokenResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppPurchaseTokens',
            Key: { Token: body.token }
        }));

        if (!tokenResult.Item) {
            return createResponse(400, {
                code: 'INVALID_TOKEN',
                message: 'Invalid purchase token'
            });
        }

        // PRESERVED: Original token expiration check - NO CHANGES
        if (new Date(tokenResult.Item.ExpiresAt) < new Date()) {
            return createResponse(400, {
                code: 'TOKEN_EXPIRED',
                message: 'Purchase token has expired'
            });
        }

        // PRESERVED: Original token status verification - NO CHANGES
        if ((tokenResult.Item.LinkType === 'unique' && tokenResult.Item.Status !== 'pending') ||
            (tokenResult.Item.LinkType === 'generic' && tokenResult.Item.Status !== 'active')) {
            return createResponse(400, {
                code: 'INVALID_TOKEN_STATUS',
                message: 'Registration link is invalid or has already been used'
            });
        }

        // PRESERVED: Original date and status logic - NO CHANGES
        const purchaseDate = new Date().toISOString();
        let purchaseStatus = tokenResult.Item.LinkType === 'unique' ? 'active' : 'pending';

        // PRESERVED: Original order number validation logic - NO CHANGES
        if (tokenResult.Item.LinkType === 'generic' && body.orderNumber) {
            try {
                const sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);

                const existingUserScan = await ddbDocClient.send(new ScanCommand({
                    TableName: 'AppUsers',
                    FilterExpression: 'OrderNumber = :orderNumber AND DistributorId = :distributorId',
                    ExpressionAttributeValues: {
                        ':orderNumber': sanitizedOrderNumber,
                        ':distributorId': tokenResult.Item.DistributorId
                    }
                }));

                if (existingUserScan.Items && existingUserScan.Items.length > 0) {
                    return createResponse(400, {
                        code: 'ORDER_ALREADY_USED',
                        message: 'Order number has already been used for a purchase'
                    });
                }
            } catch (sanitizationError) {
                return createResponse(400, {
                    code: 'INVALID_ORDER_NUMBER',
                    message: sanitizationError.message
                });
            }
        }

        // 🟢 PUT THE DUPLICATE EMAIL CHECK HERE 🟢
        // (Right before the transaction items are built)

        // Get app configuration to check allowDuplicateEmails setting
        const appResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Apps',
            Key: { AppId: body.appId }
        }));

        if (appResult.Item && appResult.Item.allowDuplicateEmails === false) {
            console.log(`Checking for existing email registration - duplicates not allowed for app ${body.appId}`);

            const existingUserQuery = await ddbDocClient.send(new QueryCommand({
                TableName: 'AppUsers',
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'Email = :email AND AppId = :appId',
                ExpressionAttributeValues: {
                    ':email': body.email.toLowerCase(),
                    ':appId': body.appId
                }
            }));

            if (existingUserQuery.Items && existingUserQuery.Items.length > 0) {
                console.log(`Registration rejected - email ${body.email} already exists for app ${body.appId}`);
                return createResponse(409, {
                    code: 'EMAIL_ALREADY_REGISTERED',
                    message: 'This email is already registered for this application. Please log in instead.'
                });
            }
        }

        // NEW: ONLY addition - construct EmailSubAppId for new table structure
        const emailSubAppId = `${body.email}#${tokenResult.Item.SubAppId}`;

        // ENHANCED: Transaction with EmailSubAppId added to existing Item structure
        const transactItems = [
            {
                Put: {
                    TableName: 'AppUsers',
                    Item: {
                        AppId: body.appId,
                        EmailSubAppId: emailSubAppId, // NEW: Add composite key
                        Email: body.email, // PRESERVED: Keep for backward compatibility and GSI
                        Password: body.password,
                        Status: purchaseStatus,
                        CreatedAt: purchaseDate,
                        Token: body.token,
                        OrderNumber: body.orderNumber || null,
                        DistributorId: tokenResult.Item.DistributorId,
                        LinkType: tokenResult.Item.LinkType,
                        SubAppId: tokenResult.Item.SubAppId // PRESERVED: Already existed
                    },
                    // ENHANCED: Update condition to use new composite key
                    ConditionExpression: 'attribute_not_exists(AppId) AND attribute_not_exists(EmailSubAppId)'
                }
            }
        ];

        // PRESERVED: Original token update logic for unique links - NO CHANGES
        if (tokenResult.Item.LinkType === 'unique') {
            transactItems.push({
                Update: {
                    TableName: 'AppPurchaseTokens',
                    Key: { Token: body.token },
                    UpdateExpression: 'SET #status = :statusValue',
                    ExpressionAttributeNames: { '#status': 'Status' },
                    ExpressionAttributeValues: { ':statusValue': 'used' }
                }
            });
        }

        // PRESERVED: Original transaction execution - NO CHANGES
        await ddbDocClient.send(new TransactWriteCommand({
            TransactItems: transactItems
        }));

        // PRESERVED: Original success response - NO CHANGES
        return createResponse(200, {
            message: 'App registration successful',
            status: purchaseStatus,
            subAppId: tokenResult.Item.SubAppId
        });

    } catch (error) {
        console.error('Error processing app purchase:', error);
        return handleLambdaError(error, 'handleVerifyAppPurchase');
    }
}
async function handleGenerateEmailPurchaseToken(body, event) {
    console.log('Generating new email registration token', {
        receivedBody: body,
        distributorId: body.distributorId,
        hasAuth: !!event.headers.Authorization
    });

    try {
        if (!body.linkType || !body.appId || !body.distributorId || !body.subAppId || !body.source) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Link type, app ID, distributor ID, subApp ID, and source are required'
            });
        }

        const distributorId = event.user.sub;

        if (distributorId !== body.distributorId) {
            return createResponse(403, {
                code: 'FORBIDDEN',
                message: 'Cannot generate token for another distributor'
            });
        }

        // Get app info (COPIED FROM WORKING FUNCTION)
        const appResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Apps',
            Key: { AppId: body.appId }
        }));

        console.log('App lookup result:', {
            found: !!appResult.Item,
            status: appResult.Item?.Status
        });

        if (!appResult.Item || appResult.Item.Status !== 'active') {
            return createResponse(403, {
                code: 'APP_NOT_AVAILABLE',
                message: 'App is not currently available for purchase'
            });
        }

        // Verify the subAppId is valid for this app (COPIED FROM WORKING FUNCTION)
        console.log('Verifying SubAppId validity using AppSubAppMapping table');
        const mappingResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppSubAppMapping',
            Key: {
                AppId: body.appId,
                SubAppId: body.subAppId
            }
        }));

        if (!mappingResult.Item) {
            return createResponse(400, {
                code: 'INVALID_SUBAPP_ID',
                message: 'The provided SubApp ID is not valid for this application'
            });
        }

        // Verify the specific app is available for this distributor (COPIED FROM WORKING FUNCTION)
        const appDistributorResult = await ddbDocClient.send(new GetCommand({
            TableName: 'DistributorApps',
            Key: {
                DistributorId: body.distributorId,
                AppId: body.appId
            }
        }));

        if (!appDistributorResult.Item) {
            return createResponse(403, {
                code: 'APP_NOT_AUTHORIZED',
                message: 'Distributor is not authorized to sell this app'
            });
        }

        // Validate source (NEW FOR EMAIL)
        const validSources = ['kajabi', 'whop', 'stan'];
        if (!validSources.includes(body.source)) {
            return createResponse(400, {
                code: 'INVALID_SOURCE',
                message: 'Source must be one of: kajabi, whop, stan'
            });
        }

        // Generate token (SAME AS WORKING FUNCTION)
        const token = crypto.randomBytes(16).toString('hex');
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString();

        const tokenItem = {
            Token: token,
            CreatedAt: createdAt,
            ExpiresAt: expiresAt,
            LinkType: 'email', // CHANGED FOR EMAIL
            AppId: body.appId,
            SubAppId: body.subAppId,
            DistributorId: body.distributorId,
            Source: body.source, // NEW FOR EMAIL
            Status: 'active'
        };

        await ddbDocClient.send(new PutCommand({
            TableName: 'AppPurchaseTokens',
            Item: tokenItem
        }));

        console.log('Email registration token generated:', {
            token,
            appId: body.appId,
            subAppId: body.subAppId,
            source: body.source, // NEW
            distributorId: body.distributorId,
            linkType: 'email',
            status: tokenItem.Status
        });

        // SAME RESPONSE FORMAT AS WORKING FUNCTION
        return createResponse(200, {
            token,
            expiresAt,
            status: tokenItem.Status,
            appDomain: appResult.Item.AppDomain, // NOW DEFINED!
            subAppId: body.subAppId
        });

    } catch (error) {
        console.error('Error generating email registration token:', error);
        if (error.name === 'ValidationException') {
            return createResponse(400, {
                code: 'VALIDATION_ERROR',
                message: 'Invalid data format provided'
            });
        }
        return handleLambdaError(error, 'handleGenerateEmailPurchaseToken');
    }
}
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

async function verifyAuthToken(event) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
        return null;
    }
    const token = authHeader.replace('Bearer ', '');
    return verifyToken(token);
}

async function handleVerifyCredentials(body) {
    console.log('Processing verify credentials request');
    try {
        if (!body.email || !body.password) {
            return createResponse(400, {
                code: 'MISSING_CREDENTIALS',
                message: 'Email and password are required'
            });
        }

        let result;
        try {
            result = await ddbDocClient.send(new QueryCommand({
                TableName: 'Distributors',
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'Email = :email',
                ExpressionAttributeValues: {
                    ':email': body.email
                }
            }));
        } catch (dbError) {
            console.error('Database query failed:', dbError);
            return handleLambdaError({
                name: 'DatabaseQueryError',
                message: 'Failed to query distributor data',
                cause: dbError,
                code: 'DATABASE_ERROR'
            }, 'handleVerifyCredentials.query');
        }

        if (!result.Items || result.Items.length === 0) {
            return createResponse(401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        const distributor = result.Items[0];

        // Add specific error if distributor object is malformed
        if (!distributor.Password) {
            return handleLambdaError({
                name: 'DataIntegrityError',
                message: 'Distributor record is missing required fields'
            }, 'handleVerifyCredentials.validation');
        }

        const passwordValid = distributor.Password === body.password;

        if (!passwordValid) {
            return createResponse(401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        if (distributor.Status !== 'active' && distributor.Status !== 'pending') {
            return createResponse(403, {
                code: 'ACCOUNT_INACTIVE',
                message: 'Account is not active'
            });
        }

        try {
            const token = generateToken(distributor);
            console.log('Login successful for user:', distributor.Email);

            return createResponse(200, {
                token,
                user: {
                    email: distributor.Email,
                    distributorName: distributor.DistributorName,
                    status: distributor.Status,
                    role: distributor.Role
                }
            });
        } catch (tokenError) {
            return handleLambdaError({
                name: 'TokenGenerationError',
                message: 'Failed to generate authentication token',
                cause: tokenError
            }, 'handleVerifyCredentials.token');
        }

    } catch (error) {
        return handleLambdaError(error, 'handleVerifyCredentials');
    }
}
async function handleVerifyToken(event) {
    console.log('Processing verify token request');
    try {
        const authHeader = event.headers.Authorization || event.headers.authorization;
        if (!authHeader) {
            console.log('No authorization header present');
            return createResponse(401, {
                code: 'MISSING_AUTH_HEADER',
                message: 'No authorization header'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = verifyToken(token);

        if (!decoded) {
            console.log('Invalid token provided');
            return createResponse(401, {
                code: 'INVALID_TOKEN',
                message: 'Invalid token'
            });
        }

        const userResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Distributors',
            Key: { DistributorId: decoded.sub }
        }));

        if (!userResult.Item) {
            console.log('User no longer exists:', decoded.sub);
            return createResponse(401, { message: 'User no longer exists' });
        }

        if (userResult.Item.Status !== 'active') {
            console.log('User account not active:', decoded.sub);
            return createResponse(401, { message: 'User account is not active' });
        }

        console.log('Token successfully verified for user:', decoded.email);
        return createResponse(200, { valid: true, user: decoded });
    } catch (error) {
        console.error('Error verifying token:', error);
        return createResponse(500, { message: 'Error verifying token', error: error.message });
    }
}

const checkPasswordResetRateLimit = async (email) => {
    const rateLimitKey = `ratelimit:${email}:passwordReset:${new Date().toISOString().slice(0, 13)}`;

    try {
        // Store rate limit records in the same table but with a unique id pattern
        const rateLimitItem = await ddbDocClient.send(new GetCommand({
            TableName: USERS_TABLE,
            Key: { id: rateLimitKey }
        }));

        const currentAttempts = rateLimitItem.Item ? rateLimitItem.Item.attempts : 0;

        if (currentAttempts >= MAX_RESET_ATTEMPTS_PER_HOUR) {
            return { allowed: false, attempts: currentAttempts };
        }

        await ddbDocClient.send(new PutCommand({
            TableName: USERS_TABLE,
            Item: {
                id: rateLimitKey,
                email: email,
                attempts: currentAttempts + 1,
                type: 'rateLimit',
                ttl: Math.floor(Date.now() / 1000) + 3600
            }
        }));

        return { allowed: true, attempts: currentAttempts + 1 };
    } catch (error) {
        console.error('Rate limit check error:', error);
        return { allowed: true, attempts: 0 };
    }
};

const findUserByEmail = async (email) => {
    try {
        // Your table uses 'id' as primary key, so we need to scan by email
        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: 'Email = :email',
            ExpressionAttributeValues: { ':email': email.toLowerCase() },
            Limit: 1
        }));

        return scanResult.Items && scanResult.Items.length > 0 ? scanResult.Items[0] : null;
    } catch (error) {
        console.error('User lookup error:', error);
        throw new Error('Database query failed');
    }
};

const getPasswordResetEmailTemplate = (resetUrl) => ({
    subject: 'Password Reset Request',
    html: `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
          <p>This link expires in ${TOKEN_EXPIRY_HOURS} hour(s).</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      </body>
    </html>
  `
});

// 6. ADD these three handler functions (before exports.handler):

async function handleSendPasswordReset(body) {
    try {
        const { email, resetToken, tokenExpiry, resetUrl } = body;

        if (!email || !resetToken || !resetUrl) {
            return createResponse(400, {
                code: 'MISSING_FIELDS',
                message: 'Email, token, and reset URL are required'
            });
        }

        const rateLimit = await checkPasswordResetRateLimit(email);
        if (!rateLimit.allowed) {
            return createResponse(429, {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many reset attempts. Please try again later.'
            });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return createResponse(200, {
                message: 'If the email exists, a reset link has been sent'
            });
        }

        await ddbDocClient.send(new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { id: user.id },
            UpdateExpression: 'SET resetToken = :token, resetTokenExpiry = :expiry',
            ExpressionAttributeValues: {
                ':token': resetToken,
                ':expiry': tokenExpiry
            }
        }));

        const template = getPasswordResetEmailTemplate(resetUrl);
        await ses.sendEmail({
            Source: FROM_EMAIL,
            Destination: { ToAddresses: [email] },
            Message: {
                Subject: { Data: template.subject },
                Body: { Html: { Data: template.html } }
            }
        }).promise();

        return createResponse(200, { message: 'Password reset email sent' });

    } catch (error) {
        console.error('Send password reset error:', error);
        return handleLambdaError(error, 'handleSendPasswordReset');
    }
}

async function handleVerifyResetToken(body) {
    try {
        const { email, resetToken } = body;

        if (!email || !resetToken) {
            return createResponse(400, {
                code: 'MISSING_FIELDS',
                message: 'Email and token are required'
            });
        }

        const user = await findUserByEmail(email);
        if (!user || !user.resetToken || user.resetToken !== resetToken) {
            return createResponse(400, {
                code: 'INVALID_TOKEN',
                message: 'Invalid token'
            });
        }

        if (Date.now() > user.resetTokenExpiry) {
            return createResponse(400, {
                code: 'TOKEN_EXPIRED',
                message: 'Token has expired'
            });
        }

        return createResponse(200, { valid: true });

    } catch (error) {
        console.error('Verify token error:', error);
        return handleLambdaError(error, 'handleVerifyResetToken');
    }
}

async function handleResetPassword(body) {
    try {
        const { email, resetToken, newPasswordHash } = body;

        if (!email || !resetToken || !newPasswordHash) {
            return createResponse(400, {
                code: 'MISSING_FIELDS',
                message: 'Email, token, and password hash are required'
            });
        }

        const verificationResult = await handleVerifyResetToken({ email, resetToken });
        if (verificationResult.statusCode !== 200) {
            return verificationResult;
        }

        // Get user again to have the id for the update
        const user = await findUserByEmail(email);
        if (!user) {
            return createResponse(400, {
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            });
        }

        await ddbDocClient.send(new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { id: user.id },
            UpdateExpression: 'SET password = :password, passwordUpdatedAt = :updatedAt REMOVE resetToken, resetTokenExpiry',
            ExpressionAttributeValues: {
                ':password': newPasswordHash,
                ':updatedAt': new Date().toISOString()
            }
        }));

        return createResponse(200, { message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        return handleLambdaError(error, 'handleResetPassword');
    }
}


exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    let currentAction = '';

    try {
        const action = event.queryStringParameters?.action;
        currentAction = action;

        if (!action) {
            return createResponse(400, {
                code: 'MISSING_ACTION',
                message: 'Missing action parameter'
            });
        }

        const config = actionConfig[action];
        if (!config) {
            return createResponse(400, {
                code: 'INVALID_ACTION',
                message: 'Invalid action parameter'
            });
        }

        let decodedToken;
        // Auth check for non-public actions
        if (!config.public) {
            decodedToken = await verifyAuthToken(event);
            if (!decodedToken) {
                return createResponse(401, {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                });
            }

            // Role check
            if (config.role && decodedToken.role !== config.role) {
                return createResponse(403, {
                    code: 'FORBIDDEN',
                    message: `This action requires ${config.role} role`
                });
            }
        }

        let body = {};
        if (event.httpMethod === 'POST') {
            try {
                body = JSON.parse(event.body || '{}');
            } catch (error) {
                return createResponse(400, {
                    code: 'INVALID_JSON',
                    message: 'Invalid JSON in request body'
                });
            }
        }

        // Attach auth info to event if authenticated
        if (decodedToken) {
            event.user = decodedToken;
        }

        // Handle actions
        switch (action) {
            // Public actions
            case 'verifyEmail':
                return await handleVerifyEmail(body);
            case 'verifyCredentials':
                return await handleVerifyCredentials(body);
            case 'verifyAppPurchase':
                return await handleVerifyAppPurchase(body);
            case 'registerDistributor':
                return await handleRegisterDistributor(body);
            case 'verifyToken':
                return await handleVerifyToken(event);
            case 'appLogin':
                return await handleAppLogin(body);
            case 'getPublicSubappInfo':
                return await handleGetPublicSubappInfo(event);

            case 'sendPasswordReset':
                return await handleSendPasswordReset(body);
            case 'verifyResetToken':
                return await handleVerifyResetToken(body);
            case 'resetPassword':
                return await handleResetPassword(body);

            // Owner actions
            case 'syncOrdersAndDistributors':
                return await handleSyncOrdersAndDistributors(event);
            case 'getDistributors':
                return await handleFetchPendingDistributors(event);
            case 'getIncomingOrders':
                return await handleFetchIncomingOrders(event);
            case 'bulkInsertOrders':
                return await handleBulkInsertOrders(body, event);
            case 'updateDistributor':
                return await handleUpdateDistributor(body, event);
            case 'generateToken':
                return await handleGenerateToken(body, event);
            case 'insertOrder':
                return await handleInsertOrder(body, event);

            // Distributor actions
            case 'syncAppUsers':
                return await handleSyncAppUsers(event);
            case 'getPendingAppUsers':
                return await handleGetPendingAppUsers(event);
            case 'fetchAvailableApps':
                return await handleFetchAvailableApps(event);
            case 'generatePurchaseToken':
                return await handleGenerateAppPurchaseToken(body, event);
            case 'generateEmailPurchaseToken':
                return await handleGenerateEmailPurchaseToken(body, event);
            case 'insertAppPurchaseOrder':
                return await handleInsertAppPurchaseOrder(body, event);
            case 'insertStoreWebhookOrder':
                return await handleStoreWebhookOrder(body, event);
            case 'getAppPurchaseOrders':
                return await handleFetchAppPurchaseOrders(event);
            case 'updateAppUser':
                return await handleUpdateAppUser(body, event);
            case 'bulkInsertAppPurchaseOrder':
                return await handleBulkInsertAppPurchaseOrder(body, event);
            case 'getSubAppsForApp':
                return await handleGetSubAppsForApp(event);

            default:
                return createResponse(400, {
                    code: 'INVALID_ACTION',
                    message: 'Invalid action'
                });
        }
    } catch (error) {
        return handleLambdaError(error, currentAction);
    }
};

async function handleBulkInsertAppPurchaseOrder(body, event) {
    console.log('Processing bulk insert app purchase order request');
    try {
        if (!body.orderNumbers || !Array.isArray(body.orderNumbers)) {
            return createResponse(400, {
                code: 'MISSING_ORDER_NUMBERS',
                message: 'Array of order numbers is required'
            });
        }

        const distributorId = event.user.sub;
        const results = {
            successful: [],
            failed: [],
            duplicates: []
        };

        // Process each order number through the same sanitization as single orders
        const sanitizedOrders = await Promise.all(body.orderNumbers.map(async (orderNumber) => {
            try {
                const sanitized = sanitizeOrderNumber(orderNumber);

                // Check for duplicate using same logic as single insert
                const existingOrder = await ddbDocClient.send(new ScanCommand({
                    TableName: 'AppPurchaseOrders',
                    FilterExpression: 'OrderNumber = :orderNumber AND DistributorId = :distributorId',
                    ExpressionAttributeValues: {
                        ':orderNumber': sanitized,
                        ':distributorId': distributorId
                    }
                }));

                if (existingOrder.Items && existingOrder.Items.length > 0) {
                    return {
                        orderNumber: sanitized,
                        isDuplicate: true
                    };
                }

                return {
                    orderNumber: sanitized,
                    isDuplicate: false
                };
            } catch (error) {
                return {
                    orderNumber,
                    isError: true,
                    error: error.message
                };
            }
        }));

        // Categorize orders based on validation results
        for (const order of sanitizedOrders) {
            if (order.isError) {
                results.failed.push({
                    orderNumber: order.orderNumber,
                    reason: order.error
                });
            } else if (order.isDuplicate) {
                results.duplicates.push({
                    orderNumber: order.orderNumber,
                    reason: 'Order number already exists for this distributor'
                });
            } else {
                results.successful.push({
                    orderNumber: order.orderNumber,
                    status: 'pending'
                });
            }
        }

        // Insert valid orders in batches
        if (results.successful.length > 0) {
            const batchSize = 25; // DynamoDB limit
            for (let i = 0; i < results.successful.length; i += batchSize) {
                const batch = results.successful.slice(i, i + batchSize);
                const putRequests = batch.map(({ orderNumber }) => ({
                    PutRequest: {
                        Item: {
                            OrderNumber: orderNumber,
                            DistributorId: distributorId,
                            CreatedAt: new Date().toISOString(),
                            Status: 'pending'
                        }
                    }
                }));

                try {
                    await ddbDocClient.send(new BatchWriteCommand({
                        RequestItems: {
                            'AppPurchaseOrders': putRequests
                        }
                    }));
                } catch (error) {
                    console.error('Error inserting batch:', error);
                    // Move failed batch items to failed results
                    batch.forEach(({ orderNumber }) => {
                        const indexInSuccess = results.successful.findIndex(
                            s => s.orderNumber === orderNumber
                        );
                        if (indexInSuccess !== -1) {
                            results.successful.splice(indexInSuccess, 1);
                            results.failed.push({
                                orderNumber,
                                reason: 'Database insertion failed'
                            });
                        }
                    });
                }
            }
        }

        // Prepare response message
        const message = `Processed ${body.orderNumbers.length} orders: ` +
            `${results.successful.length} inserted successfully, ` +
            `${results.duplicates.length} duplicates skipped, ` +
            `${results.failed.length} failed.`;

        return createResponse(200, {
            code: 'SUCCESS',
            message,
            results
        });

    } catch (error) {
        console.error('Error in bulk insert app purchase orders:', error);
        return handleLambdaError(error, 'handleBulkInsertAppPurchaseOrder');
    }
}

function handleLambdaError(error, context = '') {
    console.error(`Error in ${context}:`, error);

    // JWT specific errors
    if (error.name === 'JsonWebTokenError') {
        return createResponse(401, {
            code: 'INVALID_TOKEN',
            message: 'Invalid or malformed JWT token'
        });
    }
    if (error.name === 'TokenExpiredError') {
        return createResponse(401, {
            code: 'TOKEN_EXPIRED',
            message: 'JWT token has expired'
        });
    }
    if (error.name === 'TokenGenerationError') {
        return createResponse(500, {
            code: 'TOKEN_GENERATION_FAILED',
            message: 'Failed to generate authentication token'
        });
    }

    // Database errors
    if (error.name === 'DatabaseQueryError') {
        return createResponse(500, {
            code: 'DATABASE_ERROR',
            message: 'Database operation failed'
        });
    }
    if (error.name === 'DataIntegrityError') {
        return createResponse(500, {
            code: 'DATA_INTEGRITY_ERROR',
            message: 'Data integrity issue detected'
        });
    }
    if (error.name === 'ConditionalCheckFailedException') {
        return createResponse(409, {
            code: 'CONDITION_FAILED',
            message: 'Database condition check failed'
        });
    }
    if (error.name === 'ValidationException') {
        return createResponse(400, {
            code: 'VALIDATION_ERROR',
            message: 'Invalid data format or missing required fields'
        });
    }
    if (error.name === 'ResourceNotFoundException') {
        return createResponse(404, {
            code: 'RESOURCE_NOT_FOUND',
            message: 'The requested resource was not found'
        });
    }
    if (error.name === 'TransactionCanceledException') {
        return createResponse(409, {
            code: 'TRANSACTION_CANCELED',
            message: 'Database transaction was canceled'
        });
    }
    if (error.name === 'ProvisionedThroughputExceededException') {
        return createResponse(429, {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
        });
    }

    // Check for AWS SDK errors
    if (error.name === 'ServiceError' || error.$metadata?.httpStatusCode) {
        return createResponse(500, {
            code: 'AWS_SERVICE_ERROR',
            message: 'AWS service error occurred',
            details: error.message
        });
    }

    // Authentication specific errors
    if (error.message?.toLowerCase().includes('unauthorized')) {
        return createResponse(401, {
            code: 'UNAUTHORIZED',
            message: 'Authentication required or failed'
        });
    }
    if (error.message?.toLowerCase().includes('forbidden')) {
        return createResponse(403, {
            code: 'FORBIDDEN',
            message: 'Access denied to requested resource'
        });
    }

    // Generic error handler with specific codes
    return createResponse(500, {
        code: error.code || 'INTERNAL_SERVER_ERROR', // Changed from 'UNKNOWN'
        message: error.message || 'An unexpected error occurred',
        error: error.message,
        details: {
            context,
            errorName: error.name,
            errorCode: error.code,
            stack: error.stack
        }
    });
}
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

async function handleUpdateDistributor(body) {
    try {
        if (!body.distributorId) {
            return createResponse(400, {
                code: 'MISSING_DISTRIBUTOR_ID',
                message: 'Distributor ID is required'
            });
        }

        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};

        // Map of fields that can be updated
        const updatableFields = {
            email: 'Email',
            distributorName: 'DistributorName',
            companyName: 'CompanyName',
            status: 'Status',
            username: 'Username'
        };

        // Build update expression for each field that has a value
        Object.entries(updatableFields).forEach(([key, dbField]) => {
            if (body[key] !== undefined) {
                updateExpressions.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = dbField;
                expressionAttributeValues[`:${key}`] = body[key];
            }
        });

        if (updateExpressions.length === 0) {
            return createResponse(400, { message: 'No fields to update' });
        }

        // If email is being updated, check for uniqueness
        if (body.email) {
            const existingEmailCheck = await ddbDocClient.send(new QueryCommand({
                TableName: 'Distributors',
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'Email = :email',
                ExpressionAttributeValues: {
                    ':email': body.email
                }
            }));

            if (existingEmailCheck.Items?.length > 0 &&
                existingEmailCheck.Items[0].DistributorId !== body.distributorId) {
                return createResponse(400, { message: 'Email already registered to another distributor' });
            }
        }

        // Update the distributor
        await ddbDocClient.send(new UpdateCommand({
            TableName: 'Distributors',
            Key: {
                DistributorId: body.distributorId
            },
            UpdateExpression: 'SET ' + updateExpressions.join(', '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }));

        return createResponse(200, {
            message: 'Distributor updated successfully',
            distributorId: body.distributorId
        });
    } catch (error) {
        console.error('Error updating distributor:', error);
        return createResponse(500, { message: 'Error updating distributor', error: error.message });
    }
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
            return createResponse(409, {
                code: 'DUPLICATE_ORDER',
                message: 'Order number already exists'
            });
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
            return createResponse(400, {
                code: 'MISSING_LINK_TYPE',
                message: 'Link type is required'
            });
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
        if (!body.token || !body.username || !body.email || !body.password || !body.distributorName || !body.companyName) {
            return createResponse(400, { message: 'Missing required fields' });
        }

        // Check for existing email using the GSI
        const existingEmailCheck = await ddbDocClient.send(new QueryCommand({
            TableName: 'Distributors',
            IndexName: 'EmailIndex',
            KeyConditionExpression: 'Email = :email',
            ExpressionAttributeValues: {
                ':email': body.email
            }
        }));

        if (existingEmailCheck.Items && existingEmailCheck.Items.length > 0) {
            return createResponse(400, { message: 'Email already registered' });
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
            Email: body.email,
            Password: body.password, // Store plain password
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

        const transactItems = [{
            Put: {
                TableName: 'Distributors',
                Item: distributorItem,
                ConditionExpression: 'attribute_not_exists(Email)'
            }
        }];

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

        // After the successful transaction that creates the distributor, add:
        const appsResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'Apps',
            FilterExpression: '#status = :activeStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':activeStatus': 'active' }
        }));

        if (appsResult.Items && appsResult.Items.length > 0) {
            const batchSize = 25; // DynamoDB limit
            const appAssignments = appsResult.Items.map(app => ({
                Put: {
                    TableName: 'DistributorApps',
                    Item: {
                        DistributorId: distributorId,
                        AppId: app.AppId,
                        CreatedAt: new Date().toISOString(),
                        Status: 'active',
                        CommissionRate: 0.3  // Default commission rate
                    }
                }
            }));

            // Process in batches due to DynamoDB limits
            for (let i = 0; i < appAssignments.length; i += batchSize) {
                const batch = appAssignments.slice(i, i + batchSize);
                await ddbDocClient.send(new TransactWriteCommand({
                    TransactItems: batch
                }));
            }
        }

        console.log('Successfully registered distributor');
        return createResponse(200, { message: 'Distributor registered successfully' });
    } catch (error) {
        console.error('Error registering distributor:', error);
        if (error.name === 'TransactionCanceledException') {
            if (error.message.includes('ConditionalCheckFailed')) {
                return createResponse(409, { message: 'Email already registered' });
            }
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

        const transactItems = [];

        for (const order of pendingOrdersResult.Items) {
            const matchingDistributor = pendingDistributorsResult.Items.find(
                distributor => distributor.OrderNumber === order.OrderNumber
            );

            if (matchingDistributor) {
                transactItems.push({
                    Update: {
                        TableName: 'IncomingOrders',
                        Key: { OrderNumber: order.OrderNumber },
                        UpdateExpression: 'SET #status = :usedStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':usedStatus': 'used' }
                    }
                });

                transactItems.push({
                    Update: {
                        TableName: 'Distributors',
                        Key: { DistributorId: matchingDistributor.DistributorId },
                        UpdateExpression: 'SET #status = :activeStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':activeStatus': 'active' }
                    }
                });

                if (transactItems.length === 25) {  // DynamoDB limit of 25 items per transaction
                    await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
                    transactItems.length = 0;  // Clear the array
                }
            }
        }

        if (transactItems.length > 0) {
            await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
        }

        return createResponse(200, { message: `Sync completed. Updated ${transactItems.length / 2} pairs.` });
    } catch (error) {
        console.error('Error syncing orders and distributors:', error);
        return createResponse(500, { message: 'Error syncing orders and distributors', error: error.message });
    }
}
async function handleFetchIncomingOrders(event) {
    try {
        console.log('Fetching incoming orders');
        const { orderFilter, dateFilter, statusFilter } = event.queryStringParameters || {};

        let filterExpression = [];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {};

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (dateFilter) {
            filterExpression.push('begins_with(CreatedAt, :dateFilter)');
            expressionAttributeValues[':dateFilter'] = dateFilter;
        }

        if (statusFilter) {
            filterExpression.push('#status = :statusFilter');
            expressionAttributeNames['#status'] = 'Status';
            expressionAttributeValues[':statusFilter'] = statusFilter;
        }

        const scanParams = {
            TableName: 'IncomingOrders',
            FilterExpression: filterExpression.length > 0 ? filterExpression.join(' AND ') : undefined,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined
        };

        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

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
        const { nameFilter, emailFilter, orderFilter, statusFilter, linkTypeFilter } = event.queryStringParameters || {};

        let filterExpression = [];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {};

        if (nameFilter) {
            filterExpression.push('contains(#distributorName, :nameFilter)');
            expressionAttributeNames['#distributorName'] = 'DistributorName';
            expressionAttributeValues[':nameFilter'] = nameFilter;
        }

        if (emailFilter) {
            filterExpression.push('contains(Email, :emailFilter)');
            expressionAttributeValues[':emailFilter'] = emailFilter;
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

async function handleGetPublicSubappInfo(event) {
    console.log("getPublicSubappInfo called with:", {
        body: JSON.parse(event.body || '{}')
    });

    try {
        const body = JSON.parse(event.body || '{}');
        const { appId, subappId } = body;

        if (!appId || !subappId) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'App ID and SubApp ID are required'
            });
        }

        // Get the subapp metadata from the mapping table
        const result = await ddbDocClient.send(new GetCommand({
            TableName: 'AppSubAppMapping',
            Key: {
                AppId: appId,
                SubAppId: subappId
            }
        }));

        if (!result.Item) {
            return createResponse(404, {
                code: 'SUBAPP_NOT_FOUND',
                message: 'SubApp not found'
            });
        }

        // Return the subapp information
        return createResponse(200, {
            status: true,
            subappName: result.Item.SubAppName || result.Item.subappName,
            description: result.Item.Description || result.Item.description
        });
    } catch (error) {
        console.error('Error fetching public subapp info:', error);
        return handleLambdaError(error, 'handleGetPublicSubappInfo');
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
        headers: {
            ...headers,
            // Add only new headers that weren't in the original headers constant
            'Surrogate-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        },
        body: JSON.stringify(body),
    };
}