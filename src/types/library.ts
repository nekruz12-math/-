export type Language = 'tg' | 'ru';
export type ThemeMode = 'light' | 'dark';
export type NavSection =
  | 'dashboard'
  | 'textbooks'
  | 'fiction'
  | 'catalog'
  | 'students'
  | 'windows';

export type BookKind = 'textbook' | 'fiction';
export type LoanStatus = 'active' | 'returned';
export type PaymentStatus = 'paid' | 'unpaid' | 'exempt';
export type ReturnCondition = 'good' | 'damaged' | 'lost';

export interface Book {
  id: string;
  kind: BookKind;
  title: string;
  subject?: string;
  grade?: number; // 1..11 for textbooks
  genre?: string; // for fiction
  inventoryCode: string;
  totalCopies: number;
  rentalPrice: number; // annual rental price in TJS for textbooks, or reading fee for fiction
  createdAt: string;
}

export interface SchoolClass {
  id: string;
  grade: number; // 1..11
  section: string; // А, Б, В, Г
  createdAt: string;
}

export interface Student {
  id: string;
  fullName: string;
  grade: number; // 1..11
  section: string; // А, Б, В, Г
  createdAt: string;
}

export interface TextbookLoan {
  id: string;
  academicYear: string; // e.g. "2026-2027"
  studentId: string;
  bookId: string;
  issuedDate: string; // YYYY-MM-DD
  dueReturnDate: string; // End of school year YYYY-MM-DD
  returnedDate?: string;
  status: LoanStatus;
  rentalFee: number;
  paymentStatus: PaymentStatus;
  conditionOnReturn?: ReturnCondition;
  note?: string;
}

export interface FictionLoan {
  id: string;
  studentId: string;
  bookId: string;
  issuedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  returnedDate?: string;
  status: LoanStatus;
  loanFee: number; // projected/reading fee in TJS
  note?: string;
}

export interface LibrarySettings {
  schoolName: string;
  schoolLogo?: string;
  academicYear: string;
  defaultReturnDate: string; // e.g. "2027-05-25"
  language: Language;
  theme: ThemeMode;
}

export interface LibraryStoreData {
  books: Book[];
  classes: SchoolClass[];
  students: Student[];
  textbookLoans: TextbookLoan[];
  fictionLoans: FictionLoan[];
  settings: LibrarySettings;
}
