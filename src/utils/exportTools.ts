import type { LibraryStoreData } from '../types/library';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(baseDate: string, days: number): string {
  const d = new Date(baseDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysDiffFromToday(targetDate: string): number {
  const today = new Date(todayISO() + 'T00:00:00').getTime();
  const target = new Date(targetDate + 'T00:00:00').getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsvUtf8Bom(headers: string[], rows: (string | number)[][], filename: string) {
  const escapeCell = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvBody = [
    headers.map(escapeCell).join(';'),
    ...rows.map((r) => r.map(escapeCell).join(';')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvBody], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerFileDownload(blob, filename);
}

export function exportLibraryBackupJson(data: LibraryStoreData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  triggerFileDownload(blob, `kitobkhona-backup-${todayISO()}.json`);
}

export function parseLibraryBackupJson(raw: string): LibraryStoreData | null {
  try {
    const parsed = JSON.parse(raw) as LibraryStoreData;
    if (
      !parsed ||
      !Array.isArray(parsed.books) ||
      !Array.isArray(parsed.students) ||
      !Array.isArray(parsed.textbookLoans) ||
      !Array.isArray(parsed.fictionLoans) ||
      !parsed.settings
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Pure TypeScript uncompressed (STORE) ZIP builder for Windows 10/11 Explorer compatibility
function crc32Bytes(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBlob(files: { name: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32Bytes(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  let centralSize = 0;
  for (const part of centralParts) centralSize += part.length;

  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [
    ...localParts.map((u) => new Uint8Array(u)),
    ...centralParts.map((u) => new Uint8Array(u)),
    new Uint8Array(endRecord),
  ];
  return new Blob(blobParts, { type: 'application/zip' });
}

export function downloadElectronExeKit(appUrl: string, schoolName: string) {
  const safeUrl = appUrl || 'http://localhost:3000';
  const packageJson = JSON.stringify(
    {
      name: 'kitobkhona-maktab-windows',
      version: '1.0.0',
      description: `Китобхонаи Мактаб (${schoolName}) — Desktop App for Windows 10/11`,
      main: 'main.js',
      scripts: {
        start: 'electron .',
        'build-win': 'electron-builder --win nsis',
      },
      build: {
        appId: 'tj.school.kitobkhona',
        productName: 'Китобхонаи Мактаб',
        win: {
          target: 'nsis',
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
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

const APP_URL = ${JSON.stringify(safeUrl)};

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
  win.loadURL(APP_URL);
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

  const guideTxt = `======================================================================
  КИТОБХОНАИ МАКТАБ — ДАСТУРИ СОХТАНИ ФАЙЛИ .EXE БАРОИ WINDOWS 10–11
  ШКОЛЬНАЯ БИБЛИОТЕКА — ИНСТРУКЦИЯ ПО СБОРКЕ .EXE ДЛЯ WINDOWS 10–11
======================================================================

[ТОҶИКӢ]
Роҳи 1 (Осон ва зуд, бе барномасозӣ):
  1. Суроғаи барномаро (${safeUrl}) дар Microsoft Edge ё Google Chrome кушоед.
  2. Дар сатри суроға тугмаи "Насб / Install"-ро пахш кунед.
  3. Барнома бо нишонаи худ дар Desktop ва Start Menu насб мешавад ва офлайн кор мекунад.

Роҳи 2 (Сохтани файли алоҳидаи .EXE бо Electron):
  Талабот: Дар Windows бояд Node.js (https://nodejs.org) насб шуда бошад.
  1. Ин файли ZIP-ро ба ягон папка кушоед (Extract All).
  2. Дар дохили папка CMD ё PowerShell-ро кушоед.
  3. Фармонро иҷро кунед:   npm install
  4. Барои сохтани файли насбкунандаи .exe иҷро кунед:   npm run build-win
  5. Файли омодаи ".exe" дар дохили папкаи "dist/" пайдо мешавад.

----------------------------------------------------------------------

[РУССКИЙ]
Способ 1 (Быстрая установка без сборки):
  1. Откройте адрес приложения (${safeUrl}) в Microsoft Edge или Google Chrome.
  2. Нажмите на кнопку «Установить приложение» в адресной строке браузера.
  3. Приложение установится на Рабочий стол и в меню «Пуск» и работает офлайн.

Способ 2 (Сборка отдельного файла .EXE через Electron):
  Требование: на компьютере должен быть установлен Node.js (https://nodejs.org).
  1. Распакуйте этот ZIP-архив в отдельную папку.
  2. Откройте командную строку (CMD или PowerShell) в этой папке.
  3. Выполните:   npm install
  4. Для создания установщика .exe выполните:   npm run build-win
  5. Готовый установщик ".exe" появится в папке "dist/".
`;

  const zipBlob = buildZipBlob([
    { name: 'package.json', content: packageJson },
    { name: 'main.js', content: mainJs },
    { name: 'README_WINDOWS_EXE.txt', content: guideTxt },
  ]);
  triggerFileDownload(zipBlob, 'kitobkhona-windows-exe-kit.zip');
}
