import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ASSET_PATHS } from './config/assets';
import { loadAssets, localCommonAssetUrl } from './services/assets';
import { LOCALES, preloadAllMessages } from './services/locale';
import './styles.css';

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <main
      className="loading-screen"
      style={{
        backgroundImage: `url(${localCommonAssetUrl(ASSET_PATHS.bg_home_classroom)})`,
      }}
    >
      <img
        className="loading-logo"
        src={localCommonAssetUrl(ASSET_PATHS.icon_school)}
        alt=""
      />
      <div
        className="loading-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <strong>{progress}%</strong>
    </main>
  );
}

async function start(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  const appRoot = createRoot(root);
  const assetTotal = Object.keys(ASSET_PATHS).length;
  const localeTotal = LOCALES.length;
  const total = assetTotal + localeTotal;
  let loadedAssets = 0;
  let loadedLocales = 0;
  const renderProgress = () => {
    const progress = Math.round(((loadedAssets + loadedLocales) / total) * 100);
    appRoot.render(<LoadingScreen progress={progress} />);
  };
  renderProgress();
  const [assets, messagePacks] = await Promise.all([
    loadAssets((loaded) => {
      loadedAssets = loaded;
      renderProgress();
    }),
    preloadAllMessages((loaded) => {
      loadedLocales = loaded;
      renderProgress();
    }),
  ]);
  appRoot.render(
    <StrictMode>
      <App assets={assets} messagePacks={messagePacks} />
    </StrictMode>,
  );
}

void start();
