export class ExprError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExprError";
  }
}

export class MissingField extends Error {
  field: string;
  constructor(field: string) {
    super(field);
    this.name = "MissingField";
    this.field = field;
  }
}

type Tok =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "id"; v: string }
  | { k: "kw"; v: "and" | "or" | "not" | "in" | "True" | "False" | "None" }
  | { k: "op"; v: "==" | "!=" | ">=" | "<=" | ">" | "<" }
  | { k: "p"; v: "(" | ")" | "[" | "]" | "," | "." };

const KEYWORDS = new Set(["and", "or", "not", "in", "True", "False", "None"]);

function tokenize(source: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === " " || c === "\n" || c === "\t") {
      i += 1;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      i += 1;
      let value = "";
      while (i < source.length && source[i] !== quote) {
        value += source[i];
        i += 1;
      }
      if (source[i] !== quote) throw new ExprError(`unterminated string in ${source}`);
      i += 1;
      tokens.push({ k: "str", v: value });
      continue;
    }
    if (/[0-9]/.test(c)) {
      let raw = "";
      while (i < source.length && /[0-9.]/.test(source[i])) {
        raw += source[i];
        i += 1;
      }
      tokens.push({ k: "num", v: Number(raw) });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let raw = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        raw += source[i];
        i += 1;
      }
      if (KEYWORDS.has(raw)) tokens.push({ k: "kw", v: raw as "and" });
      else tokens.push({ k: "id", v: raw });
      continue;
    }
    const two = source.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === ">=" || two === "<=") {
      tokens.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if (c === ">" || c === "<") {
      tokens.push({ k: "op", v: c });
      i += 1;
      continue;
    }
    if (c === "(" || c === ")" || c === "[" || c === "]" || c === "," || c === ".") {
      tokens.push({ k: "p", v: c });
      i += 1;
      continue;
    }
    throw new ExprError(`unexpected character ${c} in ${source}`);
  }
  return tokens;
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined;
}

export class SafeEvaluator {
  private readonly context: Record<string, unknown>;

  constructor(context: Record<string, unknown>) {
    this.context = context;
  }

  eval(expression: string): unknown {
    const parser = new Parser(tokenize(expression), this.context, expression);
    const value = parser.parseOr();
    parser.end();
    return value;
  }
}

class Parser {
  private index = 0;
  private readonly tokens: Tok[];
  private readonly context: Record<string, unknown>;
  private readonly source: string;

  constructor(tokens: Tok[], context: Record<string, unknown>, source: string) {
    this.tokens = tokens;
    this.context = context;
    this.source = source;
  }

  end() {
    if (this.index < this.tokens.length) {
      throw new ExprError(`trailing tokens in ${this.source}`);
    }
  }

  parseOr(): unknown {
    let left = this.parseAnd();
    while (this.matchKw("or")) {
      const right = this.parseAnd();
      if (!left) left = right;
    }
    return left;
  }

  parseAnd(): unknown {
    let left = this.parseNot();
    while (this.matchKw("and")) {
      const right = this.parseNot();
      if (left) left = right;
    }
    return left;
  }

  parseNot(): unknown {
    if (this.matchKw("not")) {
      const peek = this.tokens[this.index];
      if (peek?.k === "kw" && peek.v === "in") {
        this.index -= 1;
        return this.parseCmp();
      }
      return !this.parseNot();
    }
    return this.parseCmp();
  }

  parseCmp(): unknown {
    const left = this.parseAdd();
    if (this.matchKw("not")) {
      this.expectKw("in");
      return !includes(this.parseAdd(), left);
    }
    if (this.matchKw("in")) return includes(this.parseAdd(), left);
    const op = this.matchOp();
    if (!op) return left;
    const right = this.parseAdd();
    switch (op) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case ">=":
        return Number(left) >= Number(right);
      case "<=":
        return Number(left) <= Number(right);
      case ">":
        return Number(left) > Number(right);
      case "<":
        return Number(left) < Number(right);
      default:
        throw new ExprError(`unsupported operator ${op}`);
    }
  }

  parseAdd(): unknown {
    let left = this.parseUnary();
    while (this.tokens[this.index]?.k === "op" && (this.tokens[this.index] as { v: string }).v === "+") {
      this.index += 1;
      left = Number(left) + Number(this.parseUnary());
    }
    return left;
  }

  parseUnary(): unknown {
    return this.parsePrimary();
  }

  parsePrimary(): unknown {
    const token = this.tokens[this.index];
    if (!token) throw new ExprError(`unexpected end of ${this.source}`);
    if (token.k === "num") {
      this.index += 1;
      return token.v;
    }
    if (token.k === "str") {
      this.index += 1;
      return token.v;
    }
    if (token.k === "kw" && token.v === "True") {
      this.index += 1;
      return true;
    }
    if (token.k === "kw" && token.v === "False") {
      this.index += 1;
      return false;
    }
    if (token.k === "kw" && token.v === "None") {
      this.index += 1;
      return null;
    }
    if (token.k === "p" && token.v === "[") return this.parseList();
    if (token.k === "p" && token.v === "(") {
      this.index += 1;
      const value = this.parseOr();
      this.expectP(")");
      return value;
    }
    if (token.k === "id") {
      this.index += 1;
      if (!(token.v in this.context)) throw new ExprError(`unknown name ${token.v}`);
      let owner: unknown = this.context;
      let value = this.context[token.v];
      let path = token.v;
      while (this.matchP(".")) {
        const attr = this.expectId();
        if (attr.startsWith("_")) throw new ExprError(`private attribute ${attr}`);
        path = `${path}.${attr}`;
        owner = value;
        value = readAttr(value, attr, path);
      }
      if (this.matchP("(")) {
        const args: unknown[] = [];
        if (!this.matchP(")")) {
          args.push(this.parseOr());
          while (this.matchP(",")) args.push(this.parseOr());
          this.expectP(")");
        }
        if (typeof value !== "function") throw new ExprError(`not a function: ${path}`);
        return value.apply(owner, args);
      }
      return value;
    }
    throw new ExprError(`cannot parse ${this.source}`);
  }

  parseList(): unknown[] {
    this.expectP("[");
    const items: unknown[] = [];
    if (!this.matchP("]")) {
      items.push(this.parseOr());
      while (this.matchP(",")) items.push(this.parseOr());
      this.expectP("]");
    }
    return items;
  }

  private matchKw(word: string): boolean {
    const token = this.tokens[this.index];
    if (token?.k === "kw" && token.v === word) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private expectKw(word: string) {
    if (!this.matchKw(word)) throw new ExprError(`expected ${word} in ${this.source}`);
  }

  private matchOp(): Tok extends { k: "op" } ? string : string | null {
    const token = this.tokens[this.index];
    if (token?.k === "op") {
      this.index += 1;
      return token.v;
    }
    return null;
  }

  private matchP(value: Tok extends { k: "p" } ? string : string): boolean {
    const token = this.tokens[this.index];
    if (token?.k === "p" && token.v === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private expectP(value: "(" | ")" | "[" | "]" | "," | ".") {
    if (!this.matchP(value)) throw new ExprError(`expected ${value} in ${this.source}`);
  }

  private expectId(): string {
    const token = this.tokens[this.index];
    if (token?.k !== "id") throw new ExprError(`expected name in ${this.source}`);
    this.index += 1;
    return token.v;
  }
}

function readAttr(base: unknown, attr: string, path: string): unknown {
  if (base === null || base === undefined) throw new MissingField(path);
  if (typeof base !== "object") throw new MissingField(path);
  const record = base as Record<string, unknown>;
  if (!(attr in record) || isMissing(record[attr])) throw new MissingField(path);
  return record[attr];
}

function includes(container: unknown, item: unknown): boolean {
  if (typeof container === "string") return container.includes(String(item));
  if (Array.isArray(container)) return container.includes(item);
  throw new ExprError("in requires a string or list");
}
