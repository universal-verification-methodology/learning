/**
 * Built-in IEEE 1800 `std` package (selected subset).
 * Method bodies are stubs — mailbox / semaphore / process run via src/std-runtime.js.
 */

function emptyFn(name, opts = {}) {
  return {
    type: "Function",
    name,
    width: opts.width ?? 0,
    range: null,
    ports: opts.ports || [],
    decls: [],
    body: { type: "Block", stmts: [] },
    isVoid: opts.isVoid ?? opts.width === 0,
    virtual: false,
    methodKind: "function",
    access: "public",
    isStatic: !!opts.isStatic,
    returnsHandle: opts.returnsHandle || null,
  };
}

function emptyTask(name, ports = []) {
  return {
    type: "Task",
    name,
    ports,
    decls: [],
    body: { type: "Block", stmts: [] },
    virtual: false,
    methodKind: "task",
    access: "public",
    isStatic: false,
  };
}

function intPort(direction, name) {
  return {
    type: "TfPortDecl",
    direction,
    kind: "integer",
    width: 32,
    range: null,
    names: [name],
  };
}

/** @returns {object} Package AST */
export function createStdPackageAst() {
  return {
    type: "Package",
    name: "std",
    items: [
      {
        type: "Typedef",
        name: "process_state",
        enum: {
          kind: "logic",
          width: 32,
          range: null,
          members: [
            { name: "FINISHED", value: { type: "Number", value: 0 } },
            { name: "RUNNING", value: { type: "Number", value: 1 } },
            { name: "WAITING", value: { type: "Number", value: 2 } },
            { name: "SUSPENDED", value: { type: "Number", value: 3 } },
            { name: "KILLED", value: { type: "Number", value: 4 } },
          ],
        },
      },
      {
        type: "Class",
        name: "process",
        base: null,
        props: [],
        methods: [
          {
            ...emptyFn("self", { isStatic: true, returnsHandle: "process", isVoid: false, width: 0 }),
            isVoid: false,
          },
          emptyFn("status", { width: 32, isVoid: false }),
          emptyFn("kill", { isVoid: true }),
          emptyFn("await", { isVoid: true }),
          emptyFn("suspend", { isVoid: true }),
          emptyFn("resume", { isVoid: true }),
        ],
      },
      {
        type: "Class",
        name: "semaphore",
        base: null,
        props: [],
        methods: [
          emptyFn("new", { ports: [intPort("input", "count")], isVoid: false }),
          emptyTask("get", [intPort("input", "n")]),
          emptyFn("put", { ports: [intPort("input", "n")], isVoid: true }),
          emptyFn("try_get", { ports: [intPort("input", "n")], width: 32, isVoid: false }),
        ],
      },
      {
        type: "Class",
        name: "mailbox",
        base: null,
        props: [],
        methods: [
          // Optional bound is passed via `new(bound)` args; native ctor reads them.
          emptyFn("new", { isVoid: false }),
          emptyFn("num", { width: 32, isVoid: false }),
          emptyTask("put", [intPort("input", "msg")]),
          emptyTask("get", [intPort("output", "msg")]),
          emptyTask("peek", [intPort("output", "msg")]),
          emptyFn("try_put", { ports: [intPort("input", "msg")], width: 32, isVoid: false }),
          emptyFn("try_get", {
            ports: [intPort("output", "msg")],
            width: 32,
            isVoid: false,
          }),
          emptyFn("try_peek", {
            ports: [intPort("output", "msg")],
            width: 32,
            isVoid: false,
          }),
        ],
      },
    ],
  };
}
