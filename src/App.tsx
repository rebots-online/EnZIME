import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useAppState } from './stores/app';
import { useZimStore } from './stores/zim';
import * as bridge from './bridge';
import { applyTheme } from './theme';
import { FirstLaunchGate } from './components/FirstLaunchGate';
import { UpdateNotification } from './components/UpdateNotification';

// Screen components
import { ZimBrowser } from './components/ZimBrowser';
import { BookmarksList } from './components/BookmarksList';
import { PackCatalogBrowser } from './components/PackCatalogBrowser';
import { ArticleViewer } from './components/ArticleViewer';
import { ChatPane } from './components/ChatPane';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import { AnnotationsList } from './components/AnnotationsList';
import { SidecarImportFlow } from './components/SidecarImportFlow';
import { SidecarExportButton } from './components/SidecarExportButton';
import { PeerTrustManager } from './components/PeerTrustManager';
import { SettingsPane } from './components/SettingsPane';
import { PaywallOverlay } from './components/PaywallOverlay';
import { VariantBadge } from './components/VariantBadge';
import { MessageList } from './components/MessageList';
import { MessageItem } from './components/MessageItem';

// Desktop navigation rail component (280px, for screens ≥1024px)
function DesktopNavigationRail({ activeScreen, onNavigate }: { activeScreen: string; onNavigate: (screen: string) => void }): JSX.Element | null {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsDesktop(window.innerWidth >= 1024);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  if (!isDesktop) return null;

  const navItems = [
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'catalog', label: 'Catalog', icon: '📦' },
    { id: 'reader', label: 'Reader', icon: '📖' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'annotator', label: 'Notebook', icon: '📝' },
    { id: 'sidecar', label: 'Share', icon: '🔗' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="desktop-navigation-rail" style={{ width: '280px', height: '100vh', position: 'fixed', left: 0, top: 0, backgroundColor: 'var(--surface-container)', borderRight: '1px solid var(--outline)' }}>
      <div className="rail-header" style={{ padding: '16px' }}>
        <h2 style={{ color: 'var(--on-surface)', margin: 0 }}>EnZIME</h2>
        <VariantBadge variant={bridge.Variant.Qwen3_06B_Q4} />
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {navItems.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                border: 'none',
                backgroundColor: activeScreen === item.id ? 'var(--primary-container)' : 'transparent',
                color: activeScreen === item.id ? 'var(--on-primary-container)' : 'var(--on-surface)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Android bottom-nav component (for mobile screens <1024px)
function MobileBottomNav({ activeScreen, onNavigate }: { activeScreen: string; onNavigate: (screen: string) => void }): JSX.Element | null {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 1024);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  if (!isMobile) return null;

  const navItems = [
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'catalog', label: 'Catalog', icon: '📦' },
    { id: 'reader', label: 'Reader', icon: '📖' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="mobile-bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px', backgroundColor: 'var(--surface-container)', borderTop: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            flex: 1,
            height: '100%',
            border: 'none',
            backgroundColor: 'transparent',
            color: activeScreen === item.id ? 'var(--primary)' : 'var(--on-surface-variant)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            fontSize: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

// Main App component
export function App(): JSX.Element {
  const { activeScreen, setActiveScreen, setUpdateAvailable } = useAppState();
  const { getActive, openHandles } = useZimStore();
  const [updateManifest, setUpdateManifest] = useState<bridge.UpdateManifest | null>(null);
  const [updateShown, setUpdateShown] = useState(false);

  // On mount: restore window state, apply dark theme
  useEffect(() => {
    const initApp = async () => {
      try {
        await bridge.windowStateRestore();
        applyTheme('dark');
      } catch (e) {
        console.error('Failed to restore window state:', e);
      }

      // Check for updates
      try {
        const manifest = await bridge.appUpdateCheck();
        if (manifest) {
          setUpdateManifest(manifest);
          setUpdateAvailable(true);
        }
      } catch (e) {
        console.error('Failed to check for updates:', e);
      }
    };

    initApp();
  }, [setUpdateAvailable]);

  // On beforeunload and resize: save window state
  useEffect(() => {
    const handleBeforeUnload = () => {
      bridge.windowStateSave();
    };

    const handleResize = () => {
      bridge.windowStateSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Navigation handler
  const navigateTo = (screen: string) => {
    setActiveScreen(screen as any);
  };

  // Screen content routing
  const renderScreen = () => {
    const activeZim = getActive();

    switch (activeScreen) {
      case 'library':
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            <ZimBrowser handle={activeZim?.handle ?? 0} onNavigate={(url) => console.log('Navigate to:', url)} />
            <BookmarksList onNavigate={(handle, url) => console.log('Navigate to bookmark:', handle, url)} />
          </div>
        );

      case 'catalog':
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            <PackCatalogBrowser />
          </div>
        );

      case 'reader':
        return (
          <div className="screen-content" style={{ display: 'flex', height: '100%' }}>
            {activeZim ? (
              <>
                <div style={{ flex: 1, padding: '16px' }}>
                  <ArticleViewer handle={activeZim.handle} url={activeZim.title} />
                </div>
                <div style={{ flex: 1, padding: '16px', borderLeft: '1px solid var(--outline)' }}>
                  <ChatPane sessionId={null} zimHandle={activeZim.handle} />
                </div>
              </>
            ) : (
              <div style={{ padding: '16px', color: 'var(--on-surface)' }}>
                <p>No ZIM file open. Please open a ZIM from the Library.</p>
              </div>
            )}
          </div>
        );

      case 'search':
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            <GlobalSearchBar onNavigate={(uuid, url) => console.log('Navigate to search result:', uuid, url)} />
          </div>
        );

      case 'annotator':
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            {activeZim ? (
              <>
                <AnnotationsList handle={activeZim.handle} url={activeZim.title} />
                <SidecarExportButton />
              </>
            ) : (
              <div style={{ padding: '16px', color: 'var(--on-surface)' }}>
                <p>No ZIM file open. Please open a ZIM from the Library.</p>
              </div>
            )}
          </div>
        );

      case 'sidecar':
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            <SidecarImportFlow />
            <PeerTrustManager />
          </div>
        );

      case 'settings':
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            <SettingsPane />
          </div>
        );

      case 'paywall':
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            <PaywallOverlay feature="pro_features" />
          </div>
        );

      default:
        return (
          <div className="screen-content" style={{ padding: '16px' }}>
            <p>Unknown screen: {activeScreen}</p>
          </div>
        );
    }
  };

  return (
    <FirstLaunchGate>
      {/* One-time update notification */}
      {updateManifest && !updateShown && (
        <UpdateNotification manifest={updateManifest} />
      )}

      {/* Desktop navigation rail */}
      <DesktopNavigationRail activeScreen={activeScreen} onNavigate={navigateTo} />

      {/* Mobile bottom navigation */}
      <MobileBottomNav activeScreen={activeScreen} onNavigate={navigateTo} />

      {/* Main content area */}
      <main className="app-main" style={{ marginLeft: '280px', marginBottom: '60px', minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
        {renderScreen()}
      </main>
    </FirstLaunchGate>
  );
}
