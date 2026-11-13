import React, { useMemo, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import type {
  Book,
  Language,
  LibrarySettings,
  PaymentStatus,
  ReturnCondition,
  Student,
  TextbookLoan,
} from '../types/library';
import { getT } from '../i18n/translations';
import { exportCsvUtf8Bom, todayISO } from '../utils/exportTools';

interface TextbooksViewProps {
  lang: Language;
  books: Book[];
  students: Student[];
  loans: TextbookLoan[];
  settings: LibrarySettings;
  isModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onIssueBulk: (payload: {
    studentId: string;
    bookIds: string[];
    issuedDate: string;
    dueReturnDate: string;
    paymentStatus: PaymentStatus;
    note?: string;
  }) => void;
  onReturnLoan: (loanId: string, condition: ReturnCondition) => void;
  onReturnAllForStudent: (studentId: string, condition: ReturnCondition) => void;
  onMarkPaid: (loanId: string) => void;
  onDeleteLoan: (loanId: string) => void;
  getAvailableCopies: (bookId: string) => number;
}

export const TextbooksView: React.FC<TextbooksViewProps> = ({
  lang,
  books,
  students,
  loans,
  settings,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  onIssueBulk,
  onReturnLoan,
  onReturnAllForStudent,
  onMarkPaid,
  onDeleteLoan,
  getAvailableCopies,
}) => {
  const t = getT(lang);
  const [statusFilter, setStatusFilter] = useState<'active' | 'returned' | 'all'>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Issue Modal state
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [issuedDate, setIssuedDate] = useState(todayISO());
  const [dueReturnDate, setDueReturnDate] = useState(settings.defaultReturnDate);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [issueNote, setIssueNote] = useState('');

  // Return modal state
  const [returningTarget, setReturningTarget] = useState<{
    mode: 'single' | 'student';
    id: string;
    label: string;
  } | null>(null);
  const [returnCondition, setReturnCondition] = useState<ReturnCondition>('good');

  const textbooks = useMemo(
    () => books.filter((b) => b.kind === 'textbook'),
    [books]
  );

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const alreadyActiveBookIdsForStudent = useMemo(() => {
    if (!selectedStudentId) return new Set<string>();
    return new Set(
      loans
        .filter(
          (l) =>
            l.studentId === selectedStudentId &&
            l.academicYear === settings.academicYear &&
            l.status === 'active'
        )
        .map((l) => l.bookId)
    );
  }, [loans, selectedStudentId, settings.academicYear]);

  const gradeMatchingBooks = useMemo(() => {
    if (!selectedStudent) return textbooks;
    return textbooks.filter((b) => b.grade === selectedStudent.grade);
  }, [textbooks, selectedStudent]);

  const otherTextbooks = useMemo(() => {
    if (!selectedStudent) return [];
    return textbooks.filter((b) => b.grade !== selectedStudent.grade);
  }, [textbooks, selectedStudent]);

  const handleSelectStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    const st = students.find((s) => s.id === studentId);
    if (!st) {
      setSelectedBookIds([]);
      return;
    }
    const existing = new Set(
      loans
        .filter(
          (l) =>
            l.studentId === studentId &&
            l.academicYear === settings.academicYear &&
            l.status === 'active'
        )
        .map((l) => l.bookId)
    );
    const autoIds = textbooks
      .filter(
        (b) =>
          b.grade === st.grade &&
          !existing.has(b.id) &&
          getAvailableCopies(b.id) > 0
      )
      .map((b) => b.id);
    setSelectedBookIds(autoIds);
  };

  const toggleBookSelection = (bookId: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const selectedTotalFee = useMemo(
    () =>
      selectedBookIds.reduce((sum, id) => {
        const b = textbooks.find((tb) => tb.id === id);
        return sum + (b?.rentalPrice ?? 0);
      }, 0),
    [selectedBookIds, textbooks]
  );

  const handleSubmitIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || selectedBookIds.length === 0) return;
    onIssueBulk({
      studentId: selectedStudentId,
      bookIds: selectedBookIds,
      issuedDate,
      dueReturnDate,
      paymentStatus,
      note: issueNote.trim() || undefined,
    });
    setSelectedStudentId('');
    setSelectedBookIds([]);
    setIssueNote('');
    onCloseModal();
  };

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans
      .filter((loan) => {
        if (loan.academicYear !== settings.academicYear) return false;
        if (statusFilter !== 'all' && loan.status !== statusFilter) return false;
        if (paymentFilter !== 'all' && loan.paymentStatus !== paymentFilter) return false;
        const st = students.find((s) => s.id === loan.studentId);
        const bk = books.find((b) => b.id === loan.bookId);
        if (gradeFilter !== 'all' && String(st?.grade ?? '') !== gradeFilter) return false;
        if (q) {
          const hay = `${st?.fullName ?? ''} ${st?.grade ?? ''}${st?.section ?? ''} ${bk?.title ?? ''} ${bk?.inventoryCode ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate));
  }, [loans, settings.academicYear, statusFilter, paymentFilter, gradeFilter, search, students, books]);

  const handleExportCsv = () => {
    const headers = [
      t.common.academicYear,
      t.common.student,
      t.common.grade,
      t.common.book,
      t.catalog.colCode,
      t.textbooks.issuedDate,
      t.textbooks.dueReturnDate,
      t.textbooks.returnedDate,
      t.textbooks.rentalFee,
      t.textbooks.paymentStatusLabel,
      t.common.status,
    ];
    const rows = filteredLoans.map((l) => {
      const st = students.find((s) => s.id === l.studentId);
      const bk = books.find((b) => b.id === l.bookId);
      const payTxt =
        l.paymentStatus === 'paid'
          ? t.textbooks.paymentPaid
          : l.paymentStatus === 'exempt'
          ? t.textbooks.paymentExempt
          : t.textbooks.paymentUnpaid;
      const stTxt = l.status === 'active' ? t.textbooks.statusActive : t.textbooks.statusReturned;
      return [
        l.academicYear,
        st?.fullName ?? '—',
        st ? `${st.grade}${st.section}` : '—',
        bk?.title ?? '—',
        bk?.inventoryCode ?? '—',
        l.issuedDate,
        l.dueReturnDate,
        l.returnedDate ?? '',
        l.rentalFee,
        payTxt,
        stTxt,
      ];
    });
    exportCsvUtf8Bom(headers, rows, `textbooks-rental-${settings.academicYear}.csv`);
  };

  // Unique students with active loans in current filtered view (for 1-click "Accept all books from student")
  const activeStudentsCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of filteredLoans) {
      if (l.status === 'active') {
        map.set(l.studentId, (map.get(l.studentId) ?? 0) + 1);
      }
    }
    return map;
  }, [filteredLoans]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.textbooks.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.textbooks.subtitle} · {t.common.academicYear} {settings.academicYear}
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
            <span>{t.textbooks.issueBulkBtn.replace('+ ', '')}</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(['all', 'active', 'returned'] as const).map((tab) => {
            const label =
              tab === 'all'
                ? t.textbooks.filterAll
                : tab === 'active'
                ? t.textbooks.filterActive
                : t.textbooks.filterReturned;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.common.search}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
            />
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">{t.textbooks.filterAllGrades}</option>
            {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={String(g)}>
                {t.common.classLabel} {g}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">{t.textbooks.filterPaymentAll}</option>
            <option value="paid">{t.textbooks.paymentPaid}</option>
            <option value="unpaid">{t.textbooks.paymentUnpaid}</option>
            <option value="exempt">{t.textbooks.paymentExempt}</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filteredLoans.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <BookMarked className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.textbooks.emptyTitle}
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              {t.textbooks.emptyDesc}
            </p>
            <button
              type="button"
              onClick={onOpenModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.textbooks.issueBulkBtn.replace('+ ', '')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">{t.common.student}</th>
                  <th className="px-4 py-3 font-medium">{t.common.book}</th>
                  <th className="px-4 py-3 font-medium">{t.textbooks.issuedDate}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.textbooks.rentalFee}</th>
                  <th className="px-4 py-3 font-medium">{t.textbooks.paymentStatusLabel}</th>
                  <th className="px-4 py-3 font-medium">{t.common.status}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLoans.map((loan) => {
                  const st = students.find((s) => s.id === loan.studentId);
                  const bk = books.find((b) => b.id === loan.bookId);
                  const studentActiveTotal = activeStudentsCount.get(loan.studentId) ?? 0;

                  return (
                    <tr
                      key={loan.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {st?.fullName ?? '—'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {st ? `${t.common.classLabel} ${st.grade}${st.section}` : '—'}
                          {loan.status === 'active' && studentActiveTotal > 1 && (
                            <>
                              {' · '}
                              <button
                                type="button"
                                onClick={() =>
                                  setReturningTarget({
                                    mode: 'student',
                                    id: loan.studentId,
                                    label: `${st?.fullName ?? ''} (${studentActiveTotal} ${t.common.book.toLowerCase()})`,
                                  })
                                }
                                className="font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                              >
                                {t.textbooks.returnAllStudentBtn} ({studentActiveTotal})
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {bk?.title ?? '—'}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {bk?.inventoryCode ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        <div>{loan.issuedDate}</div>
                        <div className="text-[11px] text-slate-400">
                          {loan.returnedDate
                            ? `${t.textbooks.returnedDate}: ${loan.returnedDate}`
                            : `${t.textbooks.dueReturnDate}: ${loan.dueReturnDate}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {loan.rentalFee} {t.common.currency}
                      </td>
                      <td className="px-4 py-3">
                        {loan.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{t.textbooks.paymentPaid}</span>
                          </span>
                        ) : loan.paymentStatus === 'exempt' ? (
                          <span className="text-slate-600 dark:text-slate-300">
                            {t.textbooks.paymentExempt}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{t.textbooks.paymentUnpaid}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => onMarkPaid(loan.id)}
                              className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                            >
                              {t.textbooks.markPaidBtn}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {loan.status === 'active' ? (
                          <span className="font-medium text-blue-700 dark:text-blue-400">
                            {t.textbooks.statusActive}
                          </span>
                        ) : (
                          <div>
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              {t.textbooks.statusReturned}
                            </span>
                            {loan.conditionOnReturn && (
                              <span className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                ·{' '}
                                {loan.conditionOnReturn === 'good'
                                  ? t.textbooks.conditionGood
                                  : loan.conditionOnReturn === 'damaged'
                                  ? t.textbooks.conditionDamaged
                                  : t.textbooks.conditionLost}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {loan.status === 'active' && (
                            <button
                              type="button"
                              onClick={() =>
                                setReturningTarget({
                                  mode: 'single',
                                  id: loan.id,
                                  label: `${bk?.title ?? ''} — ${st?.fullName ?? ''}`,
                                })
                              }
                              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              {t.textbooks.returnOneBtn}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteLoan(loan.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer"
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

      {/* Bulk Issue Modal (Beginning of School Year) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.textbooks.modalTitle}
              </h2>
              <button
                type="button"
                onClick={onCloseModal}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitIssue} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.textbooks.selectStudent}
                  </label>
                  <select
                    required
                    value={selectedStudentId}
                    onChange={(e) => handleSelectStudentChange(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">— {t.textbooks.selectStudent} —</option>
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
                    {t.textbooks.dueReturnDate}
                  </label>
                  <input
                    type="date"
                    required
                    value={dueReturnDate}
                    onChange={(e) => setDueReturnDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Textbook checklist */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {selectedStudent
                      ? `${t.textbooks.matchingBooks} (${selectedStudent.grade})`
                      : t.textbooks.selectGradeFirst}
                  </span>
                  {selectedStudent && gradeMatchingBooks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectStudentChange(selectedStudent.id)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                    >
                      {t.textbooks.selectAllForGrade}
                    </button>
                  )}
                </div>

                <div className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                  {gradeMatchingBooks.length === 0 && otherTextbooks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t.common.noData}
                    </div>
                  ) : (
                    <>
                      {gradeMatchingBooks.map((bk) => {
                        const avail = getAvailableCopies(bk.id);
                        const already = alreadyActiveBookIdsForStudent.has(bk.id);
                        const disabled = already || avail <= 0;
                        const checked = selectedBookIds.includes(bk.id);
                        return (
                          <label
                            key={bk.id}
                            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs ${
                              disabled
                                ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40'
                                : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={checked}
                                onChange={() => toggleBookSelection(bk.id)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                                  {bk.title}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {bk.inventoryCode} · {t.common.available}: {avail}
                                  {already && ` · ${t.textbooks.alreadyIssuedNotice}`}
                                  {!already && avail <= 0 && ` · ${t.textbooks.outOfStockNotice}`}
                                </div>
                              </div>
                            </div>
                            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
                              {bk.rentalPrice} {t.common.currency}
                            </span>
                          </label>
                        );
                      })}
                      {otherTextbooks.length > 0 && (
                        <>
                          <div className="bg-slate-50 px-3.5 py-1.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {t.textbooks.allTextbooksFallback}
                          </div>
                          {otherTextbooks.map((bk) => {
                            const avail = getAvailableCopies(bk.id);
                            const already = alreadyActiveBookIdsForStudent.has(bk.id);
                            const disabled = already || avail <= 0;
                            const checked = selectedBookIds.includes(bk.id);
                            return (
                              <label
                                key={bk.id}
                                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs ${
                                  disabled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={checked}
                                    onChange={() => toggleBookSelection(bk.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                                      {bk.title}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {t.common.classLabel} {bk.grade} · {t.common.available}: {avail}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
                                  {bk.rentalPrice} {t.common.currency}
                                </span>
                              </label>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.textbooks.paymentStatusLabel}
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="paid">{t.textbooks.paymentPaid}</option>
                    <option value="unpaid">{t.textbooks.paymentUnpaid}</option>
                    <option value="exempt">{t.textbooks.paymentExempt}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.common.notes}
                  </label>
                  <input
                    type="text"
                    value={issueNote}
                    onChange={(e) => setIssueNote(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {t.textbooks.totalFeeLabel}:{' '}
                  <strong className="font-mono text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                    {paymentStatus === 'exempt' ? 0 : selectedTotalFee} {t.common.currency}
                  </strong>{' '}
                  ({selectedBookIds.length})
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onCloseModal}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedStudentId || selectedBookIds.length === 0}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {t.textbooks.submitIssue}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Confirmation Modal (End of Year) */}
      {returningTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.textbooks.returnModalTitle}
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              {returningTarget.label}
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.textbooks.returnConditionLabel}
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['good', 'damaged', 'lost'] as const).map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setReturnCondition(cond)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      returnCondition === cond
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cond === 'good'
                      ? t.textbooks.conditionGood
                      : cond === 'damaged'
                      ? t.textbooks.conditionDamaged
                      : t.textbooks.conditionLost}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReturningTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (returningTarget.mode === 'single') {
                    onReturnLoan(returningTarget.id, returnCondition);
                  } else {
                    onReturnAllForStudent(returningTarget.id, returnCondition);
                  }
                  setReturningTarget(null);
                  setReturnCondition('good');
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
              >
                {t.textbooks.confirmReturn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
