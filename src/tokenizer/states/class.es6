import CheddarLexer from '../tok/lex';
import * as CheddarError from '../consts/err';

import CheddarCustomLexer from '../parsers/custom';

// Tokens
import CheddarVariableToken from '../literals/var';
import ClassArgument from './class/arg';
import ClassStatement from './class/states';

import CheddarArrayLexer from '../parsers/array';

let ClassArguments = CheddarCustomLexer(CheddarArrayLexer, '(', ')', ClassArgument)

export default class StatementClass extends CheddarLexer {
    exec(tokenizer) {
        this.open(false);

        return this.grammar(true,
            ['class', this.jumpWhite, CheddarVariableToken, [ClassArguments], '{',
                CheddarCustomLexer(ClassStatement, tokenizer), '}'
            ]
        );
    }
}