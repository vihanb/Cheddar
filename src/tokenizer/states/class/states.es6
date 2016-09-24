import CheddarLexer from '../../tok/lex';
import * as CheddarError from '../../consts/err';

import ClassSingleStatement from './single_state';

export default class ClassStatement extends CheddarLexer {
    exec(tokenizer) {
        this.open(false);

        let match = new ClassSingleStatement(this.Code, this.Index);
        let res = match.exec(tokenizer);

        let items = [];

        while (res instanceof CheddarLexer && res.Errored !== true) {
            items.push(res);

            this.Index = res.Index;

            match = new ClassSingleStatement(this.Code, this.Index);
            res = match.exec(tokenizer);
        }

        if (res === CheddarError.EXIT_NOTFOUND) {
            // Add and close
            this._Tokens = items;
            return this.close();
        } else {
            // And a bork bork here and a bork bork there
            // here a bork there a bork, everywhere a bork bork
            //console.log("PLS HALP THERES BORK HERE PLS");
            //console.log(res);
            return res;
        }
    }
}