import CheddarLexer from '../../tok/lex';
import * as CheddarError from '../../consts/err';
import CheddarVariableToken from '../../literals/var';

export default class ClassArguments extends CheddarLexer {
    exec(tokenizer) {
        this.open(false);

        return this.grammar(true,
            [
                ['private', 'public', 'readonly'], this.jumpWhite,
                [[ CheddarVariableToken, ':' ]],
                CheddarVariableToken, ['?']
            ]
        );
    }
}