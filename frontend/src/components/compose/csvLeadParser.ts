/**
 * Parses raw text from a .csv or .txt file and returns a deduplicated list
 * of valid email addresses.
 */
export function extractEmailsFromText(rawContent: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = rawContent.match(emailRegex) || [];

  const uniqueEmails = Array.from(
    new Set(matches.map((email) => email.trim().toLowerCase()))
  );

  return uniqueEmails;
}

