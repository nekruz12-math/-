import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Book, BookKind, Language } from '../types/library';
import { getT } from '../i18n/translations';
import { exportCsvUtf8Bom, todayISO } from '../utils/exportTools';

interface CatalogViewProps {
  lang: Language;
  books: Book[];
  onSaveBook: (book: Omit<Book, 'id' | 'createdAt'>, editId?: string) => void;
  onDeleteBook: (bookId: string) => void;
  getAvailableCopies: (bookId: string) => number;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  lang,
  books,
  onSaveBook,
  onDeleteBook,
  getAvailableCopies,
}) => {
  const t = getT(lang);
  const [kindFilter, setKindFilter] = useState<'all' | BookKind>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [kind, setKind] = useState<BookKind>('textbook');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [genre, setGenre] = useState('');
  const [grade, setGrade] = useState(7);
  const [inventoryCode, setInventoryCode] = useState('');
  const [totalCopies, setTotalCopies] = useState(30);
  const [rentalPrice, setRentalPrice] = useState(10);

  const openAddModal = () => {
    setEditingId(undefined);
    setKind('textbook');
    setTitle('');
    setSubject('');
    setGenre('');
    setGrade(7);
    setInventoryCode('');
    setTotalCopies(30);
    setRentalPrice(10);
    setModalOpen(true);
  };

  const openEditModal = (bk: Book) => {
    setEditingId(bk.id);
    setKind(bk.kind);
    setTitle(bk.title);
    setSubject(bk.subject ?? '');
    setGenre(bk.genre ?? '');
    setGrade(bk.grade ?? 7);
    setInventoryCode(bk.inventoryCode);
    setTotalCopies(bk.totalCopies);
    setRentalPrice(bk.rentalPrice);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !inventoryCode.trim()) return;
    onSaveBook(
      {
        kind,
        title: title.trim(),
        subject: kind === 'textbook' ? subject.trim() || undefined : undefined,
        grade: kind === 'textbook' ? grade : undefined,
        genre: kind === 'fiction' ? genre.trim() || undefined : undefined,
        inventoryCode: inventoryCode.trim(),
        totalCopies: Math.max(1, Number(totalCopies) || 1),
        rentalPrice: Math.max(0, Number(rentalPrice) || 0),
      },
      editingId
    );
    setModalOpen(false);
  };

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books
      .filter((b) => {
        if (kindFilter !== 'all' && b.kind !== kindFilter) return false;
        if (gradeFilter !== 'all' && String(b.grade ?? '') !== gradeFilter) return false;
        if (q) {
          const hay = `${b.title} ${b.subject ?? ''} ${b.genre ?? ''} ${b.inventoryCode}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.kind.localeCompare(b.kind) || (a.grade ?? 99) - (b.grade ?? 99) || a.title.localeCompare(b.title));
  }, [books, kindFilter, gradeFilter, search]);

  const handleExportCsv = () => {
    const headers = [
      t.catalog.colCode,
      t.catalog.kindLabel,
      t.catalog.colTitle,
      t.catalog.colCategory,
      t.common.grade,
      t.common.available,
      t.common.total,
      t.catalog.colPrice,
    ];
    const rows = filteredBooks.map((b) => [
      b.inventoryCode,
      b.kind === 'textbook' ? t.catalog.kindTextbook : t.catalog.kindFiction,
      b.title,
      b.kind === 'textbook' ? b.subject ?? '' : b.genre ?? '',
      b.kind === 'textbook' ? b.grade ?? '' : '',
      getAvailableCopies(b.id),
      b.totalCopies,
      b.rentalPrice,
    ]);
    exportCsvUtf8Bom(headers, rows, `library-catalog-${todayISO()}.csv`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.catalog.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.catalog.subtitle}
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
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.catalog.addBookBtn.replace('+ ', '')}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(['all', 'textbook', 'fiction'] as const).map((tab) => {
            const label =
              tab === 'all'
                ? t.catalog.kindAll
                : tab === 'textbook'
                ? t.catalog.kindTextbook
                : t.catalog.kindFiction;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setKindFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  kindFilter === tab
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
          <div className="relative min-w-[210px] flex-1 sm:flex-initial">
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
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.catalog.emptyTitle}
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              {t.catalog.emptyDesc}
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.catalog.addBookBtn.replace('+ ', '')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">{t.catalog.colCode}</th>
                  <th className="px-4 py-3 font-medium">{t.catalog.colTitle}</th>
                  <th className="px-4 py-3 font-medium">{t.catalog.colCategory}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.catalog.colCopies}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.catalog.colPrice}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBooks.map((bk) => {
                  const avail = getAvailableCopies(bk.id);
                  return (
                    <tr
                      key={bk.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {bk.inventoryCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {bk.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {bk.kind === 'textbook'
                            ? `${t.catalog.kindTextbook}${bk.grade ? ` · ${t.common.classLabel} ${bk.grade}` : ''}`
                            : t.catalog.kindFiction}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {bk.kind === 'textbook' ? bk.subject ?? '—' : bk.genre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <span
                          className={`font-semibold ${
                            avail === 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {avail}
                        </span>
                        <span className="text-slate-400"> / {bk.totalCopies}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                        {bk.rentalPrice} {t.common.currency}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(bk)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            title={t.common.edit}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBook(bk.id)}
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

      {/* Add/Edit Book Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingId ? t.catalog.modalEditTitle : t.catalog.modalAddTitle}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.catalog.kindLabel}
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(['textbook', 'fiction'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        kind === k
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {k === 'textbook' ? t.catalog.kindTextbook : t.catalog.kindFiction}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.catalog.titleLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.catalog.codeLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={inventoryCode}
                    onChange={(e) => setInventoryCode(e.target.value)}
                    placeholder={kind === 'textbook' ? 'ФН-07-004' : 'БД-005'}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {kind === 'textbook' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        {t.catalog.gradeLabel}
                      </label>
                      <select
                        value={grade}
                        onChange={(e) => setGrade(Number(e.target.value))}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                          <option key={g} value={g}>
                            {t.common.classLabel} {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        {t.catalog.subjectLabel}
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t.catalog.genreLabel}
                    </label>
                    <input
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.catalog.copiesLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalCopies}
                    onChange={(e) => setTotalCopies(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.catalog.priceLabel}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={rentalPrice}
                    onChange={(e) => setRentalPrice(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
