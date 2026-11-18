import type { Page } from '@playwright/test';

/** Lista viva de `pageerror`, `console.error` e respostas HTTP >= 400 da página. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console.error: ${message.text()}`); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  return errors;
}
