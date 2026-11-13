import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DESKTOP_BUILD_DIR = path.join(__dirname, 'dist-desktop');
let cachedZipBuffer: Buffer | null = null;
let buildingPromise: Promise<Buffer> | null = null;

function crc32Buffer(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntryInput {
  name: string;
  data: Buffer;
}

function buildZipBuffer(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const dataBytes = entry.data;
    const crc = crc32Buffer(dataBytes);

    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8
    localHeader.writeUInt16LE(0, 8); // STORE
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBytes.length, 18);
    localHeader.writeUInt32LE(dataBytes.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBytes.copy(localHeader, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = Buffer.alloc(46 + nameBytes.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBytes.length, 20);
    centralHeader.writeUInt32LE(dataBytes.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBytes.copy(centralHeader, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function collectFilesRecursively(dir: string, prefix: string): ZipEntryInput[] {
  const results: ZipEntryInput[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const zipPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) {
      results.push(...collectFilesRecursively(fullPath, zipPath));
    } else if (item.isFile()) {
      results.push({ name: zipPath, data: fs.readFileSync(fullPath) });
    }
  }
  return results;
}

async function generateOfflineDesktopZip(): Promise<Buffer> {
  if (cachedZipBuffer) return cachedZipBuffer;
  if (buildingPromise) return buildingPromise;

  buildingPromise = (async () => {
    const viteBin = path.join(__dirname, 'node_modules', '.bin', 'vite');
    await execFileAsync(
      viteBin,
      ['build', '--outDir', 'dist-desktop', '--emptyOutDir'],
      {
        cwd: __dirname,
        env: { ...process.env, ELECTRON_BUNDLE: 'true' },
      }
    );

    const appFiles = collectFilesRecursively(DESKTOP_BUILD_DIR, 'app');

    const packageJson = JSON.stringify(
      {
        name: 'kitobkhona-maktab-windows',
        version: '1.0.0',
        description: 'Китобхонаи Мактаб — Offline Desktop Application for Windows 10/11',
        main: 'main.js',
        scripts: {
          start: 'electron .',
          'build-win': 'electron-builder --win nsis',
        },
        build: {
          appId: 'tj.school.kitobkhona',
          productName: 'Китобхонаи Мактаб',
          files: ['main.js', 'app/**/*'],
          win: {
            target: [
              {
                target: 'nsis',
                arch: ['x64', 'ia32'],
              },
            ],
          },
          nsis: {
            oneClick: false,
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: 'Китобхонаи Мактаб',
            artifactName: 'Kitobkhona-Maktab-Setup-${version}.exe',
          },
        },
        devDependencies: {
          electron: '^33.2.0',
          'electron-builder': '^25.1.8',
        },
      },
      null,
      2
    );

    const mainJs = `const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'Китобхонаи Мактаб',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);
  // Loads the complete bundled offline application directly from disk (no browser, no internet needed)
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;

    const buildBat = `@echo off
chcp 65001 >nul
echo ============================================================
echo   Китобхонаи Мактаб — Сохтани барномаи Windows (.EXE)
echo ============================================================
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ХАТО] Node.js дар компютер ёфт нашуд!
  echo Лутфан аз https://nodejs.org Node.js-ро насб кунед ва дубора кӯшиш намоед.
  pause
  exit /b 1
)
echo [1/2] Насби вобастагиҳои Electron...
call npm install
if %errorlevel% neq 0 (
  echo Хато ҳангоми npm install! Пайвастшавӣ ба интернетро санҷед.
  pause
  exit /b 1
)
echo.
echo [2/2] Сохтани файли насбкунандаи .EXE барои Windows 10/11...
call npm run build-win
if %errorlevel% neq 0 (
  echo Хато ҳангоми сохтани .EXE!
  pause
  exit /b 1
)
echo.
echo [МУВАФФАҚИЯТ] Файли .EXE дар папкаи "dist" сохта шуд!
start "" "%~dp0dist"
pause
`;

    const workflowYml = `name: Build Windows EXE Installer

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  build-exe:
    runs-on: windows-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install Electron and Builder
        run: npm install

      - name: Build Windows Setup (.exe)
        run: npm run build-win

      - name: Upload Windows .EXE Installer
        uses: actions/upload-artifact@v4
        with:
          name: Kitobkhona-Maktab-Windows-EXE
          path: dist/*.exe
`;

    const readmeTxt = `======================================================================
  КИТОБХОНАИ МАКТАБ — БАРНОМАИ ОФЛАЙНИ WINDOWS 10–11 (БЕ БРАУЗЕР)
  ШКОЛЬНАЯ БИБЛИОТЕКА — АВТОНОМНОЕ ПРИЛОЖЕНИЕ WINDOWS 10–11
======================================================================

[ТОҶИКӢ]
Роҳи 1 — Ба воситаи GitHub (бе насби Node.js дар компютери худ!):
1. Дар GitHub репозиторийи нав созед ва тамоми файлҳои ин архивро (бо папкаи .github) ба он бор кунед.
2. Ба бахши "Actions" дар GitHub дароед — худкор сохтани барнома оғоз мешавад (1–2 дақиқа).
3. Пас аз анҷом, файли "Kitobkhona-Maktab-Windows-EXE"-ро зеркашӣ кунед: дар дарунаш "Kitobkhona-Maktab-Setup-1.0.0.exe" ҳаст!
4. Ҳамин .exe-ро ба флешка гирифта, дар дилхоҳ компютери Windows 10–11 насб кунед.

Роҳи 2 — Сохтан дар компютери Windows (агар Node.js дошта бошед):
1. Ин архивро кушоед ва ба файли "build-exe.bat" ду маротиба клик кунед.
2. Файли "dist/Kitobkhona-Maktab-Setup-1.0.0.exe" сохта мешавад.

----------------------------------------------------------------------

[РУССКИЙ]
Способ 1 — Через GitHub Actions (без установки Node.js на компьютер!):
1. Создайте новый репозиторий на GitHub и загрузите туда все файлы из архива (включая папку .github).
2. Откройте вкладку "Actions" на GitHub — сборка EXE запустится автоматически (1–2 минуты).
3. Скачайте артефакт "Kitobkhona-Maktab-Windows-EXE" — внутри готовый установщик "Kitobkhona-Maktab-Setup-1.0.0.exe".
4. Скопируйте этот .exe на флешку и устанавливайте на любые школьные ПК с Windows 10–11 без браузера и без интернета!

Способ 2 — Локально на Windows (при установленном Node.js):
1. Распакуйте архив и дважды запустите "build-exe.bat".
2. Готовый установщик появится в папке "dist/".
`;

    const allEntries: ZipEntryInput[] = [
      ...appFiles,
      { name: 'package.json', data: Buffer.from(packageJson, 'utf8') },
      { name: 'main.js', data: Buffer.from(mainJs, 'utf8') },
      { name: 'build-exe.bat', data: Buffer.from(buildBat, 'utf8') },
      { name: '.github/workflows/build-windows-exe.yml', data: Buffer.from(workflowYml, 'utf8') },
      { name: 'README_WINDOWS_EXE.txt', data: Buffer.from(readmeTxt, 'utf8') },
    ];

    const buf = buildZipBuffer(allEntries);
    cachedZipBuffer = buf;
    return buf;
  })();

  try {
    return await buildingPromise;
  } finally {
    buildingPromise = null;
  }
}

async function startServer() {
  const app = express();

  app.get('/api/windows-desktop-kit.zip', async (_req, res) => {
    try {
      const zipBuffer = await generateOfflineDesktopZip();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="kitobkhona-windows-desktop.zip"'
      );
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err) {
      console.error('Failed to build Windows desktop kit:', err);
      res.status(500).json({ error: 'Failed to generate Windows desktop package' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
