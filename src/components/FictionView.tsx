import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Book, FictionLoan, Language, Student } from '../types/library';
import { getT } from '../i18n/translations';
import {
  addDaysISO,
  daysDiffFromToday,
  exportCsvUtf8Bom,
  todayISO,
} from '../utils/exportTools';

interface FictionViewProps {
  lang: Language;
  books: Book[];
  students: Student[];
  loans: FictionLoan[];
  isModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onIssueFiction: (payload: {
    bookId: string;
    studentId: string;
    issuedDate: string;
    dueDate: string;
    loanFee: number;
    note?: string;
  }) => void;
  onExtendFiction: (loanId: string, extraDays: number) => void;
  onReturnFiction: (loanId: string) => void;
  onDeleteLoan: (loanId: string) => void;
  getAvailableCopies: (bookId: string) => number;
}

export const FictionView: React.FC<FictionViewProps> = ({
  lang,
  books,
  students,
  loans,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  onIssueFiction,
  onExtendFiction,
  onReturnFiction,
  onDeleteLoan,
  getAvailableCopies,
}) => {
  const t = getT(lang);
  // Default to 'all' so returned books remain visible and marked as Returned ("Супорида шуд")
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [search, setSearch] = useState('');

  // Modal state
  const [bookId, setBookId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [issuedDate, setIssuedDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 14));
  const [loanFee, setLoanFee] = useState(0);
  const [note, setNote] = useState('');

  const fictionBooks = useMemo(
    () => books.filter((b) => b.kind === 'fiction'),
    [books]
  );

  const handleBookSelect = (selectedId: string) => {
    setBookId(selectedId);
    const bk = fictionBooks.find((b) => b.id === selectedId);
    setLoanFee(bk?.rentalPrice ?? 0);
  };

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans
      .filter((loan) => {
        const diff = daysDiffFromToday(loan.dueDate);
        if (filter === 'active' && loan.status !== 'active') return false;
        if (filter === 'overdue' && !(loan.status === 'active' && diff < 0)) return false;
        if (filter === 'returned' && loan.status !== 'returned') return false;

        if (q) {
          const st = students.find((s) => s.id === loan.studentId);
          const bk = books.find((b) => b.id === loan.bookId);
          const hay = `${st?.fullName ?? ''} ${bk?.title ?? ''} ${bk?.inventoryCode ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [loans, filter, search, students, books]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookId || !studentId) return;
    onIssueFiction({
      bookId,
      studentId,
      issuedDate,
      dueDate,
      loanFee: Math.max(0, Number(loanFee) || 0),
      note: note.trim() || undefined,
    });
    setBookId('');
    setStudentId('');
    setLoanFee(0);
    setNote('');
    onCloseModal();
  };

  const handleExportCsv = () => {
    const headers = [
      t.common.book,
      t.catalog.colCode,
      t.common.student,
      t.common.grade,
      t.textbooks.issuedDate,
      t.fiction.dueDateLabel,
      t.textbooks.returnedDate,
      t.fiction.feeLabel,
      t.common.status,
    ];
    const rows = filteredLoans.map((l) => {
      const bk = books.find((b) => b.id === l.bookId);
      const st = students.find((s) => s.id === l.studentId);
      const diff = daysDiffFromToday(l.dueDate);
      const stTxt =
        l.status === 'returned'
          ? t.fiction.statusReturned
          : diff < 0
          ? t.fiction.statusOverdue
          : t.fiction.statusOnTime;
      return [
        bk?.title ?? '—',
        bk?.inventoryCode ?? '—',
        st?.fullName ?? '—',
        st ? `${st.grade}${st.section}` : '—',
        l.issuedDate,
        l.dueDate,
        l.returnedDate ?? '',
        l.loanFee ?? 0,
        stTxt,
      ];
    });
    exportCsvUtf8Bom(headers, rows, `fiction-loans-${todayISO()}.csv`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.fiction.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.fiction.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.common.exportCsv}</span>
          </button>
          <button
            type="button"
            onClick={onOpenModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.fiction.issueBtn.replace('+ ', '')}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(['all', 'active', 'overdue', 'returned'] as const).map((tab) => {
            const label =
              tab === 'all'
                ? t.fiction.filterAll
                : tab === 'active'
                ? t.fiction.filterActive
                : tab === 'overdue'
                ? t.fiction.filterOverdue
                : t.fiction.filterReturned;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.common.search}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filteredLoans.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.fiction.emptyTitle}
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              {t.fiction.emptyDesc}
            </p>
            <button
              type="button"
              onClick={onOpenModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.fiction.issueBtn.replace('+ ', '')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">{t.common.book}</th>
                  <th className="px-4 py-3 font-medium">{t.common.student}</th>
                  <th className="px-4 py-3 font-medium">{t.textbooks.issuedDate}</th>
                  <th className="px-4 py-3 font-medium">{t.fiction.dueDateLabel}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.catalog.colPrice}</th>
                  <th className="px-4 py-3 font-medium">{t.common.status}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLoans.map((loan) => {
                  const bk = books.find((b) => b.id === loan.bookId);
                  const st = students.find((s) => s.id === loan.studentId);
                  const diff = daysDiffFromToday(loan.dueDate);
                  const isOverdue = loan.status === 'active' && diff < 0;
                  const isDueSoon = loan.status === 'active' && diff >= 0 && diff <= 3;

                  return (
                    <tr
                      key={loan.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {bk?.title ?? '—'}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {bk?.inventoryCode ?? ''}
                          {bk?.genre ? ` · ${bk.genre}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {st?.fullName ?? '—'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {st ? `${t.common.classLabel} ${st.grade}${st.section}` : '—'}
                          {loan.note ? ` · ${loan.note}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {loan.issuedDate}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                        <div>{loan.dueDate}</div>
                        {loan.returnedDate && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            {t.textbooks.returnedDate}: {loan.returnedDate}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {loan.loanFee ?? 0} {t.common.currency}
                      </td>
                      <td className="px-4 py-3">
                        {loan.status === 'returned' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{t.fiction.statusReturned}</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>
                              {t.fiction.statusOverdue} ({Math.abs(diff)} {t.dashboard.daysOverdue})
                            </span>
                          </span>
                        ) : isDueSoon ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {diff === 0
                                ? t.dashboard.dueToday
                                : `${t.fiction.statusDueSoon} (${diff} ${t.dashboard.daysLeft})`}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {t.fiction.statusOnTime} ({diff} {t.dashboard.daysLeft})
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {loan.status === 'active' && (
                            <>
                              <button
                                type="button"
                                onClick={() => onExtendFiction(loan.id, 7)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                {t.fiction.extend7Days}
                              </button>
                              <button
                                type="button"
                                onClick={() => onReturnFiction(loan.id)}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                {t.fiction.returnBtn}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteLoan(loan.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                            title={t.common.delete}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue Fiction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.fiction.modalTitle}
              </h2>
              <button
                type="button"
                onClick={onCloseModal}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.fiction.selectBook}
                </label>
                <select
                  required
                  value={bookId}
                  onChange={(e) => handleBookSelect(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">— {t.fiction.selectBook} —</option>
                  {fictionBooks.map((bk) => {
                    const avail = getAvailableCopies(bk.id);
                    return (
                      <option key={bk.id} value={bk.id} disabled={avail <= 0}>
                        {bk.title} ({bk.inventoryCode}) — {t.common.available}: {avail}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.fiction.selectStudent}
                </label>
                <select
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">— {t.fiction.selectStudent} —</option>
                  {students
                    .slice()
                    .sort((a, b) => a.grade - b.grade || a.fullName.localeCompare(b.fullName))
                    .map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.grade}
                        {st.section} — {st.fullName}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.fiction.durationLabel}
                </label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {[
                    { days: 7, label: t.fiction.days7 },
                    { days: 14, label: t.fiction.days14 },
                    { days: 21, label: t.fiction.days21 },
                    { days: 30, label: t.fiction.days30 },
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setDueDate(addDaysISO(issuedDate, opt.days))}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.textbooks.issuedDate}
                  </label>
                  <input
                    type="date"
                    required
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.fiction.dueDateLabel}
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.fiction.feeLabel}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={loanFee}
                    onChange={(e) => setLoanFee(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.common.notes}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                >
                  {t.fiction.submitIssue}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
