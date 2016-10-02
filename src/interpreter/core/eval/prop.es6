import CheddarParenthesizedExpressionToken from '../../../tokenizer/parsers/paren_expr';
import CheddarVariableToken from '../../../tokenizer/literals/var';
import CheddarLiteral from '../../../tokenizer/literals/literal';
import CheddarClass from '../env/class';

import {PRIMITIVE_LINKS, EVALUATED_LINKS} from '../config/link';

import CheddarFunction from '../env/func';

import CheddarError from '../consts/err';
import CheddarErrorDesc from '../consts/err_msg';

function to_value(variable, parent, name) {
    // Check if getter
    if (variable.Value) {
        return variable.Value;
    } else if (variable.getter) {
        let res = variable.getter.exec([], parent);
        res.Reference = name;
        res.scope = parent;
        return res;
    } else {
        // ERROR INTEGRATE
        return `Attempted to accesses variable without value`;
    }
}

const EVALUATED_ACCESSOR_NAME = 'eval_accessor';

// Evaluates a property
export default function eval_prop(prop, scope, evaluate, data = {}) {
    // If it's a property
    let Operation = prop;

    let CheddarEval = evaluate;

    let OPERATOR;
    let NAME;
    let DATA;
    let TOKEN;
    let REFERENCE;
    let TARGET;
    let EVALUATED;


    // Is a primitive
    // this includes `"foo".bar`
    if ((Operation._Tokens[0] instanceof CheddarLiteral) ||
        (Operation instanceof CheddarLiteral)) {

        if (Operation instanceof CheddarLiteral) {
            TOKEN = Operation;
        } else {
            // Get the token's value
            TOKEN = Operation._Tokens[0]._Tokens[0];
        }

        // Get the class associated with the token
        if ((OPERATOR = PRIMITIVE_LINKS.get(TOKEN.constructor.name))) {
            // Set the name to be used in errors
            NAME = OPERATOR.Name || "object";

            OPERATOR = new OPERATOR(scope);

            if ((TOKEN = OPERATOR.init(...TOKEN.Tokens)) !== true) {
                return TOKEN;
            }

            // Exit if it's a raw literal
            if (Operation instanceof CheddarLiteral) {
                return OPERATOR;
            }
        } else if ((OPERATOR = EVALUATED_LINKS.get(TOKEN.constructor.name))) {
            OPERATOR = OPERATOR(...TOKEN.Tokens);
        } else {
            return CheddarError.UNLINKED_CLASS;
        }
    } else if (Operation._Tokens[0] instanceof CheddarParenthesizedExpressionToken) {
        // Evaluate
        OPERATOR = new CheddarEval(
            Operation._Tokens[0],
            scope,
            data
        );

        OPERATOR = OPERATOR.exec();

        if (typeof OPERATOR === "string") {
            return OPERATOR;
        }

        NAME = OPERATOR.constructor.Name ||
            OPERATOR.Name ||
            "object";

    }
    else if (Operation._Tokens[0] instanceof CheddarVariableToken) {
        // Lookup variable -> initial variable name
        OPERATOR = scope.accessor(Operation._Tokens[0]._Tokens[0], data.perms);

        // Set the name to be used in errors, extracted from token
        NAME = Operation._Tokens[0]._Tokens[0];
        if (!OPERATOR || OPERATOR === CheddarError.KEY_NOT_FOUND) {
            return CheddarErrorDesc.get(CheddarError.KEY_NOT_FOUND)
                .replace('$0', NAME);
        }

        OPERATOR = to_value(OPERATOR);
        if (typeof OPERATOR === "string")
            return OPERATOR;
    }
    else {
        return CheddarError.MALFORMED_TOKEN;
    }

    // Advance variable tree
    for (let i = 1; i < Operation._Tokens.length; i++) {
        // if it is a function call, call the function
        // we know this if the marker is a (
        if (Operation._Tokens[i] === "(") {
            ++i; // Go to the actual function token

            if (!(OPERATOR instanceof CheddarFunction)) {
                // ERROR INTEGRATE
                return `\`${NAME}\` is not a function`;
            }

            DATA = [];

            // Get the array of args from the token
            TOKEN = Operation._Tokens[i]._Tokens;
            let evalres; // Evaluation result
            for (let i = 0; i < TOKEN.length; i++) {
                evalres = new CheddarEval({
                        _Tokens: [TOKEN[i]]
                    },
                    scope,
                    data
                );
                evalres = evalres.exec();
                if (typeof evalres === "string") {
                    return evalres;
                }
                else {
                    DATA.push(evalres);
                }
            }

            OPERATOR = OPERATOR.exec(
                DATA,
                REFERENCE
            );

            if (typeof OPERATOR === 'string') {
                return OPERATOR;
            }
        }
        // if it is a class call, initalize it
        // we know this if the marker is a {
        else if (Operation._Tokens[i] === "{") {
            // Go to the token...
            ++i;

            // Make sure it's a class
            if (!(OPERATOR.prototype instanceof CheddarClass)) {
                // ERROR INTEGRATE
                return `${NAME} is not a class`;
            }

            // Create the JS version of it
            let bg = new OPERATOR(
                scope // Pass current scope
            );

            // Evaluate each argument
            DATA = []; // Stores the results

            // Get the array of args from the token
            TOKEN = Operation._Tokens[i]._Tokens;
            let evalres; // Evaluation result
            for (let i = 0; i < TOKEN.length; i++) {
                evalres = new CheddarEval({
                        _Tokens: [TOKEN[i]]
                    },
                    scope,
                    data
                );
                evalres = evalres.exec();
                if (typeof evalres === "string") {
                    return evalres;
                }
                else {
                    DATA.push(evalres);
                }
            }

            // Construct the item
            OPERATOR = bg.init(...DATA);

            // If it's sucessful, set it to the calss
            if (OPERATOR === true)
                OPERATOR = bg;

        }
        else {
            if (Operation._Tokens[i] === "[]") {
                // it is [ ... ]
                ++i; // Go to expression

                // Execute the expression
                let res = new CheddarEval({
                        _Tokens: [Operation._Tokens[i]]
                    },
                    scope,
                    data
                ).exec();

                // If response is a string, it's errored
                if (typeof res === "string") {
                    return res;
                }

                // It was an evaluated accessor
                EVALUATED = true;

                TARGET = res;
            }
            else {
                TARGET = Operation._Tokens[i]._Tokens[0];
            }

            // Else it is a property

            // Determine the accessor type
            if (EVALUATED) {
                EVALUATED = 'eval_accessor';
            } else {
                EVALUATED = 'accessor';
            }

            // Attempt to access the accessor
            if (!OPERATOR[EVALUATED]) {
                return `${ NAME } cannot be${
                    EVALUATED === EVALUATED_ACCESSOR_NAME ? ' dynamically' : ''
                } accessed.`;
            }

            // then use the accessor to get the token
            if (!(DATA = OPERATOR[EVALUATED](TARGET, data.perms))) {
                if (EVALUATED !== EVALUATED_ACCESSOR_NAME) {
                    // ERROR INTEGRATE
                    return `${
                                NAME
                            } has no property ${
                                TARGET
                            }`;
                }
            }

            // Handle errors
            if (typeof DATA === 'string') {
                return DATA;
            }

            // Reset the evaluated property
            EVALUATED = false;

            // Set the previous item to the REFERENCE
            REFERENCE = OPERATOR;

            OPERATOR = to_value(DATA, REFERENCE, TARGET);

            // Set the pending name to the target
            NAME = TARGET;


            if (typeof OPERATOR === "string")
                return OPERATOR;
        }
    }

    return OPERATOR;
}