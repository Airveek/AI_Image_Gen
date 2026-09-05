# Stripe Billing Setup

Use this guide to connect Stripe to Airveek.

## 1. Create Stripe prices

In Stripe Dashboard, enable **Test mode** first.

Go to **More → Product catalogue** and create these products and prices:

| Product | Price | Billing |
|---|---:|---|
| Airveek Commercial | $49 USD | One time |
| Airveek Commercial | $49 USD | Monthly recurring |
| Airveek Premium | $147 USD | One time |
| Airveek Premium | $147 USD | Monthly recurring |

Copy the `price_...` ID for every price.

## 2. Get the Stripe secret key

Go to **Developers → API keys** and copy the Secret key.

Use the test key while testing:

```env
STRIPE_SECRET_KEY=sk_test_...
```

Use the live key only for production.

## 3. Create the Stripe webhook

Go to **Developers → Webhooks → Add endpoint**.

Endpoint URL:

```text
https://YOUR_DOMAIN.com/api/webhooks/stripe
```

Select these events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
payment_intent.succeeded
invoice.paid
invoice.payment_failed
refund.created
refund.updated
charge.dispute.created
charge.dispute.closed
```

Open the new endpoint, click **Reveal signing secret**, and copy it:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 4. Fill the environment variables

Add these to the server environment. Do not use `NEXT_PUBLIC_` for any of them.

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_COMMERCIAL_ONE_TIME_PRICE_ID=price_...
STRIPE_PREMIUM_ONE_TIME_PRICE_ID=price_...
STRIPE_COMMERCIAL_SUBSCRIPTION_PRICE_ID=price_...
STRIPE_PREMIUM_SUBSCRIPTION_PRICE_ID=price_...
```

The names mean:

- `COMMERCIAL_ONE_TIME`: Commercial $49 paid once.
- `PREMIUM_ONE_TIME`: Premium $147 paid once.
- `COMMERCIAL_SUBSCRIPTION`: Commercial $49 every month.
- `PREMIUM_SUBSCRIPTION`: Premium $147 every month.

## 5. Configure the customer portal

In Stripe, open **Settings → Billing → Customer portal** and enable the portal. This lets users manage payment methods and subscriptions.

## 6. Switch the provider in Airveek

After deploying the environment variables:

1. Open **Admin → Integrations**.
2. Select **Stripe**.
3. Select **Monthly subscription** or **One-time payment**.
4. Click **Save and activate**.

Airveek checks the Stripe prices before activating the switch. It checks the price amount, currency, active state, and billing type.

The switch affects new checkouts only. Existing Whop or Stripe access remains active.

## 7. Go live

Before production:

1. Switch Stripe to live mode.
2. Create the same four live prices.
3. Create a live webhook endpoint.
4. Replace the test key, webhook secret, and price IDs with live values.
5. Test one Commercial checkout and one Premium checkout.

Never commit secret keys or webhook secrets to Git.
