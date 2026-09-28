import { learning, mcq, tutorial, type CatalogBank } from './catalog-helpers';

const questions = [
  mcq('py-q1', 'Python lists are…', ['Mutable dynamic arrays', 'Immutable tuples', 'Linked lists only', 'Fixed C arrays'], 0, 'Lists grow and can change in place.'),
  mcq('py-q2', 'Tuples differ from lists because they are…', ['Immutable', 'Slower always', 'Unordered', 'Lazy'], 0, 'Hashable if elements are hashable.'),
  mcq('py-q3', 'dict keys must be…', ['Hashable', 'Only ints', 'Mutable lists OK', 'Always strings'], 0, 'Hashability required for dict/set keys.'),
  mcq('py-q4', 'list comprehension creates…', ['A new list', 'A generator always', 'A dict', 'A set only'], 0, '[expr for x in it if cond].'),
  mcq('py-q5', 'Generator expressions are…', ['Lazy iterators', 'Eager lists', 'Threads', 'JSON'], 0, 'Use () to save memory.'),
  mcq('py-q6', 'EAFP style means…', ['Easier to Ask Forgiveness than Permission', 'Always check types first only', 'Avoid try', 'No exceptions'], 0, 'Pythonic try/except patterns.'),
  mcq('py-q7', 'def defines…', ['A function object', 'A class only', 'A module', 'A coroutine always'], 0, 'First-class functions.'),
  mcq('py-q8', '*args collects…', ['Extra positional args as tuple', 'Keyword only', 'Locals', 'Globals'], 0, '**kwargs collects keyword dict.'),
  mcq('py-q9', 'Decorators wrap…', ['Callables to add behavior', 'Only classes', 'Only modules', 'CSS'], 0, '@decorator syntax.'),
  mcq('py-q10', 'with statement manages…', ['Context managers (resources)', 'Only loops', 'Imports', 'Virtualenv'], 0, 'Files/locks auto cleanup.'),
  mcq('py-q11', 'Virtual environments isolate…', ['Project dependencies', 'CPU cores', 'DNS', 'Git history'], 0, 'venv/poetry/pip-tools workflows.'),
  mcq('py-q12', 'pip install packages into…', ['The active environment', 'Always system Python only', 'Docker Hub', 'npm'], 0, 'Activate venv first.'),
  mcq('py-q13', 'f-strings are for…', ['Formatted string interpolation', 'Binary files', 'SQL injection', 'Async only'], 0, 'f"Hello {name}".'),
  mcq('py-q14', 'dataclass helps…', ['Boilerplate classes for data', 'Replace dict forever', 'Speed C extensions', 'GUI'], 0, 'Auto __init__/repr etc.'),
  mcq('py-q15', 'Type hints are…', ['Optional annotations for tools/readers', 'Runtime enforced always', 'Comments only', 'Deprecated'], 0, 'mypy/pyright check them.'),
  mcq('py-q16', 'pytest discovers…', ['test_*.py / *_test.py functions', 'Only unittest classes', 'Shell scripts', 'CSS'], 0, 'Simple assert-based tests.'),
  mcq('py-q17', 'GIL means…', ['One bytecode thread at a time in CPython', 'No async', 'No multiprocessing', 'No I/O'], 0, 'CPU-bound may need processes.'),
  mcq('py-q18', 'asyncio is for…', ['Concurrent I/O with event loop', 'Parallel CPU always', 'CSS', 'SQL migrations'], 0, 'await non-blocking I/O.'),
  mcq('py-q19', 'pandas DataFrame is…', ['Tabular labeled data structure', 'A web framework', 'A linter', 'A socket'], 0, 'Data analysis workhorse.'),
  mcq('py-q20', 'FastAPI / Flask build…', ['HTTP APIs', 'Only desktop GUIs', 'Kernels', 'Browsers'], 0, 'Python web backends.'),
  mcq('py-q21', 'PEP 8 is…', ['Style guide', 'Package index', 'Debugger', 'VM'], 0, 'Readability conventions.'),
  mcq('py-q22', 'Exception hierarchy root often…', ['BaseException / Exception', 'ErrorString', 'Fail', 'Runtime only'], 0, 'Catch specific exceptions.'),
  mcq('py-q23', 'enumerate() gives…', ['Index + value pairs', 'Only values', 'Only keys', 'Sorted unique'], 0, 'for i, x in enumerate(xs).'),
  mcq('py-q24', 'zip() combines…', ['Iterables in parallel', 'Files into tar always', 'JSON', 'Threads'], 0, 'Stops at shortest by default.'),
];

export const pythonBank: CatalogBank = {
  questions,
  tutorials: [
    tutorial({ id: 'py-t1', courseId: '6', title: 'Module 1 — Python Core Data', dateLabel: 'Self-paced', duration: '1h 45m', videoTitle: 'Lists, tuples, dicts, comprehensions', questionIds: ['py-q1', 'py-q2', 'py-q3', 'py-q4', 'py-q5', 'py-q6'], videoTopic: { track: 'python', keywords: ['list & tuple', 'dictionary & set', 'data types', 'loops', 'strings'] } }),
    tutorial({ id: 'py-t2', courseId: '6', title: 'Module 2 — Functions & Structure', dateLabel: 'Self-paced', duration: '1h 45m', videoTitle: 'Args, decorators, context managers, venv', questionIds: ['py-q7', 'py-q8', 'py-q9', 'py-q10', 'py-q11', 'py-q12'], videoTopic: { track: 'python', keywords: ['functions', 'recursion', 'file input/output', 'data types'] } }),
    tutorial({ id: 'py-t3', courseId: '6', title: 'Module 3 — Modern Python Ergonomics', dateLabel: 'Self-paced', duration: '1h 30m', videoTitle: 'f-strings, dataclasses, typing, pytest', questionIds: ['py-q13', 'py-q14', 'py-q15', 'py-q16', 'py-q23', 'py-q24'], videoTopic: { track: 'python', keywords: ['strings', 'oops in python', 'loops', 'data types'] } }),
    tutorial({ id: 'py-t4', courseId: '6', title: 'Module 4 — Applied Python', dateLabel: 'Self-paced', duration: '1h 45m', videoTitle: 'GIL, asyncio, pandas, web APIs, style', questionIds: ['py-q17', 'py-q18', 'py-q19', 'py-q20', 'py-q21', 'py-q22'], videoTopic: { track: 'python', keywords: ['file input/output', 'oops part 2', 'oops in python', 'functions'] } }),
  ],
  learning: {
    'py-t1': learning('py-t1', 'Revision: Python Data', 'Choose the right collection — it shapes clarity and performance.', [
      { heading: 'Mutability', body: 'Lists change; tuples don’t.' },
      { heading: 'Dicts/sets', body: 'Need hashable keys.' },
      { heading: 'Comprehensions', body: 'Compact transforms; generators when lazy.' },
    ], [
      { front: 'List mutable?', back: 'Yes.' },
      { front: 'Tuple?', back: 'Immutable.' },
      { front: 'Dict key need?', back: 'Hashable.' },
      { front: 'Comprehension?', back: 'New list expression.' },
      { front: 'Generator?', back: 'Lazy iterator.' },
      { front: 'EAFP?', back: 'try/except style.' },
    ]),
    'py-t2': learning('py-t2', 'Revision: Functions & Tooling', 'Keep functions small; isolate deps in venvs.', [
      { heading: 'Signatures', body: '*args/**kwargs for flexibility.' },
      { heading: 'Decorators', body: 'Cross-cutting wrappers.' },
      { heading: 'venv', body: 'Per-project dependencies.' },
    ], [
      { front: '*args type?', back: 'Tuple.' },
      { front: 'Decorator?', back: 'Wraps callable.' },
      { front: 'with does?', back: 'Context cleanup.' },
      { front: 'venv for?', back: 'Isolate deps.' },
      { front: 'pip installs where?', back: 'Active env.' },
      { front: 'def creates?', back: 'Function object.' },
    ]),
    'py-t3': learning('py-t3', 'Revision: Ergonomics', 'Readable modern Python ships faster.', [
      { heading: 'Typing', body: 'Hints help editors and CI.' },
      { heading: 'Tests', body: 'pytest keeps refactors safe.' },
      { heading: 'Dataclasses', body: 'Less boilerplate for records.' },
    ], [
      { front: 'f-string?', back: 'Interpolated string.' },
      { front: 'dataclass?', back: 'Data boilerplate helper.' },
      { front: 'Type hints enforced?', back: 'Not at runtime by default.' },
      { front: 'pytest finds?', back: 'test_ files/funcs.' },
      { front: 'enumerate?', back: 'index + value.' },
      { front: 'zip?', back: 'Parallel iterables.' },
    ]),
    'py-t4': learning('py-t4', 'Revision: Applied Python', 'Pick concurrency model based on I/O vs CPU.', [
      { heading: 'GIL', body: 'Threads ≠ CPU parallelism in CPython.' },
      { heading: 'asyncio', body: 'Many I/O waits, one thread.' },
      { heading: 'Ecosystem', body: 'pandas + FastAPI are common paths.' },
    ], [
      { front: 'GIL effect?', back: 'One bytecode thread.' },
      { front: 'asyncio for?', back: 'Concurrent I/O.' },
      { front: 'DataFrame?', back: 'Tabular data.' },
      { front: 'FastAPI?', back: 'HTTP APIs.' },
      { front: 'PEP 8?', back: 'Style guide.' },
      { front: 'Catch what?', back: 'Specific exceptions.' },
    ]),
  },
};
