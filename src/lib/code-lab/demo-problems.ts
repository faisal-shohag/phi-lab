// Seed problems for Code Lab. Idempotently upserted by slug via the admin seed
// route (src/app/api/admin/code-lab/seed/route.ts). Covers both problem types,
// all four difficulties, and ships JS + TS starters plus a reference solution
// and explicit test cases (some hidden).
import 'server-only'

import type { ProblemDifficulty, ProblemTests, ProblemType } from './types'

export interface DemoProblem {
  slug: string
  title: string
  difficulty: ProblemDifficulty
  type: ProblemType
  description: string
  constraints: string[]
  hints: string[]
  tags: string[]
  fnName: string | null
  starterJs: string
  starterTs: string
  solutionJs: string
  tests: ProblemTests
  order: number
}

export const DEMO_PROBLEMS: DemoProblem[] = [
  {
    slug: 'sum-array',
    title: 'Sum of an Array',
    difficulty: 'EASY',
    type: 'FUNCTION_RETURN',
    description:
      '## Sum of an Array\n\nGiven an array of numbers, return the sum of all its elements. An empty array sums to `0`.',
    constraints: ['0 <= nums.length <= 1000', '-1000 <= nums[i] <= 1000'],
    hints: ['`Array.prototype.reduce` does this in one line.'],
    tags: ['array', 'math'],
    fnName: 'sum',
    starterJs: 'function sum(nums) {\n  // your code here\n}\n',
    starterTs: 'function sum(nums: number[]): number {\n  // your code here\n}\n',
    solutionJs: 'function sum(nums) { return nums.reduce((a, b) => a + b, 0) }',
    tests: {
      cases: [
        { id: 't1', hidden: false, args: [[1, 2, 3]], expected: 6 },
        { id: 't2', hidden: false, args: [[]], expected: 0 },
        { id: 't3', hidden: true, args: [[-5, 5, 10]], expected: 10 },
        { id: 't4', hidden: true, args: [[100, 200, 300]], expected: 600 },
      ],
    },
    order: 1,
  },
  {
    slug: 'reverse-string',
    title: 'Reverse a String',
    difficulty: 'EASY',
    type: 'FUNCTION_RETURN',
    description: '## Reverse a String\n\nReturn the input string with its characters in reverse order.',
    constraints: ['0 <= s.length <= 1000'],
    hints: ['Split into characters, reverse, join back.'],
    tags: ['string'],
    fnName: 'reverseString',
    starterJs: 'function reverseString(s) {\n  // your code here\n}\n',
    starterTs: 'function reverseString(s: string): string {\n  // your code here\n}\n',
    solutionJs: "function reverseString(s) { return s.split('').reverse().join('') }",
    tests: {
      cases: [
        { id: 't1', hidden: false, args: ['hello'], expected: 'olleh' },
        { id: 't2', hidden: false, args: [''], expected: '' },
        { id: 't3', hidden: true, args: ['Phi Lab'], expected: 'baL ihP' },
        { id: 't4', hidden: true, args: ['racecar'], expected: 'racecar' },
      ],
    },
    order: 2,
  },
  {
    slug: 'count-vowels',
    title: 'Count the Vowels',
    difficulty: 'EASY',
    type: 'FUNCTION_RETURN',
    description: '## Count the Vowels\n\nReturn how many vowels (`a e i o u`, case-insensitive) appear in the string.',
    constraints: ['0 <= s.length <= 1000'],
    hints: ['A regex like `/[aeiou]/gi` plus `match` gives you the count.'],
    tags: ['string'],
    fnName: 'countVowels',
    starterJs: 'function countVowels(s) {\n  // your code here\n}\n',
    starterTs: 'function countVowels(s: string): number {\n  // your code here\n}\n',
    solutionJs: "function countVowels(s) { return (s.match(/[aeiou]/gi) || []).length }",
    tests: {
      cases: [
        { id: 't1', hidden: false, args: ['hello'], expected: 2 },
        { id: 't2', hidden: false, args: ['xyz'], expected: 0 },
        { id: 't3', hidden: true, args: ['AEIOU'], expected: 5 },
        { id: 't4', hidden: true, args: ['Programming Hero'], expected: 5 },
      ],
    },
    order: 3,
  },
  {
    slug: 'fizzbuzz',
    title: 'FizzBuzz',
    difficulty: 'EASY',
    type: 'CONSOLE_OUTPUT',
    description:
      '## FizzBuzz\n\nFor every number from `1` to `n`, print one line:\n\n- `Fizz` if divisible by 3\n- `Buzz` if divisible by 5\n- `FizzBuzz` if divisible by both\n- otherwise the number itself\n\nUse `console.log` for each line.',
    constraints: ['1 <= n <= 100'],
    hints: ['Check divisibility by 15 first, then 3, then 5.'],
    tags: ['loops', 'conditionals'],
    fnName: 'fizzbuzz',
    starterJs: 'function fizzbuzz(n) {\n  // console.log each line\n}\n',
    starterTs: 'function fizzbuzz(n: number): void {\n  // console.log each line\n}\n',
    solutionJs:
      'function fizzbuzz(n){for(let i=1;i<=n;i++){if(i%15===0)console.log("FizzBuzz");else if(i%3===0)console.log("Fizz");else if(i%5===0)console.log("Buzz");else console.log(String(i))}}',
    tests: {
      cases: [
        { id: 't1', hidden: false, args: [5], expectedStdout: '1\n2\nFizz\n4\nBuzz' },
        { id: 't2', hidden: true, args: [15], expectedStdout: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz' },
      ],
    },
    order: 4,
  },
  {
    slug: 'is-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'EASY',
    type: 'FUNCTION_RETURN',
    description:
      '## Valid Palindrome\n\nReturn `true` if the string reads the same forwards and backwards, considering only lowercase alphanumeric characters (ignore case, spaces and punctuation).',
    constraints: ['0 <= s.length <= 1000'],
    hints: ['Strip non-alphanumerics and lowercase first, then compare to the reverse.'],
    tags: ['string', 'two-pointers'],
    fnName: 'isPalindrome',
    starterJs: 'function isPalindrome(s) {\n  // your code here\n}\n',
    starterTs: 'function isPalindrome(s: string): boolean {\n  // your code here\n}\n',
    solutionJs:
      "function isPalindrome(s){const c=s.toLowerCase().replace(/[^a-z0-9]/g,'');return c===c.split('').reverse().join('')}",
    tests: {
      cases: [
        { id: 't1', hidden: false, args: ['A man, a plan, a canal: Panama'], expected: true },
        { id: 't2', hidden: false, args: ['race a car'], expected: false },
        { id: 't3', hidden: true, args: [''], expected: true },
        { id: 't4', hidden: true, args: ['0P'], expected: false },
      ],
    },
    order: 5,
  },
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'MEDIUM',
    type: 'FUNCTION_RETURN',
    description:
      '## Two Sum\n\nGiven an array of integers `nums` and a `target`, return the indices `[i, j]` (with `i < j`) of the two numbers that add up to `target`. Exactly one solution exists.',
    constraints: ['2 <= nums.length <= 1000', 'Exactly one valid answer exists'],
    hints: ['A hash map from value → index lets you check the complement in one pass.'],
    tags: ['array', 'hash-map'],
    fnName: 'twoSum',
    starterJs: 'function twoSum(nums, target) {\n  // return [i, j]\n}\n',
    starterTs: 'function twoSum(nums: number[], target: number): number[] {\n  // return [i, j]\n}\n',
    solutionJs:
      'function twoSum(nums,target){const m=new Map();for(let i=0;i<nums.length;i++){const c=target-nums[i];if(m.has(c))return [m.get(c),i];m.set(nums[i],i)}return []}',
    tests: {
      cases: [
        { id: 't1', hidden: false, args: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { id: 't2', hidden: false, args: [[3, 2, 4], 6], expected: [1, 2] },
        { id: 't3', hidden: true, args: [[3, 3], 6], expected: [0, 1] },
        { id: 't4', hidden: true, args: [[1, 5, 8, 3], 11], expected: [2, 3] },
      ],
    },
    order: 6,
  },
  {
    slug: 'valid-anagram',
    title: 'Valid Anagram',
    difficulty: 'MEDIUM',
    type: 'FUNCTION_RETURN',
    description:
      '## Valid Anagram\n\nReturn `true` if `t` is an anagram of `s` — the same characters in any order, same counts.',
    constraints: ['0 <= s.length, t.length <= 1000'],
    hints: ['Sort both strings and compare, or count characters.'],
    tags: ['string', 'sorting'],
    fnName: 'isAnagram',
    starterJs: 'function isAnagram(s, t) {\n  // your code here\n}\n',
    starterTs: 'function isAnagram(s: string, t: string): boolean {\n  // your code here\n}\n',
    solutionJs:
      "function isAnagram(s,t){const k=x=>x.split('').sort().join('');return k(s)===k(t)}",
    tests: {
      cases: [
        { id: 't1', hidden: false, args: ['anagram', 'nagaram'], expected: true },
        { id: 't2', hidden: false, args: ['rat', 'car'], expected: false },
        { id: 't3', hidden: true, args: ['', ''], expected: true },
        { id: 't4', hidden: true, args: ['ab', 'a'], expected: false },
      ],
    },
    order: 7,
  },
  {
    slug: 'triangle-pattern',
    title: 'Triangle of Stars',
    difficulty: 'MEDIUM',
    type: 'CONSOLE_OUTPUT',
    description:
      '## Triangle of Stars\n\nPrint a left-aligned triangle of `*` with `n` rows: row `i` has `i` stars. Use `console.log` per row.\n\nFor `n = 3`:\n```\n*\n**\n***\n```',
    constraints: ['1 <= n <= 50'],
    hints: ['`"*".repeat(i)` builds each row.'],
    tags: ['loops', 'patterns'],
    fnName: 'triangle',
    starterJs: 'function triangle(n) {\n  // console.log each row\n}\n',
    starterTs: 'function triangle(n: number): void {\n  // console.log each row\n}\n',
    solutionJs: 'function triangle(n){for(let i=1;i<=n;i++)console.log("*".repeat(i))}',
    tests: {
      cases: [
        { id: 't1', hidden: false, args: [3], expectedStdout: '*\n**\n***' },
        { id: 't2', hidden: true, args: [5], expectedStdout: '*\n**\n***\n****\n*****' },
      ],
    },
    order: 8,
  },
  {
    slug: 'balanced-brackets',
    title: 'Balanced Brackets',
    difficulty: 'HARD',
    type: 'FUNCTION_RETURN',
    description:
      '## Balanced Brackets\n\nGiven a string of `()[]{}`, return `true` if every opening bracket is closed by the matching type in the correct order.',
    constraints: ['0 <= s.length <= 10000', 's contains only bracket characters'],
    hints: ['Push openers on a stack; on a closer, the top must be its match.'],
    tags: ['stack', 'string'],
    fnName: 'isBalanced',
    starterJs: 'function isBalanced(s) {\n  // your code here\n}\n',
    starterTs: 'function isBalanced(s: string): boolean {\n  // your code here\n}\n',
    solutionJs:
      "function isBalanced(s){const p={')':'(',']':'[','}':'{'};const st=[];for(const c of s){if(c==='('||c==='['||c==='{')st.push(c);else{if(st.pop()!==p[c])return false}}return st.length===0}",
    tests: {
      cases: [
        { id: 't1', hidden: false, args: ['()[]{}'], expected: true },
        { id: 't2', hidden: false, args: ['(]'], expected: false },
        { id: 't3', hidden: true, args: ['{[()]}'], expected: true },
        { id: 't4', hidden: true, args: ['([)]'], expected: false },
        { id: 't5', hidden: true, args: ['('], expected: false },
      ],
    },
    order: 9,
  },
  {
    slug: 'rotate-matrix',
    title: 'Rotate a Matrix',
    difficulty: 'EXTRA_HARD',
    type: 'FUNCTION_RETURN',
    description:
      '## Rotate a Matrix\n\nGiven an `n x n` matrix, return a new matrix rotated 90 degrees clockwise.',
    constraints: ['1 <= n <= 50', 'The input is square'],
    hints: ['The rotated cell `[i][j]` comes from the original `[n-1-j][i]`.'],
    tags: ['matrix', 'array'],
    fnName: 'rotate',
    starterJs: 'function rotate(matrix) {\n  // return the rotated matrix\n}\n',
    starterTs: 'function rotate(matrix: number[][]): number[][] {\n  // return the rotated matrix\n}\n',
    solutionJs:
      'function rotate(m){const n=m.length;const r=[];for(let i=0;i<n;i++){r.push([]);for(let j=0;j<n;j++)r[i].push(m[n-1-j][i])}return r}',
    tests: {
      cases: [
        {
          id: 't1',
          hidden: false,
          args: [[[1, 2], [3, 4]]],
          expected: [[3, 1], [4, 2]],
        },
        {
          id: 't2',
          hidden: true,
          args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]],
          expected: [[7, 4, 1], [8, 5, 2], [9, 6, 3]],
        },
        { id: 't3', hidden: true, args: [[[5]]], expected: [[5]] },
      ],
    },
    order: 10,
  },
]
