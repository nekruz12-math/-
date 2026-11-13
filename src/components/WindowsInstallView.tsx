import React, { useEffect, useRef, useState } from 'react';
import {
  HardDriveDownload,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Language, LibrarySettings, LibraryStoreData } from '../types/library';
import { getT } from '../i18n/translations';
import {
  exportLibraryBackupJson,
  parseLibraryBackupJson,
} from '../utils/exportTools';

interface WindowsInstallViewProps {
  lang: Language;
  storeData: LibraryStoreData;
  onUpdateSettings: (next: Partial<LibrarySettings>) => void;
  onImportBackup: (data: LibraryStoreData) => void;
  onLoadDemo: () => void;
  onClearAll: () => void;
  onNotify: (msg: string) => void;
}

export const WindowsInstallView: React.FC<WindowsInstallViewProps> = ({
  lang,
  storeData,
  onUpdateSettings,
  onImportBackup,
  onLoadDemo,
  onClearAll,
  onNotify,
}) => {
  const t = getT(lang);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [schoolName, setSchoolName] = useState(storeData.settings.schoolName);
  const [academicYear, setAcademicYear] = useState(storeData.settings.academicYear);
  const [defaultReturnDate, setDefaultReturnDate] = useState(
    storeData.settings.defaultReturnDate
  );
  const [schoolLogo, setSchoolLogo] = useState(storeData.settings.schoolLogo || '');
  const [confirmClear, setConfirmClear] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSchoolName(storeData.settings.schoolName);
    setAcademicYear(storeData.settings.academicYear);
    setDefaultReturnDate(storeData.settings.defaultReturnDate);
    setSchoolLogo(storeData.settings.schoolLogo || '');
  }, [storeData.settings]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      schoolName: schoolName.trim() || 'МТМУ №1',
      schoolLogo: schoolLogo || undefined,
      academicYear: academicYear.trim() || '2026-2027',
      defaultReturnDate: defaultReturnDate || '2027-05-25',
    });
    onNotify(t.windows.toastSaved);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      setSchoolLogo(dataUrl);
      onUpdateSettings({ schoolLogo: dataUrl });
      onNotify(t.windows.toastLogoUpdated);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    setSchoolLogo('');
    onUpdateSettings({ schoolLogo: undefined });
    onNotify(t.windows.toastLogoUpdated);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseLibraryBackupJson(String(reader.result ?? ''));
      if (parsed) {
        onImportBackup(parsed);
        onNotify(t.windows.toastImported);
      } else {
        onNotify(t.windows.toastImportError);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.windows.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t.windows.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 2. School Settings */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.windows.settingsCardTitle}
          </h2>
          <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.windows.schoolNameLabel}
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* School Logo Upload */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.windows.schoolLogoLabel}
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center">
                  <img
                    src={schoolLogo || './icon.svg'}
                    alt="Logo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{t.windows.logoUploadBtn}</span>
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  {schoolLogo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t.windows.logoRemoveBtn}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.windows.academicYearLabel}
                </label>
                <input
                  type="text"
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.windows.defaultReturnLabel}
                </label>
                <input
                  type="date"
                  required
                  value={defaultReturnDate}
                  onChange={(e) => setDefaultReturnDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {t.windows.saveSettingsBtn}
            </button>
          </form>
        </section>

        {/* 3. Backup & Data Reset */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.windows.backupCardTitle}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {t.windows.backupDesc}
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => exportLibraryBackupJson(storeData)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <HardDriveDownload className="h-3.5 w-3.5" />
              <span>{t.windows.exportJsonBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{t.windows.importJsonBtn}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onLoadDemo();
                onNotify(t.windows.toastDemoLoaded);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t.windows.loadDemoBtn}</span>
            </button>

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t.windows.clearAllBtn}</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-red-600 dark:text-red-400">
                  {t.windows.confirmClearAll}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                    onNotify(t.windows.toastCleared);
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 cursor-pointer"
                >
                  {t.common.yesDelete}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
