export type RegisterAccountDraft = {
  email: string;
  password: string;
};

export type RegisterProfileDraft = {
  fullName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  dob: string;
  phone: string;
  hometown: string;
  address: string;
  bio: string;
};

const ACCOUNT_KEY = 'qldh.register.account';
const PROFILE_KEY = 'qldh.register.profile';

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function loadRegisterAccountDraft(): RegisterAccountDraft | null {
  if (typeof window === 'undefined') return null;
  return safeParse<RegisterAccountDraft>(window.sessionStorage.getItem(ACCOUNT_KEY));
}

export function saveRegisterAccountDraft(value: RegisterAccountDraft) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(value));
}

export function clearRegisterAccountDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ACCOUNT_KEY);
}

export function loadRegisterProfileDraft(): RegisterProfileDraft | null {
  if (typeof window === 'undefined') return null;
  return safeParse<RegisterProfileDraft>(window.localStorage.getItem(PROFILE_KEY));
}

export function saveRegisterProfileDraft(value: RegisterProfileDraft) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(value));
}

export function clearRegisterProfileDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROFILE_KEY);
}
