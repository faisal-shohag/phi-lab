import type { DemoExample } from './types'

export const DEMO_EXAMPLES: DemoExample[] = [
  {
    id: 'conditional',
    title: 'Conditionals',
    description: 'See how if / else if / else picks a branch and why.',
    icon: 'shuffle',
    code: `let score = 78;

if (score >= 90) {
  console.log("Grade: A");
} else if (score >= 80) {
  console.log("Grade: B");
} else if (score >= 70) {
  console.log("Grade: C");
} else if (score >= 60) {
  console.log("Grade: D");
} else {
  console.log("Grade: F");
}`,
  },
  {
    id: 'for-loop-sum',
    title: 'For Loop — Sum',
    description: 'Watch a loop accumulate a sum one iteration at a time.',
    icon: 'repeat',
    code: `let sum = 0;
let numbers = [10, 25, 7, 42, 18];

for (let i = 0; i < numbers.length; i++) {
  sum = sum + numbers[i];
  console.log("After adding numbers[" + i + "] = " + numbers[i] + ", sum = " + sum);
}

console.log("Final sum: " + sum);`,
  },
  {
    id: 'array-max',
    title: 'Array — Find Max',
    description: 'Scan an array to find the largest element, step by step.',
    icon: 'list',
    code: `let nums = [14, 92, 7, 53, 88, 31];
let max = nums[0];

for (let i = 1; i < nums.length; i++) {
  if (nums[i] > max) {
    max = nums[i];
    console.log("New max found at index " + i + ": " + max);
  }
}

console.log("Largest element: " + max);`,
  },
  {
    id: 'while-countdown',
    title: 'While Loop — Countdown',
    description: 'A while loop counting down with a changing condition.',
    icon: 'timer',
    code: `let count = 5;
console.log("Starting countdown");

while (count > 0) {
  console.log("T-minus " + count);
  count = count - 1;
}

console.log("Lift off!");`,
  },
  {
    id: 'for-of',
    title: 'For...of — Iterate',
    description: 'Iterate an array element-by-element with for...of.',
    icon: 'arrow-right',
    code: `let fruits = ["apple", "banana", "cherry"];
let message = "I like ";

for (let fruit of fruits) {
  message = message + fruit + ", ";
}

console.log(message);`,
  },
  {
    id: 'nested-loops',
    title: 'Nested Loops — Times Table',
    description: 'Two loops working together; watch the inner one restart.',
    icon: 'grid',
    code: `for (let i = 1; i <= 3; i++) {
  for (let j = 1; j <= 3; j++) {
    console.log(i + " x " + j + " = " + (i * j));
  }
}`,
  },
  {
    id: 'array-mutation',
    title: 'Array Mutation',
    description: 'push / pop / indexed assignment change the array live.',
    icon: 'wand',
    code: `let stack = [];

stack.push(10);
stack.push(20);
stack.push(30);
console.log("Stack: " + stack);

stack[1] = 99;
console.log("After index write: " + stack);

let top = stack.pop();
console.log("Popped: " + top + ", remaining: " + stack);`,
  },
  {
    id: 'function-call',
    title: 'Function Call',
    description: 'See arguments bound to parameters and a value returned.',
    icon: 'function',
    code: `function add(a, b) {
  let result = a + b;
  return result;
}

let x = 7;
let y = 5;
let sum = add(x, y);
console.log(x + " + " + y + " = " + sum);`,
  },
  {
    id: 'recursion',
    title: 'Recursion — Factorial',
    description: 'Watch the call stack grow and unwind as frames return.',
    icon: 'function',
    code: `function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

let result = factorial(5);
console.log("5! = " + result);`,
  },
  {
    id: 'bubble-sort',
    title: 'Bubble Sort',
    description: 'Switch the array to bar mode and watch swaps happen.',
    icon: 'grid',
    code: `let arr = [5, 2, 8, 1, 9, 3];

for (let i = 0; i < arr.length; i++) {
  for (let j = 0; j < arr.length - 1 - i; j++) {
    if (arr[j] > arr[j + 1]) {
      let temp = arr[j];
      arr[j] = arr[j + 1];
      arr[j + 1] = temp;
    }
  }
}

console.log("Sorted: " + arr);`,
  },
  {
    id: 'two-pointer',
    title: 'Two Pointers — Reverse',
    description: 'Two indices walk inward, swapping as they go.',
    icon: 'arrow-right',
    code: `let arr = [1, 2, 3, 4, 5, 6];
let left = 0;
let right = arr.length - 1;

while (left < right) {
  let temp = arr[left];
  arr[left] = arr[right];
  arr[right] = temp;
  left = left + 1;
  right = right - 1;
}

console.log("Reversed: " + arr);`,
  },
  {
    id: 'aliasing',
    title: 'References & Aliasing',
    description: 'Two variables, one array — see it in the Heap graph.',
    icon: 'wand',
    code: `let original = [10, 20, 30];
let alias = original;

alias[1] = 999;

console.log("original: " + original);
console.log("alias: " + alias);
console.log("They share the same array!");`,
  },
  {
    id: 'closure',
    title: 'Closures — Counter',
    description: 'A returned function remembers its enclosing variable.',
    icon: 'function',
    code: `function makeCounter() {
  let count = 0;
  return function () {
    count = count + 1;
    return count;
  };
}

let next = makeCounter();
console.log(next());
console.log(next());
console.log(next());`,
  },
  {
    id: 'event-loop',
    title: 'Event Loop — Async Order',
    description: 'sync vs microtask vs setTimeout. Turn on the Event loop feature.',
    icon: 'timer',
    code: `console.log("1: sync start");

setTimeout(function timer() {
  console.log("4: setTimeout (macrotask)");
}, 0);

Promise.resolve().then(function micro() {
  console.log("3: promise (microtask)");
});

console.log("2: sync end");`,
  },
  {
    id: 'hoisting',
    title: 'Hoisting & TDZ',
    description: 'Compile phase vs run phase. Turn on the Hoisting feature.',
    icon: 'wand',
    code: `greet();

function greet() {
  console.log("hoisted functions run fine");
}

var ready = true;
let title = "TDZ demo";
const version = 3;

console.log(title + " v" + version);`,
  },
  {
    id: 'fizzbuzz',
    title: 'FizzBuzz',
    description: 'Classic modulo-and-branch warmup.',
    icon: 'shuffle',
    code: `for (let i = 1; i <= 15; i++) {
  if (i % 15 === 0) {
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
  {
    id: 'destructuring',
    title: 'Destructuring & Swap',
    description: 'Unpack arrays and objects, and swap two variables in one line.',
    icon: 'shuffle',
    code: `const user = { name: "Ayesha", age: 21 };
const { name, age } = user;
console.log(name + " is " + age);

const [first, ...rest] = [10, 20, 30];
console.log("first = " + first);
console.log("rest = " + rest.join(", "));

let a = 1, b = 2;
[a, b] = [b, a];
console.log("a = " + a + ", b = " + b);`,
  },
  {
    id: 'classes',
    title: 'Classes & Inheritance',
    description: 'Build objects with a class, extend it, and call super.',
    icon: 'shuffle',
    code: `class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return this.name + " makes a sound";
  }
}

class Dog extends Animal {
  speak() {
    return this.name + " barks";
  }
}

const a = new Animal("Creature");
const d = new Dog("Rex");
console.log(a.speak());
console.log(d.speak());`,
  },
  {
    id: 'switch-methods',
    title: 'Switch & Array Methods',
    description: 'A switch statement plus map / filter / reduce on an array.',
    icon: 'shuffle',
    code: `const day = 3;
switch (day) {
  case 1:
    console.log("Monday");
    break;
  case 3:
    console.log("Wednesday");
    break;
  default:
    console.log("Some other day");
}

const nums = [1, 2, 3, 4, 5];
const doubled = nums.map(n => n * 2);
const evens = nums.filter(n => n % 2 === 0);
const total = nums.reduce((sum, n) => sum + n, 0);
console.log("doubled: " + doubled.join(", "));
console.log("evens: " + evens.join(", "));
console.log("total: " + total);`,
  },
]