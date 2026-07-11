// Golden-trace smoke tests for the teaching interpreter.
//
// The interpreter is the heart of the visualizer: if it regresses, every panel
// lies. These tests don't assert on exact step counts (too brittle) — they
// assert what a learner would actually notice: every built-in demo runs without
// throwing and without hitting the step cap, and the language features we
// advertise (array/string methods, control flow) produce the right output.

import { describe, it, expect } from 'vitest'
import { interpret } from '../interpreter'
import { DEMO_EXAMPLES } from '../examples'

// Collect console.log output from a run, in order.
function outputs(src: string): string[] {
  const trace = interpret(src, { maxSteps: 5000 })
  return trace.steps.filter((s) => s.kind === 'output' && s.output != null).map((s) => s.output as string)
}

describe('demo examples', () => {
  for (const ex of DEMO_EXAMPLES) {
    it(`runs "${ex.title}" without error or truncation`, () => {
      const trace = interpret(ex.code, { maxSteps: 5000 })
      expect(trace.steps.length).toBeGreaterThan(0)
      expect(trace.truncated).toBe(false)
    })
  }
})

describe('array methods', () => {
  it('map / filter / reduce', () => {
    expect(outputs('const n=[1,2,3,4]; console.log(n.map(x=>x*2).join(","))')).toEqual(['2,4,6,8'])
    expect(outputs('const n=[1,2,3,4]; console.log(n.filter(x=>x%2===0).join(","))')).toEqual(['2,4'])
    expect(outputs('const n=[1,2,3,4]; console.log(n.reduce((a,b)=>a+b,0))')).toEqual(['10'])
  })
  it('forEach / some / every / find', () => {
    expect(outputs('[1,2].forEach(x=>console.log(x))')).toEqual(['1', '2'])
    expect(outputs('console.log([1,2,3].some(x=>x>2))')).toEqual(['true'])
    expect(outputs('console.log([1,2,3].every(x=>x>0))')).toEqual(['true'])
    expect(outputs('console.log([1,2,3].find(x=>x>1))')).toEqual(['2'])
  })
  it('sort / flat / includes', () => {
    expect(outputs('console.log([3,1,2].sort((a,b)=>a-b).join(","))')).toEqual(['1,2,3'])
    expect(outputs('console.log([[1],[2,3]].flat().join(","))')).toEqual(['1,2,3'])
    expect(outputs('console.log([1,2].includes(2))')).toEqual(['true'])
  })
  it('callback receives index', () => {
    expect(outputs('console.log(["a","b"].map((w,i)=>w+i).join("-"))')).toEqual(['a0-b1'])
  })
})

describe('string methods', () => {
  it('padStart / startsWith / replace', () => {
    expect(outputs('console.log("Hi".padStart(4,"*"))')).toEqual(['**Hi'])
    expect(outputs('console.log("hello".startsWith("he"))')).toEqual(['true'])
    expect(outputs('console.log("a-b".replace("-","+"))')).toEqual(['a+b'])
  })
})

describe('builtins', () => {
  it('Object / Array / JSON / Math', () => {
    expect(outputs('console.log(Object.keys({x:1,y:2}).join(","))')).toEqual(['x,y'])
    expect(outputs('console.log(Array.from([1,2],x=>x+10).join(","))')).toEqual(['11,12'])
    expect(outputs('console.log(Array.isArray([1]))')).toEqual(['true'])
    expect(outputs('console.log(Math.max(3,7,2))')).toEqual(['7'])
  })
})

describe('control flow & functions', () => {
  it('for loop, if/else, recursion', () => {
    expect(outputs('let s=0; for(let i=1;i<=3;i++) s+=i; console.log(s)')).toEqual(['6'])
    expect(outputs('const x=5; if(x>3) console.log("big"); else console.log("small")')).toEqual(['big'])
    expect(outputs('function f(n){return n<=1?1:n*f(n-1)} console.log(f(5))')).toEqual(['120'])
  })
})

describe('destructuring', () => {
  it('array + object declarations', () => {
    expect(outputs('const [a,b]=[10,20]; console.log(a+","+b)')).toEqual(['10,20'])
    expect(outputs('const {x,y}={x:1,y:2}; console.log(x+","+y)')).toEqual(['1,2'])
    expect(outputs('const {a:p}={a:7}; console.log(p)')).toEqual(['7'])
  })
  it('defaults and rest', () => {
    expect(outputs('const [a,b=5]=[1]; console.log(a+","+b)')).toEqual(['1,5'])
    expect(outputs('const [h,...t]=[1,2,3]; console.log(h+"|"+t.join(","))')).toEqual(['1|2,3'])
  })
  it('swap via assignment', () => {
    expect(outputs('let a=1,b=2; [a,b]=[b,a]; console.log(a+","+b)')).toEqual(['2,1'])
  })
  it('destructured function params', () => {
    expect(outputs('function f({name,age}){return name+" "+age} console.log(f({name:"Sam",age:9}))')).toEqual(['Sam 9'])
  })
})

describe('switch / for-in / optional chaining', () => {
  it('switch with fall-through and default', () => {
    expect(outputs('const x=2; switch(x){case 1:console.log("one");break;case 2:console.log("two");break;default:console.log("other")}')).toEqual(['two'])
    expect(outputs('const x=9; switch(x){case 1:console.log("one");break;default:console.log("other")}')).toEqual(['other'])
  })
  it('for...in over object keys', () => {
    expect(outputs('const o={a:1,b:2}; let s=""; for(const k in o) s+=k; console.log(s)')).toEqual(['ab'])
  })
  it('optional chaining short-circuits', () => {
    expect(outputs('const o={a:{b:5}}; console.log(o?.a?.b)')).toEqual(['5'])
    expect(outputs('const o={}; console.log(o?.a?.b)')).toEqual(['undefined'])
    expect(outputs('const o=null; console.log(o?.x)')).toEqual(['undefined'])
  })
})

describe('classes', () => {
  it('constructor, this, methods', () => {
    expect(outputs(`
class Dog {
  constructor(name){ this.name = name }
  speak(){ return this.name + " says woof" }
}
const d = new Dog("Rex");
console.log(d.speak());`)).toEqual(['Rex says woof'])
  })
  it('class fields', () => {
    expect(outputs(`
class Counter {
  count = 0;
  inc(){ this.count = this.count + 1; return this.count }
}
const c = new Counter();
console.log(c.inc());
console.log(c.inc());`)).toEqual(['1', '2'])
  })
  it('inheritance with super', () => {
    expect(outputs(`
class Animal {
  constructor(name){ this.name = name }
  describe(){ return this.name + " is an animal" }
}
class Cat extends Animal {
  constructor(name){ super(name); this.legs = 4 }
  describe(){ return super.describe() + " with " + this.legs + " legs" }
}
const cat = new Cat("Tom");
console.log(cat.describe());`)).toEqual(['Tom is an animal with 4 legs'])
  })
})

describe('Map / Set', () => {
  it('Map set/get/has/size', () => {
    expect(outputs('const m=new Map(); m.set("a",1); m.set("b",2); console.log(m.get("a")+","+m.has("b")+","+m.size)')).toEqual(['1,true,2'])
  })
  it('Set add/has/size + dedupe', () => {
    expect(outputs('const s=new Set([1,1,2,3]); s.add(3); console.log(s.size+","+s.has(2)+","+s.has(9))')).toEqual(['3,true,false'])
  })
  it('for...of over a Map with destructuring', () => {
    expect(outputs('const m=new Map([["x",10],["y",20]]); let t=0; for(const [k,v] of m) t+=v; console.log(t)')).toEqual(['30'])
  })
  it('console.log shows Map/Set contents', () => {
    expect(outputs('console.log(new Set([1,2]))')).toEqual(['Set(2) {1, 2}'])
  })
})

describe('async / await', () => {
  it('await unwraps a resolved promise', () => {
    expect(outputs(`
async function getValue(){ return 42 }
async function main(){ const v = await getValue(); console.log("got " + v) }
main();`)).toEqual(['got 42'])
  })
})

describe('error handling', () => {
  it('reports an unsupported/invalid call as a runtime error with a line', () => {
    let threw = false
    try {
      interpret('const n=[1]; n.nope()')
    } catch (e) {
      threw = true
      expect(e).toHaveProperty('line')
    }
    expect(threw).toBe(true)
  })
})
