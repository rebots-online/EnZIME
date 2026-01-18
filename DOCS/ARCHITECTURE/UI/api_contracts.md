Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
All rights reserved.
Unauthorized use without prior written consent is strictly prohibited.

# EnZIM API Contracts — Service Layer Definitions

**Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.**

> Service API definitions connecting UI to backend functionality.
> Aligned with component diagram `03_component_diagram.puml`.

---

## 1. Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Auth Service   │  │ Billing Service │  │ Feature Gate    │             │
│  │                 │  │                 │  │                 │             │
│  │ OAuth, JWT      │  │ Stripe API      │  │ Entitlements    │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│  ┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐             │
│  │ Session Manager │  │  ZIM Service    │  │ Search Service  │             │
│  │                 │  │                 │  │                 │             │
│  │ Token mgmt      │  │ AnZimmermanLib  │  │ Full-text index │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Auth Service API

### Interface Definition

```typescript
// services/authService.ts

interface AuthService {
  // Email/Password Authentication
  login(email: string, password: string): Promise<AuthResult>;
  signup(email: string, password: string, displayName: string): Promise<SignupResult>;
  resetPassword(email: string): Promise<void>;
  
  // OAuth Authentication
  initiateOAuth(provider: AuthProvider): void;
  handleOAuthCallback(code: string, state: string): Promise<AuthResult>;
  
  // Session Management
  validateToken(token: string): Promise<TokenValidationResult>;
  refreshToken(token: string): Promise<string>;
  logout(): Promise<void>;
  
  // User Management
  getCurrentUser(): Promise<User | null>;
  updateProfile(updates: Partial<User>): Promise<User>;
  verifyEmail(token: string): Promise<void>;
}

// Response Types
interface AuthResult {
  user: User;
  token: string;
  expiresAt: Date;
}

interface SignupResult {
  user: User;
  pendingVerification: boolean;
}

interface TokenValidationResult {
  valid: boolean;
  user?: User;
  reason?: 'EXPIRED' | 'INVALID' | 'REVOKED';
}
```

### Implementation

```typescript
// services/authService.ts

import { User, AuthProvider } from '../types/auth';

class AuthServiceImpl implements AuthService {
  private baseUrl = '/api/auth';
  
  async login(email: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.code, error.message);
    }
    
    return response.json();
  }
  
  async signup(email: string, password: string, displayName: string): Promise<SignupResult> {
    const response = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.code, error.message);
    }
    
    return response.json();
  }
  
  initiateOAuth(provider: AuthProvider): void {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = generateState();
    sessionStorage.setItem('oauth_state', state);
    
    const authUrls: Record<AuthProvider, string> = {
      [AuthProvider.GOOGLE]: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${state}`,
      [AuthProvider.GITHUB]: `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email&state=${state}`,
      [AuthProvider.APPLE]: `https://appleid.apple.com/auth/authorize?client_id=${APPLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20name&state=${state}`,
      [AuthProvider.EMAIL_PASSWORD]: '', // Not applicable
    };
    
    window.location.href = authUrls[provider];
  }
  
  async handleOAuthCallback(code: string, state: string): Promise<AuthResult> {
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new AuthError('INVALID_STATE', 'OAuth state mismatch');
    }
    
    const response = await fetch(`${this.baseUrl}/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.code, error.message);
    }
    
    sessionStorage.removeItem('oauth_state');
    return response.json();
  }
  
  async validateToken(token: string): Promise<TokenValidationResult> {
    const response = await fetch(`${this.baseUrl}/validate`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      return { valid: false, reason: 'INVALID' };
    }
    
    const data = await response.json();
    return { valid: true, user: data.user };
  }
  
  async logout(): Promise<void> {
    const token = localStorage.getItem('enzim_token');
    if (token) {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    }
  }
  
  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('enzim_token');
    if (!token) return null;
    
    const validation = await this.validateToken(token);
    return validation.user || null;
  }
  
  async updateProfile(updates: Partial<User>): Promise<User> {
    const token = localStorage.getItem('enzim_token');
    const response = await fetch(`${this.baseUrl}/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.code, error.message);
    }
    
    return response.json();
  }
  
  async verifyEmail(token: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.code, error.message);
    }
  }
  
  async resetPassword(email: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.code, error.message);
    }
  }
  
  async refreshToken(token: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      throw new AuthError('REFRESH_FAILED', 'Failed to refresh token');
    }
    
    const data = await response.json();
    return data.token;
  }
}

// Error class
class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const authService = new AuthServiceImpl();
```

---

## 3. Billing Service API

### Interface Definition

```typescript
// services/billingService.ts

interface BillingService {
  // Subscription Management
  getSubscription(): Promise<Subscription | null>;
  createSubscription(plan: SubscriptionPlan, paymentMethodId: string): Promise<Subscription>;
  updateSubscription(plan: SubscriptionPlan): Promise<Subscription>;
  cancelSubscription(): Promise<Subscription>;
  reactivateSubscription(): Promise<Subscription>;
  
  // Payment Methods
  getPaymentMethods(): Promise<PaymentMethod[]>;
  addPaymentMethod(paymentMethodId: string): Promise<PaymentMethod>;
  removePaymentMethod(paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(paymentMethodId: string): Promise<void>;
  
  // Billing History
  getInvoices(limit?: number): Promise<Invoice[]>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  
  // Stripe Setup
  createSetupIntent(): Promise<string>;  // Returns clientSecret
  createPaymentIntent(amount: number): Promise<string>;  // Returns clientSecret
}

// Additional Types
interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  createdAt: Date;
  pdfUrl: string;
}
```

### Implementation

```typescript
// services/billingService.ts

import { Subscription, SubscriptionPlan } from '../types/subscription';

class BillingServiceImpl implements BillingService {
  private baseUrl = '/api/billing';
  
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('enzim_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }
  
  async getSubscription(): Promise<Subscription | null> {
    const response = await fetch(`${this.baseUrl}/subscription`, {
      headers: this.getAuthHeaders(),
    });
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new BillingError('FETCH_FAILED', 'Failed to fetch subscription');
    }
    
    return response.json();
  }
  
  async createSubscription(plan: SubscriptionPlan, paymentMethodId: string): Promise<Subscription> {
    const response = await fetch(`${this.baseUrl}/subscription`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ plan, paymentMethodId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new BillingError(error.code, error.message);
    }
    
    return response.json();
  }
  
  async updateSubscription(plan: SubscriptionPlan): Promise<Subscription> {
    const response = await fetch(`${this.baseUrl}/subscription`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ plan }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new BillingError(error.code, error.message);
    }
    
    return response.json();
  }
  
  async cancelSubscription(): Promise<Subscription> {
    const response = await fetch(`${this.baseUrl}/subscription/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new BillingError(error.code, error.message);
    }
    
    return response.json();
  }
  
  async reactivateSubscription(): Promise<Subscription> {
    const response = await fetch(`${this.baseUrl}/subscription/reactivate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new BillingError(error.code, error.message);
    }
    
    return response.json();
  }
  
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await fetch(`${this.baseUrl}/payment-methods`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new BillingError('FETCH_FAILED', 'Failed to fetch payment methods');
    }
    
    return response.json();
  }
  
  async addPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    const response = await fetch(`${this.baseUrl}/payment-methods`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ paymentMethodId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new BillingError(error.code, error.message);
    }
    
    return response.json();
  }
  
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/payment-methods/${paymentMethodId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new BillingError(error.code, error.message);
    }
  }
  
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/payment-methods/${paymentMethodId}/default`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new BillingError(error.code, error.message);
    }
  }
  
  async getInvoices(limit: number = 10): Promise<Invoice[]> {
    const response = await fetch(`${this.baseUrl}/invoices?limit=${limit}`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new BillingError('FETCH_FAILED', 'Failed to fetch invoices');
    }
    
    return response.json();
  }
  
  async getInvoice(invoiceId: string): Promise<Invoice> {
    const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new BillingError('FETCH_FAILED', 'Failed to fetch invoice');
    }
    
    return response.json();
  }
  
  async createSetupIntent(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/setup-intent`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new BillingError('SETUP_FAILED', 'Failed to create setup intent');
    }
    
    const data = await response.json();
    return data.clientSecret;
  }
  
  async createPaymentIntent(amount: number): Promise<string> {
    const response = await fetch(`${this.baseUrl}/payment-intent`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ amount }),
    });
    
    if (!response.ok) {
      throw new BillingError('PAYMENT_FAILED', 'Failed to create payment intent');
    }
    
    const data = await response.json();
    return data.clientSecret;
  }
}

class BillingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'BillingError';
  }
}

export const billingService = new BillingServiceImpl();
```

---

## 4. Feature Gate Service API

### Interface Definition

```typescript
// services/featureGateService.ts

interface FeatureGateService {
  // Feature Checks
  canAccess(feature: keyof FeatureFlags): FeatureCheckResult;
  checkUsage(feature: 'aiQueriesPerDay'): UsageCheckResult;
  
  // Usage Tracking
  trackUsage(feature: 'aiQueriesPerDay'): void;
  getUsage(feature: 'aiQueriesPerDay'): UsageInfo;
  resetUsage(feature: 'aiQueriesPerDay'): void;
  
  // Feature Sync
  syncFeatures(): Promise<FeatureFlags>;
}

interface FeatureCheckResult {
  allowed: boolean;
  reason?: 'NOT_AUTHENTICATED' | 'PLAN_REQUIRED' | 'LIMIT_REACHED';
  requiredPlan?: SubscriptionPlan;
}

interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

interface UsageInfo {
  used: number;
  limit: number;
  resetAt: Date;
}
```

### Implementation

```typescript
// services/featureGateService.ts

import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';

class FeatureGateServiceImpl implements FeatureGateService {
  
  canAccess(feature: keyof FeatureFlags): FeatureCheckResult {
    const { isAuthenticated } = useAuthStore.getState();
    const { features } = useSubscriptionStore.getState();
    
    if (!isAuthenticated) {
      return { allowed: false, reason: 'NOT_AUTHENTICATED' };
    }
    
    const value = features[feature];
    
    if (typeof value === 'boolean') {
      return value 
        ? { allowed: true }
        : { allowed: false, reason: 'PLAN_REQUIRED', requiredPlan: this.getRequiredPlan(feature) };
    }
    
    if (typeof value === 'number') {
      return value > 0 
        ? { allowed: true }
        : { allowed: false, reason: 'PLAN_REQUIRED', requiredPlan: this.getRequiredPlan(feature) };
    }
    
    return { allowed: true };
  }
  
  checkUsage(feature: 'aiQueriesPerDay'): UsageCheckResult {
    const { features, usage } = useSubscriptionStore.getState();
    const limit = features[feature];
    const { used, resetAt } = usage[feature];
    
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);
    const allowed = limit === Infinity || remaining > 0;
    
    return { allowed, remaining, limit, resetAt };
  }
  
  trackUsage(feature: 'aiQueriesPerDay'): void {
    const { incrementAiUsage } = useSubscriptionStore.getState();
    incrementAiUsage();
  }
  
  getUsage(feature: 'aiQueriesPerDay'): UsageInfo {
    const { features, usage } = useSubscriptionStore.getState();
    return {
      used: usage[feature].used,
      limit: features[feature],
      resetAt: usage[feature].resetAt,
    };
  }
  
  resetUsage(feature: 'aiQueriesPerDay'): void {
    const { resetDailyUsage } = useSubscriptionStore.getState();
    resetDailyUsage();
  }
  
  async syncFeatures(): Promise<FeatureFlags> {
    const { setFeatures } = useSubscriptionStore.getState();
    
    const response = await fetch('/api/billing/features', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('enzim_token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync features');
    }
    
    const features = await response.json();
    setFeatures(features);
    return features;
  }
  
  private getRequiredPlan(feature: keyof FeatureFlags): SubscriptionPlan {
    const requirements: Partial<Record<keyof FeatureFlags, SubscriptionPlan>> = {
      aiAssistantEnabled: SubscriptionPlan.STARTER,
      aiQueriesPerDay: SubscriptionPlan.STARTER,
      cloudSyncEnabled: SubscriptionPlan.PRO,
      advancedAnnotations: SubscriptionPlan.STARTER,
      customThemes: SubscriptionPlan.PRO,
      prioritySupport: SubscriptionPlan.PRO,
    };
    return requirements[feature] || SubscriptionPlan.STARTER;
  }
}

export const featureGateService = new FeatureGateServiceImpl();
```

---

## 5. Backend API Endpoints (REST)

### Auth Endpoints

| Method | Endpoint | Request Body | Response | Description |
|--------|----------|--------------|----------|-------------|
| POST | `/api/auth/login` | `{ email, password }` | `AuthResult` | Email/password login |
| POST | `/api/auth/signup` | `{ email, password, displayName }` | `SignupResult` | New user registration |
| POST | `/api/auth/oauth/callback` | `{ code, state }` | `AuthResult` | OAuth callback handler |
| GET | `/api/auth/validate` | - (Bearer token) | `{ user }` | Validate JWT token |
| POST | `/api/auth/refresh` | - (Bearer token) | `{ token }` | Refresh JWT token |
| POST | `/api/auth/logout` | - (Bearer token) | - | Invalidate session |
| PATCH | `/api/auth/profile` | `Partial<User>` | `User` | Update user profile |
| POST | `/api/auth/verify-email` | `{ token }` | - | Verify email address |
| POST | `/api/auth/reset-password` | `{ email }` | - | Request password reset |

### Billing Endpoints

| Method | Endpoint | Request Body | Response | Description |
|--------|----------|--------------|----------|-------------|
| GET | `/api/billing/subscription` | - | `Subscription` | Get current subscription |
| POST | `/api/billing/subscription` | `{ plan, paymentMethodId }` | `Subscription` | Create subscription |
| PATCH | `/api/billing/subscription` | `{ plan }` | `Subscription` | Update subscription |
| POST | `/api/billing/subscription/cancel` | - | `Subscription` | Cancel subscription |
| POST | `/api/billing/subscription/reactivate` | - | `Subscription` | Reactivate subscription |
| GET | `/api/billing/payment-methods` | - | `PaymentMethod[]` | List payment methods |
| POST | `/api/billing/payment-methods` | `{ paymentMethodId }` | `PaymentMethod` | Add payment method |
| DELETE | `/api/billing/payment-methods/:id` | - | - | Remove payment method |
| POST | `/api/billing/setup-intent` | - | `{ clientSecret }` | Create Stripe SetupIntent |
| GET | `/api/billing/invoices` | - | `Invoice[]` | List invoices |
| GET | `/api/billing/features` | - | `FeatureFlags` | Get current feature flags |
| POST | `/api/billing/webhook` | Stripe event | - | Handle Stripe webhooks |

---

## 6. Error Codes

### Auth Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `USER_EXISTS` | 409 | Email already registered |
| `INVALID_TOKEN` | 401 | JWT token invalid |
| `TOKEN_EXPIRED` | 401 | JWT token expired |
| `INVALID_STATE` | 400 | OAuth state mismatch |
| `OAUTH_FAILED` | 400 | OAuth authentication failed |

### Billing Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NO_SUBSCRIPTION` | 404 | User has no subscription |
| `PAYMENT_FAILED` | 402 | Payment processing failed |
| `CARD_DECLINED` | 402 | Card was declined |
| `INVALID_PLAN` | 400 | Invalid subscription plan |
| `ALREADY_SUBSCRIBED` | 409 | User already has active subscription |
| `CANNOT_CANCEL` | 400 | Subscription cannot be canceled |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-17 | Cascade | Initial API contracts |

---

*Last updated: 2026-01-17T15:20:00-05:00*
