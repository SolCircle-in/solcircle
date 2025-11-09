import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// User data interface
export interface UserData {
  walletAddress: string;
  telegramHandle: string;
  telegramId: string;
  connectedAt: string;
  custodial_pub: string;
  custodial_balance: string;
  groups: any[];
  telegramusername: string;
}

// User data functions (JWT token is handled by httpOnly cookies from backend)
export function setUserData(userData: UserData) {
  const jsonString = JSON.stringify(userData);
  localStorage.setItem("solana_vote_user", jsonString);
}

export function getUserData(): UserData | null {
  const dataString = localStorage.getItem("solana_vote_user");
  if (!dataString) return null;

  try {
    return JSON.parse(dataString);
  } catch (e) {
    console.error("Failed to parse user data:", e);
    return null;
  }
}

export function clearUserData() {
  localStorage.removeItem("solana_vote_user");
}
