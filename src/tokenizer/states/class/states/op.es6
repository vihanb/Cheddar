import CheddarLexer from '../../../tok/lex';
import CheddarCodeblock from '../../../patterns/block';
import CheddarCustomLexer from '../../../parsers/custom';

import CheddarArray from '../../../parsers/array';
import CheddarVariable from '../../../literals/var';

import {KEEP_ITEM} from '../../../consts/err';

import {UOP, OP} from '../../../consts/ops';

export default class ClassStateOp extends CheddarLexer {
    exec(tokenizer) {
        this.open(false);

        return this.grammar(true,
            [
                'unary', KEEP_ITEM, 'op', UOP,
                CheddarCustomLexer(CheddarArray, '(', ')', CheddarVariable),
                CheddarCustomLexer(CheddarCodeblock, tokenizer)
            ],
            [
                'binary', KEEP_ITEM, 'op', OP,
                CheddarCustomLexer(CheddarArray, '(', ')', CheddarVariable),
                CheddarCustomLexer(CheddarCodeblock, tokenizer)
            ]
        );
    }
}