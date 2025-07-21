// Enhanced handleVerifyAppPurchase to support marketplace purchases
async function handleVerifyAppPurchase(body) {
    console.log('Processing app purchase verification with marketplace support');
    try {
        if (!body.token || !body.appId || !body.email || !body.password) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Token, app ID, email, and password are required'
            });
        }

        // Get the registration token info
        const tokenResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppPurchaseTokens',
            Key: { Token: body.token }
        }));

        if (!tokenResult.Item) {
            return createResponse(400, {
                code: 'INVALID_TOKEN',
                message: 'Invalid registration token'
            });
        }

        const tokenData = tokenResult.Item;
        let purchaseStatus = 'pending';
        let purchaseValidated = false;

        // Check for marketplace purchase validation
        if (body.marketplacePurchaseId) {
            // Validate marketplace purchase
            const marketplacePurchase = await validateMarketplacePurchase({
                purchaseId: body.marketplacePurchaseId,
                email: body.email,
                appId: body.appId,
                subAppId: tokenData.SubAppId
            });

            if (marketplacePurchase.valid) {
                purchaseStatus = 'active';
                purchaseValidated = true;
                console.log('Marketplace purchase validated:', body.marketplacePurchaseId);
            }
        }

        // Fall back to existing order number validation for generic links
        if (!purchaseValidated && tokenData.LinkType === 'generic' && body.orderNumber) {
            try {
                const sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);

                // Check existing order validation logic
                const orderValidation = await validateOrderNumber(sanitizedOrderNumber, tokenData.DistributorId);
                if (orderValidation.valid) {
                    purchaseStatus = 'active';
                    purchaseValidated = true;
                }
            } catch (error) {
                console.log('Order number validation failed:', error.message);
            }
        }

        // For unique links, immediate activation
        if (tokenData.LinkType === 'unique') {
            purchaseStatus = 'active';
            purchaseValidated = true;
        }

        const registrationDate = new Date().toISOString();

        // Create the app user with proper attribution
        const appUser = {
            AppId: body.appId,
            Email: body.email,
            Password: body.password,
            Status: purchaseStatus,
            CreatedAt: registrationDate,
            Token: body.token,
            DistributorId: tokenData.DistributorId, // Maintains existing attribution
            LinkType: tokenData.LinkType,
            SubAppId: tokenData.SubAppId,
            // Add marketplace attribution if applicable
            ...(body.marketplacePurchaseId && {
                MarketplacePurchaseId: body.marketplacePurchaseId,
                PurchaseSource: 'marketplace'
            }),
            // Add order number if provided (existing flow)
            ...(body.orderNumber && {
                OrderNumber: body.orderNumber,
                PurchaseSource: 'order_number'
            })
        };

        const transactItems = [
            {
                Put: {
                    TableName: 'AppUsers',
                    Item: appUser,
                    ConditionExpression: 'attribute_not_exists(AppId) AND attribute_not_exists(Email)'
                }
            }
        ];

        // Update token status for unique links (existing logic)
        if (tokenData.LinkType === 'unique') {
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

        await ddbDocClient.send(new TransactWriteCommand({
            TransactItems: transactItems
        }));

        // Record commission for distributor (enhanced for marketplace)
        if (purchaseValidated) {
            await recordDistributorCommission({
                distributorId: tokenData.DistributorId,
                appId: body.appId,
                subAppId: tokenData.SubAppId,
                userId: body.email,
                purchaseSource: body.marketplacePurchaseId ? 'marketplace' : 'direct',
                amount: body.purchaseAmount || 0
            });
        }

        return createResponse(200, {
            message: 'App registration successful',
            status: purchaseStatus,
            subAppId: tokenData.SubAppId,
            distributorId: tokenData.DistributorId // Confirms attribution maintained
        });

    } catch (error) {
        console.error('Error processing app purchase:', error);
        return handleLambdaError(error, 'handleVerifyAppPurchase');
    }
}

// New function to validate marketplace purchases
async function validateMarketplacePurchase({ purchaseId, email, appId, subAppId }) {
    try {
        // Check if we have a pre-validated marketplace purchase
        const purchaseResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'MarketplacePurchases',
            FilterExpression: 'PurchaseId = :purchaseId AND CustomerEmail = :email AND AppId = :appId',
            ExpressionAttributeValues: {
                ':purchaseId': purchaseId,
                ':email': email,
                ':appId': appId
            }
        }));

        if (purchaseResult.Items && purchaseResult.Items.length > 0) {
            const purchase = purchaseResult.Items[0];

            // Check if purchase is still valid (not expired)
            if (new Date(purchase.ExpiresAt) > new Date()) {
                return {
                    valid: true,
                    purchase: purchase,
                    amount: purchase.Amount,
                    currency: purchase.Currency
                };
            }
        }

        return { valid: false, reason: 'Purchase not found or expired' };
    } catch (error) {
        console.error('Error validating marketplace purchase:', error);
        return { valid: false, reason: 'Validation error' };
    }
}

// Enhanced webhook handler to create pre-validated purchases
async function handleMarketplaceWebhook(event, platform) {
    try {
        const purchaseData = extractPurchaseData(event.body, platform);

        // Extract App Manager token from purchase metadata
        const appManagerToken = purchaseData.metadata?.app_manager_token;
        if (!appManagerToken) {
            console.log('No App Manager token found in purchase metadata');
            return createResponse(200, { message: 'No token to process' });
        }

        // Get token info to determine app and distributor
        const tokenResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppPurchaseTokens',
            Key: { Token: appManagerToken }
        }));

        if (!tokenResult.Item) {
            console.log('Invalid App Manager token in purchase:', appManagerToken);
            return createResponse(400, { message: 'Invalid token' });
        }

        // Create pre-validated purchase record
        const marketplacePurchase = {
            PurchaseId: `${platform}_${purchaseData.id}`,
            CustomerEmail: purchaseData.customerEmail,
            AppId: tokenResult.Item.AppId,
            SubAppId: tokenResult.Item.SubAppId,
            DistributorId: tokenResult.Item.DistributorId,
            Amount: purchaseData.amount,
            Currency: purchaseData.currency,
            Platform: platform,
            Status: 'paid',
            CreatedAt: new Date().toISOString(),
            ExpiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(), // 7 days to register
            AppManagerToken: appManagerToken
        };

        await ddbDocClient.send(new PutCommand({
            TableName: 'MarketplacePurchases',
            Item: marketplacePurchase
        }));

        console.log(`Pre-validated purchase created for ${purchaseData.customerEmail}`);
        return createResponse(200, { message: 'Purchase pre-validated' });

    } catch (error) {
        console.error('Error processing marketplace webhook:', error);
        return createResponse(500, { message: 'Webhook processing failed' });
    }
}

function extractPurchaseData(webhookBody, platform) {
    const data = JSON.parse(webhookBody);

    if (platform === 'whop') {
        return {
            id: data.data.id,
            customerEmail: data.data.customer_email,
            amount: data.data.amount / 100, // Convert from cents
            currency: data.data.currency,
            metadata: data.data.metadata
        };
    } else if (platform === 'stanstore') {
        return {
            id: data.data.id,
            customerEmail: data.data.customer_email,
            amount: data.data.total_amount,
            currency: data.data.currency,
            metadata: data.data.custom_fields?.reduce((acc, field) => {
                acc[field.name] = field.value;
                return acc;
            }, {}) || {}
        };
    }

    throw new Error(`Unsupported platform: ${platform}`);
}