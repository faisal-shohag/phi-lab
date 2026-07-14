// Bug Hunt: programs that are already written and already wrong. The learner is
// told the symptom, not the cause; they read the code, find the bug, fix it, and
// the server re-runs it against the expected output.
//
// This is a side track, deliberately kept OUT of PROBLEM_TOPICS: the challenge
// gate is "60% of the 43 catalog problems + the Functions topic", and folding
// levels in here would quietly move that line every time one is added. Bug Hunt
// pays XP and badges; it does not pace the curriculum.
//
// Every level is written inside the teaching subset so both engines run it —
// `bugs.test.ts` asserts each fix prints its expected lines on both.
//
// CLIENT-SAFE: imported by the sidebar. The fixed code and the expected output
// live in bugs-expected.ts. What ships to the browser is the broken program (the
// learner needs it) and the symptom (that's the puzzle).

import type { TopicId } from './problems'

/** How much of a hunt it is. Drives the XP payout — see BUG_FIX_XP. */
export type BugDifficulty = 1 | 2 | 3

export interface BugLevel {
  /** Stable id — the XpEvent sourceId is `bug:${id}`. Never renumber. */
  id: string
  title: string
  /** Which topic it leans on, for the label and grouping. */
  topicId: TopicId
  difficulty: BugDifficulty
  /** What the learner is told is wrong. Never says where. */
  symptom: string
  /** What a fixed program prints. Shown as the goal. */
  goal: string
  /** The broken program, loaded into the editor. */
  buggyCode: string
  /**
   * Substrings the fix must keep. Guards the lazy cheat — deleting the program
   * and printing the goal lines by hand. Not a security boundary; see the note
   * in the check route.
   */
  requires?: string[]
}

export const BUG_LEVELS: BugLevel[] = [
  {
    id: 'bug-01',
    title: 'The Borderline Pass',
    topicId: 'conditionals',
    difficulty: 1,
    symptom: 'A score of exactly 60 is a pass, but this says it failed.',
    goal: 'Print "40: fail", "60: pass", "85: pass" — one per line.',
    requires: ['if'],
    buggyCode: `// The pass mark is 60. Scoring EXACTLY 60 should pass.
// This one says 60 failed. Find out why.

function result(score) {
  if (score > 60) {
    return "pass";
  }
  return "fail";
}

const scores = [40, 60, 85];
for (let s of scores) {
  console.log(s + ": " + result(s));
}`,
  },

  {
    id: 'bug-02',
    title: 'FizzBuzz Never Buzzes',
    topicId: 'conditionals',
    difficulty: 2,
    symptom: '15 divides by 3 AND 5, so it should print "FizzBuzz". It prints "Fizz".',
    goal: 'Print the numbers 1 to 15, with Fizz / Buzz / FizzBuzz in the right places.',
    requires: ['for'],
    buggyCode: `// 3 -> Fizz, 5 -> Buzz, both -> FizzBuzz.
// 15 should say FizzBuzz. It says Fizz. The checks run in the
// wrong order -- think about which test is the most specific.

for (let i = 1; i <= 15; i++) {
  if (i % 3 === 0) {
    console.log("Fizz");
  } else if (i % 5 === 0) {
    console.log("Buzz");
  } else if (i % 3 === 0 && i % 5 === 0) {
    console.log("FizzBuzz");
  } else {
    console.log(i);
  }
}`,
  },

  {
    id: 'bug-03',
    title: 'One Step Too Far',
    topicId: 'loops',
    difficulty: 1,
    symptom: 'The last line prints "undefined" instead of the last name.',
    goal: 'Print "Hi Ana", "Hi Bo", "Hi Cy" — one per line, nothing after.',
    requires: ['for'],
    buggyCode: `// An array of 3 names lives at indexes 0, 1 and 2.
// This loop visits one index too many. Which one?

const names = ["Ana", "Bo", "Cy"];

for (let i = 0; i <= names.length; i++) {
  console.log("Hi " + names[i]);
}`,
  },

  {
    id: 'bug-04',
    title: 'The Loop That Never Ends',
    topicId: 'loops',
    difficulty: 2,
    symptom: 'The program hangs — it runs forever and prints nothing useful.',
    goal: 'Count 1, 2, 3, 4, 5 — one per line — then stop.',
    requires: ['while'],
    buggyCode: `// A while loop only stops when its condition turns false.
// Something has to CHANGE for that to ever happen.

let i = 1;

while (i <= 5) {
  console.log(i);
}`,
  },

  {
    id: 'bug-05',
    title: 'The Amnesiac Total',
    topicId: 'loops',
    difficulty: 2,
    symptom: 'The total is 16 — the last number — instead of the sum of all of them.',
    goal: 'Print "Total: 40".',
    requires: ['for'],
    buggyCode: `// The total keeps forgetting everything before the current number.
// Look at WHERE the total is created.

const nums = [4, 7, 13, 16];

for (let n of nums) {
  let total = 0;
  total = total + n;
  console.log("Total: " + total);
}`,
  },

  {
    id: 'bug-06',
    title: 'Push Returns a Number',
    topicId: 'arrays',
    difficulty: 2,
    symptom: 'It prints a number where the array should be.',
    goal: 'Print "[1, 2, 3]".',
    requires: ['push'],
    buggyCode: `// push() adds to the array IN PLACE. It hands back the new
// length, not the array. This code believes otherwise.

let list = [1, 2];
list = list.push(3);

console.log(list);`,
  },

  {
    id: 'bug-07',
    title: 'The Silent Filter',
    topicId: 'arrays',
    difficulty: 2,
    symptom: 'The filter keeps nothing at all — the result is an empty array.',
    goal: 'Print "[8, 12]".',
    requires: ['filter'],
    buggyCode: `// filter() keeps an item when the callback SAYS yes.
// This callback computes the answer and then loses it.

const nums = [3, 8, 5, 12];

const big = nums.filter(function (n) {
  n > 6;
});

console.log(big);`,
  },

  {
    id: 'bug-08',
    title: 'The Function That Gives Nothing',
    topicId: 'functions',
    difficulty: 1,
    symptom: 'The area prints as "undefined".',
    goal: 'Print "Area: 12".',
    requires: ['function'],
    buggyCode: `// The function does the maths and then throws it away.
// Printing inside a function is not the same as handing a
// value back to whoever called it.

function area(w, h) {
  const a = w * h;
}

const result = area(3, 4);
console.log("Area: " + result);`,
  },

  {
    id: 'bug-09',
    title: 'Recursion Without a Floor',
    topicId: 'functions',
    difficulty: 3,
    symptom: 'It never finishes — the function calls itself forever.',
    goal: 'Print "5! = 120".',
    requires: ['function', 'factorial'],
    buggyCode: `// Every recursive function needs a case where it STOPS
// calling itself. This one always recurses.

function factorial(n) {
  return n * factorial(n - 1);
}

console.log("5! = " + factorial(5));`,
  },

  {
    id: 'bug-10',
    title: 'Two Names, One Object',
    topicId: 'objects',
    difficulty: 3,
    symptom: 'Editing the copy also changed the original.',
    goal: 'Print "original: 10", "copy: 99".',
    requires: ['Object.assign'],
    buggyCode: `// Assigning an object does not duplicate it -- both names end
// up pointing at the SAME object on the heap. Make a real copy.
// Object.assign({}, source) builds a fresh one.

const original = { score: 10 };
const copy = original;

copy.score = 99;

console.log("original: " + original.score);
console.log("copy: " + copy.score);`,
  },

  {
    id: 'bug-11',
    title: 'The Swap That Ate a Value',
    topicId: 'algorithms',
    difficulty: 3,
    symptom: 'Sorting produces duplicates — values go missing.',
    goal: 'Print "[1, 2, 5, 8]".',
    requires: ['for'],
    buggyCode: `// Swapping two variables needs somewhere to PARK the first
// value before it gets overwritten. This swap loses it.

const nums = [5, 2, 8, 1];

for (let i = 0; i < nums.length; i++) {
  for (let j = 0; j < nums.length - 1 - i; j++) {
    if (nums[j] > nums[j + 1]) {
      nums[j] = nums[j + 1];
      nums[j + 1] = nums[j];
    }
  }
}

console.log(nums);`,
  },

  {
    id: 'bug-12',
    title: 'Late to Its Own Party',
    topicId: 'async',
    difficulty: 3,
    symptom: 'It prints 3, 3, 3 instead of 0, 1, 2.',
    goal: 'Print "waiting", then 0, 1, 2 — one per line.',
    requires: ['setTimeout', 'for'],
    buggyCode: `// The timers all fire AFTER the loop has finished. By then
// there is only one i left, and it is 3. Give each iteration
// its own i -- the declaration keyword decides that.

console.log("waiting");

for (var i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, 0);
}`,
  },
]

export const TOTAL_BUGS = BUG_LEVELS.length

export const BUG_BY_ID = new Map(BUG_LEVELS.map((b) => [b.id, b]))

export function bugById(id: string): BugLevel | undefined {
  return BUG_BY_ID.get(id)
}
