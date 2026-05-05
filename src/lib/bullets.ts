import type { ChangeEvent, Dispatch, KeyboardEvent, SetStateAction } from "react";

const BULLET_PREFIX = "\u2022\u00A0";
const STANDARD_BULLET_PREFIX = "- ";

function normalizeBulletText(value: string) {
  if (!value) return "";

  const lines = value.split(/\r?\n/);
  const normalized: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1];
    const isBulletOnly = line.trim() === "-" || line.trim() === "\u2022";
    const hasPlainTextNextLine = !!nextLine?.trim() && !nextLine.trimStart().startsWith("-");

    if (isBulletOnly && hasPlainTextNextLine) {
      normalized.push(`${BULLET_PREFIX}${nextLine.trimStart()}`);
      index += 1;
      continue;
    }

    if (!line) {
      normalized.push(line);
      continue;
    }

    if (line === "-") {
      normalized.push(BULLET_PREFIX);
      continue;
    }

    if (line.startsWith(BULLET_PREFIX)) {
      normalized.push(line);
      continue;
    }

    if (line.startsWith("\u2022 ")) {
      normalized.push(`${BULLET_PREFIX}${line.slice(2)}`);
      continue;
    }

    if (line.startsWith("\u2022")) {
      normalized.push(`${BULLET_PREFIX}${line.slice(1).trimStart()}`);
      continue;
    }

    if (line.startsWith(STANDARD_BULLET_PREFIX)) {
      normalized.push(`${BULLET_PREFIX}${line.slice(STANDARD_BULLET_PREFIX.length)}`);
      continue;
    }

    if (line.startsWith("-")) {
      normalized.push(`${BULLET_PREFIX}${line.slice(1).trimStart()}`);
      continue;
    }

    normalized.push(`${BULLET_PREFIX}${line}`);
  }

  return normalized.join("\n");
}

export function appendBulletText(
  setter: Dispatch<SetStateAction<string>>,
  text: string
) {
  const cleaned = text.trim();
  if (!cleaned) return;

  setter((prev) => {
    if (!prev.trim()) return `${BULLET_PREFIX}${cleaned}`;
    return `${prev.trimEnd()}\n${BULLET_PREFIX}${cleaned}`;
  });
}

export function handleBulletTextareaChange(
  event: ChangeEvent<HTMLTextAreaElement>,
  setter: Dispatch<SetStateAction<string>>
) {
  setter(normalizeBulletText(event.target.value));
}

export function handleBulletTextareaKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  setter: Dispatch<SetStateAction<string>>
) {
  if (event.key !== "Enter") return;

  event.preventDefault();

  const textarea = event.currentTarget;
  const { selectionStart, selectionEnd, value } = textarea;
  const nextValue = `${value.slice(0, selectionStart)}\n${BULLET_PREFIX}${value.slice(selectionEnd)}`;
  const nextCursorPosition = selectionStart + BULLET_PREFIX.length + 1;

  setter(nextValue);
  window.requestAnimationFrame(() => {
    textarea.selectionStart = nextCursorPosition;
    textarea.selectionEnd = nextCursorPosition;
  });
}
