// The in-guest recorder. This source string is prepended to the instrumented
// user program and runs INSIDE the QuickJS sandbox (spike-proven rule: never
// call the host per step). Instrumented code calls the globals it defines —
// `__enter`/`__exit`/`__rec`/`console.log` — and the recorder accumulates a
// `Step[]` in-guest. `__dump()` serializes the whole trace across the wasm
// boundary exactly once.
//
// Value encoding: primitives that JSON can't carry (undefined / NaN / ±Infinity)
// are tagged with an `e` field and decoded back on the host (see trace-qjs.ts).
// Heap objects get stable ids by identity (Map), reproducing the legacy
// interpreter's aliasing so two vars pointing at one array share an id.
//
// P2 slice scope: frames + heap + line/kind/description/depth. Not yet:
// closure captures, exprTrail (P3), async/event-loop snapshot (P4).

export const RECORDER_PRELUDE = String.raw`
var __steps = [];
var __outLines = [];
var __budget = 5000;
var __recording = true;
var __truncated = false;
var __stack = [{ name: "(main)", kind: "global", callLine: null, vars: {}, loops: [] }];

// Event-loop model (viz-only): controlled queues so the async views can show
// sync → microtask → macrotask ordering. Mirrors the legacy interpreter. The
// grading path keeps the real native Promise (this prelude is not loaded there).
var __micro = [];   // microtask queue
var __timers = [];  // Web API holding area (pending setTimeout)
var __macro = [];   // (macro)task queue
var __phase = "sync";
var __usedAsync = false;

function __isRef(v) { return v !== null && (typeof v === "object" || typeof v === "function"); }

// Tag a function at its definition site with a (non-enumerable) thunk that
// resolves its captured free variables — the thunk is lexically inside the
// closure, so it reads the live captured values. __snapshot calls it to fill
// the function heap entry's captures. Non-enumerable so it never leaks as an
// object field.
function __tag(fn, capThunk) {
  if (typeof fn === "function") {
    try { Object.defineProperty(fn, "__cap", { value: capThunk, enumerable: false, configurable: true }); } catch (e) {}
  }
  return fn;
}

function __encPrim(v) {
  if (v === undefined) return { t: "prim", e: "u" };
  if (typeof v === "number") {
    if (v !== v) return { t: "prim", e: "nan" };
    if (v === Infinity) return { t: "prim", e: "inf" };
    if (v === -Infinity) return { t: "prim", e: "-inf" };
  }
  return { t: "prim", v: v };
}

// Beginner-friendly value formatting matching the legacy interpreter's
// formatValue: top-level strings unquoted, arrays [a, b] and objects {k: v} with
// inner strings quoted. VIZ-ONLY (grading uses raw real-JS output).
function __fmtQ(v) { return typeof v === "string" ? '"' + v + '"' : __fmt(v); }
function __pretty(v) {
  if (Array.isArray(v)) {
    var p = [];
    for (var i = 0; i < v.length; i++) p.push(__fmtQ(v[i]));
    return "[" + p.join(", ") + "]";
  }
  if (v && typeof v === "object") {
    var keys = Object.keys(v);
    var ps = [];
    for (var k = 0; k < keys.length; k++) ps.push(keys[k] + ": " + __fmtQ(v[keys[k]]));
    return "{" + ps.join(", ") + "}";
  }
  return String(v);
}
function __fmt(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "function") return "ƒ " + (v.name || "") + "()";
  return __pretty(v);
}
// So string coercion (e.g. "sum: " + arr) prints the pretty form too, matching
// how the legacy interpreter displayed arrays. Objects keep the default.
try { Array.prototype.toString = function () { return __pretty(this); }; } catch (e) {}

// Loop lifecycle, tracked per-activation so an early return unwinds cleanly.
// __loopEnter/__loopExit bracket a loop; __iter fires once per iteration (body
// top) and stamps the 0-based iteration index.
function __loopEnter(line, desc, thunk) {
  __stack[__stack.length - 1].loops.push({ i: -1 });
  __rec(line, "loop-start", desc, thunk);
}
function __iter(line, desc, thunk) {
  var loops = __stack[__stack.length - 1].loops;
  var L = loops[loops.length - 1];
  if (L) L.i++;
  __rec(line, "loop-iter", desc, thunk, { iteration: L ? L.i : 0 });
}
function __loopExit(line, desc, thunk) {
  __stack[__stack.length - 1].loops.pop();
  __rec(line, "loop-end", desc, thunk);
}

function __snapshot() {
  var seen = new Map();
  var order = [];
  function idOf(o) {
    if (seen.has(o)) return seen.get(o);
    var id = order.length + 1;
    seen.set(o, id);
    order.push(o);
    return id;
  }
  function toVS(v) { return __isRef(v) ? { t: "ref", id: idOf(v) } : __encPrim(v); }

  var frames = [];
  for (var i = 0; i < __stack.length; i++) {
    var act = __stack[i];
    var vars = [];
    var names = Object.keys(act.vars);
    names.sort();
    for (var n = 0; n < names.length; n++) {
      vars.push({ name: names[n], value: toVS(act.vars[names[n]]) });
    }
    frames.push({ name: act.name, kind: act.kind, callLine: act.callLine, vars: vars });
  }

  var heap = [];
  for (var qi = 0; qi < order.length; qi++) {
    var o = order[qi];
    var id = qi + 1;
    if (typeof o === "function") {
      var fnEntry = { id: id, kind: "function", label: o.name || "fn" };
      if (o.__cap) {
        try {
          var capObj = o.__cap();
          var caps = [];
          var cnames = Object.keys(capObj);
          for (var ci = 0; ci < cnames.length; ci++) caps.push({ name: cnames[ci], value: __fmt(capObj[cnames[ci]]) });
          if (caps.length) fnEntry.captures = caps;
        } catch (e) {}
      }
      heap.push(fnEntry);
    } else if (Array.isArray(o)) {
      var cells = [];
      for (var c = 0; c < o.length; c++) cells.push(toVS(o[c]));
      heap.push({ id: id, kind: "array", cells: cells });
    } else {
      var fields = [];
      var keys = Object.keys(o);
      for (var k = 0; k < keys.length; k++) fields.push({ key: keys[k], value: toVS(o[keys[k]]) });
      heap.push({ id: id, kind: "object", fields: fields });
    }
  }
  return { frames: frames, heap: heap, seen: seen };
}

function __asyncSnap() {
  var cs = [];
  for (var i = 0; i < __stack.length; i++) cs.push(__stack[i].kind === "global" ? "(main)" : __stack[i].name + "()");
  function labels(q) { var out = []; for (var j = 0; j < q.length; j++) out.push(q[j].label); return out; }
  return { callStack: cs, webApis: labels(__timers), microtasks: labels(__micro), macrotasks: labels(__macro), phase: __phase };
}

// Single choke point for pushing a step: stamps the event-loop snapshot once any
// async API has been used, matching the legacy interpreter.
function __push(step) {
  if (__usedAsync) step.async = __asyncSnap();
  __steps.push(step);
}

// Called on function entry: push an activation + emit an "enter" Step carrying
// the argument→parameter bindings and where the function lives in source.
function __enter(name, callLine, fnLine, fnEndLine, argsObj) {
  var vars = argsObj || {};
  __stack.push({ name: name, kind: "function", callLine: callLine, vars: vars, loops: [] });
  if (!__recording || __steps.length >= __budget) { if (__recording && __steps.length >= __budget) { __recording = false; __truncated = true; } return; }
  var bindings = [];
  var keys = Object.keys(vars);
  for (var i = 0; i < keys.length; i++) bindings.push({ name: keys[i], value: __fmt(vars[keys[i]]) });
  var snap = __snapshot();
  __push({ line: fnLine, kind: "enter", description: "call " + name + "()", bindings: bindings, fnLoc: { line: fnLine, endLine: fnEndLine }, callLine: callLine, frames: snap.frames, heap: snap.heap, depth: __stack.length - 1 });
}
function __exit() { if (__stack.length > 1) __stack.pop(); }

// Before/after an instrumented statement. thunk() returns the top frame's
// currently visible locals; extra optionally carries result / conditionResult
// / iteration / focusName for the richer views.
function __rec(line, kind, desc, thunk, extra) {
  if (!__recording) return;
  var top = __stack[__stack.length - 1];
  top.vars = thunk ? thunk() : {};
  if (__steps.length >= __budget) { __recording = false; __truncated = true; return; }
  var snap = __snapshot();
  var step = { line: line, kind: kind, description: desc, frames: snap.frames, heap: snap.heap, depth: __stack.length - 1 };
  if (extra) {
    if (extra.hasResult) step.result = __isRef(extra.result) ? __fmt(extra.result) : extra.result;
    if ("conditionResult" in extra) step.conditionResult = extra.conditionResult;
    if ("iteration" in extra) step.iteration = extra.iteration;
    if (extra.focusName != null) {
      var fv = top.vars[extra.focusName];
      var focus = { varName: extra.focusName };
      if (__isRef(fv) && snap.seen.has(fv)) focus.heapId = snap.seen.get(fv);
      if (extra.focusIndexName != null) {
        focus.indexVarName = extra.focusIndexName;
        var iv = top.vars[extra.focusIndexName];
        if (typeof iv === "number") focus.arrayIndex = iv;
      }
      step.focus = focus;
    }
    if (extra.trail) step.__trail = { r: extra.trail, es: extra.es, ee: extra.ee, tf: extra.tf };
  }
  __push(step);
}

// ---- expression trail recording -------------------------------------------
// While evaluating a "headline" expression (a condition test, a return value),
// each primitive sub-expression is wrapped in __t(start, end, value), which
// records its source range + formatted value. The host substitutes these back
// into the source to build a trail like nums[i] > max → 92 > 14 → true.
var __trailBuf = null;
var __v; // scratch for capturing an assignment/declaration RHS value for the trail
function __ts() { __trailBuf = []; }
function __tc() { var b = __trailBuf || []; __trailBuf = null; return b; }
function __trailText(v) {
  if (typeof v === "string") { var s = v.length > 24 ? v.slice(0, 24) + "…" : v; return '"' + s + '"'; }
  return __fmt(v);
}
function __t(s, e, v) {
  if (__trailBuf && !(v !== null && (typeof v === "object" || typeof v === "function"))) {
    __trailBuf.push({ s: s, e: e, x: __trailText(v) });
  }
  return v;
}

// A step for an event-loop transition (schedule / dequeue) at global depth.
function __recAsync(kind, desc) {
  if (!__recording || __steps.length >= __budget) { if (__recording && __steps.length >= __budget) { __recording = false; __truncated = true; } return; }
  var snap = __snapshot();
  __push({ line: 0, kind: kind, description: desc, frames: snap.frames, heap: snap.heap, depth: __stack.length - 1 });
}

// ---- async API shims (viz event-loop model) --------------------------------
function __taskLabel(fn) { return (fn && fn.name) ? fn.name : "anonymous"; }

function setTimeout(fn, delay) {
  __usedAsync = true;
  var ms = Number(delay) || 0;
  var label = __taskLabel(fn);
  if (typeof fn === "function") __timers.push({ label: label + " · " + ms + "ms", delay: ms, run: function () { fn(); } });
  __recAsync("schedule", "setTimeout → " + label + "() after " + ms + "ms (goes to Web APIs)");
  return __timers.length;
}
function queueMicrotask(fn) {
  __usedAsync = true;
  var label = __taskLabel(fn);
  if (typeof fn === "function") __micro.push({ label: label, run: function () { fn(); } });
  __recAsync("schedule", "queueMicrotask → " + label + "() (microtask queue)");
}
function __mkResolved(value) {
  return {
    __isPromise: true,
    then: function (cb) {
      __usedAsync = true;
      var label = __taskLabel(cb);
      if (typeof cb === "function") __micro.push({ label: label, run: function () { cb(value); } });
      __recAsync("schedule", "Promise.then → " + label + "() (microtask queue)");
      return __mkResolved(undefined);
    },
    catch: function () { return __mkResolved(value); }
  };
}
var Promise = { resolve: function (v) { return (v && v.__isPromise) ? v : __mkResolved(v); } };

function __drainMicro() {
  while (__micro.length) {
    __phase = "microtask";
    var t = __micro.shift();
    __recAsync("dequeue", "Event loop: run microtask " + t.label);
    t.run();
  }
}
// Drain the queues after synchronous code finishes: all microtasks, then one
// macrotask at a time (each followed by draining microtasks). No-op unless the
// program actually scheduled async work.
function __runEventLoop() {
  if (!__usedAsync) return;
  __drainMicro();
  while (__timers.length || __macro.length) {
    if (__macro.length === 0) {
      __timers.sort(function (a, b) { return a.delay - b.delay; });
      var timer = __timers.shift();
      __phase = "macrotask";
      __macro.push({ label: timer.label.replace(/ · \d+ms$/, ""), run: timer.run });
      __recAsync("schedule", "Timer fired: " + timer.label + " moves to the task queue");
    }
    __phase = "macrotask";
    var t = __macro.shift();
    __recAsync("dequeue", "Event loop: run task " + t.label);
    t.run();
    __drainMicro();
  }
  __phase = "sync";
}

var console = {
  log: function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) parts.push(__fmt(arguments[i]));
    var text = parts.join(" ");
    __outLines.push(text);
    if (__recording && __steps.length < __budget) {
      var snap = __snapshot();
      __push({ line: 0, kind: "output", description: text, output: text, frames: snap.frames, heap: snap.heap, depth: __stack.length - 1 });
    }
  }
};

function __dump() {
  return JSON.stringify({ steps: __steps, output: __outLines.join("\n"), outputCount: __outLines.length, truncated: __truncated, hasAsync: __usedAsync });
}
`
