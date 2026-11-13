import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  Book,
  FictionLoan,
  Language,
  SchoolClass,
  Student,
  TextbookLoan,
} from '../types/library';
import { getT } from '../i18n/translations';
import { exportCsvUtf8Bom, todayISO } from '../utils/exportTools';

interface StudentsViewProps {
  lang: Language;
  classes: SchoolClass[];
  students: Student[];
  books: Book[];
  textbookLoans: TextbookLoan[];
  fictionLoans: FictionLoan[];
  onAddClass: (grade: number, section: string) => void;
  onDeleteClass: (classId: string) => void;
  onSaveStudent: (student: Omit<Student, 'id' | 'createdAt'>, editId?: string) => void;
  onAddStudentsBulk: (grade: number, section: string, names: string[]) => void;
  onDeleteStudent: (studentId: string) => void;
  onReturnTextbook: (loanId: string) => void;
  onReturnFiction: (loanId: string) => void;
}

function parseStudentNamesFromRaw(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    // Remove leading numbering like "1.", "1)", "01 -" and take first CSV/semicolon cell if pasted from spreadsheet
    .map((line) => line.split(/[;\t]/)[0].trim())
    .map((line) => line.replace(/^\d+[.)\-:\s]+/, '').trim())
    .filter((line) => line.length >= 2);
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  lang,
  classes,
  students,
  books,
  textbookLoans,
  fictionLoans,
  onAddClass,
  onDeleteClass,
  onSaveStudent,
  onAddStudentsBulk,
  onDeleteStudent,
  onReturnTextbook,
  onReturnFiction,
}) => {
  const t = getT(lang);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Add Class modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [newClassGrade, setNewClassGrade] = useState(7);
  const [newClassSection, setNewClassSection] = useState('А');

  // Add/Edit Single Student modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | undefined>(undefined);
  const [fullName, setFullName] = useState('');
  const [studentGrade, setStudentGrade] = useState(7);
  const [studentSection, setStudentSection] = useState('А');

  // Bulk Import from List modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // Student Card Drawer/Modal
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);

  const sortedClasses = useMemo(
    () =>
      classes
        .slice()
        .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section)),
    [classes]
  );

  const activeClass = useMemo(
    () => sortedClasses.find((c) => c.id === selectedClassId) ?? null,
    [sortedClasses, selectedClassId]
  );

  const getStudentLoanStats = (studentId: string) => {
    const allTb = textbookLoans.filter((l) => l.studentId === studentId);
    const activeTb = allTb.filter((l) => l.status === 'active');
    const allFc = fictionLoans.filter((l) => l.studentId === studentId);
    const activeFc = allFc.filter((l) => l.status === 'active');
    return { allTb, activeTb, allFc, activeFc };
  };

  const getClassStats = (cls: SchoolClass) => {
    const classStudents = students.filter(
      (s) => s.grade === cls.grade && s.section === cls.section
    );
    const ids = new Set(classStudents.map((s) => s.id));
    const activeTbCount = textbookLoans.filter(
      (l) => ids.has(l.studentId) && l.status === 'active'
    ).length;
    const activeFcCount = fictionLoans.filter(
      (l) => ids.has(l.studentId) && l.status === 'active'
    ).length;
    return {
      studentCount: classStudents.length,
      activeTbCount,
      activeFcCount,
      classStudents,
    };
  };

  // Search filtering for Classes Overview & inside Selected Class
  const searchQuery = search.trim().toLowerCase();

  const filteredClasses = useMemo(() => {
    if (!searchQuery) return sortedClasses;
    return sortedClasses.filter((cls) => {
      const classLabel = `${cls.grade}${cls.section}`.toLowerCase();
      if (classLabel.includes(searchQuery)) return true;
      return students.some(
        (s) =>
          s.grade === cls.grade &&
          s.section === cls.section &&
          s.fullName.toLowerCase().includes(searchQuery)
      );
    });
  }, [sortedClasses, students, searchQuery]);

  const globalMatchingStudents = useMemo(() => {
    if (!searchQuery || activeClass) return [];
    return students
      .filter((s) => {
        const classLabel = `${s.grade}${s.section}`.toLowerCase();
        return (
          s.fullName.toLowerCase().includes(searchQuery) ||
          classLabel.includes(searchQuery)
        );
      })
      .sort(
        (a, b) =>
          a.grade - b.grade ||
          a.section.localeCompare(b.section) ||
          a.fullName.localeCompare(b.fullName)
      );
  }, [students, searchQuery, activeClass]);

  const studentsInActiveClass = useMemo(() => {
    if (!activeClass) return [];
    return students
      .filter((s) => s.grade === activeClass.grade && s.section === activeClass.section)
      .filter((s) => !searchQuery || s.fullName.toLowerCase().includes(searchQuery))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, activeClass, searchQuery]);

  const parsedImportNames = useMemo(
    () => parseStudentNamesFromRaw(importText),
    [importText]
  );

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    const sec = newClassSection.trim().toUpperCase() || 'А';
    onAddClass(newClassGrade, sec);
    setClassModalOpen(false);
  };

  const openAddOneModal = () => {
    if (!activeClass) return;
    setEditingStudentId(undefined);
    setFullName('');
    setStudentGrade(activeClass.grade);
    setStudentSection(activeClass.section);
    setStudentModalOpen(true);
  };

  const openEditStudentModal = (st: Student) => {
    setEditingStudentId(st.id);
    setFullName(st.fullName);
    setStudentGrade(st.grade);
    setStudentSection(st.section);
    setStudentModalOpen(true);
  };

  const handleSaveOneStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    onSaveStudent(
      {
        fullName: fullName.trim(),
        grade: studentGrade,
        section: studentSection.trim().toUpperCase() || 'А',
      },
      editingStudentId
    );
    setStudentModalOpen(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      setImportText((prev) => (prev ? `${prev}\n${content}` : content));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmitBulkImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass || parsedImportNames.length === 0) return;
    onAddStudentsBulk(activeClass.grade, activeClass.section, parsedImportNames);
    setImportText('');
    setImportModalOpen(false);
  };

  const handleExportDebtorsCsv = () => {
    const headers = [
      t.students.colName,
      t.students.colGrade,
      t.students.colTextbooks,
      t.students.colFiction,
    ];
    const rows = students
      .map((st) => {
        const { activeTb, activeFc } = getStudentLoanStats(st.id);
        return { st, tbCount: activeTb.length, fcCount: activeFc.length };
      })
      .filter((row) => row.tbCount > 0 || row.fcCount > 0)
      .map((row) => [
        row.st.fullName,
        `${row.st.grade}${row.st.section}`,
        row.tbCount,
        row.fcCount,
      ]);
    exportCsvUtf8Bom(headers, rows, `library-debtors-${todayISO()}.csv`);
  };

  const inspectedStudent = useMemo(
    () => students.find((s) => s.id === inspectedStudentId) ?? null,
    [students, inspectedStudentId]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {activeClass ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedClassId(null);
                  setSearch('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t.students.backToClasses}</span>
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {t.common.classLabel} {activeClass.grade}
                {activeClass.section}
              </h1>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {t.students.title}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t.students.subtitle}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportDebtorsCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.students.exportDebtorsBtn}</span>
          </button>

          {activeClass ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportText('');
                  setImportModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>{t.students.importListBtn}</span>
              </button>
              <button
                type="button"
                onClick={openAddOneModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t.students.addOneBtn.replace('+ ', '')}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setClassModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.students.addClassBtn.replace('+ ', '')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.students.searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
          />
        </div>
      </div>

      {/* LEVEL 1: Classes Grid + Quick Search Results */}
      {!activeClass && (
        <div className="space-y-6">
          {filteredClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t.students.emptyClassesTitle}
              </h3>
              <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                {t.students.emptyClassesDesc}
              </p>
              <button
                type="button"
                onClick={() => setClassModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.students.addClassBtn.replace('+ ', '')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredClasses.map((cls) => {
                const stats = getClassStats(cls);
                return (
                  <div
                    key={cls.id}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClassId(cls.id);
                        setSearch('');
                      }}
                      className="text-left w-full cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-lg font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                          {t.common.classLabel} {cls.grade}
                          {cls.section}
                        </span>
                        <FolderOpen className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </div>
                      <div className="mt-3 flex items-center gap-3 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100">
                            {stats.studentCount}
                          </strong>{' '}
                          {t.students.studentsCount}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.students.colTextbooks}:{' '}
                          <strong className="text-blue-600 dark:text-blue-400">
                            {stats.activeTbCount}
                          </strong>
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {t.students.colFiction}: {stats.activeFcCount}
                      </div>
                    </button>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClassId(cls.id);
                          setSearch('');
                        }}
                        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                      >
                        {lang === 'tg' ? 'Кушодани синф →' : 'Открыть класс →'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClass(cls.id)}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                        title={t.common.delete}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Direct Student Search Results across all classes */}
          {searchQuery && globalMatchingStudents.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                {t.students.searchResultsTitle} ({globalMatchingStudents.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="px-4 py-2.5 font-medium">{t.students.colName}</th>
                      <th className="px-4 py-2.5 font-medium">{t.students.colGrade}</th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {t.students.colTextbooks}
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {t.students.colFiction}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {globalMatchingStudents.map((st) => {
                      const { activeTb, activeFc } = getStudentLoanStats(st.id);
                      return (
                        <tr
                          key={st.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setInspectedStudentId(st.id)}
                              className="font-medium text-blue-700 hover:underline dark:text-blue-400 text-left cursor-pointer"
                            >
                              {st.fullName}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                            {st.grade}
                            {st.section}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                            {activeTb.length}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                            {activeFc.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2: Opened Class Students Table + 2 Entry Modes */}
      {activeClass && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {studentsInActiveClass.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t.students.emptyTitle}
              </h3>
              <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                {t.students.emptyDesc}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={openAddOneModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{t.students.addOneBtn.replace('+ ', '')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportText('');
                    setImportModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>{t.students.importListBtn}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">{t.students.colName}</th>
                    <th className="px-4 py-3 font-medium">{t.students.colGrade}</th>
                    <th className="px-4 py-3 font-medium text-right">
                      {t.students.colTextbooks}
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      {t.students.colFiction}
                    </th>
                    <th className="px-4 py-3 font-medium text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {studentsInActiveClass.map((st, idx) => {
                    const { activeTb, activeFc } = getStudentLoanStats(st.id);
                    return (
                      <tr
                        key={st.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setInspectedStudentId(st.id)}
                            className="font-medium text-blue-700 hover:underline dark:text-blue-400 text-left cursor-pointer"
                          >
                            {st.fullName}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                          {st.grade}
                          {st.section}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {activeTb.length}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {activeFc.length}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditStudentModal(st)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                              title={t.common.edit}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteStudent(st.id)}
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
      )}

      {/* Modal: Create Class */}
      {classModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.students.modalAddClassTitle}
              </h2>
              <button
                type="button"
                onClick={() => setClassModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.students.gradeLabel}
                  </label>
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.students.sectionLabel}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={newClassSection}
                    onChange={(e) => setNewClassSection(e.target.value.toUpperCase())}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
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

      {/* Modal: Add/Edit Single Student (One-by-One) */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingStudentId ? t.students.modalEditTitle : t.students.modalAddTitle}
              </h2>
              <button
                type="button"
                onClick={() => setStudentModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOneStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.students.fullNameLabel}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.students.gradeLabel}
                  </label>
                  <select
                    value={studentGrade}
                    onChange={(e) => setStudentGrade(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.students.sectionLabel}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={studentSection}
                    onChange={(e) => setStudentSection(e.target.value.toUpperCase())}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
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

      {/* Modal: Bulk Import Students from List */}
      {importModalOpen && activeClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t.students.modalImportTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.common.classLabel} {activeClass.grade}
                  {activeClass.section}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitBulkImport} className="p-6 space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t.students.importInstructions}
              </p>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{t.students.importFileBtn}</span>
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  {t.students.importPreviewCount}{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {parsedImportNames.length}
                  </strong>
                </span>
              </div>

              <textarea
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={t.students.importPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={parsedImportNames.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t.students.importSubmitBtn} ({parsedImportNames.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Card Modal (All Active & Returned Books — Returned remain visible!) */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {inspectedStudent.fullName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.students.drawerTitle} · {t.common.classLabel} {inspectedStudent.grade}
                  {inspectedStudent.section}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedStudentId(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {(() => {
                const { allTb, allFc } = getStudentLoanStats(inspectedStudent.id);
                if (allTb.length === 0 && allFc.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t.students.noActiveLoans}
                    </p>
                  );
                }
                return (
                  <>
                    {allTb.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t.students.activeTextbooks} ({allTb.length})
                        </h3>
                        <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                          {allTb.map((loan) => {
                            const bk = books.find((b) => b.id === loan.bookId);
                            return (
                              <div
                                key={loan.id}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                              >
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {bk?.title ?? '—'}
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                    {loan.issuedDate} →{' '}
                                    {loan.returnedDate ? loan.returnedDate : loan.dueReturnDate}
                                  </div>
                                </div>
                                {loan.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() => onReturnTextbook(loan.id)}
                                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                  >
                                    {t.textbooks.returnOneBtn}
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>{t.textbooks.statusReturned}</span>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {allFc.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {t.students.activeFiction} ({allFc.length})
                        </h3>
                        <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                          {allFc.map((loan) => {
                            const bk = books.find((b) => b.id === loan.bookId);
                            return (
                              <div
                                key={loan.id}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                              >
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {bk?.title ?? '—'}
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                    {loan.issuedDate} →{' '}
                                    {loan.returnedDate ? loan.returnedDate : loan.dueDate}
                                  </div>
                                </div>
                                {loan.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() => onReturnFiction(loan.id)}
                                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                  >
                                    {t.fiction.returnBtn}
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>{t.fiction.statusReturned}</span>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
