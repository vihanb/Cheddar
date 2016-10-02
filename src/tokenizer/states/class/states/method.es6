import CheddarLexer from '../../../tok/lex';

import StatementFunc from '../../../states/func';
import CheddarFunctionToken from '../../../parsers/function';

import CheddarVariableToken from '../../../literals/var';

export default class ClassStateMethod extends CheddarLexer {
    exec(tokenizer) {
        this.open(false);

        return this.grammar(true,
            [StatementFunc],
            ['func', CheddarVariableToken, CheddarFunctionToken]
        );
    }
}