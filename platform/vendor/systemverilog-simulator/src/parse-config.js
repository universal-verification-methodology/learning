/**
 * Parse IEEE 1364 library / config design units.
 * Modularity V8 — see V8_CONFIG.md.
 *
 * Soft-keywords inside config: default, instance, cell, use
 */

export function attachParseConfig(ctx) {
  const { eat, match, at, peek, error } = ctx;

  function softId(name) {
    return at("id") && peek().value === name;
  }

  function atSoft(name) {
    // Some config words are also hard keywords elsewhere (e.g. default)
    return at(name) || softId(name);
  }

  function eatSoft(name) {
    if (at(name)) return eat(name);
    if (!softId(name)) error(`Expected '${name}'`);
    return eat("id");
  }

  function parseLibCellRef() {
    const a = eat("id").value;
    if (match(".")) {
      return { lib: a, cell: eat("id").value };
    }
    return { lib: null, cell: a };
  }

  function parseLibrary() {
    eat("library");
    const name = eat("id").value;
    const files = [];
    if (at("string")) {
      files.push(eat("string").value);
      while (match(",")) {
        if (!at("string")) error("Expected file string in library declaration");
        files.push(eat("string").value);
      }
    }
    eat(";");
    return { type: "Library", name, files };
  }

  function parseConfig() {
    eat("config");
    const name = eat("id").value;
    eat(";");
    /** @type {{ lib: string|null, cell: string }|null} */
    let design = null;
    /** @type {object[]} */
    const rules = [];

    while (!at("endconfig") && !at("eof")) {
      if (at("design")) {
        eat("design");
        design = parseLibCellRef();
        eat(";");
        continue;
      }
      if (atSoft("default")) {
        eatSoft("default");
        eatSoft("liblist");
        const liblist = [];
        while (at("id")) liblist.push(eat("id").value);
        eat(";");
        rules.push({ type: "Default", liblist });
        continue;
      }
      if (atSoft("instance")) {
        eatSoft("instance");
        const path = [eat("id").value];
        while (match(".")) path.push(eat("id").value);
        eatSoft("use");
        const use = parseLibCellRef();
        eat(";");
        rules.push({ type: "Instance", path, use });
        continue;
      }
      if (atSoft("cell")) {
        eatSoft("cell");
        const cell = eat("id").value;
        eatSoft("use");
        const use = parseLibCellRef();
        eat(";");
        rules.push({ type: "Cell", cell, use });
        continue;
      }
      error("Expected design, default liblist, instance, or cell in config");
    }
    eat("endconfig");
    return { type: "Config", name, design, rules };
  }

  Object.assign(ctx, {
    parseLibrary,
    parseConfig,
  });
}
