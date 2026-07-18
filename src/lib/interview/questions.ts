// Question bank and subtopic definitions for the interview lab.
// Each topic has subtopics with keywords for transcript matching and a bank
// of sample questions the system instruction can reference.
//
// Kept framework-free so both the client page and the server report route
// can import it.

export interface Subtopic {
  id: string
  label: string
  /** Keywords used to detect coverage in the transcript post-interview. */
  keywords: string[]
}

export interface BankQuestion {
  subtopicId: string
  text: string
  difficulty: 'easy' | 'medium' | 'expert'
}

export interface TopicSubtopics {
  topicId: string
  subtopics: Subtopic[]
  questions: BankQuestion[]
}

// ── HTML ────────────────────────────────────────────────────────────────────

const HTML_SUBTOPICS: TopicSubtopics = {
  topicId: 'html',
  subtopics: [
    { id: 'semantics', label: 'Semantic Elements', keywords: ['semantic', 'article', 'section', 'header', 'footer', 'nav', 'main', 'aside', 'landmark'] },
    { id: 'forms', label: 'Forms & Validation', keywords: ['form', 'input', 'select', 'textarea', 'validation', 'required', 'pattern', 'constraint'] },
    { id: 'accessibility', label: 'Accessibility (a11y)', keywords: ['accessibility', 'aria', 'role', 'alt', 'screen reader', 'tabindex', 'wcag', 'a11y', 'label'] },
    { id: 'document-outline', label: 'Document Structure', keywords: ['document', 'head', 'meta', 'doctype', 'charset', 'viewport', 'headings', 'outline'] },
    { id: 'media', label: 'Media & Embedding', keywords: ['video', 'audio', 'canvas', 'svg', 'iframe', 'embed', 'picture', 'source', 'srcset'] },
    { id: 'seo', label: 'SEO & Meta', keywords: ['seo', 'meta', 'open graph', 'og:', 'twitter card', 'canonical', 'sitemap', 'structured data'] },
  ],
  questions: [
    { subtopicId: 'semantics', text: 'Why would you choose an article element over a div for a blog post?', difficulty: 'easy' },
    { subtopicId: 'semantics', text: 'What landmarks does the browser infer from semantic elements, and why does that matter for assistive tech?', difficulty: 'medium' },
    { subtopicId: 'semantics', text: 'When would you use the details and summary elements instead of a custom accordion?', difficulty: 'easy' },
    { subtopicId: 'semantics', text: 'How does the browser determine the implicit ARIA roles of elements like nav, aside, and main?', difficulty: 'medium' },
    { subtopicId: 'forms', text: 'What built-in validation attributes does HTML provide, and when would you use pattern instead?', difficulty: 'easy' },
    { subtopicId: 'forms', text: 'How does the browser decide which element gets focus when a user presses Tab inside a complex form?', difficulty: 'expert' },
    { subtopicId: 'forms', text: 'Explain the difference between the validity and checkValidity APIs on form elements.', difficulty: 'medium' },
    { subtopicId: 'forms', text: 'When would you use the datalist element versus a custom autocomplete implementation?', difficulty: 'medium' },
    { subtopicId: 'accessibility', text: 'When should you use aria-label versus a visually-hidden text span?', difficulty: 'medium' },
    { subtopicId: 'accessibility', text: 'Explain the difference between role="button" and a native button element from an accessibility standpoint.', difficulty: 'medium' },
    { subtopicId: 'accessibility', text: 'What are ARIA live regions and when would you use aria-live="polite" versus "assertive"?', difficulty: 'expert' },
    { subtopicId: 'document-outline', text: 'Why was the h1-per-section model abandoned in the HTML5 spec, and what do browsers actually do?', difficulty: 'expert' },
    { subtopicId: 'document-outline', text: 'What is the purpose of the meta viewport element and how does it affect mobile rendering?', difficulty: 'easy' },
    { subtopicId: 'media', text: 'What is the purpose of the picture element and srcset attribute?', difficulty: 'easy' },
    { subtopicId: 'media', text: 'How does lazy loading with the loading attribute work, and when would you use eager instead?', difficulty: 'medium' },
    { subtopicId: 'media', text: 'What are the trade-offs between using an iframe versus the embed element for third-party content?', difficulty: 'medium' },
    { subtopicId: 'seo', text: 'What meta tags are essential for a page to render well on mobile and share correctly on social media?', difficulty: 'medium' },
    { subtopicId: 'seo', text: 'How does structured data (JSON-LD) help search engines understand your content?', difficulty: 'medium' },
  ],
}

// ── CSS ─────────────────────────────────────────────────────────────────────

const CSS_SUBTOPICS: TopicSubtopics = {
  topicId: 'css',
  subtopics: [
    { id: 'flexbox', label: 'Flexbox', keywords: ['flexbox', 'flex', 'display: flex', 'justify-content', 'align-items', 'flex-direction', 'gap', 'flex-wrap'] },
    { id: 'grid', label: 'CSS Grid', keywords: ['grid', 'display: grid', 'grid-template', 'grid-area', 'grid-column', 'fr', 'auto-fit', 'auto-fill'] },
    { id: 'specificity', label: 'Specificity & Cascade', keywords: ['specificity', 'cascade', 'inheritance', 'layer', '@layer', 'important', 'selector'] },
    { id: 'responsive', label: 'Responsive Design', keywords: ['responsive', 'media query', 'breakpoint', 'mobile-first', 'container query', 'clamp'] },
    { id: 'layout', label: 'Layout & Positioning', keywords: ['position', 'float', 'display', 'overflow', 'box model', 'margin collapse', 'sticky', 'relative', 'absolute', 'fixed'] },
    { id: 'animations', label: 'Animations & Transitions', keywords: ['transition', 'animation', 'keyframe', 'transform', 'ease', 'duration', 'will-change'] },
  ],
  questions: [
    { subtopicId: 'flexbox', text: 'When would you use flex-wrap instead of letting items shrink with flex-shrink?', difficulty: 'easy' },
    { subtopicId: 'flexbox', text: 'How does the browser resolve conflicting align-items and alignSelf on the same element?', difficulty: 'medium' },
    { subtopicId: 'flexbox', text: 'What is the difference between flex-grow on a child and align-self on the same child?', difficulty: 'medium' },
    { subtopicId: 'flexbox', text: 'How would you build a holy grail layout using only flexbox?', difficulty: 'medium' },
    { subtopicId: 'grid', text: 'Explain the difference between auto-fit and auto-fill in repeat(). When would you choose one over the other?', difficulty: 'medium' },
    { subtopicId: 'grid', text: 'How does implicit grid row creation work, and how can you control the track size with grid-auto-rows?', difficulty: 'medium' },
    { subtopicId: 'grid', text: 'When would you use named grid areas versus line-based placement?', difficulty: 'easy' },
    { subtopicId: 'grid', text: 'How do you create a responsive card layout that switches from 1 column on mobile to 4 on desktop without media queries?', difficulty: 'expert' },
    { subtopicId: 'specificity', text: 'How does CSS layer (@layer) interact with specificity in CSS3?', difficulty: 'expert' },
    { subtopicId: 'specificity', text: 'If a utility class and a component class both set color, which one wins and why?', difficulty: 'medium' },
    { subtopicId: 'specificity', text: 'What is the specificity of :is() and :has() pseudo-class selectors?', difficulty: 'expert' },
    { subtopicId: 'responsive', text: 'What is the mobile-first approach and why is it preferred over desktop-first media queries?', difficulty: 'easy' },
    { subtopicId: 'responsive', text: 'How do container queries differ from media queries, and when would you use each?', difficulty: 'medium' },
    { subtopicId: 'responsive', text: 'Explain the clamp() function and how it replaces min/max media queries for fluid typography.', difficulty: 'medium' },
    { subtopicId: 'layout', text: 'When would you use position sticky versus a JavaScript-based scroll observer?', difficulty: 'medium' },
    { subtopicId: 'layout', text: 'How does margin collapse work, and when does it NOT happen?', difficulty: 'medium' },
    { subtopicId: 'layout', text: 'What is the difference between overflow: hidden and overflow: clip?', difficulty: 'expert' },
    { subtopicId: 'animations', text: 'What does will-change do, and why should you use it sparingly?', difficulty: 'medium' },
    { subtopicId: 'animations', text: 'How do you decide between CSS transitions and the Web Animations API for a complex UI effect?', difficulty: 'expert' },
    { subtopicId: 'animations', text: 'What is the difference between transform and translate for positioning elements?', difficulty: 'easy' },
  ],
}

// ── JavaScript ──────────────────────────────────────────────────────────────

const JS_SUBTOPICS: TopicSubtopics = {
  topicId: 'javascript',
  subtopics: [
    { id: 'closures', label: 'Closures & Scope', keywords: ['closure', 'lexical', 'scope', 'inner function', 'outer function', 'variable capture'] },
    { id: 'event-loop', label: 'Event Loop & Concurrency', keywords: ['event loop', 'callback', 'macro task', 'micro task', 'promise', 'queue', 'stack', 'settimeout', 'setimmediate'] },
    { id: 'prototypes', label: 'Prototypes & OOP', keywords: ['prototype', '__proto__', 'class', 'extends', 'inheritance', 'object.create', 'method'] },
    { id: 'async', label: 'Async Patterns', keywords: ['async', 'await', 'promise', 'then', 'catch', 'finally', 'concurrent', 'parallel', 'race'] },
    { id: 'modules', label: 'Modules', keywords: ['import', 'export', 'module', 'require', 'commonjs', 'esm', 'dynamic import'] },
    { id: 'error-handling', label: 'Error Handling', keywords: ['error', 'try', 'catch', 'throw', 'finally', 'typeerror', 'referenceerror', 'custom error'] },
    { id: 'types-coercion', label: 'Types & Coercion', keywords: ['type', 'coercion', 'equality', 'typeof', 'instanceof', 'truthy', 'falsy', 'nan'] },
  ],
  questions: [
    { subtopicId: 'closures', text: 'Explain what a closure is and give a real-world use case.', difficulty: 'easy' },
    { subtopicId: 'closures', text: 'How does the classic var-in-a-loop problem demonstrate closure behavior, and how do you fix it?', difficulty: 'medium' },
    { subtopicId: 'closures', text: 'What is the module pattern and how does it leverage closures for private state?', difficulty: 'medium' },
    { subtopicId: 'event-loop', text: 'What is the difference between microtasks and macrotasks? Give examples of each.', difficulty: 'medium' },
    { subtopicId: 'event-loop', text: 'Why does console.log(1); setTimeout(() => console.log(2)); Promise.resolve().then(() => console.log(3)) print 1, 3, 2?', difficulty: 'medium' },
    { subtopicId: 'event-loop', text: 'How does requestAnimationFrame differ from setTimeout for scheduling work?', difficulty: 'medium' },
    { subtopicId: 'event-loop', text: 'What happens when you call JSON.parse on a deeply nested object — is it synchronous or does it block the event loop?', difficulty: 'expert' },
    { subtopicId: 'prototypes', text: 'What is the prototype chain and how does Object.create() let you build it?', difficulty: 'easy' },
    { subtopicId: 'prototypes', text: 'Explain the difference between __proto__ and prototype property on a constructor function.', difficulty: 'expert' },
    { subtopicId: 'prototypes', text: 'How does the class keyword relate to prototypal inheritance under the hood?', difficulty: 'medium' },
    { subtopicId: 'async', text: 'When would you use Promise.allSettled instead of Promise.all?', difficulty: 'medium' },
    { subtopicId: 'async', text: 'How would you implement a retry function that re-runs an async operation up to N times with exponential backoff?', difficulty: 'expert' },
    { subtopicId: 'async', text: 'What is the difference between for...of with async/await and Promise.all for concurrent execution?', difficulty: 'medium' },
    { subtopicId: 'async', text: 'How do you cancel a pending Promise, and what patterns exist for doing so?', difficulty: 'expert' },
    { subtopicId: 'modules', text: 'What is tree-shaking and how does ES module structure enable it?', difficulty: 'medium' },
    { subtopicId: 'modules', text: 'Why are side effects at the top level of a module a potential problem for tree-shaking?', difficulty: 'expert' },
    { subtopicId: 'error-handling', text: 'When would you create a custom error class instead of using a generic Error?', difficulty: 'medium' },
    { subtopicId: 'error-handling', text: 'How does the error boundary pattern work in JavaScript without try-catch?', difficulty: 'medium' },
    { subtopicId: 'types-coercion', text: 'What are the rules of abstract equality (==) in JavaScript, and why is strict equality (===) preferred?', difficulty: 'easy' },
    { subtopicId: 'types-coercion', text: 'What happens when you add an object with a valueOf method to a number?', difficulty: 'expert' },
  ],
}

// ── TypeScript ──────────────────────────────────────────────────────────────

const TS_SUBTOPICS: TopicSubtopics = {
  topicId: 'typescript',
  subtopics: [
    { id: 'basics', label: 'Basic Types & Annotations', keywords: ['string', 'number', 'boolean', 'null', 'undefined', 'annotation', 'type', 'any', 'unknown'] },
    { id: 'generics', label: 'Generics', keywords: ['generic', 'type parameter', 'constraint', 'extends', 'infer', 'mapped type'] },
    { id: 'narrowing', label: 'Type Narrowing', keywords: ['narrow', 'narrowing', 'type guard', 'typeof', 'instanceof', 'in', 'discriminated', 'satisfies'] },
    { id: 'utility-types', label: 'Utility Types', keywords: ['partial', 'required', 'pick', 'omit', 'record', 'extract', 'exclude', 'nonnullable', 'returntype'] },
    { id: 'interfaces', label: 'Interfaces & Type Aliases', keywords: ['interface', 'type alias', 'declaration merging', 'extends', 'intersection', 'union'] },
    { id: 'advanced', label: 'Advanced Patterns', keywords: ['conditional', 'template literal', 'asserts', 'keyof', 'index', 'access', 'mapped'] },
  ],
  questions: [
    { subtopicId: 'basics', text: 'When would you use unknown instead of any, and why?', difficulty: 'easy' },
    { subtopicId: 'basics', text: 'What is the difference between type and interface for defining object shapes?', difficulty: 'easy' },
    { subtopicId: 'basics', text: 'When would you use a tuple type versus an array type?', difficulty: 'medium' },
    { subtopicId: 'basics', text: 'How does TypeScript handle the void return type in async functions?', difficulty: 'medium' },
    { subtopicId: 'generics', text: 'Write a generic function that wraps an async call and returns a Result type instead of throwing.', difficulty: 'medium' },
    { subtopicId: 'generics', text: 'How does the infer keyword work inside conditional types? Give an example.', difficulty: 'expert' },
    { subtopicId: 'generics', text: 'When would you use a generic constraint with extends versus a mapped type?', difficulty: 'medium' },
    { subtopicId: 'generics', text: 'Explain how you would type a function that takes different argument shapes based on a discriminator.', difficulty: 'expert' },
    { subtopicId: 'narrowing', text: 'How do discriminated unions help TypeScript narrow types in a switch statement?', difficulty: 'easy' },
    { subtopicId: 'narrowing', text: 'What is the satisfies operator and how does it differ from a type annotation?', difficulty: 'medium' },
    { subtopicId: 'narrowing', text: 'How does the in operator narrow union types in TypeScript?', difficulty: 'medium' },
    { subtopicId: 'narrowing', text: 'When would you use a type predicate function instead of a type guard?', difficulty: 'expert' },
    { subtopicId: 'utility-types', text: 'Explain the difference between Pick and Omit. When would you use each?', difficulty: 'easy' },
    { subtopicId: 'utility-types', text: 'How does the Readonly utility type differ from using the readonly keyword on properties?', difficulty: 'medium' },
    { subtopicId: 'utility-types', text: 'When would you use Extract versus a conditional type to filter union members?', difficulty: 'medium' },
    { subtopicId: 'interfaces', text: 'When would you choose a type alias over an interface, or vice versa?', difficulty: 'medium' },
    { subtopicId: 'interfaces', text: 'How does declaration merging work with interfaces and namespaces?', difficulty: 'expert' },
    { subtopicId: 'advanced', text: 'How would you type a function that memoizes its result based on its arguments?', difficulty: 'expert' },
    { subtopicId: 'advanced', text: 'What are template literal types and when would you use them in real-world code?', difficulty: 'expert' },
    { subtopicId: 'advanced', text: 'How do conditional types enable you to create types that transform other types?', difficulty: 'medium' },
  ],
}

// ── React ───────────────────────────────────────────────────────────────────

const REACT_SUBTOPICS: TopicSubtopics = {
  topicId: 'react',
  subtopics: [
    { id: 'hooks', label: 'Hooks', keywords: ['hook', 'usestate', 'useeffect', 'usecallback', 'usememo', 'useref', 'usereducer', 'custom hook'] },
    { id: 'state', label: 'State Management', keywords: ['state', 'context', 'reducer', 'zustand', 'jotai', 'redux', 'lift state', 'derived state'] },
    { id: 'rendering', label: 'Rendering & Reconciliation', keywords: ['render', 'reconcil', 'virtual dom', 'diff', 'fiber', 're-render', 'batch'] },
    { id: 'effects', label: 'Effects & Side Effects', keywords: ['effect', 'useeffect', 'cleanup', 'dependency', 'mount', 'unmount', 'side effect', 'abort'] },
    { id: 'composition', label: 'Composition Patterns', keywords: ['composition', 'compound', 'render prop', 'higher order', 'hoc', 'children', 'slot', 'provider'] },
    { id: 'performance', label: 'Performance', keywords: ['memo', 'usememo', 'usecallback', 'lazy', 'suspense', 'code split', 'virtualize'] },
    { id: 'forms', label: 'Forms & Events', keywords: ['form', 'controlled', 'uncontrolled', 'onchange', 'onsubmit', 'ref', 'validation'] },
  ],
  questions: [
    { subtopicId: 'hooks', text: 'When would you reach for useReducer over useState?', difficulty: 'easy' },
    { subtopicId: 'hooks', text: 'Explain the rules of hooks and why they exist from a compiler perspective.', difficulty: 'medium' },
    { subtopicId: 'hooks', text: 'How does useRef differ from useState when you need to persist a value across renders without re-rendering?', difficulty: 'medium' },
    { subtopicId: 'hooks', text: 'When would you write a custom hook versus extracting a utility function?', difficulty: 'medium' },
    { subtopicId: 'state', text: 'How do you decide between lifting state, context, and a state management library?', difficulty: 'medium' },
    { subtopicId: 'state', text: 'What are the trade-offs of using Zustand versus Jotai for global state?', difficulty: 'medium' },
    { subtopicId: 'state', text: 'How do you avoid unnecessary re-renders when using React Context?', difficulty: 'expert' },
    { subtopicId: 'rendering', text: 'What causes a component to re-render, and how does React batch updates?', difficulty: 'medium' },
    { subtopicId: 'rendering', text: 'Explain the React reconciliation algorithm. What makes it skip a subtree?', difficulty: 'expert' },
    { subtopicId: 'rendering', text: 'What is the difference between key and index for list rendering, and why does it matter?', difficulty: 'easy' },
    { subtopicId: 'rendering', text: 'How does React 18s concurrent rendering change the default behavior of setState?', difficulty: 'expert' },
    { subtopicId: 'effects', text: 'What is the cleanup function in useEffect and when does it run?', difficulty: 'easy' },
    { subtopicId: 'effects', text: 'How do you handle async work inside useEffect without creating a memory leak?', difficulty: 'medium' },
    { subtopicId: 'effects', text: 'When would you use useLayoutEffect instead of useEffect?', difficulty: 'medium' },
    { subtopicId: 'effects', text: 'How do you debug an effect that runs on every render when you only expected it to run once?', difficulty: 'medium' },
    { subtopicId: 'composition', text: 'When would you use the render prop pattern instead of a custom hook?', difficulty: 'medium' },
    { subtopicId: 'composition', text: 'How do compound components differ from a component that accepts a config prop?', difficulty: 'medium' },
    { subtopicId: 'performance', text: 'When does React.memo help, and when is it just adding overhead?', difficulty: 'medium' },
    { subtopicId: 'performance', text: 'How does React.lazy work with Suspense for code splitting?', difficulty: 'medium' },
    { subtopicId: 'performance', text: 'What is virtualization and when would you use it for long lists?', difficulty: 'medium' },
    { subtopicId: 'forms', text: 'What are the trade-offs between controlled and uncontrolled form inputs?', difficulty: 'easy' },
    { subtopicId: 'forms', text: 'How do you handle form validation in React without a library?', difficulty: 'medium' },
  ],
}

// ── Next.js ─────────────────────────────────────────────────────────────────

const NEXTJS_SUBTOPICS: TopicSubtopics = {
  topicId: 'nextjs',
  subtopics: [
    { id: 'app-router', label: 'App Router', keywords: ['app router', 'layout', 'page', 'loading', 'error', 'not-found', 'template', 'route group'] },
    { id: 'server-components', label: 'Server Components', keywords: ['server component', 'use client', 'use server', 'server action', 'rsc', 'streaming'] },
    { id: 'data-fetching', label: 'Data Fetching', keywords: ['fetch', 'cache', 'revalidate', 'dynamic', 'no store', 'segment config', 'search params'] },
    { id: 'caching', label: 'Caching & Revalidation', keywords: ['cache', 'revalidate', 'tag', 'on-demand', 'isr', 'static', 'dynamic'] },
    { id: 'routing', label: 'Routing & Navigation', keywords: ['link', 'navigate', 'redirect', 'middleware', 'rewrites', 'parallel', 'intercepting'] },
    { id: 'deploy', label: 'Deployment & Config', keywords: ['next.config', 'middleware', 'edge', 'serverless', 'docker', 'vercel', 'output'] },
  ],
  questions: [
    { subtopicId: 'app-router', text: 'How does the layout nesting model work in the App Router, and how does it differ from pages/_app?', difficulty: 'easy' },
    { subtopicId: 'app-router', text: 'What is the purpose of the loading.tsx and error.tsx conventions?', difficulty: 'easy' },
    { subtopicId: 'app-router', text: 'When would you use a route group versus a nested layout to organize routes?', difficulty: 'medium' },
    { subtopicId: 'app-router', text: 'How do catch-all routes and optional catch-all routes differ?', difficulty: 'medium' },
    { subtopicId: 'server-components', text: 'What can a server component do that a client component cannot, and vice versa?', difficulty: 'easy' },
    { subtopicId: 'server-components', text: 'Explain the server action flow. How does the client call a server function without an API route?', difficulty: 'medium' },
    { subtopicId: 'server-components', text: 'When would you use "use server" at the top of a file versus on individual functions?', difficulty: 'medium' },
    { subtopicId: 'server-components', text: 'How do you pass a Server Component as a child or prop to a Client Component?', difficulty: 'expert' },
    { subtopicId: 'data-fetching', text: 'When would you use React.cache() versus Next.js fetch cache for deduplicating requests?', difficulty: 'expert' },
    { subtopicId: 'data-fetching', text: 'How does the cache: no-store option differ from next: revalidate 0 in fetch?', difficulty: 'medium' },
    { subtopicId: 'data-fetching', text: 'What is streaming and how does it improve the user experience for slow data fetches?', difficulty: 'medium' },
    { subtopicId: 'caching', text: 'What is the difference between time-based revalidation and on-demand revalidation with tags?', difficulty: 'medium' },
    { subtopicId: 'caching', text: 'How does the unstable_cache function work and when would you use it?', difficulty: 'expert' },
    { subtopicId: 'caching', text: 'When should you opt out of the fetch cache entirely with cache: no-store?', difficulty: 'medium' },
    { subtopicId: 'routing', text: 'Explain what parallel routes and intercepted routes are and when you would use each.', difficulty: 'expert' },
    { subtopicId: 'routing', text: 'How does the useRouter hook differ from the Link component for navigation?', difficulty: 'easy' },
    { subtopicId: 'routing', text: 'When would you use next/navigation redirect versus a server-side redirect in middleware?', difficulty: 'medium' },
    { subtopicId: 'deploy', text: 'When would you need middleware in a Next.js app, and what can and cannot run in it?', difficulty: 'medium' },
    { subtopicId: 'deploy', text: 'How does the output: "standalone" config option affect Docker deployments?', difficulty: 'medium' },
    { subtopicId: 'deploy', text: 'What are the differences between deploying to Vercel versus a self-hosted Node.js server?', difficulty: 'easy' },
  ],
}

// ── Node.js ─────────────────────────────────────────────────────────────────

const NODEJS_SUBTOPICS: TopicSubtopics = {
  topicId: 'nodejs',
  subtopics: [
    { id: 'event-loop', label: 'Event Loop', keywords: ['event loop', 'libuv', 'callback', 'tick', 'phase', 'settimeout', 'setimmediate', 'process.nexttick'] },
    { id: 'streams', label: 'Streams', keywords: ['stream', 'readable', 'writable', 'transform', 'pipe', 'backpressure', 'chunk'] },
    { id: 'modules', label: 'Module System', keywords: ['require', 'import', 'commonjs', 'esm', 'module', 'exports', 'cjs'] },
    { id: 'async', label: 'Async Patterns', keywords: ['async', 'await', 'callback', 'promise', 'event emitter', 'stream'] },
    { id: 'filesystem', label: 'File System & IO', keywords: ['fs', 'file', 'directory', 'path', 'readfile', 'writefile', 'stream'] },
    { id: 'process', label: 'Process & OS', keywords: ['process', 'env', 'argv', 'cluster', 'worker', 'child_process', 'memory', 'cpu'] },
  ],
  questions: [
    { subtopicId: 'event-loop', text: 'What is the difference between process.nextTick() and setImmediate()?', difficulty: 'medium' },
    { subtopicId: 'event-loop', text: 'How does Node.js handle blocking operations, and what happens when you call a synchronous fs function in a request handler?', difficulty: 'medium' },
    { subtopicId: 'event-loop', text: 'What are the different phases of the Node.js event loop and in what order do they execute?', difficulty: 'expert' },
    { subtopicId: 'event-loop', text: 'When would you use worker_threads instead of child_process for CPU-bound work?', difficulty: 'expert' },
    { subtopicId: 'streams', text: 'When would you use a Transform stream versus a simple async function?', difficulty: 'medium' },
    { subtopicId: 'streams', text: 'Explain backpressure in Node.js streams and how pipe() handles it.', difficulty: 'expert' },
    { subtopicId: 'streams', text: 'How do you convert a readable stream to a string or buffer?', difficulty: 'medium' },
    { subtopicId: 'streams', text: 'What is the difference between objectMode streams and regular binary streams?', difficulty: 'medium' },
    { subtopicId: 'modules', text: 'Why does Node.js support both require and import, and what are the gotchas of mixing them?', difficulty: 'medium' },
    { subtopicId: 'modules', text: 'How does the __dirname variable work in ESM modules where it is not available?', difficulty: 'medium' },
    { subtopicId: 'modules', text: 'What is the purpose of the package.json "type": "module" field?', difficulty: 'easy' },
    { subtopicId: 'async', text: 'How would you handle errors in a long chain of async/await calls without repeating try-catch everywhere?', difficulty: 'medium' },
    { subtopicId: 'async', text: 'What is the difference between an EventEmitter and a Promise for async patterns?', difficulty: 'medium' },
    { subtopicId: 'async', text: 'When would you use the async iterator protocol (for await...of) over standard Promises?', difficulty: 'expert' },
    { subtopicId: 'filesystem', text: 'When would you use the synchronous fs methods versus the callback or Promise-based ones?', difficulty: 'easy' },
    { subtopicId: 'filesystem', text: 'How does the fs.createReadStream approach differ from fs.readFile for large files?', difficulty: 'medium' },
    { subtopicId: 'filesystem', text: 'What is the purpose of fs.promises and how does it differ from util.promisify?', difficulty: 'medium' },
    { subtopicId: 'process', text: 'When would you use the cluster module versus worker_threads?', difficulty: 'expert' },
    { subtopicId: 'process', text: 'How do you handle unhandled promise rejections in a Node.js process?', difficulty: 'medium' },
    { subtopicId: 'process', text: 'What environment variables should never be logged and why?', difficulty: 'easy' },
  ],
}

// ── Express ─────────────────────────────────────────────────────────────────

const EXPRESS_SUBTOPICS: TopicSubtopics = {
  topicId: 'express',
  subtopics: [
    { id: 'routing', label: 'Routing', keywords: ['route', 'router', 'get', 'post', 'put', 'delete', 'params', 'query', 'route matching'] },
    { id: 'middleware', label: 'Middleware', keywords: ['middleware', 'next', 'app.use', 'router.use', 'error middleware', 'apply'] },
    { id: 'error-handling', label: 'Error Handling', keywords: ['error', 'next(err)', 'error middleware', 'unhandled', 'async error'] },
    { id: 'rest', label: 'REST API Design', keywords: ['rest', 'resource', 'crud', 'status code', 'json', 'api', 'endpoint'] },
    { id: 'security', label: 'Security', keywords: ['helmet', 'cors', 'csrf', 'xss', 'sanitization', 'rate limit', 'authentication'] },
  ],
  questions: [
    { subtopicId: 'routing', text: 'How does Express match route parameters and when would you use a regex in a route path?', difficulty: 'medium' },
    { subtopicId: 'routing', text: 'What is the difference between req.params, req.query, and req.body?', difficulty: 'easy' },
    { subtopicId: 'routing', text: 'When would you use Router-level middleware versus application-level middleware?', difficulty: 'medium' },
    { subtopicId: 'routing', text: 'How do you version an API using Express routing?', difficulty: 'medium' },
    { subtopicId: 'middleware', text: 'Explain the middleware execution order. What happens if a middleware forgets to call next()?', difficulty: 'easy' },
    { subtopicId: 'middleware', text: 'How would you write middleware that handles both JSON and form-urlencoded bodies?', difficulty: 'medium' },
    { subtopicId: 'middleware', text: 'When would you use app.use(path, middleware) versus applying middleware inside a router?', difficulty: 'medium' },
    { subtopicId: 'middleware', text: 'How do you create middleware that runs only for specific HTTP methods?', difficulty: 'medium' },
    { subtopicId: 'error-handling', text: 'How do you handle async errors in Express 4 versus Express 5?', difficulty: 'medium' },
    { subtopicId: 'error-handling', text: 'What is the purpose of the four-argument error handler (err, req, res, next)?', difficulty: 'easy' },
    { subtopicId: 'error-handling', text: 'How do you propagate errors from nested async functions to the Express error handler?', difficulty: 'expert' },
    { subtopicId: 'error-handling', text: 'When would you throw an error versus sending an error response directly?', difficulty: 'medium' },
    { subtopicId: 'rest', text: 'When would you return 201 vs 200 for a successful POST request?', difficulty: 'easy' },
    { subtopicId: 'rest', text: 'How do you implement pagination in a REST API — offset-based vs cursor-based?', difficulty: 'medium' },
    { subtopicId: 'rest', text: 'What HTTP status codes should you use for authentication and authorization failures?', difficulty: 'medium' },
    { subtopicId: 'rest', text: 'How do you handle partial updates — PUT vs PATCH semantics?', difficulty: 'medium' },
    { subtopicId: 'security', text: 'What does the helmet middleware do, and which headers does it set?', difficulty: 'medium' },
    { subtopicId: 'security', text: 'How do you implement rate limiting in Express and why is it important?', difficulty: 'medium' },
    { subtopicId: 'security', text: 'What is the difference between CORS and CSRF, and how do you handle each in Express?', difficulty: 'medium' },
    { subtopicId: 'security', text: 'When would you use HTTP-only cookies instead of Authorization headers for tokens?', difficulty: 'expert' },
  ],
}

// ── JWT & Auth ──────────────────────────────────────────────────────────────

const JWT_SUBTOPICS: TopicSubtopics = {
  topicId: 'jwt',
  subtopics: [
    { id: 'token-basics', label: 'Token Basics', keywords: ['jwt', 'token', 'header', 'payload', 'signature', 'base64', 'claim'] },
    { id: 'sessions', label: 'Sessions vs Tokens', keywords: ['session', 'cookie', 'token', 'stateless', 'stateful', 'storage'] },
    { id: 'refresh', label: 'Refresh Flows', keywords: ['refresh token', 'access token', 'rotation', 'expiry', 'silent refresh'] },
    { id: 'signing', label: 'Signing & Verification', keywords: ['sign', 'verify', 'hmac', 'rsa', 'secret', 'public key', 'private key', 'algorithm'] },
    { id: 'security', label: 'Security Considerations', keywords: ['xss', 'csrf', 'httponly', 'secure', 'samesite', 'replay', 'exposure', 'storage'] },
  ],
  questions: [
    { subtopicId: 'token-basics', text: 'What are the three parts of a JWT and what does each contain?', difficulty: 'easy' },
    { subtopicId: 'token-basics', text: 'Why is a JWT payload not encrypted — and is that a security problem?', difficulty: 'medium' },
    { subtopicId: 'token-basics', text: 'How do you read the claims in a JWT without verifying the signature?', difficulty: 'easy' },
    { subtopicId: 'token-basics', text: 'What is the difference between registered, public, and private JWT claims?', difficulty: 'medium' },
    { subtopicId: 'sessions', text: 'When would you choose server-side sessions over JWTs, and vice versa?', difficulty: 'medium' },
    { subtopicId: 'sessions', text: 'How do you implement session fixation protection when using server-side sessions?', difficulty: 'expert' },
    { subtopicId: 'sessions', text: 'What are the scalability trade-offs between session-based and token-based auth?', difficulty: 'medium' },
    { subtopicId: 'sessions', text: 'When would you store a session in Redis versus a database?', difficulty: 'medium' },
    { subtopicId: 'refresh', text: 'Explain the access token / refresh token pattern. Why not just use a long-lived token?', difficulty: 'medium' },
    { subtopicId: 'refresh', text: 'How does token rotation protect against token theft, and what are its downsides?', difficulty: 'expert' },
    { subtopicId: 'refresh', text: 'How do you handle the scenario where a refresh token is used after it has been rotated?', difficulty: 'expert' },
    { subtopicId: 'refresh', text: 'What is the sliding window expiration pattern for refresh tokens?', difficulty: 'medium' },
    { subtopicId: 'signing', text: 'What is the difference between HMAC and RSA signing for JWTs?', difficulty: 'medium' },
    { subtopicId: 'signing', text: 'When would you use asymmetric (RS256) versus symmetric (HS256) signing?', difficulty: 'medium' },
    { subtopicId: 'signing', text: 'How does JWK (JSON Web Key) simplify key rotation for JWT verification?', difficulty: 'expert' },
    { subtopicId: 'security', text: 'Where should you store JWTs to prevent XSS attacks, and what trade-off does that introduce?', difficulty: 'medium' },
    { subtopicId: 'security', text: 'What is the "none" algorithm attack and how do libraries defend against it?', difficulty: 'expert' },
    { subtopicId: 'security', text: 'How do you prevent JWT replay attacks in a microservices architecture?', difficulty: 'expert' },
    { subtopicId: 'security', text: 'Why should you always validate the `iss` and `aud` claims on the server?', difficulty: 'medium' },
  ],
}

// ── MongoDB ─────────────────────────────────────────────────────────────────

const MONGODB_SUBTOPICS: TopicSubtopics = {
  topicId: 'mongodb',
  subtopics: [
    { id: 'documents', label: 'Document Design', keywords: ['document', 'schema', 'embed', 'reference', 'normalization', 'denormalization', 'bson'] },
    { id: 'indexes', label: 'Indexes', keywords: ['index', 'compound', 'unique', 'sparse', 'text', 'explain', 'scan'] },
    { id: 'aggregation', label: 'Aggregation Pipeline', keywords: ['aggregate', 'pipeline', 'match', 'group', 'lookup', 'project', 'unwind', 'sort'] },
    { id: 'crud', label: 'CRUD Operations', keywords: ['find', 'insert', 'update', 'delete', 'upsert', 'bulk', 'replace'] },
    { id: 'transactions', label: 'Transactions & Consistency', keywords: ['transaction', 'session', 'atomic', 'consistency', 'isolation', 'causally consistent'] },
  ],
  questions: [
    { subtopicId: 'documents', text: 'When would you embed a sub-document versus referencing another collection?', difficulty: 'easy' },
    { subtopicId: 'documents', text: 'How does the 16MB document size limit affect your schema design decisions?', difficulty: 'medium' },
    { subtopicId: 'documents', text: 'What are the trade-offs between embedding arrays of sub-documents versus using a separate collection?', difficulty: 'medium' },
    { subtopicId: 'documents', text: 'When would you use references with $lookup instead of embedding for a one-to-many relationship?', difficulty: 'expert' },
    { subtopicId: 'indexes', text: 'Explain how a compound index supports a query that filters on both fields AND sorts on a third.', difficulty: 'medium' },
    { subtopicId: 'indexes', text: 'When would an index hurt performance instead of helping it?', difficulty: 'expert' },
    { subtopicId: 'indexes', text: 'How do you decide which fields to include in a compound index?', difficulty: 'medium' },
    { subtopicId: 'indexes', text: 'What is the difference between a sparse index and a partial index?', difficulty: 'medium' },
    { subtopicId: 'aggregation', text: 'Walk through a pipeline that calculates the average order value per customer.', difficulty: 'medium' },
    { subtopicId: 'aggregation', text: 'How does $lookup differ from a SQL JOIN, and what are its performance implications?', difficulty: 'medium' },
    { subtopicId: 'aggregation', text: 'When would you use $facet to run multiple aggregations in a single pipeline?', difficulty: 'expert' },
    { subtopicId: 'aggregation', text: 'How do you handle null or missing fields in an aggregation pipeline?', difficulty: 'medium' },
    { subtopicId: 'crud', text: 'What is the difference between updateOne and replaceOne?', difficulty: 'easy' },
    { subtopicId: 'crud', text: 'When would you use upsert versus a separate find-and-insert pattern?', difficulty: 'medium' },
    { subtopicId: 'crud', text: 'How do you perform a bulk write operation efficiently in MongoDB?', difficulty: 'medium' },
    { subtopicId: 'crud', text: 'What is the difference between $set and $setOnInsert in an update operation?', difficulty: 'medium' },
    { subtopicId: 'transactions', text: 'When do you need a MongoDB transaction versus relying on document-level atomicity?', difficulty: 'medium' },
    { subtopicId: 'transactions', text: 'How does causal consistency work in a MongoDB replica set?', difficulty: 'expert' },
    { subtopicId: 'transactions', text: 'What performance impact do multi-document transactions have and when is that acceptable?', difficulty: 'medium' },
  ],
}

// ── Registry ────────────────────────────────────────────────────────────────

export const TOPIC_SUBTOPICS: TopicSubtopics[] = [
  HTML_SUBTOPICS,
  CSS_SUBTOPICS,
  JS_SUBTOPICS,
  TS_SUBTOPICS,
  REACT_SUBTOPICS,
  NEXTJS_SUBTOPICS,
  NODEJS_SUBTOPICS,
  EXPRESS_SUBTOPICS,
  JWT_SUBTOPICS,
  MONGODB_SUBTOPICS,
]

/** Get subtopics and questions for a topic ID. Returns undefined if unknown. */
export function subtopicsForTopic(topicId: string): TopicSubtopics | undefined {
  return TOPIC_SUBTOPICS.find((t) => t.topicId === topicId)
}

/** Flat list of subtopic labels for a topic, used in the system instruction. */
export function subtopicLabels(topicId: string): string[] {
  return subtopicsForTopic(topicId)?.subtopics.map((s) => s.label) ?? []
}

/** All keywords for a topic, keyed by subtopic ID. Used for transcript analysis. */
export function subtopicKeywords(topicId: string): Record<string, string[]> {
  const entry = subtopicsForTopic(topicId)
  if (!entry) return {}
  const map: Record<string, string[]> = {}
  for (const st of entry.subtopics) map[st.id] = st.keywords
  return map
}

/**
 * Given a transcript and a topic, return the set of subtopic IDs that appear
 * to have been covered. Detection is keyword-based and intentionally loose —
 * the report LLM provides the nuanced per-subtopic assessment.
 */
export function detectCoveredSubtopics(
  topicId: string,
  transcript: { role: string; text: string }[],
): string[] {
  const keywords = subtopicKeywords(topicId)
  const covered: string[] = []
  const allText = transcript.map((t) => t.text).join(' ').toLowerCase()

  for (const [subId, kws] of Object.entries(keywords)) {
    const matched = kws.some((kw) => allText.includes(kw.toLowerCase()))
    if (matched) covered.push(subId)
  }
  return covered
}
