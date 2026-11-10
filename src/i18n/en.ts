// English strings (P1.9). Keys are dotted ids; "{name}" is replaced by a parameter. A key with
// "_one" / "_other" suffixes is a plural: pass `count` and the right form is chosen.
// To translate: copy this file to <locale>.ts, translate the values, register it in index.ts.

export const en = {
  'daily.sell': 'Sell {count} cars',
  'daily.haggle': 'Haggle {count} sales',
  'daily.buyer': 'Serve {count} customers',
  'daily.crush': 'Crush {count} wrecks',
  'daily.contract_one': 'Finish {count} job',
  'daily.contract_other': 'Finish {count} jobs',
  'daily.garage': 'Fix {count} cars in the garage',
  'daily.lot': 'Sell {count} lot cars',
  'daily.paint': 'Finish {count} paint orders',
  'daily.reset': 'New tasks in {wait}',
  'daily.waiting.reward': "today's reward",
  'daily.waiting.tasks_one': '{count} finished task',
  'daily.waiting.tasks_other': '{count} finished tasks',
  'daily.waiting.bonus': 'the all-done bonus',
  'daily.waiting.line': "📅 Daily: {bits} on the scrapyard's Jobs board",
  'daily.waiting.and': ' and ',
  'daily.medals_one': '🏅 {count} medal to claim in the 📒 book',
  'daily.medals_other': '🏅 {count} medals to claim in the 📒 book',
  'daily.done': "📅 Daily task done: {task}. Claim it on the scrapyard's Jobs board",
} as const;

export type MessageKey = keyof typeof en;
