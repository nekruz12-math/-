/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  LayoutDashboard,
  Library,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import type {
  Book,
  Language,
  LibrarySettings,
  LibraryStoreData,
  NavSection,
  PaymentStatus,
  ReturnCondition,
  SchoolClass,
  Student,
} from './types/library';
import { EMPTY_LIBRARY_DATA, INITIAL_SEED_DATA } from './data/seedData';
import { getT } from './i18n/translations';
import { addDaysISO, todayISO } from './utils/exportTools';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardView } from './components/DashboardView';
import { TextbooksView } from './components/TextbooksView';
import { FictionView } from './components/FictionView';
import { CatalogView } from './components/CatalogView';
import { StudentsView } from './components/StudentsView';
import { WindowsInstallView } from './components/WindowsInstallView';

const STORAGE_KEY = 'kitobkhona_maktab_v1';

function deriveClassesFromStudents(
  existingClasses: SchoolClass[] | undefined,
  students: Student[]
): SchoolClass[] {
  const list = Array.isArray(existingClasses) ? [...existingClasses] : [];
  const seen = new Set(list.map((c) => `${c.grade}-${c.section}`));
  for (const st of students) {
    const key = `${st.grade}-${st.section}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({
        id: makeId('cls'),
        grade: st.grade,
        section: st.section,
        createdAt: st.createdAt || todayISO(),
      });
    }
  }
  return list;
}

function loadInitialStore(): LibraryStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LibraryStoreData;
      if (parsed && Array.isArray(parsed.books) && parsed.settings) {
        return {
          ...parsed,
          classes: deriveClassesFromStudents(parsed.classes, parsed.students || []),
        };
      }
    }
  } catch {
    // Fallback to initial seed data
  }
  return INITIAL_SEED_DATA;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function App() {
  const [store, setStore] = useState<LibraryStoreData>(loadInitialStore);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [issueTextbookOpen, setIssueTextbookOpen] = useState(false);
  const [issueFictionOpen, setIssueFictionOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const lang = store.settings.language;
  const theme = store.settings.theme;
  const t = getT(lang);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota errors
    }
  }, [store]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.lang = lang;
  }, [theme, lang]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const getAvailableCopies = (bookId: string): number => {
    const book = store.books.find((b) => b.id === bookId);
    if (!book) return 0;
    const activeTb = store.textbookLoans.filter(
      (l) => l.bookId === bookId && l.status === 'active'
    ).length;
    const activeFc = store.fictionLoans.filter(
      (l) => l.bookId === bookId && l.status === 'active'
    ).length;
    return Math.max(0, book.totalCopies - activeTb - activeFc);
  };

  // Language & Theme toggles
  const setLanguage = (nextLang: Language) => {
    setStore((prev) => ({
      ...prev,
      settings: { ...prev.settings, language: nextLang },
    }));
  };

  const toggleTheme = () => {
    setStore((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
      },
    }));
  };

  // Textbook Handlers
  const handleIssueTextbooksBulk = (payload: {
    studentId: string;
    bookIds: string[];
    issuedDate: string;
    dueReturnDate: string;
    paymentStatus: PaymentStatus;
    note?: string;
  }) => {
    setStore((prev) => {
      const newLoans = payload.bookIds.map((bookId) => {
        const bk = prev.books.find((b) => b.id === bookId);
        return {
          id: makeId('tl'),
          academicYear: prev.settings.academicYear,
          studentId: payload.studentId,
          bookId,
          issuedDate: payload.issuedDate,
          dueReturnDate: payload.dueReturnDate,
          status: 'active' as const,
          rentalFee: payload.paymentStatus === 'exempt' ? 0 : bk?.rentalPrice ?? 0,
          paymentStatus: payload.paymentStatus,
          note: payload.note,
        };
      });
      return {
        ...prev,
        textbookLoans: [...newLoans, ...prev.textbookLoans],
      };
    });
  };

  const handleReturnTextbook = (loanId: string, condition: ReturnCondition = 'good') => {
    setStore((prev) => ({
      ...prev,
      textbookLoans: prev.textbookLoans.map((l) =>
        l.id === loanId
          ? {
              ...l,
              status: 'returned',
              returnedDate: todayISO(),
              conditionOnReturn: condition,
            }
          : l
      ),
    }));
  };

  const handleReturnAllForStudent = (studentId: string, condition: ReturnCondition) => {
    setStore((prev) => ({
      ...prev,
      textbookLoans: prev.textbookLoans.map((l) =>
        l.studentId === studentId &&
        l.academicYear === prev.settings.academicYear &&
        l.status === 'active'
          ? {
              ...l,
              status: 'returned',
              returnedDate: todayISO(),
              conditionOnReturn: condition,
            }
          : l
      ),
    }));
  };

  const handleMarkPaid = (loanId: string) => {
    setStore((prev) => ({
      ...prev,
      textbookLoans: prev.textbookLoans.map((l) =>
        l.id === loanId ? { ...l, paymentStatus: 'paid' } : l
      ),
    }));
  };

  const handleDeleteTextbookLoan = (loanId: string) => {
    setStore((prev) => ({
      ...prev,
      textbookLoans: prev.textbookLoans.filter((l) => l.id !== loanId),
    }));
  };

  // Fiction Handlers
  const handleIssueFiction = (payload: {
    bookId: string;
    studentId: string;
    issuedDate: string;
    dueDate: string;
    loanFee: number;
    note?: string;
  }) => {
    setStore((prev) => ({
      ...prev,
      fictionLoans: [
        {
          id: makeId('fl'),
          bookId: payload.bookId,
          studentId: payload.studentId,
          issuedDate: payload.issuedDate,
          dueDate: payload.dueDate,
          status: 'active',
          loanFee: payload.loanFee,
          note: payload.note,
        },
        ...prev.fictionLoans,
      ],
    }));
  };

  const handleExtendFiction = (loanId: string, extraDays: number) => {
    setStore((prev) => ({
      ...prev,
      fictionLoans: prev.fictionLoans.map((l) =>
        l.id === loanId ? { ...l, dueDate: addDaysISO(l.dueDate, extraDays) } : l
      ),
    }));
  };

  const handleReturnFiction = (loanId: string) => {
    setStore((prev) => ({
      ...prev,
      fictionLoans: prev.fictionLoans.map((l) =>
        l.id === loanId ? { ...l, status: 'returned', returnedDate: todayISO() } : l
      ),
    }));
  };

  const handleDeleteFictionLoan = (loanId: string) => {
    setStore((prev) => ({
      ...prev,
      fictionLoans: prev.fictionLoans.filter((l) => l.id !== loanId),
    }));
  };

  // Book Catalog Handlers
  const handleSaveBook = (book: Omit<Book, 'id' | 'createdAt'>, editId?: string) => {
    setStore((prev) => {
      if (editId) {
        return {
          ...prev,
          books: prev.books.map((b) => (b.id === editId ? { ...b, ...book } : b)),
        };
      }
      return {
        ...prev,
        books: [
          {
            ...book,
            id: makeId('bk'),
            createdAt: todayISO(),
          },
          ...prev.books,
        ],
      };
    });
  };

  const handleDeleteBook = (bookId: string) => {
    setStore((prev) => ({
      ...prev,
      books: prev.books.filter((b) => b.id !== bookId),
      textbookLoans: prev.textbookLoans.filter((l) => l.bookId !== bookId),
      fictionLoans: prev.fictionLoans.filter((l) => l.bookId !== bookId),
    }));
  };

  // Class & Student Handlers
  const handleAddClass = (grade: number, section: string) => {
    const cleanSection = section.trim().toUpperCase() || 'А';
    setStore((prev) => {
      const exists = prev.classes.some(
        (c) => c.grade === grade && c.section === cleanSection
      );
      if (exists) return prev;
      return {
        ...prev,
        classes: [
          ...prev.classes,
          {
            id: makeId('cls'),
            grade,
            section: cleanSection,
            createdAt: todayISO(),
          },
        ],
      };
    });
  };

  const handleDeleteClass = (classId: string) => {
    setStore((prev) => {
      const target = prev.classes.find((c) => c.id === classId);
      if (!target) return prev;
      const removedStudentIds = new Set(
        prev.students
          .filter((s) => s.grade === target.grade && s.section === target.section)
          .map((s) => s.id)
      );
      return {
        ...prev,
        classes: prev.classes.filter((c) => c.id !== classId),
        students: prev.students.filter((s) => !removedStudentIds.has(s.id)),
        textbookLoans: prev.textbookLoans.filter((l) => !removedStudentIds.has(l.studentId)),
        fictionLoans: prev.fictionLoans.filter((l) => !removedStudentIds.has(l.studentId)),
      };
    });
  };

  const handleSaveStudent = (student: Omit<Student, 'id' | 'createdAt'>, editId?: string) => {
    const cleanSection = student.section.trim().toUpperCase() || 'А';
    setStore((prev) => {
      const hasClass = prev.classes.some(
        (c) => c.grade === student.grade && c.section === cleanSection
      );
      const nextClasses = hasClass
        ? prev.classes
        : [
            ...prev.classes,
            {
              id: makeId('cls'),
              grade: student.grade,
              section: cleanSection,
              createdAt: todayISO(),
            },
          ];

      if (editId) {
        return {
          ...prev,
          classes: nextClasses,
          students: prev.students.map((s) =>
            s.id === editId ? { ...s, ...student, section: cleanSection } : s
          ),
        };
      }
      return {
        ...prev,
        classes: nextClasses,
        students: [
          {
            ...student,
            section: cleanSection,
            id: makeId('st'),
            createdAt: todayISO(),
          },
          ...prev.students,
        ],
      };
    });
  };

  const handleAddStudentsBulk = (grade: number, section: string, names: string[]) => {
    const cleanSection = section.trim().toUpperCase() || 'А';
    setStore((prev) => {
      const newStudents: Student[] = names.map((name) => ({
        id: makeId('st'),
        fullName: name,
        grade,
        section: cleanSection,
        createdAt: todayISO(),
      }));
      return {
        ...prev,
        students: [...newStudents, ...prev.students],
      };
    });
  };

  const handleDeleteStudent = (studentId: string) => {
    setStore((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== studentId),
      textbookLoans: prev.textbookLoans.filter((l) => l.studentId !== studentId),
      fictionLoans: prev.fictionLoans.filter((l) => l.studentId !== studentId),
    }));
  };

  // Settings & Backup Handlers
  const handleUpdateSettings = (next: Partial<LibrarySettings>) => {
    setStore((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...next },
    }));
  };

  const handleImportBackup = (data: LibraryStoreData) => {
    setStore({
      ...data,
      classes: deriveClassesFromStudents(data.classes, data.students || []),
      settings: {
        ...data.settings,
        language: store.settings.language,
        theme: store.settings.theme,
      },
    });
  };

  const handleLoadDemo = () => {
    setStore((prev) => ({
      ...INITIAL_SEED_DATA,
      settings: {
        ...INITIAL_SEED_DATA.settings,
        language: prev.settings.language,
        theme: prev.settings.theme,
      },
    }));
  };

  const handleClearAll = () => {
    setStore((prev) => ({
      ...EMPTY_LIBRARY_DATA,
      settings: {
        ...prev.settings,
      },
    }));
  };

  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'textbooks', label: t.nav.textbooks, icon: <BookMarked className="h-4 w-4" /> },
    { id: 'fiction', label: t.nav.fiction, icon: <BookOpen className="h-4 w-4" /> },
    { id: 'catalog', label: t.nav.catalog, icon: <Library className="h-4 w-4" /> },
    { id: 'students', label: t.nav.students, icon: <Users className="h-4 w-4" /> },
    { id: 'windows', label: t.nav.windows, icon: <Settings className="h-4 w-4" /> },
  ];

  const navigateTo = (section: NavSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const SidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <img
            src={store.settings.schoolLogo || '/icon.svg'}
            alt={t.appName}
            className="h-9 w-9 rounded-lg shrink-0 object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {t.appName}
            </div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {store.settings.schoolName}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Bottom Controls: Language + Theme */}
      <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setLanguage('tg')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                lang === 'tg'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Тоҷикӣ
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ru')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                lang === 'ru'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Русский
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer shrink-0"
            title={theme === 'dark' ? t.common.lightMode : t.common.darkMode}
            aria-label={theme === 'dark' ? t.common.lightMode : t.common.darkMode}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 lg:block">
          <div className="sticky top-0 h-screen">{SidebarContent}</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative z-10 w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
              {SidebarContent}
            </aside>
          </div>
        )}

        {/* Main Workspace */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile Top Bar */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-display text-sm font-bold whitespace-nowrap">
                {t.appName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLanguage(lang === 'tg' ? 'ru' : 'tg')}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium dark:border-slate-700"
              >
                {lang === 'tg' ? 'РУС' : 'ТОҶ'}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg border border-slate-200 p-1.5 dark:border-slate-700"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1360px] flex-1 p-5 sm:p-7">
            {activeSection === 'dashboard' && (
              <DashboardView
                lang={lang}
                books={store.books}
                students={store.students}
                textbookLoans={store.textbookLoans}
                fictionLoans={store.fictionLoans}
                settings={store.settings}
                onNavigate={navigateTo}
                onOpenIssueTextbooks={() => {
                  setActiveSection('textbooks');
                  setIssueTextbookOpen(true);
                }}
                onOpenIssueFiction={() => {
                  setActiveSection('fiction');
                  setIssueFictionOpen(true);
                }}
                onReturnFiction={handleReturnFiction}
              />
            )}

            {activeSection === 'textbooks' && (
              <TextbooksView
                lang={lang}
                books={store.books}
                students={store.students}
                loans={store.textbookLoans}
                settings={store.settings}
                isModalOpen={issueTextbookOpen}
                onOpenModal={() => setIssueTextbookOpen(true)}
                onCloseModal={() => setIssueTextbookOpen(false)}
                onIssueBulk={handleIssueTextbooksBulk}
                onReturnLoan={handleReturnTextbook}
                onReturnAllForStudent={handleReturnAllForStudent}
                onMarkPaid={handleMarkPaid}
                onDeleteLoan={handleDeleteTextbookLoan}
                getAvailableCopies={getAvailableCopies}
              />
            )}

            {activeSection === 'fiction' && (
              <FictionView
                lang={lang}
                books={store.books}
                students={store.students}
                loans={store.fictionLoans}
                isModalOpen={issueFictionOpen}
                onOpenModal={() => setIssueFictionOpen(true)}
                onCloseModal={() => setIssueFictionOpen(false)}
                onIssueFiction={handleIssueFiction}
                onExtendFiction={handleExtendFiction}
                onReturnFiction={handleReturnFiction}
                onDeleteLoan={handleDeleteFictionLoan}
                getAvailableCopies={getAvailableCopies}
              />
            )}

            {activeSection === 'catalog' && (
              <CatalogView
                lang={lang}
                books={store.books}
                onSaveBook={handleSaveBook}
                onDeleteBook={handleDeleteBook}
                getAvailableCopies={getAvailableCopies}
              />
            )}

            {activeSection === 'students' && (
              <StudentsView
                lang={lang}
                classes={store.classes}
                students={store.students}
                books={store.books}
                textbookLoans={store.textbookLoans}
                fictionLoans={store.fictionLoans}
                onAddClass={handleAddClass}
                onDeleteClass={handleDeleteClass}
                onSaveStudent={handleSaveStudent}
                onAddStudentsBulk={handleAddStudentsBulk}
                onDeleteStudent={handleDeleteStudent}
                onReturnTextbook={(id) => handleReturnTextbook(id, 'good')}
                onReturnFiction={handleReturnFiction}
              />
            )}

            {activeSection === 'windows' && (
              <WindowsInstallView
                lang={lang}
                storeData={store}
                onUpdateSettings={handleUpdateSettings}
                onImportBackup={handleImportBackup}
                onLoadDemo={handleLoadDemo}
                onClearAll={handleClearAll}
                onNotify={showToast}
              />
            )}
          </main>
        </div>
      </div>

      {/* Offline Status Indicator & Toast */}
      <OfflineIndicator lang={lang} />

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900">
          {toast}
        </div>
      )}
    </div>
  );
}
