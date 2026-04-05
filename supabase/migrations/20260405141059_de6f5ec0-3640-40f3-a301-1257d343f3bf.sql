UPDATE businesses 
SET subscription_status = 'inactive', 
    stripe_customer_id = NULL, 
    stripe_subscription_id = NULL 
WHERE id IN ('8f54c77d-1d53-49c1-967b-3f7327912299', '7dc94100-0e96-4eeb-8f01-ec0945556c29');