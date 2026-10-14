import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'server/storage');
const USERS_FILE = path.join(STORAGE_DIR, 'users.json');
const PACKAGES_FILE = path.join(STORAGE_DIR, 'packages.json');

export interface PackagePlan {
  id: string;
  name: string;
  nameAr: string;
  priceSAR: number;
  maxUsers: number;
  maxCompanies: number;
  description: string;
}

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  companyName: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'blocked';
  packageId: string;
  allowedCompaniesCount: number;
  createdAt: string;
}

let currentSessionUserId: string = 'usr-admin'; // Default to admin for seamless testing, or user-test

export function getCurrentSessionUserId(): string {
  return currentSessionUserId;
}

export function setCurrentSessionUserId(userId: string) {
  currentSessionUserId = userId;
}

// Ensure storage files exist with defaults
export function initUserStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(PACKAGES_FILE)) {
    const defaultPackages: PackagePlan[] = [
      {
        id: 'pkg-basic',
        name: 'Basic Package',
        nameAr: 'الباقة الأساسية',
        priceSAR: 199,
        maxUsers: 1,
        maxCompanies: 1,
        description: 'مستخدم واحد وشركة واحدة فقط (غير مسموح بتغيير الشركة إلا بموافقة الإدارة)',
      },
      {
        id: 'pkg-business',
        name: 'Business Package',
        nameAr: 'باقة الأعمال',
        priceSAR: 499,
        maxUsers: 3,
        maxCompanies: 3,
        description: 'حتى 3 مستخدمين و 3 شركات',
      },
      {
        id: 'pkg-enterprise',
        name: 'Enterprise Package',
        nameAr: 'باقة المؤسسات',
        priceSAR: 999,
        maxUsers: 10,
        maxCompanies: 10,
        description: 'حتى 10 مستخدمين و 10 شركات',
      },
    ];
    fs.writeFileSync(PACKAGES_FILE, JSON.stringify(defaultPackages, null, 2));
  }

  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers: UserAccount[] = [
      {
        id: 'usr-admin',
        email: 'admin@zatca.gov.sa',
        passwordHash: 'admin123',
        fullName: 'System Administrator (مدير النظام)',
        companyName: 'ZATCA Admin Central',
        role: 'admin',
        status: 'approved',
        packageId: 'pkg-enterprise',
        allowedCompaniesCount: 10,
        createdAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
  }
}

export function getAllPackages(): PackagePlan[] {
  initUserStorage();
  try {
    return JSON.parse(fs.readFileSync(PACKAGES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function getAllUsers(): UserAccount[] {
  initUserStorage();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function saveUsers(users: UserAccount[]) {
  initUserStorage();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function savePackages(packages: PackagePlan[]) {
  initUserStorage();
  fs.writeFileSync(PACKAGES_FILE, JSON.stringify(packages, null, 2));
}

export function findUserByEmail(email: string): UserAccount | undefined {
  const users = getAllUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): UserAccount | undefined {
  const users = getAllUsers();
  return users.find((u) => u.id === id);
}

export function createUser(data: {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}): UserAccount {
  const users = getAllUsers();
  const packages = getAllPackages();
  const basicPkg = packages.find((p) => p.id === 'pkg-basic') || packages[0];

  const newUser: UserAccount = {
    id: `usr-${Date.now()}`,
    email: data.email,
    passwordHash: data.password,
    fullName: data.fullName,
    companyName: data.companyName,
    role: 'user',
    status: 'pending', // Requires admin approval
    packageId: basicPkg ? basicPkg.id : 'pkg-basic',
    allowedCompaniesCount: basicPkg ? basicPkg.maxCompanies : 1,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  return newUser;
}
