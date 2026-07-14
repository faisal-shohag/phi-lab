// Server-only. The answer key for practice problems: the exact console output a
// correct solution prints, plus a reference solution that produces it.
//
// NEVER import this from client code — it would ship every answer to the
// browser. The complete route imports it; the sidebar imports `problems.ts`.
//
// The reference solutions are not dead weight: `problems.test.ts` runs each one
// through BOTH engines and asserts it prints exactly its expected lines. That is
// what stops a typo in this file from making a problem unsolvable — the check
// that a human reviewer would otherwise have to do by hand for all 15.
import 'server-only'

export interface ProblemAnswer {
  /** Exact console.log lines, in order. */
  expected: string[]
  /** A correct solution. Stays inside the teaching subset so both engines run it. */
  solution: string
}

export const PROBLEM_ANSWERS: Record<string, ProblemAnswer> = {
  'cond-04': {
    expected: ['2024: leap', '1900: not leap', '2000: leap'],
    solution: `function isLeap(year) {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

const years = [2024, 1900, 2000];
for (let y of years) {
  if (isLeap(y)) {
    console.log(y + ": leap");
  } else {
    console.log(y + ": not leap");
  }
}`,
  },

  'cond-05': {
    expected: ['5: 0', '17: 50', '30: 100', '70: 40'],
    solution: `function priceFor(age) {
  if (age < 6) return 0;
  if (age <= 17) return 50;
  if (age <= 64) return 100;
  return 40;
}

const ages = [5, 17, 30, 70];
for (let age of ages) {
  console.log(age + ": " + priceFor(age));
}`,
  },

  'loop-07': {
    expected: ['7 x 1 = 7', '7 x 2 = 14', '7 x 3 = 21', '7 x 4 = 28', '7 x 5 = 35'],
    solution: `const n = 7;

for (let i = 1; i <= 5; i++) {
  console.log(n + " x " + i + " = " + (n * i));
}`,
  },

  'loop-08': {
    expected: ['Sum of evens: 30'],
    solution: `const nums = [4, 7, 10, 3, 16];
let sum = 0;

for (let n of nums) {
  if (n % 2 === 0) {
    sum = sum + n;
  }
}

console.log("Sum of evens: " + sum);`,
  },

  'loop-09': {
    expected: ['olleh', 'tpircsavaj'],
    solution: `function reverse(text) {
  let out = "";
  for (let i = text.length - 1; i >= 0; i--) {
    out = out + text.charAt(i);
  }
  return out;
}

console.log(reverse("hello"));
console.log(reverse("javascript"));`,
  },

  'arr-06': {
    expected: ['Smallest: 7'],
    solution: `const nums = [14, 92, 7, 53, 88, 31];

let min = nums[0];
for (let i = 1; i < nums.length; i++) {
  if (nums[i] < min) {
    min = nums[i];
  }
}

console.log("Smallest: " + min);`,
  },

  'arr-07': {
    expected: ['Average: 20', 'Above average: 2'],
    solution: `const scores = [10, 20, 30, 5, 35];

let sum = 0;
for (let s of scores) {
  sum = sum + s;
}
let average = sum / scores.length;

console.log("Average: " + average);

let above = 0;
for (let s of scores) {
  if (s > average) {
    above = above + 1;
  }
}

console.log("Above average: " + above);`,
  },

  'fn-06': {
    expected: ['Area: 15', 'Area: 42', 'Perimeter: 16'],
    solution: `function area(width, height) {
  return width * height;
}

function perimeter(width, height) {
  return 2 * (width + height);
}

console.log("Area: " + area(3, 5));
console.log("Area: " + area(6, 7));
console.log("Perimeter: " + perimeter(3, 5));`,
  },

  'fn-07': {
    expected: ['sumTo(5) = 15', 'sumTo(10) = 55'],
    solution: `function sumTo(n) {
  if (n <= 0) {
    return 0;
  }
  return n + sumTo(n - 1);
}

console.log("sumTo(5) = " + sumTo(5));
console.log("sumTo(10) = " + sumTo(10));`,
  },

  'obj-04': {
    expected: ['red: 3', 'blue: 2', 'green: 1'],
    solution: `const words = ["red", "blue", "red", "green", "blue", "red"];
const counts = {};

for (let word of words) {
  if (counts[word]) {
    counts[word] = counts[word] + 1;
  } else {
    counts[word] = 1;
  }
}

for (let word in counts) {
  console.log(word + ": " + counts[word]);
}`,
  },

  'obj-05': {
    expected: ['Rex says Woof!', 'Tom says Meow!', 'Rex is 3 years old'],
    solution: `class Pet {
  constructor(name, sound, age) {
    this.name = name;
    this.sound = sound;
    this.age = age;
  }
  speak() {
    return this.name + " says " + this.sound;
  }
  describe() {
    return this.name + " is " + this.age + " years old";
  }
}

const rex = new Pet("Rex", "Woof!", 3);
const tom = new Pet("Tom", "Meow!", 2);

console.log(rex.speak());
console.log(tom.speak());
console.log(rex.describe());`,
  },

  'algo-04': {
    expected: ['Found 23 at index 5', 'Found 2 at index 0', 'Missing: -1'],
    solution: `const sorted = [2, 5, 8, 12, 16, 23, 38, 56];

function binarySearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    if (arr[mid] === target) {
      return mid;
    }
    if (arr[mid] < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return -1;
}

console.log("Found 23 at index " + binarySearch(sorted, 23));
console.log("Found 2 at index " + binarySearch(sorted, 2));
console.log("Missing: " + binarySearch(sorted, 99));`,
  },

  'algo-05': {
    expected: ['racecar: true', 'hello: false', 'level: true'],
    solution: `function isPalindrome(text) {
  let left = 0;
  let right = text.length - 1;
  while (left < right) {
    if (text.charAt(left) !== text.charAt(right)) {
      return false;
    }
    left = left + 1;
    right = right - 1;
  }
  return true;
}

const words = ["racecar", "hello", "level"];
for (let w of words) {
  console.log(w + ": " + isPalindrome(w));
}`,
  },

  'async-04': {
    expected: ['1', '2', '3', '4'],
    solution: `console.log("1");

setTimeout(function last() {
  console.log("4");
}, 0);

Promise.resolve().then(function micro() {
  console.log("3");
});

console.log("2");`,
  },

  'async-05': {
    expected: ['Ordering...', 'Still waiting', 'Food is ready!'],
    solution: `console.log("Ordering...");

setTimeout(function ready() {
  console.log("Food is ready!");
}, 0);

console.log("Still waiting");`,
  },
}

export function expectedFor(problemId: string): string[] | undefined {
  return PROBLEM_ANSWERS[problemId]?.expected
}
