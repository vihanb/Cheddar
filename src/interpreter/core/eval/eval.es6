// == Evaluates Expressions ==
// Perhaps add config item to specify optimizations
// This first version will be a preliminary test
//  and won't have very many features
// Class operators and tokens  will be abstracted so
//  changed to `class` won't be deterimental to the
//  existing code.
// This will also allow classes to be forged for testing

// == Info ==
// config:link contains class linktage to
//  primitives, which functions as a basic
//  abstraction layer between the expression
//  parser and the tokenizer.
//   The CheddarClass itself provides   a
//   more thougrough abstraction between
//   the tokenizer and the rest of the code
//   itself

// Primitive <-> Class Links
import {PRIMITIVE_LINKS} from '../config/link';
import {TYPE as OP_TYPE, EXCLUDE_META_ASSIGNMENT as REG_OPS} from '../../../tokenizer/consts/ops';

// Reference tokens
import CheddarPropertyToken from '../../../tokenizer/parsers/property';
import CheddarLiteral from '../../../tokenizer/literals/literal';
import CheddarOperatorToken from '../../../tokenizer/literals/op';
import CheddarExpressionToken from '../../../tokenizer/parsers/expr';

import CheddarScope from '../env/scope';

import CheddarVariable from '../env/var';
import CheddarClass from '../env/class';
import NIL from '../consts/nil';

// Call stack wrapper
import CheddarCallStack from './callstack';

// Standard Error class
import CheddarError from '../consts/err';
import CheddarErrorDesc from '../consts/err_msg';

import eval_prop from './prop';

function set_value(value, child) {
    // The CheddarVariable() wrapping the value
    let variable = value.scope.accessor(value.Reference);

    // If the result is being set to a variable
    if (child instanceof CheddarVariable) {
        child = child.Value; // extract it's literal value
    }

    // If there's a setter
    if (variable.setter !== null) {
        // Run the setter.
        // Pass the target value (child) as an arg
        // Run in context of value (`self`)
        child = variable.setter.exec([child], value);
    }

    // Set the correct reference on the scope
    child.scope = value.scope;
    child.Reference = value.Reference;

    // Get the scope the LHS is in.
    let rep = value.scope.enforceset(
        // Change the var name
        value.Reference,
        // to the resulting value
        child
    );

    return rep;
}

export default class CheddarEval extends CheddarCallStack {
    // To iterativaley evaluate the expression
    //  individual repeated steps would be taken
    //  which would also allow the debugger to
    //  function on the same foundation
    step() {
        const Operation = this.next();

        let OPERATOR,
            TOKEN,
            DATA,
            NAME,
            TARGET,
            REFERENCE = null;



        // Helper functions
        function run_op(LHS, RHS) {
            if (NAME.has(TARGET)) {
                OPERATOR = NAME.get(TARGET)(LHS, RHS);
            } else {
                OPERATOR = CheddarError.NO_OP_BEHAVIOR;
            }
        }


        // Expression source

        // Handle Operator
        if (Operation instanceof CheddarOperatorToken) {

            let SETSELF = false; // If the operator is a self-asignning operator

            TOKEN = this.shift(); // Get the value to operate upon

            // SPECIAL BEHAVIOR FOR REsASSIGNMENT
            if (Operation.tok(0) === "=") {
                DATA = this.shift();

                if ((
                    !(DATA.scope instanceof CheddarScope) ||
                    DATA.Reference === null
                ) || Operation.tok(1) === OP_TYPE.UNARY) {
                    return CheddarErrorDesc.get(CheddarError.NOT_A_REFERENCE);
                }

                // Call `set_value` function
                DATA = set_value(DATA, TOKEN);

                // If it errored
                if (DATA !== true) {
                    return DATA;
                }

                OPERATOR = TOKEN;

            } else if (Operation.Tokens[1] === OP_TYPE.UNARY) {
                NAME = TOKEN.Operator;
                // It is an Unary operator use TOKEN as RHS, null as LHS
                if (NAME.has(Operation.Tokens[0])) {
                    OPERATOR = NAME.get(Operation.Tokens[0])(null, TOKEN);
                } else {
                    OPERATOR = CheddarError.NO_OP_BEHAVIOR;
                }
            } else {
                // Binary operator. DATA is LHS, TOKEN is RHS
                DATA = this.shift(); // Get the other arg

                NAME = DATA.Operator; // Get the list of operators DATA has

                TARGET = Operation.Tokens[0]; // The operator

                // Set LHS to LHS * RHS

                // if it ends with `=`, given `a *= b` do `a = a * b`
                // given if the above is true, set the `SETSELF` to true
                if (TARGET.endsWith('=') && !REG_OPS.has(TARGET)) {
                    SETSELF = true;
                    TARGET = TARGET.slice(0,-1);
                }

                run_op(DATA, TOKEN); // Run the operator

                if (OPERATOR === CheddarError.NO_OP_BEHAVIOR) {
                    NAME = TOKEN.RHS_Operator;
                    run_op(TOKEN, DATA); // Run the operator again
                }
            }

            if (OPERATOR === CheddarError.NO_OP_BEHAVIOR) {
                return CheddarErrorDesc.get(OPERATOR)
                .replace(/\$0/g, Operation.Tokens[0])
                .replace(/\$1/g, TOKEN ? (
                    TOKEN.constructor.Name || (
                        TOKEN.prototype instanceof CheddarClass
                        ? "Class"
                        : "nil"
                    )
                ) : "nil")
                .replace(/\$2/g, DATA ? (
                    DATA.constructor.Name || (
                        DATA.prototype instanceof CheddarClass
                        ? "Class"
                        : "nil"
                    )
                ) : "nil");
            } else if (typeof OPERATOR === 'string') {
                return OPERATOR;
            } else {
                // Perform re-assignment
                if (SETSELF) {
                    // DATA, TOKEN
                    if ((
                        !(DATA.scope instanceof CheddarScope) ||
                        DATA.Reference === null
                    ) || Operation.tok(1) === OP_TYPE.UNARY) {
                        return CheddarErrorDesc.get(CheddarError.NOT_A_REFERENCE);
                    }

                    // Call `set_value` function
                    DATA = set_value(DATA, OPERATOR);

                    // If it errored
                    if (DATA !== true) {
                        return DATA;
                    }
                }

                this.put(OPERATOR);
            }

        } else if (Operation instanceof CheddarPropertyToken || Operation instanceof CheddarLiteral) {
            let res = eval_prop(Operation, this.Scope, this.constructor, this.data);
            if (typeof res === 'string' || typeof res === 'boolean' || typeof res === 'symbol')
                return res;

            this.put( res );
        } else if (Operation.constructor.name === "CheddarExpressionTernary") {
            let condition = new CheddarExpressionToken();
            condition._Tokens = Operation._Tokens[0];
            let if_true = Operation._Tokens[1];
            let if_false = Operation._Tokens[2];

            condition = new CheddarEval(
                { _Tokens: [condition] },
                this.Scope
            ).exec();

            if (typeof condition === 'string')
                return condition;

            let condition_result = new (
                PRIMITIVE_LINKS.get("CheddarBooleanToken")
            )(this.Scope);

            let to_run = condition_result.init(condition) && condition_result.value === true ?
                if_true :
                if_false;

            to_run = new CheddarEval(
                { _Tokens: [ to_run ] },
                this.Scope
            ).exec();

            if (typeof to_run === 'string')
                return to_run;

            this.put(to_run);
        } else {
            return "An unhandled token was encountered";
        }

        return true;
    }

    // Evaluate entire call stack
    //  this stepts until the call
    //  stack or `InStack` is empty
    exec() {
        let step;
        while (!!this.InStack[this._csi])
            if ((step = this.step()) !== true)
                return step;

        return this.close();
    }
}
