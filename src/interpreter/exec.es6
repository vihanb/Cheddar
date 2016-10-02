import links from './links';
import NIL from './core/consts/nil';
import Signal from './signal';

export default class CheddarExec {
    constructor(exec_stack, scope, data) {
        this.Code = exec_stack._Tokens;
        this._csi = 0;
        this.Scope = scope;

        this.data = data; // data to send to proc

        this.continue = true;
        this.lrep = new NIL;
    }

    step() {
        let item = this.Code[this._csi++];
        let sproc = links[item.constructor.name];

        let proc = new sproc(item, this.Scope, this.data);
        let resp = proc.exec();

        if (typeof resp === "string") {
            this.continue = false;
            this.lrep = resp;
        } else if (typeof resp === "undefined") {
            this.lrep = new NIL;
        } else if (resp instanceof Signal) {
            resp.res = this.lrep;
            this.lrep = resp;
            this.continue = false;
        } else {
            this.lrep = resp;
        }
    }

    exec(OPTS) {
        if (OPTS) {
            global.CHEDDAR_OPTS = OPTS;
        }

        while (this.Code[this._csi] && this.continue)
            this.step();
        return this.lrep;
    }
}