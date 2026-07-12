import React, { useState } from 'react';
import { useEntitlementStore } from '../stores/entitlement';
import { billingOpenPaywall, billingRestorePurchases } from '../bridge';

/**
 * PaywallOverlay — processor-agnostic EnZIME Pro paywall
 *
 * Modal shown when an entitlement-gated action is attempted while not entitled.
 * Integrates Stitch 11-paywall design (8cf2146a…).
 *
 * @param feature - The feature gate being checked (e.g., 'ai_chat', 'voice_transcription')
 */
export function PaywallOverlay({ feature }: { feature: string }) {
  const { check } = useEntitlementStore();
  const [isOpeningPaywall, setIsOpeningPaywall] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const handleSubscribe = async () => {
    setIsOpeningPaywall(true);
    try {
      await billingOpenPaywall();
      // After paywall closes, re-check entitlement
      await check(feature);
    } catch (error) {
      console.error('Failed to open paywall:', error);
    } finally {
      setIsOpeningPaywall(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(false);
    try {
      const result = await billingRestorePurchases();
      if (result.restored > 0) {
        setRestoreSuccess(true);
        // After successful restore, re-check entitlement
        await check(feature);
      } else if (result.errors.length > 0) {
        setRestoreError(result.errors.join(', '));
      } else {
        setRestoreError('No purchases found to restore');
      }
    } catch (error) {
      setRestoreError(error?.toString() || 'Failed to restore purchases');
    } finally {
      setIsRestoring(false);
    }
  };

  const getFeatureDisplayName = (featureKey: string): string => {
    const featureNames: Record<string, string> = {
      'ai_chat': 'AI Chat',
      'voice_transcription': 'Voice Transcription',
      'annotation_sync': 'Annotation Sync',
      'multi_model': 'Multiple AI Models',
      'priority_mirrors': 'Priority Pack Mirrors',
    };
    return featureNames[featureKey] || featureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const featureName = getFeatureDisplayName(feature);

  return (
    <div className="paywall-overlay">
      <div className="paywall-backdrop" />
      <div className="paywall-modal">
        {/* Header */}
        <div className="paywall-header">
          <div className="paywall-header-icon">
            <span className="material-symbols-outlined">enhanced_encryption</span>
          </div>
          <h2 className="paywall-title">Unlock EnZIME Pro</h2>
        </div>

        {/* Content */}
        <div className="paywall-content">
          <p className="paywall-message">
            <strong>{featureName}</strong> requires an active EnZIME Pro subscription.
          </p>

          {/* Benefits List */}
          <ul className="paywall-benefits">
            <li className="paywall-benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Unlimited on-device AI chat</span>
            </li>
            <li className="paywall-benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Voice note transcription</span>
            </li>
            <li className="paywall-benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Sync annotations with unlimited peers</span>
            </li>
            <li className="paywall-benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Run multiple AI models</span>
            </li>
            <li className="paywall-benefit">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Priority pack mirrors</span>
            </li>
          </ul>

          {/* Actions */}
          <div className="paywall-actions">
            <button
              className="paywall-subscribe-button"
              onClick={handleSubscribe}
              disabled={isOpeningPaywall}
            >
              {isOpeningPaywall ? 'Opening Paywall...' : 'Subscribe to EnZIME Pro'}
            </button>

            <button
              className="paywall-restore-button"
              onClick={handleRestore}
              disabled={isRestoring}
            >
              {isRestoring ? 'Restoring...' : 'Restore Purchases'}
            </button>

            {restoreSuccess && (
              <p className="paywall-success">Purchases restored successfully!</p>
            )}
            {restoreError && (
              <p className="paywall-error">Restore failed: {restoreError}</p>
            )}
          </div>

          {/* Footer */}
          <div className="paywall-footer">
            <div className="paywall-footer-note">
              <span className="material-symbols-outlined">verified_user</span>
              <span>Works fully offline after purchase · no account required · cancel anytime</span>
            </div>
            <p className="paywall-footer-fine">
              Billing via Google Play / direct (Stripe · BTCPay) depending on how you installed EnZIME
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
