import CheddarLexer from '../../tok/lex';
import * as CheddarError from '../../consts/err';

import ClassStateInit from './states/init';

export default class ClassSingleStatement extends CheddarLexer {
    exec(tokenizer) {
        this.open(false);

        return this.attempt(
            /* Class Statement List */
            [
                ClassStateInit
            ], tokenizer
        );
    }
}