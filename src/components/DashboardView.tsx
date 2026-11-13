import React from 'react';
import {
  BookOpen,
  BookMarked,
  Clock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  PackageOpen,
  Wallet,
} from 'lucide-react';
import type {
  Book,
  FictionLoan,
  Language,
  LibrarySettings,
  NavSection,
  Student,
  TextbookLoan,
} from '../types/library';
import { getT } from '../i18n/translations';
import { daysDiffFromToday } from '../utils/exportTools';

interface DashboardViewProps {
  lang: Language;
  books: Book[];
  students: Student[];
  textbookLoans: TextbookLoan[];
  fictionLoans: FictionLoan[];
  settings: LibrarySettings;
  onNavigate: (section: NavSection) => void;
  onOpenIssueTextbooks: () => void;
  onOpenIssueFiction: () => void;
  onReturnFiction: (loanId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  lang,
  books,
  students,
  textbookLoans,
  fictionLoans,
  settings,
  onNavigate,
  onOpenIssueTextbooks,
  onOpenIssueFiction,
  onReturnFiction,
}) => {
  const t = getT(lang);

  const totalBookCopies = books.reduce((sum, b) => sum + b.totalCopies, 0);
  const currentYearLoans = textbookLoans.filter(
    (l) => l.academicYear === settings.academicYear
  );
  const activeTextbookLoans = currentYearLoans.filter((l) => l.status === 'active');
  const activeFictionLoans = fictionLoans.filter((l) => l.status === 'active');
  const returnedFictionLoans = fictionLoans.filter((l) => l.status === 'returned');
  const overdueFictionLoans = activeFictionLoans.filter(
    (l) => daysDiffFromToday(l.dueDate) < 0
  );
  const onTimeFictionLoans = activeFictionLoans.filter(
    (l) => daysDiffFromToday(l.dueDate) >= 0
  );

  // Projected income from fiction loans (using loanFee or book's rentalPrice fallback)
  const getLoanFee = (loan: FictionLoan) => {
    if (typeof loan.loanFee === 'number') return loan.loanFee;
    const bk = books.find((b) => b.id === loan.bookId);
    return bk?.rentalPrice ?? 0;
  };
  const activeFictionProjectedIncome = activeFictionLoans.reduce(
    (sum, l) => sum + getLoanFee(l),
    0
  );
  const returnedFictionIncome = returnedFictionLoans.reduce(
    (sum, l) => sum + getLoanFee(l),
    0
  );
  const totalFictionProjectedIncome = activeFictionProjectedIncome + returnedFictionIncome;

  // Grade-by-grade textbook progress (1..11)
  const gradeStats = Array.from({ length: 11 }, (_, i) => i + 1)
    .map((grade) => {
      const gradeStudentIds = new Set(
        students.filter((s) => s.grade === grade).map((s) => s.id)
      );
      const loans = currentYearLoans.filter((l) => gradeStudentIds.has(l.studentId));
      const active = loans.filter((l) => l.status === 'active').length;
      const returned = loans.filter((l) => l.status === 'returned').length;
      return {
        grade,
        total: loans.length,
        active,
        returned,
      };
    })
    .filter((g) => g.total > 0);

  // Fiction alerts (overdue or due within 3 days)
  const alertFiction = activeFictionLoans
    .map((loan) => ({
      loan,
      diff: daysDiffFromToday(loan.dueDate),
      book: books.find((b) => b.id === loan.bookId),
      student: students.find((s) => s.id === loan.studentId),
    }))
    .filter((item) => item.diff <= 3)
    .sort((a, b) => a.diff - b.diff);

  // Books with fewer than 3 available copies remaining
  const activeCountByBookId = new Map<string, number>();
  for (const l of textbookLoans) {
    if (l.status === 'active') {
      activeCountByBookId.set(l.bookId, (activeCountByBookId.get(l.bookId) ?? 0) + 1);
    }
  }
  for (const l of fictionLoans) {
    if (l.status === 'active') {
      activeCountByBookId.set(l.bookId, (activeCountByBookId.get(l.bookId) ?? 0) + 1);
    }
  }
  const lowStockBooks = books
    .map((book) => {
      const issued = activeCountByBookId.get(book.id) ?? 0;
      const available = Math.max(0, book.totalCopies - issued);
      return { book, available, issued };
    })
    .filter((item) => item.available < 3)
    .sort((a, b) => a.available - b.available || a.book.title.localeCompare(b.book.title));

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.dashboard.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.dashboard.subtitle} · {t.common.academicYear} {settings.academicYear}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenIssueFiction}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.dashboard.quickIssueFiction}
          </button>
          <button
            type="button"
            onClick={onOpenIssueTextbooks}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.dashboard.quickIssueTextbook}
          </button>
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('catalog')}
          className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.dashboard.kpiTotalBooks}
            </span>
            <BookOpen className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {totalBookCopies}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {books.length} {lang === 'tg' ? 'номгӯй' : 'наим.'} · {t.dashboard.kpiTotalBooksSub}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('textbooks')}
          className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.dashboard.kpiTextbooksRented}
            </span>
            <BookMarked className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {activeTextbookLoans.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t.dashboard.kpiTextbooksSub}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('fiction')}
          className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.dashboard.kpiFictionOut}
            </span>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {activeFictionLoans.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t.dashboard.kpiFictionSub}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('fiction')}
          className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.dashboard.kpiOverdue}
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${
                overdueFictionLoans.length > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
          </div>
          <div
            className={`mt-3 font-mono text-3xl font-semibold tabular-nums ${
              overdueFictionLoans.length > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {overdueFictionLoans.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t.dashboard.kpiOverdueSub}
          </div>
        </button>
      </div>

      {/* Fiction Projected Income & Overdue Status Summary Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.financeCardTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('fiction')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{t.nav.fiction}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3 md:divide-x md:divide-slate-100 dark:md:divide-slate-800">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.dashboard.financeProjectedLabel}
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {totalFictionProjectedIncome.toFixed(2).replace(/\.00$/, '')} {t.common.currency}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {fictionLoans.length} {lang === 'tg' ? 'сабти умумӣ' : 'всего выдач'}
            </div>
          </div>

          <div className="md:pl-6">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.dashboard.financeActiveValueLabel} / {t.dashboard.financeReturnedValueLabel}
            </div>
            <div className="mt-2 flex items-baseline gap-3 font-mono text-lg font-semibold tabular-nums">
              <span className="text-blue-700 dark:text-blue-400">
                {activeFictionProjectedIncome} {t.common.currency}
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-emerald-700 dark:text-emerald-400">
                {returnedFictionIncome} {t.common.currency}
              </span>
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {t.dashboard.financeOnTimeLabel}: <span className="font-mono font-medium">{onTimeFictionLoans.length}</span>
            </div>
          </div>

          <div className="md:pl-6">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.dashboard.financeOverdueLabel}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {overdueFictionLoans.length > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="font-mono text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                    {overdueFictionLoans.length}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    0
                  </span>
                </>
              )}
            </div>
            <div
              className={`mt-1.5 text-xs font-medium ${
                overdueFictionLoans.length > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {overdueFictionLoans.length > 0
                ? t.dashboard.financeOverdueWarning
                : t.dashboard.financeNominalStatus}
            </div>
          </div>
        </div>
      </section>

      {/* 2-Column Analytical Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Grade 1-11 Textbook Rental & Return Progress */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.gradeProgressTitle}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('textbooks')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.nav.textbooks}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {gradeStats.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {t.dashboard.gradeProgressEmpty}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {gradeStats.map((g) => {
                const returnedPct = g.total > 0 ? Math.round((g.returned / g.total) * 100) : 0;
                return (
                  <div key={g.grade} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {t.common.classLabel} {g.grade}
                      </span>
                      <div className="flex items-center gap-3 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        <span>
                          {t.dashboard.activeCount}: <strong className="text-slate-900 dark:text-slate-100">{g.active}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.dashboard.returnedCount}: <strong className="text-emerald-600 dark:text-emerald-400">{g.returned}</strong>
                        </span>
                        <span aria-hidden="true">/</span>
                        <span>{g.total}</span>
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-200"
                        style={{ width: `${returnedPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Fiction Due Soon & Overdue Quick Returns */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.fictionAlertTitle}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('fiction')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.nav.fiction}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {alertFiction.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-2.5 text-sm text-slate-500 dark:text-slate-400">
                {t.dashboard.fictionAlertEmpty}
              </p>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {alertFiction.map(({ loan, diff, book, student }) => {
                const isOverdue = diff < 0;
                return (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {book?.title ?? '—'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {student ? `${student.fullName} (${student.grade}${student.section})` : '—'}
                      </p>
                      <p
                        className={`mt-1 font-mono text-xs font-medium tabular-nums ${
                          isOverdue
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isOverdue
                          ? `${Math.abs(diff)} ${t.dashboard.daysOverdue}`
                          : diff === 0
                          ? t.dashboard.dueToday
                          : `${diff} ${t.dashboard.daysLeft}`}
                        {' · '}
                        {loan.dueDate}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onReturnFiction(loan.id)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.dashboard.quickReturn}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Low Stock Books (< 3 Available Copies) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <PackageOpen
              className={`h-4 w-4 shrink-0 ${
                lowStockBooks.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.lowStockTitle}
            </h2>
            {lowStockBooks.length > 0 && (
              <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                ({lowStockBooks.length})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('catalog')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{t.nav.catalog}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {lowStockBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t.dashboard.lowStockEmpty}
            </p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {lowStockBooks.map(({ book, available }) => {
              const isOut = available === 0;
              return (
                <div
                  key={book.id}
                  className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {book.title}
                      </span>
                      <span className="font-mono text-xs text-slate-400 shrink-0">
                        {book.inventoryCode}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {book.kind === 'textbook'
                        ? `${t.catalog.kindTextbook}${book.grade ? ` · ${t.common.classLabel} ${book.grade}` : ''}`
                        : `${t.catalog.kindFiction}${book.genre ? ` · ${book.genre}` : ''}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right font-mono text-xs tabular-nums">
                      <span
                        className={`font-semibold ${
                          isOut
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {available}
                      </span>
                      <span className="text-slate-400"> / {book.totalCopies} {t.common.copies}</span>
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        isOut
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isOut ? t.dashboard.lowStockOutOfStock : t.dashboard.lowStockNeedsReplenish}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
