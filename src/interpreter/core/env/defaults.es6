// Request dependencies for
//  preset casing for operator
//  handling
import CheddarError from '../consts/err';
import HelperInit from '../../../helpers/init';

export const IS_CLASS = Symbol("IS_CLASS");
export const DEFAULT_OP = new Map([

    // print: Definition
    ['print', (_, LHS) => {
        if (!LHS || !LHS.constructor.Cast)
            return CheddarError.NO_OP_BEHAVIOR;

        // Attempt to call `repr`, else, cast to string
        let VAL = LHS.constructor.Name === 'String' ? LHS
                : LHS.constructor.Cast.has('String')
                ? LHS.constructor.Cast.get('String')(LHS)
                : LHS.constructor.Operator.has('repr')
                ? LHS.constructor.Operator.get('repr')(null, LHS)
                : LHS;


        // Stream
        if (VAL.constructor.Name === 'String')
            global.CHEDDAR_OPTS.PRINT(VAL.value + "\n");
        else
            return CheddarError.NO_OP_BEHAVIOR;

        return LHS;
    }],

    ['is', (LHS, RHS) => {
        let c = require('./class');
        if (LHS === null) {
            let f = require('./func');
            var comp = (RHS.constructor || RHS).Operator.get('==');
            if (!comp) {
                return `\`${RHS.constructor.Name || RHS.Name || "object"}\` has no behavior for \`==\``;
            }
            var fn = new f([
                ["item", {}]
            ], function(scope, input) {
                return comp(RHS, input("item"));
            });

            if (RHS instanceof c) {
                fn.WHICH_CLASS = RHS.constructor;
                return fn;
            } else {
                return `\`${RHS.constructor.Name || RHS.Name || "object"}\` is not an instance of anything.`;
            }
        } else {
            if (!(RHS.prototype instanceof c)) {
                return CheddarError.NO_OP_BEHAVIOR;
            }
            let b = require('../primitives/Bool');
            return HelperInit(b, LHS instanceof RHS);
        }
    }],

    ['what', (LHS, RHS) => {
        return RHS.WHICH_CLASS || CheddarError.NO_OP_BEHAVIOR;
    }],

    ['::', (LHS, RHS) => {
        let CheddarClass = require('./class');
        let CAST_ALIAS = require('../config/alias');

        if (!(LHS.prototype instanceof CheddarClass)) {
            // ERROR INTEGRATE
            return 'Cast target must be class';
        }

        if (RHS.constructor === LHS)
            return RHS;

        let res;
        if ((res = RHS.constructor.Cast.get(LHS.Name) ||
                   RHS.constructor.Cast.get(LHS) ||
                   RHS.constructor.Cast.get(CAST_ALIAS.get(LHS)))) {
            return res(RHS);
        } else {
            return `Cannot cast to given target \`${LHS.Name || "object"}\``;
        }
    }],

    ['==', (LHS, RHS) => {
        return HelperInit(
            require("../primitives/Bool"),
            RHS && LHS instanceof RHS.constructor && LHS.value === RHS.value
        );
    }],

    ['!=', (LHS, RHS) => {
        return HelperInit(
            require("../primitives/Bool"),
            RHS && LHS instanceof RHS.constructor && LHS.value !== RHS.value
        );
    }],

    // Defaults
    ['!', (LHS, RHS) => {
        if (LHS === null && RHS && RHS.constructor.Cast && RHS.constructor.Cast.has('Bool'))
            return HelperInit(
                require("../primitives/Bool"),
                !RHS.constructor.Cast.get('Bool')(RHS).value
            );
        else
            return CheddarError.NO_OP_BEHAVIOR;
    }],

    // TODO: short-circuiting
    ['&&', (LHS, RHS) => {
        let bool = require("../primitives/Bool");
        if (LHS && RHS)
            return HelperInit(
                bool,
                HelperInit(bool, LHS).value && HelperInit(bool, RHS).value
            );
        else
            return CheddarError.NO_OP_BEHAVIOR;
    }],

    // TODO: short-circuiting
    ['||', (LHS, RHS) => {
        let bool = require("../primitives/Bool");
        if (LHS && RHS)
            return HelperInit(
                bool,
                HelperInit(bool, LHS).value || HelperInit(bool, RHS).value
            );
        else
            return CheddarError.NO_OP_BEHAVIOR;
    }],

]);

export const DEFAULT_CAST = new Map([
    ['Bool', (self) => {
        self
    }]
]);
