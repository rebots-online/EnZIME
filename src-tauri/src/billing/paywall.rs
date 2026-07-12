// Paywall controller for RevenueCat paywall trigger

use std::sync::Arc;
use super::BillingMode;
use super::revenuecat::RevenueCatClient;

/// RC paywall trigger
/// E-ENT-9
pub struct PaywallController {
    /// RevenueCat client for paywall interactions
    pub rc: Arc<RevenueCatClient>,
    /// Billing mode for this paywall controller
    pub mode: BillingMode,
}

impl PaywallController {
    /// Create a new paywall controller.
    ///
    /// # Arguments
    /// * `rc` - RevenueCat client for paywall interactions
    /// * `mode` - Billing mode for this controller
    pub fn new(rc: Arc<RevenueCatClient>, mode: BillingMode) -> Self {
        Self { rc, mode }
    }

    /// Open the paywall screen for the user.
    /// E-ENT-9
    ///
    /// On the Play build, triggers the RC paywall Offering for the configured product id.
    /// On desktop/sideload builds:
    /// - `ENZIME_BILLING_PROCESSOR=stripe` surfaces the Stripe checkout URL
    /// - `ENZIME_BILLING_PROCESSOR=btcpay` surfaces the BTCPay invoice URL
    ///
    /// Returns `Err(String)` when no Offering/price is configured for the active channel.
    /// The rendered surface is the Stitch `11-paywall` screen.
    ///
    /// # I-10(b) placeholder note
    /// This method currently returns a placeholder error because the RevenueCat SDK's
    /// paywall offerings API and Stripe/BTCPay checkout URL generation are not yet
    /// wired. When E-ENT-5 (RevenueCat SDK) landing adds offerings/fetch_product API,
    /// this implementation should:
    /// 1. For Play builds: call `rc.get_offering()` to trigger the paywall UI
    /// 2. For stripe/btcpay: generate and return the checkout/invoice URL
    /// 3. Return `Err(String)` only when no Offering/price is configured
    pub fn open(&self) -> Result<(), String> {
        // I-10(b): placeholder - requires RevenueCat SDK paywall offerings API
        // When RevenueCat SDK integration adds offerings/fetch_product methods,
        // this will:
        // - Play build: trigger RC paywall Offering for configured product id
        // - Desktop/sideload with stripe: surface Stripe checkout URL
        // - Desktop/sideload with btcpay: surface BTCPay invoice URL
        // - Return Err(String) when no Offering/price configured

        #[cfg(all(feature = "play", target_os = "android"))]
        {
            // Play build path: trigger RevenueCat paywall Offering
            // I-10(b): swap when RevenueCat SDK paywall offerings API lands
            return Err(String::from("Paywall offerings not yet configured - RevenueCat SDK paywall integration pending"));
        }

        #[cfg(not(all(feature = "play", target_os = "android")))]
        {
            // Desktop/sideload build path: check processor type
            let processor = std::env::var("ENZIME_BILLING_PROCESSOR")
                .unwrap_or_else(|_| String::from("stripe"));

            match processor.as_str() {
                "stripe" => {
                    // I-10(b): swap when Stripe checkout URL generation lands
                    // Should surface the Stripe checkout URL for the configured product
                    return Err(String::from("Stripe checkout URL generation pending - checkout not yet configured"));
                }
                "btcpay" => {
                    // I-10(b): swap when BTCPay invoice URL generation lands
                    // Should surface the BTCPay invoice URL for the configured product
                    return Err(String::from("BTCPay invoice URL generation pending - checkout not yet configured"));
                }
                _ => {
                    return Err(format!("Unknown billing processor: {}", processor));
                }
            }
        }
    }
}
