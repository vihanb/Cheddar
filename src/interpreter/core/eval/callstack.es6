import CheddarScope from '../env/scope';
import CheddarShuntingYard from '../../../tokenizer/tok/shunting_yard';

export default class CheddarCallStack {
    constructor(exec_instruct, scope = new CheddarScope(), data) {
        this.InStack = new CheddarShuntingYard().exec(
            exec_instruct._Tokens[0]
        )._Tokens;

        this.CallStack = [];
        this.Scope = scope;

        this.data = data;

        this._csi = 0; // Call-stack Index
    }

    get stack() { return this.CallStack }

    put(n) {
        return this.CallStack.unshift(n);
    }

    shift() {
        return this.CallStack.shift();
    }

    next() {
        return this.InStack[this._csi++];
    }

    close() {
        let ret = this.CallStack[this.CallStack.length - 1];
        if (ret) {
            delete ret.Reference;
            delete ret.scope;
        }
        return ret;
    }
}