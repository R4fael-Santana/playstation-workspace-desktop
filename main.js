// PlayStation Workspace — programa de PC (Electron)
// Abre o sistema online numa janela própria. As telas se atualizam sozinhas sempre que o site
// é publicado de novo na Vercel; o próprio programa se atualiza pelas versões no GitHub (electron-updater).
const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const pkg = require('./package.json');

const APP_URL = process.env.PSW_URL || (pkg.psw && pkg.psw.appUrl) || '';
const ORIGIN = (() => { try { return new URL(APP_URL).origin } catch (e) { return '' } })();
let win = null;

if (!app.requestSingleInstanceLock()) { app.quit() }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } });
app.setAppUserModelId('br.com.playstationworkspace');

function openOffline() {
  win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: APP_URL } });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640,
    title: 'PlayStation Workspace', backgroundColor: '#e3ecfb',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show() });

  if (!APP_URL) openOffline(); else win.loadURL(APP_URL + '/index.html');

  // sem internet ou site fora do ar: mostra a tela offline com "Tentar de novo"
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3 && !String(url).startsWith('file:')) openOffline();
  });
  // links para fora do sistema abrem no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (ORIGIN && url.startsWith(ORIGIN)) { win.loadURL(url); return { action: 'deny' } }
    shell.openExternal(url); return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:') || (ORIGIN && url.startsWith(ORIGIN))) return;
    e.preventDefault(); shell.openExternal(url);
  });
  // atalhos de teclado: F5 / Ctrl+R recarrega, Ctrl+Shift+I abre as ferramentas de diagnóstico
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r' && !input.shift)) { win.webContents.reload(); e.preventDefault() }
    if (input.control && input.shift && input.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); e.preventDefault() }
  });
  // downloads (PDF, Excel): pergunta onde salvar
  win.webContents.session.on('will-download', (e, item) => {
    item.setSaveDialogOptions({ title: 'Salvar arquivo', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
  });
}

function setupUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-downloaded', async (info) => {
      const r = await dialog.showMessageBox(win, {
        type: 'info', buttons: ['Reiniciar agora', 'Depois'], defaultId: 0, cancelId: 1,
        title: 'Atualização pronta', message: `A versão ${info.version} do PlayStation Workspace foi baixada.`,
        detail: 'Reinicie para usar a versão nova. Se escolher “Depois”, ela será instalada quando você fechar o programa.'
      });
      if (r.response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', err => console.warn('auto-update:', err && err.message));
    autoUpdater.checkForUpdates();
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
  } catch (e) { console.warn('auto-update indisponível', e) }
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => { createWindow(); setupUpdates() });
app.on('window-all-closed', () => app.quit());
