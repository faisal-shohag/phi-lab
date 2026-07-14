// The JS Motion curriculum: topics, each holding a run of problems the learner
// works through in order. Two kinds:
//
//   demo     — a finished program to watch. Completed by stepping it to the end.
//              Its code lives in DEMO_EXAMPLES (referenced by `demoId`) so the
//              engine-parity test keeps covering it.
//   practice — a starter stub with TODOs. The learner writes the code; the
//              server runs it and compares the console output to the expected
//              lines (kept out of this file — see problems-expected.ts).
//
// Roughly the last 30% of each topic is practice: you watch, then you do.
//
// This module is CLIENT-SAFE and must stay that way — it is imported by the
// sidebar. No expected outputs, no reference solutions, no server imports.

import { DEMO_EXAMPLES } from './examples'

export const TOPIC_IDS = [
  'conditionals',
  'loops',
  'arrays',
  'functions',
  'objects',
  'algorithms',
  'async',
] as const

export type TopicId = (typeof TOPIC_IDS)[number]

export interface Problem {
  /** Stable id — the XpEvent sourceId is `problem:${id}`. Never renumber. */
  id: string
  topicId: TopicId
  title: string
  description: string
  kind: 'demo' | 'practice'
  /** demo-kind: the DEMO_EXAMPLES entry holding the code. */
  demoId?: string
  /** practice-kind: the stub loaded into the editor. */
  starterCode?: string
  /**
   * practice-kind: what the learner is asked to print, shown as the goal. The
   * server checks the real output against problems-expected.ts, not this.
   */
  goal?: string
  /**
   * practice-kind: substrings the submission must contain. A cheap nudge that
   * keeps "just console.log the answer" from passing a problem about writing a
   * loop. Not a security boundary — see the note in the complete route.
   */
  requires?: string[]
}

export interface ProblemTopic {
  id: TopicId
  label: string
  blurb: string
  problems: Problem[]
}

export const PROBLEM_TOPICS: ProblemTopic[] = [
  {
    id: 'conditionals',
    label: 'Conditionals',
    blurb: 'Choosing a branch: if / else if / else and switch.',
    problems: [
      { id: 'cond-01', topicId: 'conditionals', kind: 'demo', demoId: 'conditional', title: 'Grade Picker', description: 'See how if / else if / else picks exactly one branch.' },
      { id: 'cond-02', topicId: 'conditionals', kind: 'demo', demoId: 'fizzbuzz', title: 'FizzBuzz', description: 'Modulo plus branching — order of the checks matters.' },
      { id: 'cond-03', topicId: 'conditionals', kind: 'demo', demoId: 'switch-methods', title: 'Switch & Array Methods', description: 'A switch statement, then map / filter / reduce.' },
      {
        id: 'cond-04',
        topicId: 'conditionals',
        kind: 'practice',
        title: 'Leap Year',
        description: 'Write the rule: divisible by 4, except centuries, unless divisible by 400.',
        goal: 'Print "2024: leap", "1900: not leap", "2000: leap" — one per line.',
        requires: ['if'],
        starterCode: `// A year is a leap year when it is divisible by 4,
// EXCEPT century years, UNLESS they divide by 400.
//   2024 -> leap      1900 -> not leap      2000 -> leap

function isLeap(year) {
  // TODO: return true or false
}

const years = [2024, 1900, 2000];
for (let y of years) {
  // TODO: print \`\${y}: leap\` or \`\${y}: not leap\`
}
`,
      },
      {
        id: 'cond-05',
        topicId: 'conditionals',
        kind: 'practice',
        title: 'Ticket Price',
        description: 'Turn a price table into a chain of conditions.',
        goal: 'Print the price for ages 5, 17, 30 and 70: "5: 0", "17: 50", "30: 100", "70: 40".',
        requires: ['if'],
        starterCode: `// Ticket rules:
//   under 6       -> free (0)
//   6 to 17       -> 50
//   18 to 64      -> 100
//   65 and over   -> 40

function priceFor(age) {
  // TODO: return the price for this age
}

const ages = [5, 17, 30, 70];
for (let age of ages) {
  // TODO: print \`\${age}: \${priceFor(age)}\`
}
`,
      },
    ],
  },
  {
    id: 'loops',
    label: 'Loops',
    blurb: 'Repeating work: for, while, for...of, and loops inside loops.',
    problems: [
      { id: 'loop-01', topicId: 'loops', kind: 'demo', demoId: 'for-loop-sum', title: 'For Loop — Sum', description: 'Watch a loop accumulate a running total.' },
      { id: 'loop-02', topicId: 'loops', kind: 'demo', demoId: 'while-countdown', title: 'While — Countdown', description: 'A condition that changes until the loop stops.' },
      { id: 'loop-03', topicId: 'loops', kind: 'demo', demoId: 'for-of', title: 'For...of', description: 'Iterate elements directly, without an index.' },
      { id: 'loop-04', topicId: 'loops', kind: 'demo', demoId: 'nested-loops', title: 'Nested — Times Table', description: 'The inner loop restarts on every outer pass.' },
      { id: 'loop-05', topicId: 'loops', kind: 'demo', demoId: 'star-pyramid', title: 'Nested — Star Pyramid', description: 'Build a row with the inner loop, print it with the outer.' },
      { id: 'loop-06', topicId: 'loops', kind: 'demo', demoId: 'count-vowels', title: 'Count Vowels', description: 'Walk a string character by character.' },
      {
        id: 'loop-07',
        topicId: 'loops',
        kind: 'practice',
        title: 'Times Table Row',
        description: 'One loop, one line per multiple.',
        goal: 'Print "7 x 1 = 7" through "7 x 5 = 35" — five lines.',
        requires: ['for'],
        starterCode: `const n = 7;

// TODO: loop from 1 to 5 and print \`\${n} x \${i} = \${n * i}\`
`,
      },
      {
        id: 'loop-08',
        topicId: 'loops',
        kind: 'practice',
        title: 'Sum the Evens',
        description: 'A loop plus a condition — only some iterations count.',
        goal: 'Print "Sum of evens: 30" for [4, 7, 10, 3, 16].',
        requires: ['for'],
        starterCode: `const nums = [4, 7, 10, 3, 16];
let sum = 0;

// TODO: add up only the even numbers

console.log("Sum of evens: " + sum);
`,
      },
      {
        id: 'loop-09',
        topicId: 'loops',
        kind: 'practice',
        title: 'Reverse a String',
        description: 'Walk backwards and build a new string as you go.',
        goal: 'Print "olleh" and "javascript" reversed ("tpircsavaj").',
        requires: ['for'],
        starterCode: `function reverse(text) {
  let out = "";
  // TODO: walk text from the last character to the first,
  //       adding each one to \`out\`
  return out;
}

console.log(reverse("hello"));
console.log(reverse("javascript"));
`,
      },
    ],
  },
  {
    id: 'arrays',
    label: 'Arrays',
    blurb: 'Lists of values: reading, changing, scanning and unpacking them.',
    problems: [
      { id: 'arr-01', topicId: 'arrays', kind: 'demo', demoId: 'array-max', title: 'Find the Max', description: 'One scan, one running "best so far".' },
      { id: 'arr-02', topicId: 'arrays', kind: 'demo', demoId: 'array-mutation', title: 'Array Mutation', description: 'push / pop / index writes change the array live.' },
      { id: 'arr-03', topicId: 'arrays', kind: 'demo', demoId: 'array-search', title: 'Array Search', description: 'indexOf and includes, and the manual scan they replace.' },
      { id: 'arr-04', topicId: 'arrays', kind: 'demo', demoId: 'two-pointer', title: 'Two Pointers — Reverse', description: 'Two indices walk inward, swapping as they go.' },
      { id: 'arr-05', topicId: 'arrays', kind: 'demo', demoId: 'destructuring', title: 'Destructuring & Swap', description: 'Unpack arrays and objects; swap in one line.' },
      {
        id: 'arr-06',
        topicId: 'arrays',
        kind: 'practice',
        title: 'Find the Minimum',
        description: 'You watched Find the Max. Now do the opposite.',
        goal: 'Print "Smallest: 7" for [14, 92, 7, 53, 88, 31].',
        requires: ['for'],
        starterCode: `const nums = [14, 92, 7, 53, 88, 31];

// TODO: scan the array and find the smallest value
let min = nums[0];

console.log("Smallest: " + min);
`,
      },
      {
        id: 'arr-07',
        topicId: 'arrays',
        kind: 'practice',
        title: 'Count Above Average',
        description: 'Two passes: work out the average, then count what beats it.',
        goal: 'Print "Average: 20" then "Above average: 2" for [10, 20, 30, 5, 35].',
        requires: ['for'],
        starterCode: `const scores = [10, 20, 30, 5, 35];

// TODO: pass 1 — add every score up and divide by scores.length
let average = 0;

console.log("Average: " + average);

// TODO: pass 2 — count how many scores are greater than the average
let above = 0;

console.log("Above average: " + above);
`,
      },
    ],
  },
  {
    id: 'functions',
    label: 'Functions',
    blurb: 'Naming a piece of work: parameters, return, the call stack, closures.',
    problems: [
      { id: 'fn-01', topicId: 'functions', kind: 'demo', demoId: 'function-call', title: 'Function Call', description: 'Arguments bind to parameters; a value comes back.' },
      { id: 'fn-02', topicId: 'functions', kind: 'demo', demoId: 'function-params', title: 'Default & Rest Params', description: 'A default fills a gap; rest collects the extras.' },
      { id: 'fn-03', topicId: 'functions', kind: 'demo', demoId: 'recursion', title: 'Recursion — Factorial', description: 'The call stack grows, then unwinds.' },
      { id: 'fn-04', topicId: 'functions', kind: 'demo', demoId: 'closure', title: 'Closures — Counter', description: 'A returned function remembers its enclosing variable.' },
      { id: 'fn-05', topicId: 'functions', kind: 'demo', demoId: 'hoisting', title: 'Hoisting & TDZ', description: 'Compile phase versus run phase.' },
      {
        id: 'fn-06',
        topicId: 'functions',
        kind: 'practice',
        title: 'Write a Function',
        description: 'Take arguments, return a value — no console.log inside.',
        goal: 'Print "Area: 15", "Area: 42" and "Perimeter: 16".',
        requires: ['function', 'return'],
        starterCode: `// TODO: return the area of a rectangle
function area(width, height) {

}

// TODO: return the perimeter of a rectangle
function perimeter(width, height) {

}

console.log("Area: " + area(3, 5));
console.log("Area: " + area(6, 7));
console.log("Perimeter: " + perimeter(3, 5));
`,
      },
      {
        id: 'fn-07',
        topicId: 'functions',
        kind: 'practice',
        title: 'Recursive Sum',
        description: 'A function that calls itself needs a base case first.',
        goal: 'Print "sumTo(5) = 15" and "sumTo(10) = 55".',
        requires: ['function', 'return'],
        starterCode: `// sumTo(5) is 5 + 4 + 3 + 2 + 1 = 15
function sumTo(n) {
  // TODO: base case first — when does the recursion stop?
  // TODO: otherwise return n plus the sum of everything below it
}

console.log("sumTo(5) = " + sumTo(5));
console.log("sumTo(10) = " + sumTo(10));
`,
      },
    ],
  },
  {
    id: 'objects',
    label: 'Objects & References',
    blurb: 'Keyed data, and the fact that two names can point at one thing.',
    problems: [
      { id: 'obj-01', topicId: 'objects', kind: 'demo', demoId: 'object-basics', title: 'Objects — Read, Write, Loop', description: 'Dot access, adding a key, walking with for...in.' },
      { id: 'obj-02', topicId: 'objects', kind: 'demo', demoId: 'aliasing', title: 'References & Aliasing', description: 'Two variables, one array — see it in the Heap graph.' },
      { id: 'obj-03', topicId: 'objects', kind: 'demo', demoId: 'classes', title: 'Classes & Inheritance', description: 'Build objects with a class, extend it, call super.' },
      {
        id: 'obj-04',
        topicId: 'objects',
        kind: 'practice',
        title: 'Tally the Words',
        description: 'Use an object as a counter — one key per word.',
        goal: 'Print "red: 3", "blue: 2", "green: 1" — one line per colour, first-seen order.',
        requires: ['for'],
        starterCode: `const words = ["red", "blue", "red", "green", "blue", "red"];
const counts = {};

// TODO: count how many times each word appears

for (let word in counts) {
  console.log(word + ": " + counts[word]);
}
`,
      },
      {
        id: 'obj-05',
        topicId: 'objects',
        kind: 'practice',
        title: 'Build a Class',
        description: 'A constructor stores state; a method uses it.',
        goal: 'Print "Rex says Woof!", "Tom says Meow!" and "Rex is 3 years old".',
        requires: ['class'],
        starterCode: `class Pet {
  // TODO: constructor takes a name, a sound and an age

  // TODO: speak() returns \`\${name} says \${sound}\`

  // TODO: describe() returns \`\${name} is \${age} years old\`
}

const rex = new Pet("Rex", "Woof!", 3);
const tom = new Pet("Tom", "Meow!", 2);

console.log(rex.speak());
console.log(tom.speak());
console.log(rex.describe());
`,
      },
    ],
  },
  {
    id: 'algorithms',
    label: 'Algorithms',
    blurb: 'Classic recipes: searching and sorting, one comparison at a time.',
    problems: [
      { id: 'algo-01', topicId: 'algorithms', kind: 'demo', demoId: 'linear-search', title: 'Linear Search', description: 'Scan until you find it — return early when you do.' },
      { id: 'algo-02', topicId: 'algorithms', kind: 'demo', demoId: 'bubble-sort', title: 'Bubble Sort', description: 'Switch the array to bar mode and watch the swaps.' },
      { id: 'algo-03', topicId: 'algorithms', kind: 'demo', demoId: 'selection-sort', title: 'Selection Sort', description: 'Find the smallest, swap it into place, repeat.' },
      {
        id: 'algo-04',
        topicId: 'algorithms',
        kind: 'practice',
        title: 'Binary Search',
        description: 'A sorted array lets you throw away half the list every step.',
        goal: 'Print "Found 23 at index 5", "Found 2 at index 0" and "Missing: -1".',
        requires: ['while', 'function'],
        starterCode: `// The array is SORTED — so compare with the middle and
// throw away the half that can't contain the target.
const sorted = [2, 5, 8, 12, 16, 23, 38, 56];

function binarySearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;
  // TODO: while low <= high, check the middle and move low or high
  return -1;
}

console.log("Found 23 at index " + binarySearch(sorted, 23));
console.log("Found 2 at index " + binarySearch(sorted, 2));
console.log("Missing: " + binarySearch(sorted, 99));
`,
      },
      {
        id: 'algo-05',
        topicId: 'algorithms',
        kind: 'practice',
        title: 'Is It a Palindrome?',
        description: 'Two pointers walking inward — you have seen this move before.',
        goal: 'Print "racecar: true", "hello: false" and "level: true".',
        requires: ['function'],
        starterCode: `function isPalindrome(text) {
  // TODO: one pointer from the left, one from the right.
  //       Walk them inward while the characters match.
  return true;
}

const words = ["racecar", "hello", "level"];
for (let w of words) {
  console.log(w + ": " + isPalindrome(w));
}
`,
      },
    ],
  },
  {
    id: 'async',
    label: 'Async & Event Loop',
    blurb: 'Why "later" code runs later: the stack, microtasks and timers.',
    problems: [
      { id: 'async-01', topicId: 'async', kind: 'demo', demoId: 'timeout-order', title: 'setTimeout — Zero Is Not Now', description: 'A 0ms timer still waits for the sync code.' },
      { id: 'async-02', topicId: 'async', kind: 'demo', demoId: 'promise-chain', title: 'Microtasks — Promise Order', description: 'Two .then callbacks queue and drain after sync.' },
      { id: 'async-03', topicId: 'async', kind: 'demo', demoId: 'event-loop', title: 'Event Loop — Full Order', description: 'sync, then microtask, then setTimeout. Turn on the Event loop view.' },
      {
        id: 'async-04',
        topicId: 'async',
        kind: 'practice',
        title: 'Predict the Order',
        description: 'Print four labels so they come out 1, 2, 3, 4 — you pick the mechanism.',
        goal: 'Print "1", "2", "3", "4" in that order, using one setTimeout and one Promise.',
        requires: ['setTimeout', 'Promise'],
        starterCode: `// Make these come out in the order 1, 2, 3, 4.
// "1" and "2" are sync. "3" must be a microtask (Promise).
// "4" must be a macrotask (setTimeout).

console.log("1");

// TODO: schedule "4" with setTimeout

// TODO: schedule "3" with Promise.resolve().then

console.log("2");
`,
      },
      {
        id: 'async-05',
        topicId: 'async',
        kind: 'practice',
        title: 'Delayed Greeting',
        description: 'A callback runs later — the code after it does not wait.',
        goal: 'Print "Ordering...", "Still waiting" and then "Food is ready!".',
        requires: ['setTimeout'],
        starterCode: `console.log("Ordering...");

// TODO: use setTimeout so "Food is ready!" prints LAST,
//       even though you write it before "Still waiting".

console.log("Still waiting");
`,
      },
    ],
  },
]

export const ALL_PROBLEMS: Problem[] = PROBLEM_TOPICS.flatMap((t) => t.problems)

export const TOTAL_PROBLEMS = ALL_PROBLEMS.length

export const PROBLEM_BY_ID = new Map(ALL_PROBLEMS.map((p) => [p.id, p]))

export function problemById(id: string): Problem | undefined {
  return PROBLEM_BY_ID.get(id)
}

export function topicById(id: string): ProblemTopic | undefined {
  return PROBLEM_TOPICS.find((t) => t.id === id)
}

/** The code a problem opens with: the demo's program, or the practice stub. */
export function problemCode(p: Problem): string {
  if (p.kind === 'demo') return DEMO_EXAMPLES.find((e) => e.id === p.demoId)?.code ?? ''
  return p.starterCode ?? ''
}

/** Fraction of a topic that is hands-on. Used by the sidebar copy. */
export function practiceCount(t: ProblemTopic): number {
  return t.problems.filter((p) => p.kind === 'practice').length
}

// Learners who finished demos before this catalog existed only left `viz_concept`
// receipts behind. This maps each concept back to the demo problems that teach
// it, so their progress is credited retroactively rather than reset to zero.
// Keys are VIZ_CONCEPTS ids (see gamification/reasons.ts).
export const CONCEPT_TO_PROBLEMS: Record<string, string[]> = {
  conditionals: ['cond-01', 'cond-02'],
  loops: ['loop-01', 'loop-02', 'loop-03', 'loop-04'],
  arrays: ['arr-01', 'arr-02'],
  'array-methods': ['cond-03'],
  functions: ['fn-01'],
  references: ['obj-02'],
  destructuring: ['arr-05'],
  hoisting: ['fn-05'],
  'two-pointers': ['arr-04'],
  recursion: ['fn-03'],
  closures: ['fn-04'],
  'event-loop': ['async-03'],
  oop: ['obj-03'],
  sorting: ['algo-02'],
}

// The gate on Challenge mode: enough of the catalog behind you, and Functions
// finished outright. Kept here so the setup card and the activate route agree.
export const CHALLENGE_GATE_PERCENT = 0.6
export const CHALLENGE_GATE_TOPIC: TopicId = 'functions'
