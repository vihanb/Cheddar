import NIL from '../consts/nil';
import CheddarFunction from '../env/func';
import CheddarError from '../consts/err';
import CheddarClass from '../env/class';
import CheddarErrorDesc from '../consts/err_msg';
import { UOP, OP } from '../../../tokenizer/consts/ops';

const UNARY_ONLY = UOP.filter(i => OP.indexOf(i) === -1);

export default function(operator, force_unary) {
    return new CheddarFunction([
        ["a", {}],
        ["b", {
            Optional: true
        }]
    ], function(scope, input) {
        let LHS = input("a");
        let RHS = input("b");

        let resp; // output / response
        let opfunc = LHS.Operator.get(operator);

        if (opfunc) {
            if (force_unary || RHS instanceof NIL || UNARY_ONLY.indexOf(operator) > -1)
                resp = opfunc(null, LHS);
            else
                resp = opfunc(LHS, RHS);
        }
        else {
            resp = CheddarError.NO_OP_BEHAVIOR;
        }

        if (resp === CheddarError.NO_OP_BEHAVIOR) {
            return CheddarErrorDesc.get(resp)
                .replace(/\$0/g, operator)
                .replace(/\$1/g, LHS ? (
                    LHS.constructor.Name || (
                        LHS.prototype instanceof CheddarClass ?
                        "Class" :
                        "nil"
                    )
                ) : "nil")
                .replace(/\$2/g, RHS ? (
                    RHS.constructor.Name || (
                        RHS.prototype instanceof CheddarClass ?
                        "Class" :
                        "nil"
                    )
                ) : "nil");
        } else {
            return resp;
        }

    });
}