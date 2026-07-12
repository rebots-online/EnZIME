/// Billing mode enum — determines how entitlement is granted.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum BillingMode {
    /// One-time purchase, perpetual access.
    Perpetual,
    /// Recurring subscription, requires active renewal.
    Subscription,
    /// Mode 3, reserved for future artifact-based entitlement.
    CustomArtifact,
}
