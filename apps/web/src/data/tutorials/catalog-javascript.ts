import { learning, mcq, tutorial, type CatalogBank } from './catalog-helpers';

const questions = [
  mcq('js-q1', 'typeof null in JavaScript is…', ['"null"', '"object"', '"undefined"', '"number"'], 1, 'Historical bug: typeof null === "object".'),
  mcq('js-q2', '=== compares…', ['Value with coercion', 'Value and type without coercion', 'Only references', 'Only numbers'], 1, 'Strict equality skips implicit conversion.'),
  mcq('js-q3', 'const prevents…', ['Reassignment of the binding', 'Mutating object properties', 'Garbage collection', 'Closures'], 0, 'Object contents can still change.'),
  mcq('js-q4', 'Arrow functions do not have their own…', ['this', 'parameters', 'body', 'return'], 0, 'They lexically capture this.'),
  mcq('js-q5', 'Closures let functions…', ['Remember outer scope variables', 'Run only on servers', 'Ignore hoisting', 'Skip the event loop'], 0, 'Inner function closes over outer bindings.'),
  mcq('js-q6', 'Array.map returns…', ['A new array', 'undefined always', 'The same array mutated', 'A Promise only'], 0, 'Non-mutating transform.'),
  mcq('js-q7', 'Promise states include…', ['pending/fulfilled/rejected', 'open/closed', 'sync/async only', 'hot/cold'], 0, 'Settled means fulfilled or rejected.'),
  mcq('js-q8', 'async function always returns…', ['A Promise', 'void', 'a Generator', 'null'], 0, 'Even if you return a plain value.'),
  mcq('js-q9', 'event loop handles…', ['Async callbacks/microtasks', 'Only CSS', 'SQL parsing', 'JVM threads'], 0, 'Queues tasks after the call stack clears.'),
  mcq('js-q10', 'JSON.stringify ignores…', ['Functions / undefined in objects', 'Strings', 'Numbers', 'Booleans'], 0, 'Know serialization limits.'),
  mcq('js-q11', 'Spread [...arr] creates…', ['A shallow copy elements', 'A deep clone always', 'A Proxy', 'A Generator'], 0, 'Nested objects still shared.'),
  mcq('js-q12', 'Optional chaining ?. helps…', ['Safe property access', 'Faster loops', 'Strict mode', 'Modules'], 0, 'Short-circuits on nullish.'),
  mcq('js-q13', 'Modules (ESM) are…', ['Static import/export scoped files', 'Global scripts only', 'CSS only', 'Deprecated'], 0, 'Prefer modules over globals.'),
  mcq('js-q14', 'Hoisting means…', ['Declarations are initialized in TDZ/available differently by kind', 'No scope', 'Always moves values', 'Disables const'], 0, 'let/const are in TDZ until init.'),
  mcq('js-q15', 'NaN === NaN is…', ['true', 'false', 'throws', 'undefined'], 1, 'Use Number.isNaN to check.'),
  mcq('js-q16', 'localStorage stores…', ['Strings (serialize objects)', 'Functions', 'DOM nodes', 'Only numbers'], 0, 'JSON.stringify/parse for objects.'),
  mcq('js-q17', 'fetch API returns…', ['A Promise of Response', 'JSON directly always', 'XML only', 'a Socket'], 0, 'Then call .json() / .text().'),
  mcq('js-q18', 'try/catch catches…', ['Thrown errors in sync/awaited promises', 'All network failures automatically without await', 'CSS errors', 'TypeScript compile errors'], 0, 'Need await or .catch for promises.'),
  mcq('js-q19', 'Map vs Object for keys…', ['Map allows any key type & size tracking', 'Object is always better', 'Map cannot iterate', 'Object has .size'], 0, 'Choose based on key types / frequent add-delete.'),
  mcq('js-q20', 'Debounce is used to…', ['Delay until quiet period', 'Call every ms always', 'Sort arrays', 'Parse JSON'], 0, 'Search inputs / resize handlers.'),
  mcq('js-q21', 'Pure functions…', ['Same in → same out, no side effects', 'Must use this', 'Must be async', 'Cannot return objects'], 0, 'Easier to test and reason about.'),
  mcq('js-q22', 'Immutability update pattern?', ['Return new object/array copies', 'Mutate nested fields casually', 'Delete prototypes', 'Use eval'], 0, 'Helps React and predictability.'),
  mcq('js-q23', 'Template literals use…', ['Backticks `string ${expr}`', 'Only single quotes', 'XML', 'YAML'], 0, 'Embedded expressions.'),
  mcq('js-q24', 'Strict mode helps catch…', ['Silent mistakes (e.g. undeclared vars)', 'Network latency', 'CSS specificity', 'DNS'], 0, "'use strict' or ESM modules."),
];

export const javascriptBank: CatalogBank = {
  questions,
  tutorials: [
    tutorial({ id: 'js-t1', courseId: '4', title: 'Module 1 — Language Foundations', dateLabel: 'Self-paced', duration: '1h 45m', videoTitle: 'Types, equality, const/let, functions', questionIds: ['js-q1', 'js-q2', 'js-q3', 'js-q4', 'js-q5', 'js-q6'], videoTopic: { track: 'javascript', keywords: ['execution context', 'how javascript code is executed', 'how functions work', 'undefined vs not defined', 'scope chain', 'let & const', 'closures', 'first class functions', 'map, filter & reduce'] } }),
    tutorial({ id: 'js-t2', courseId: '4', title: 'Module 2 — Async JavaScript', dateLabel: 'Self-paced', duration: '2h 00m', videoTitle: 'Promises, async/await, event loop, fetch', questionIds: ['js-q7', 'js-q8', 'js-q9', 'js-q10', 'js-q17', 'js-q18'], videoTopic: { track: 'javascript', keywords: ['event loop', 'promise', 'async await', 'callback hell', 'error handling', 'settimeout', 'js engine'] } }),
    tutorial({ id: 'js-t3', courseId: '4', title: 'Module 3 — Modern Syntax & Data', dateLabel: 'Self-paced', duration: '1h 45m', videoTitle: 'Spread, optional chaining, modules, Map', questionIds: ['js-q11', 'js-q12', 'js-q13', 'js-q14', 'js-q15', 'js-q19'], videoTopic: { track: 'javascript', keywords: ['hoisting', 'temporal dead zone', 'block scope', 'shadowing', 'top 9 javascript topics', 'this keyword'] } }),
    tutorial({ id: 'js-t4', courseId: '4', title: 'Module 4 — Browser Patterns', dateLabel: 'Self-paced', duration: '1h 30m', videoTitle: 'Storage, debounce, purity, immutability', questionIds: ['js-q16', 'js-q20', 'js-q21', 'js-q22', 'js-q23', 'js-q24'], videoTopic: { track: 'javascript', keywords: ['higher-order functions', 'functional programming', 'event listeners', 'map, filter & reduce', 'window & this', 'closures'] } }),
  ],
  learning: {
    'js-t1': learning('js-t1', 'Revision: JS Foundations', 'Know types and equality quirks — they show up in every interview.', [
      { heading: 'Equality', body: 'Prefer ===; understand coercion pitfalls.' },
      { heading: 'Bindings', body: 'const/let block scope; avoid var.' },
      { heading: 'Closures', body: 'Functions remember their lexical environment.' },
    ], [
      { front: 'typeof null?', back: '"object".' },
      { front: '=== means?', back: 'No coercion.' },
      { front: 'const blocks?', back: 'Reassignment.' },
      { front: 'Arrow this?', back: 'Lexical.' },
      { front: 'map returns?', back: 'New array.' },
      { front: 'Closure?', back: 'Outer vars remembered.' },
    ]),
    'js-t2': learning('js-t2', 'Revision: Async JS', 'The event loop schedules work; promises model success/failure.', [
      { heading: 'Promises', body: 'pending → fulfilled/rejected.' },
      { heading: 'async/await', body: 'Syntax over promises.' },
      { heading: 'fetch', body: 'Network I/O returning Response promises.' },
    ], [
      { front: 'async returns?', back: 'Promise.' },
      { front: 'Event loop?', back: 'Runs queued tasks.' },
      { front: 'fetch returns?', back: 'Promise<Response>.' },
      { front: 'catch async?', back: 'try/catch with await.' },
      { front: 'JSON.stringify drops?', back: 'Functions/undefined.' },
      { front: 'Microtasks?', back: 'Promise jobs before next macrotask.' },
    ]),
    'js-t3': learning('js-t3', 'Revision: Modern JS', 'Write modular, null-safe, iterable-friendly code.', [
      { heading: 'Modules', body: 'Explicit imports/exports.' },
      { heading: 'Nullish ops', body: '?. and ?? for safer access/defaults.' },
      { heading: 'Collections', body: 'Map/Set when Object is awkward.' },
    ], [
      { front: 'Spread copy depth?', back: 'Shallow.' },
      { front: '?. does?', back: 'Safe access.' },
      { front: 'TDZ?', back: 'Temporal dead zone for let/const.' },
      { front: 'NaN === NaN?', back: 'false.' },
      { front: 'Map keys?', back: 'Any type.' },
      { front: 'ESM?', back: 'import/export modules.' },
    ]),
    'js-t4': learning('js-t4', 'Revision: Browser JS', 'Think in events, storage limits, and pure updates.', [
      { heading: 'Storage', body: 'Strings only in localStorage.' },
      { heading: 'Debounce', body: 'Reduce noisy event handlers.' },
      { heading: 'Purity', body: 'Prefer immutable updates.' },
    ], [
      { front: 'localStorage type?', back: 'Strings.' },
      { front: 'Debounce for?', back: 'Wait for quiet.' },
      { front: 'Pure function?', back: 'No side effects.' },
      { front: 'Immutable update?', back: 'Copy then change.' },
      { front: 'Template literal?', back: 'Backticks.' },
      { front: 'Strict mode helps?', back: 'Catch silent bugs.' },
    ]),
  },
};
