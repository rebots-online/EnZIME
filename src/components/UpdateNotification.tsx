import { bridge } from '../bridge';

export function UpdateNotification({ manifest }: { manifest: bridge.UpdateManifest }): JSX.Element {
  return (
    <div className="update-notification">
      <div className="update-notification-content">
        <span className="update-notification-text">
          Update available: version {manifest.version}
        </span>
        {manifest.notes && (
          <p className="update-notification-notes">{manifest.notes}</p>
        )}
        <div className="update-notification-actions">
          <button onClick={() => bridge.appUpdateApply()} className="update-notification-apply">
            Update
          </button>
          <button className="update-notification-dismiss">Dismiss</button>
        </div>
      </div>
    </div>
  );
}
