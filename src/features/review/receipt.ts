/**
 * USCIS receipt-number helpers for the review & filing workflow.
 *
 * Pure, dependency-free — extracted from `actions.ts` (a `"use server"` module
 * that may only export async server actions and cannot load under `tsx --test`)
 * so the validator and the demo minter can be unit-tested and stay one
 * definition. Same pattern as `decisions.ts`, the other pure sibling of the
 * review actions.
 */

/** USCIS receipt format: a 3-letter service-center prefix + 10 digits
 *  (EAC/WAC/LIN/SRC/IOE/MSC/YSC/NBC). Used to validate an attorney-entered real
 *  receipt so a typo isn't recorded as authoritative. */
export function isUscisReceipt(value: string): boolean {
  return /^(EAC|WAC|LIN|SRC|IOE|MSC|YSC|NBC)\d{10}$/i.test(value.trim());
}

/** A DEMO receipt number (real filing isn't wired). Marked `demo:true` in the
 *  filed event so the UI can flag it as not a genuine USCIS receipt. */
export function newReceiptNumber(): string {
  return `EAC${Math.floor(1_000_000_000 + Math.random() * 9_000_000_000)}`;
}
