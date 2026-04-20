import { doc, runTransaction, type Firestore } from "firebase/firestore";

const MAX_VALID_TICKET_NUMBER = 999999;

function isValidTicketNumber(value: number) {
  return Number.isInteger(value) && value > 0 && value <= MAX_VALID_TICKET_NUMBER;
}

function getTicketNumberFromCode(value: string) {
  const normalized = value.trim().toUpperCase();
  const match = /^KLSB-(\d+)$/.exec(normalized);
  if (!match) return null;

  const parsed = Number(match[1]);
  return isValidTicketNumber(parsed) ? parsed : null;
}

export function formatTicketCode(value: number) {
  return `KLSB-${String(Math.max(1, value)).padStart(3, "0")}`;
}

export function isValidTicketIdentity(ticketCode: string, ticketNumber: number) {
  return getTicketNumberFromCode(ticketCode) !== null || isValidTicketNumber(ticketNumber);
}

export function resolveTicketNumber(ticketCode: string, ticketNumber: number, fallbackNumber: number) {
  const codeNumber = getTicketNumberFromCode(ticketCode);
  if (codeNumber !== null) return codeNumber;
  if (isValidTicketNumber(ticketNumber)) return ticketNumber;
  return Math.max(1, fallbackNumber);
}

export function resolveTicketCode(ticketCode: string, ticketNumber: number, fallbackNumber: number) {
  return formatTicketCode(resolveTicketNumber(ticketCode, ticketNumber, fallbackNumber));
}

export async function allocateNextTicketNumber(firestore: Firestore) {
  const countersRef = doc(firestore, "meta", "counters");

  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(countersRef);
    const currentValue = Number(snapshot.data()?.ticketCounter ?? 0);
    const nextValue = Math.max(0, currentValue) + 1;

    transaction.set(countersRef, { ticketCounter: nextValue }, { merge: true });
    return nextValue;
  });
}
