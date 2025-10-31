# Credits System (Future Feature)

## Current Status

**NOT IMPLEMENTED** - Mentioned on landing page but doesn't exist in codebase.

## Decision Needed

**Option A:** Remove all credit mentions from landing page (simpler)
**Option B:** Implement full credits system (complex, requires payment integration)

---

## If Implementing: Full Plan

### Database Schema

```sql
-- User credits
CREATE TABLE user_credits (
  user_id TEXT PRIMARY KEY,
  credits_remaining INT DEFAULT 2, -- Free credits
  credits_purchased INT DEFAULT 0,
  total_credits_used INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount INT NOT NULL, -- Positive for purchase, negative for use
  type TEXT NOT NULL, -- 'purchase', 'share', 'email', 'refund'
  description TEXT,
  stripe_payment_id TEXT, -- If purchased
  created_at TIMESTAMP DEFAULT NOW()
);

-- Credit packages
CREATE TABLE credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- '10 Credits', '50 Credits'
  credits INT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Insert default packages
INSERT INTO credit_packages (name, credits, price_usd) VALUES
  ('10 Credits', 10, 15.00),
  ('50 Credits', 50, 60.00),
  ('100 Credits', 100, 100.00);
```

---

### Credit Costs

```
File Share: 1 credit
Email Notification: 0.33 credits (3 emails = 1 credit)

Examples:
- Share file with email notification = 1.33 credits
- Share file without email = 1 credit
- Send invitation email = 0.33 credits
```

---

### Backend Implementation

```typescript
// routes/credits.ts
router.get('/balance', asyncHandler(async (req, res) => {
  const { user_id } = req.query;
  const result = await query(
    'SELECT credits_remaining FROM user_credits WHERE user_id = $1',
    [user_id]
  );

  res.apiSuccess({
    balance: result.rows[0]?.credits_remaining || 2
  });
}));

router.post('/purchase', asyncHandler(async (req, res) => {
  const { user_id, package_id, stripe_token } = req.body;

  // Get package details
  const pkg = await query(
    'SELECT * FROM credit_packages WHERE id = $1',
    [package_id]
  );

  // Process payment with Stripe
  const charge = await stripe.charges.create({
    amount: pkg.rows[0].price_usd * 100, // cents
    currency: 'usd',
    source: stripe_token,
    description: `ZeroDrive - ${pkg.rows[0].name}`
  });

  if (charge.status === 'succeeded') {
    // Add credits
    await query(`
      INSERT INTO user_credits (user_id, credits_remaining, credits_purchased)
      VALUES ($1, $2, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        credits_remaining = user_credits.credits_remaining + $2,
        credits_purchased = user_credits.credits_purchased + $2
    `, [user_id, pkg.rows[0].credits]);

    // Record transaction
    await query(`
      INSERT INTO credit_transactions (user_id, amount, type, description, stripe_payment_id)
      VALUES ($1, $2, 'purchase', $3, $4)
    `, [user_id, pkg.rows[0].credits, pkg.rows[0].name, charge.id]);

    res.apiSuccess({ success: true });
  }
}));

// Middleware to check credits
async function requireCredits(cost: number) {
  return async (req, res, next) => {
    const { user_id } = req.body;

    const result = await query(
      'SELECT credits_remaining FROM user_credits WHERE user_id = $1',
      [user_id]
    );

    const balance = result.rows[0]?.credits_remaining || 2;

    if (balance < cost) {
      throw ApiErrors.BadRequest(
        `Insufficient credits. Required: ${cost}, Available: ${balance}`
      );
    }

    // Deduct credits
    await query(`
      UPDATE user_credits
      SET credits_remaining = credits_remaining - $1,
          total_credits_used = total_credits_used + $1
      WHERE user_id = $2
    `, [cost, user_id]);

    // Record transaction
    await query(`
      INSERT INTO credit_transactions (user_id, amount, type, description)
      VALUES ($1, $2, 'share', 'File share')
    `, [user_id, -cost, 'File share']);

    next();
  };
}

// Use in routes
router.post('/shared-files',
  requireCredits(1), // 1 credit for share
  asyncHandler(createShare)
);
```

---

### Frontend Implementation

```tsx
// pages/buy-credits.tsx
export function BuyCreditsPage() {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [balance, setBalance] = useState(0);

  const packages = [
    { id: 1, name: '10 Credits', credits: 10, price: 15.00 },
    { id: 2, name: '50 Credits', credits: 50, price: 60.00 },
    { id: 3, name: '100 Credits', credits: 100, price: 100.00 },
  ];

  const handlePurchase = async (pkg) => {
    // Load Stripe
    const stripe = await loadStripe(STRIPE_PUBLIC_KEY);

    // Get Stripe token
    const { token } = await stripe.createToken({
      // card details
    });

    // Purchase credits
    await apiClient.post('/credits/purchase', {
      user_id: userEmail,
      package_id: pkg.id,
      stripe_token: token.id
    });

    toast.success(`${pkg.credits} credits added!`);
    loadBalance();
  };

  return (
    <div>
      <h1>Buy Credits</h1>
      <p>Current balance: {balance} credits</p>

      <div className="grid grid-cols-3 gap-4">
        {packages.map(pkg => (
          <Card key={pkg.id}>
            <CardHeader>
              <CardTitle>{pkg.name}</CardTitle>
              <CardDescription>${pkg.price}</CardDescription>
            </CardHeader>
            <CardContent>
              <p>{pkg.credits} credits</p>
              <p>${(pkg.price / pkg.credits).toFixed(2)} per credit</p>
              <Button onClick={() => handlePurchase(pkg)}>
                Buy Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

### Display Credit Balance

```tsx
// components/credit-balance.tsx
export function CreditBalance() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    loadBalance();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span>💎 {balance} credits</span>
      <Button variant="outline" size="sm" asChild>
        <Link to="/buy-credits">Buy More</Link>
      </Button>
    </div>
  );
}
```

---

### Update Landing Page

```tsx
// Remove old pricing section, add:
<div className="pricing-section">
  <h2>Simple, Pay-Per-Use Pricing</h2>

  <div className="grid grid-cols-3 gap-4">
    <Card>
      <CardTitle>Free Start</CardTitle>
      <p>2 free credits to get started</p>
      <p>Share 2 files for free!</p>
    </Card>

    <Card>
      <CardTitle>File Sharing</CardTitle>
      <p>1 credit per share</p>
      <p>Includes encrypted storage</p>
    </Card>

    <Card>
      <CardTitle>Email Notifications</CardTitle>
      <p>0.33 credits per email</p>
      <p>Optional, not required</p>
    </Card>
  </div>

  <h3>Credit Packages</h3>
  <ul>
    <li>10 Credits - $15 ($1.50 per credit)</li>
    <li>50 Credits - $60 ($1.20 per credit)</li>
    <li>100 Credits - $100 ($1.00 per credit)</li>
  </ul>

  <p>Pay only for what you use. No subscriptions.</p>
</div>
```

---

## Low Credit Warnings

```tsx
// Show warning when low
{balance < 5 && (
  <Alert variant="warning">
    <AlertTitle>Low Credits</AlertTitle>
    <AlertDescription>
      You have {balance} credits remaining.
      <Link to="/buy-credits">Buy more</Link>
    </AlertDescription>
  </Alert>
)}

// Block action if no credits
const handleShare = async () => {
  if (balance < 1) {
    toast.error('Insufficient credits', {
      description: 'You need at least 1 credit to share a file.',
      action: {
        label: 'Buy Credits',
        onClick: () => navigate('/buy-credits')
      }
    });
    return;
  }

  // Proceed with share...
};
```

---

## Stripe Setup

1. **Create Stripe account**: https://stripe.com
2. **Get API keys**:
   - Test mode: `pk_test_...` and `sk_test_...`
   - Live mode: `pk_live_...` and `sk_live_...`
3. **Install SDK**: `npm install stripe @stripe/stripe-js`
4. **Add to .env**:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLIC_KEY=pk_test_...
   ```

---

## Files Needed

### Backend
- `backend/src/routes/credits.ts` - Credits API
- `backend/src/middleware/requireCredits.ts` - Credit checking
- `backend/src/services/stripe.ts` - Stripe integration

### Frontend
- `app/src/pages/buy-credits.tsx` - Purchase page
- `app/src/components/credit-balance.tsx` - Balance display
- `app/src/hooks/useCredits.ts` - Credits hook

### Database
- `backend/migrations/xxx_create_credits_tables.sql` - Schema

---

## Testing Checklist

- [ ] Credit balance displays correctly
- [ ] Purchase flow works end-to-end
- [ ] Credits deducted on file share
- [ ] Low credit warnings appear
- [ ] Insufficient credits blocks actions
- [ ] Stripe webhooks handle payment events
- [ ] Transaction history accurate
- [ ] Refunds work correctly

---

## Recommendation

**Start without credits system:**
- Simpler to build and maintain
- Focus on core features first
- Can add monetization later
- Less friction for early users

**Add credits later if needed:**
- After product-market fit
- When growth sustainable
- If costs justify it
