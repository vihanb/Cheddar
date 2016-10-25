import * as CheddarError from '../consts/err';

export default class CheddarLexer {
    constructor(Code, Index) {
        this.Code  = Code;
        this.Index = Index;

        this._Tokens = [];
    }

    toAST() {
        let node = this,
            tokens = this._Tokens;

        while (tokens.length === 1 && tokens[0].isExpression) {
            node = tokens[0];
            tokens = tokens[0]._Tokens;
        }

        if (tokens.length === 1 && tokens[0] instanceof CheddarLexer) {
            node = tokens[0];
            tokens = tokens[0]._Tokens;
        }

        return node.constructor.name.replace(/^Cheddar/g, '') + '\n' + tokens.map(t => typeof t === 'string'  ? "'" + t + "'" : t)
            .map(t => t.toAST ? t.toAST() : t.toString())
            .join(tokens.every(o => !(o instanceof CheddarLexer)) ? ' ' : '\n')
            .replace(/^/gm, ' │')
            .replace(/^ │(?! [└├│┬])/gm, ' ├');
            //.replace(/^((?: [^└├│┬])*)├/gm, '└'); //wait only the last one
    }

    getChar() {
        return this.Code[this.Index++];
    }

    get curchar() { return this.Code[this.Index] }

    newToken(fill = '') { this._Tokens[this._Tokens.push(fill) - 1]; return this }
    addToken(char = '') { this._Tokens[this._Tokens.length - 1] += char; return this }

    get last() { return this._Tokens[this._Tokens.length - 1] }

    shift() {
        return this._Tokens.shift();
    }

    open(forceNot) {
        if (forceNot !== false)
            this.newToken();
    }

    close(arg) {
        return arg || this;
    }
    error(id) {
        this.Errored = true;
        return id;
    }

    get Tokens() { return this._Tokens }
    set Tokens(v) {
        if (Array.isArray(v))
            this._Tokens.push(...v);
        else
            this._Tokens.push(v);
    }

    get isLast() { return this.Index === this.Code.length }

    attempt(...parsers) {
        let global_tokenizer;
        if (Array.isArray(parsers[0])) {
            [
                parsers,
                global_tokenizer
            ] = parsers;
        }

        let attempt;
        let furthest = this.Index;
        for (let i = 0; i < parsers.length; i++) {
            if (parsers[i] instanceof CheddarLexer) {
                parsers[i].Code = this.Code;
                parsers[i].Index = this.Index;
                attempt = parsers[i].exec(global_tokenizer);
            } else {
                parsers[i] = this.initParser(parsers[i]);
                attempt = parsers[i].exec(global_tokenizer);
            }

            if (attempt instanceof CheddarLexer && attempt.Errored !== true) {
                this.Index = attempt.Index;
                return attempt;
            } else if (attempt !== CheddarError.EXIT_NOTFOUND) {
                this.Index = parsers[i].Index;

                if (attempt instanceof CheddarLexer) {
                    return this.error(CheddarError.UNEXPECTED_TOKEN);
                } else {
                    return this.error(attempt);
                }
            } else {
                furthest = Math.max(furthest, parsers[i].Index);
            }
        }

        this.Index = furthest;
        return this.error(CheddarError.EXIT_NOTFOUND);
    }

    initParser(parseClass, i = this.Index) {
        if (parseClass instanceof CheddarLexer) {
            parseClass.Code = this.Code;
            parseClass.Index = i;
            return parseClass;
        } else {
            return new parseClass(this.Code, i);
        }
    }

    tok(n = 0) { return this._Tokens[n] }

    grammar(whitespace, ...defs) { //TODO: remove unused stuff (if any)
        // defs<Array<CheddarLexer or String>>
        let index,
            parser,
            result,
            tokens,
            i,
            j,
            WDIFF,
            LWMIN, // last whitespcae lower bound
            LWMAX; // last whitespcae upper bound

        main: for (i = 0; i < defs.length; i++) {

            index = this.Index;
            tokens = [];

            sub: for (j = 0; j < defs[i].length; j++) {
                if (whitespace) {
                    let oldIndex = this.Index;
                    let deltaIndex = index;
                    this.Index = index;
                    this.jumpWhite();
                    index = this.Index;
                    WDIFF = this.Index - deltaIndex > 0;
                    LWMIN = deltaIndex;
                    LWMAX = this.Index;
                    this.Index = oldIndex;
                }

                if (typeof defs[i][j] === 'symbol') {
                    continue sub;
                } else if (defs[i][j] instanceof CheddarLexer) {
                    parser = defs[i][j];
                    parser.Code = this.Code;
                    parser.Index = index;
                    result = parser.exec();

                    if (result === CheddarError.EXIT_NOTFOUND) {
                        continue main;
                    } else if (!(result instanceof CheddarLexer)) {
                        this.Index = parser.Index;
                        return this.error(result);
                    }

                    index = result.Index;

                    tokens.push(result);
                } else if (defs[i][j].prototype instanceof CheddarLexer) {
                    parser = new (defs[i][j])(this.Code, index);
                    result = parser.exec();

                    if (
                        !(result instanceof CheddarLexer) &&
                        typeof defs[i][j + 1] === 'symbol'
                    )  {
                        if (defs[i][j + 1] === CheddarError.ALLOW_ERROR) {
                            j++;
                            continue main;
                        } else {
                            this.Index = Math.max(parser.Index, index);
                            return this.error(defs[i][j + 1]);
                        }
                    }

                    if (result === CheddarError.EXIT_NOTFOUND) {
                        continue main;
                    } else if (!(result instanceof CheddarLexer)) {
                        this.Index = parser.Index;
                        return this.error(result);
                    }

                    index = parser.Index;

                    // Filters out meaningless data
                    if (!(
                        (
                            result.constructor.name.endsWith('Alpha') ||
                            result.constructor.name.endsWith('Beta')
                        ) &&
                        result._Tokens.length === 0))
                        tokens.push(result);
                } else if (defs[i][j] === this.jumpWhite) {
                    let oldIndex = this.Index;
                    this.Index = index;
                    if (whitespace ? !WDIFF : !/\s/.test(this.curchar))
                        return this.error(CheddarError.EXIT_NOTFOUND);
                    this.jumpWhite();
                    index = this.Index;
                    this.Index = oldIndex;
                } else if (defs[i][j] === this.jumpSpace) {
                    let oldIndex = this.Index;
                    this.Index = index;
                    this.jumpWhite();
                    index = this.Index;
                    this.Index = oldIndex;
                } else if (Array.isArray(defs[i][j])) {
                    if (defs[i][j].length === 1) {
                        if (Array.isArray(defs[i][j][0])) {
                            // TODO: not recommended; creates 2^optionals new rules
                            //slice(0) clones array
                            let def = defs[i].slice(0);
                            def.splice(j, 1);
                            defs.splice(i + 1, 0, def);
                            defs[i].splice(j, 1, ...(defs[i][j][0]));
                            i--;
                            continue main;
                        }

                        // Optional
                        if (typeof defs[i][j][0] === 'string') {
                            // If it matches
                            if (this.Code.indexOf(defs[i][j][0], index) === index) {
                                index += defs[i][j][0].length;
                                tokens.push(defs[i][j][0]);
                            }
                        } else if (defs[i][j][0] === this.jumpWhite) {
                            let oldIndex = this.Index;
                            this.Index = index;
                            this.jumpWhite();
                            index = this.Index;
                            this.Index = oldIndex;
                        } else {
                            parser = this.initParser(defs[i][j][0], index);
                            result = parser.exec();

                            if (result !== CheddarError.EXIT_NOTFOUND) {
                                if (!(result instanceof CheddarLexer)) {
                                    return this.error(result);
                                } else {
                                    index = result.Index;

                                    // Filter
                                    if (!(
                                        (
                                            result.constructor.name.endsWith('Alpha') ||
                                            result.constructor.name.endsWith('Beta')
                                        ) &&
                                        result._Tokens.length === 0))
                                        tokens.push(result);
                                }
                            }
                        }
                    } else {
                        // OR
                        let match;
                        let oldIndex = this.Index;
                        let success = false;
                        for (let k = 0; k < defs[i][j].length; k++) {
                            this.Index = index;
                            if (defs[i][j][k].prototype instanceof CheddarLexer || defs[i][j][k] instanceof CheddarLexer) {
                                result = this.initParser(defs[i][j][k]).exec();
                                if (result instanceof CheddarLexer) {
                                    match = result;
                                    index = result.Index;
                                    break;
                                }
                                if (result !== CheddarError.EXIT_NOTFOUND)
                                    return this.error(result);
                            } else {
                                result = this.jumpLiteral(defs[i][j][k]);
                                if (result) {
                                    success = true;
                                    match = defs[i][j][k];
                                    index = this.Index;
                                    break;
                                }
                            }
                        }
                        this.Index = oldIndex;
                        if (match || success) {
                            if (!(
                                (
                                    result.constructor.name.endsWith('Alpha') ||
                                    result.constructor.name.endsWith('Beta')
                                ) &&
                                result._Tokens.length === 0)) {
                                tokens.push(match);
                                continue sub;
                            }
                        } else {
                            // this.Index = result.Index;
                            if (defs[i][j + 1] === CheddarError.ALLOW_ERROR) {
                                j++;
                                continue main;
                            } else {
                                return this.error(CheddarError.EXIT_NOTFOUND);
                            }
                        }
                    }
                } else {
                    // It must be a string
                    let oldIndex = this.Index;
                    this.Index = index;
                    result = this.jumpLiteral(defs[i][j]);
                    if (result)
                        index = this.Index;
                    this.Index = oldIndex;
                    if (!result) {
                        continue main;
                    } else if (defs[i][j + 1] === CheddarError.KEEP_ITEM) {
                        tokens.push(defs[i][j]);
                        j++;
                    }
                }
            }

            this.Tokens = tokens;
            this.Index = index;

            if (LWMAX  === this.Index && LWMIN < LWMAX) {
                this.Index = LWMIN;
            }

            return this.close();
        }

        return this.error(CheddarError.EXIT_NOTFOUND);
    }

    /*
    Whitespace Grammar:
    W -> w
         w C1 w
         w C2 w
         ... etc

    Right-recursive:
    W -> w α
         α
    α -> C1 W
         C2 W

    where C1...CN are terminal comment grammars
    */
    jumpWhite() {
        let STARTINDEX = this.Index;
        while (/\s/.test(this.Code[this.Index])) {
            this.Index++;
            this._jumpComment();
        }

        return this;
    }

    _jumpComment() {
        if (this.Code[this.Index] === '/') {
            switch (this.Code[this.Index + 1]) {
                case '*':
                   // match till EOF or '*/'
                   this.Index += 2;
                   this._jumpBlockComment();
                   break;
                case '/':
                    // match till EOF or newline
                    this.Index += 2; // jump ahead to the start of the comment
                    while (this.curchar && this.curchar !== '\n')
                        this.Index++;
                    break;
                default:
                    return false;
            }

            return true;
        } else {
            return false;
        }

        // you must of borked something bad if this is executing
    }

    _jumpBlockComment() {
        let nextStart, nextEnd,
            depth = 1,
            newIndex = this.Index + 2;
        while (depth) {
            nextStart = this.Code.indexOf('/*', newIndex);
            nextEnd = this.Code.indexOf('*/', newIndex);
            if (nextStart < nextEnd) {
                depth++;
                newIndex = nextStart + 2;
            } else {
                depth--;
                newIndex = nextEnd + 2;
            }
            if (nextEnd === -1)
                return this.error(CheddarError.UNEXPECTED_TOKEN);
        }
        this.Index = newIndex;
        return this;
    }

    jumpLiteral(l) {
        //TODO: make more efficient
        //downgoat D: this returned first index
        //took me 6 hours to figure out the problem :(
        //D: D: D:
        if (this.Code.indexOf(l, this.Index) === this.Index)
            this.Index += l.length;
        else
            return false;
        return this;
    }

    jumpSpace() {
        return this.jumpWhite();
    }

    lookAhead(seq) {
        this.jumpWhite();
        return this.Code.indexOf(seq, this.Index) === this.Index;
    }

    isExpression = false;

    get isPrimitive() { return false; }
}