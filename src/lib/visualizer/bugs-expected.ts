// Server-only. What a fixed Bug Hunt level prints, plus a repaired version of
// the program that prints it.
//
// NEVER import this from client code — it would ship every fix to the browser.
// The check route imports it; the sidebar imports `bugs.ts`.
//
// The `fixed` programs earn their keep in `bugs.test.ts`: each is run through
// BOTH engines and must print exactly `expected`, and each level's BROKEN code is
// run too and must NOT. That pair is what stops a level from being unsolvable
// (wrong key) or already solved (the "bug" isn't one).
import 'server-only'

export interface BugAnswer {
  /** Exact console.log lines a fixed program prints, in order. */
  expected: string[]
  /** The level's code with the bug repaired, and nothing else changed. */
  fixed: string
}

const FIZZBUZZ_15 = [
  '1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz',
  '11', 'Fizz', '13', '14', 'FizzBuzz',
]

export const BUG_ANSWERS: Record<string, BugAnswer> = {
  'bug-01': {
    expected: ['40: fail', '60: pass', '85: pass'],
    fixed: `function result(score) {
  if (score >= 60) {
    return "pass";
  }
  return "fail";
}

const scores = [40, 60, 85];
for (let s of scores) {
  console.log(s + ": " + result(s));
}`,
  },

  'bug-02': {
    expected: FIZZBUZZ_15,
    fixed: `for (let i = 1; i <= 15; i++) {
  if (i % 3 === 0 && i % 5 === 0) {
    console.log("FizzBuzz");
  } else if (i % 3 === 0) {
    console.log("Fizz");
  } else if (i % 5 === 0) {
    console.log("Buzz");
  } else {
    console.log(i);
  }
}`,
  },

  'bug-03': {
    expected: ['Hi Ana', 'Hi Bo', 'Hi Cy'],
    fixed: `const names = ["Ana", "Bo", "Cy"];

for (let i = 0; i < names.length; i++) {
  console.log("Hi " + names[i]);
}`,
  },

  'bug-04': {
    expected: ['1', '2', '3', '4', '5'],
    fixed: `let i = 1;

while (i <= 5) {
  console.log(i);
  i = i + 1;
}`,
  },

  'bug-05': {
    expected: ['Total: 40'],
    fixed: `const nums = [4, 7, 13, 16];

let total = 0;
for (let n of nums) {
  total = total + n;
}
console.log("Total: " + total);`,
  },

  'bug-06': {
    expected: ['[1, 2, 3]'],
    fixed: `let list = [1, 2];
list.push(3);

console.log(list);`,
  },

  'bug-07': {
    expected: ['[8, 12]'],
    fixed: `const nums = [3, 8, 5, 12];

const big = nums.filter(function (n) {
  return n > 6;
});

console.log(big);`,
  },

  'bug-08': {
    expected: ['Area: 12'],
    fixed: `function area(w, h) {
  const a = w * h;
  return a;
}

const result = area(3, 4);
console.log("Area: " + result);`,
  },

  'bug-09': {
    expected: ['5! = 120'],
    fixed: `function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

console.log("5! = " + factorial(5));`,
  },

  'bug-10': {
    expected: ['original: 10', 'copy: 99'],
    fixed: `const original = { score: 10 };
const copy = Object.assign({}, original);

copy.score = 99;

console.log("original: " + original.score);
console.log("copy: " + copy.score);`,
  },

  'bug-11': {
    expected: ['[1, 2, 5, 8]'],
    fixed: `const nums = [5, 2, 8, 1];

for (let i = 0; i < nums.length; i++) {
  for (let j = 0; j < nums.length - 1 - i; j++) {
    if (nums[j] > nums[j + 1]) {
      const tmp = nums[j];
      nums[j] = nums[j + 1];
      nums[j + 1] = tmp;
    }
  }
}

console.log(nums);`,
  },

  'bug-12': {
    expected: ['waiting', '0', '1', '2'],
    fixed: `console.log("waiting");

for (let i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, 0);
}`,
  },
}

export function bugAnswer(id: string): BugAnswer | undefined {
  return BUG_ANSWERS[id]
}
