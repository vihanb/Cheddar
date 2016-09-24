import CheddarLexer from '../../../tok/lex';
import CheddarCodeblock from '../../../patterns/block';
import CheddarCustomLexer from '../../../parsers/custom';

export default class ClassStateInit extends CheddarLexer {
    exec(tokenizer) {
        this.open(false);

        return this.grammar(true,
            ['init', CheddarCustomLexer(CheddarCodeblock, tokenizer)]
        );
    }
}