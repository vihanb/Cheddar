import CheddarVariable from './var';
import CheddarScope from './scope';
import CheddarClass from './class';
import Signal from '../../signal';
import NIL from '../consts/nil';

import HelperInit from '../../../helpers/init';

import CheddarError from '../consts/err';

export default class CheddarFunction extends CheddarClass {
    static Name = "Function";

    constructor(args, body, data) {
        super(null);

        // List of arguments the
        //  function is expecting
        // Tokens handled by init
        // #generateScope handles
        //  the enforcement
        this.args = args;

        // Function body, either a
        //  native function or a
        //  exec/eval pattern body
        this.body = body;

        // General data object
        //  includes permissons
        this.data = data;

        // Does the function have a self-alias?
        this.selfRef = null;
    }

    // Initalizes from primitive arguments
    init(args, selfRef, body) {
        if (!body) {
            body = selfRef;
            selfRef = null;
        } else {
            selfRef = selfRef._Tokens[0];
        }


        // Move the scope argument to correct prop
        this.inherited = this.args;
        this.Reference = this.body;

        if (args === "") {
            args = [];
        } else {

            if (args.constructor.name !== "CheddarArrayToken") {
                args = { _Tokens: [ args ] };
            }

            let argument, res = Array(args._Tokens.length);
            for (var i = 0; i < args._Tokens.length; i++) {
                argument = args._Tokens[i];

                // Argument is a arg object
                let props = {};
                let name;

                // Store the argument tokens
                let arg = argument._Tokens;
                let nameargs = arg[0]._Tokens;

                props.Optional = arg[1] === '?';
                props.Default = arg[2] ||
                    arg[1] &&
                    arg[1].constructor.name === "StatementExpression" &&
                    arg[1];

                props.Type = nameargs.length > 1 && nameargs[1];

                if (props.Type) {
                    let type = this.inherited.accessor(props.Type._Tokens[0]);
                    if (!type) {
                        return `${props.Type._Tokens[0]} is not defined`;
                    }

                    type = type.Value;

                    if (!(type.prototype instanceof CheddarClass)) {
                        return `${props.Type._Tokens[0]} is not a class`;
                    }

                    props.Type = type;
                }

                name = nameargs[0]._Tokens[0];

                res[i] = [name, props];
            }

            args = res;
        }


        this.args = args;
        this.body = body;
        this.selfRef = selfRef;

        return true;
    }

    exec(input, self) {
        let scope = this.generateScope(input, self);

        if (!(scope instanceof CheddarScope))
            return scope;

        let tmp;
        if (typeof this.body === 'function') {
            return this.body(
                scope,
                name => (tmp = scope.accessor(name)) && tmp.Value,
                input
            );
        } else {
            let executor = require(
                this.body.constructor.name === "StatementExpression" ?
                '../eval/eval' :
                '../../exec'
            );

            let res = new executor(
                this.body.constructor.name === "StatementExpression" ?
                this.body :
                this.body._Tokens[0],
                scope,
                this.data
            ).exec();

            if (res instanceof Signal) {
                if (res.is(Signal.RETURN)) {
                    res = res.data;
                }
            }

            return res;
        }
    }

    generateScope(input, self) {
        let args = new CheddarScope(this.inherited || null);

        let CheddarArray = require('../primitives/Array');
        let tmp;

        if (self) {
            args.setter("self", new CheddarVariable(self, {
                Writeable: false
            }));
        }

        if (this.selfRef) {
            args.setter(this.selfRef, new CheddarVariable(this, {}))
        }

        for (let i = 0; i < this.args.length; i++) {
            tmp = this.args[i][1];

            // Pass if undefined
            if (!tmp) continue;

            if (tmp.Splat === true) {
                let splat = new CheddarArray();
                splat.init(...input.slice(i));

                args.setter(this.args[i][0], new CheddarVariable(
                    splat
                ));

                break;
            }
            else if (input[i]) {
                if (tmp.Type) {
                    if (Array.isArray(tmp.Type)) {
                        if (!tmp.Type.some(
                            t => input[i] instanceof t
                        )) {
                            return `${this.Reference || "function"} expected arg @${i} to be any of: ${
                                tmp.Type.map(t =>
                                    tmp.Type.Name ||
                                    tmp.Type.constructor.Name ||
                                    "object"
                                ).join(", ")
                            }, recieved ${
                                input[i].Name ||
                                input[i].constructor.Name ||
                                "object"
                            }`;
                        }
                    } else if (!(input[i] instanceof tmp.Type)) {
                        return `${this.Reference || "function"} expected arg @${i} to be ${
                            tmp.Type.Name ||
                            tmp.Type.constructor.Name ||
                            "object"
                        }, recieved ${
                            input[i].Name ||
                            input[i].constructor.Name ||
                            "object"
                        }`;
                    }
                }
                args.setter(this.args[i][0], new CheddarVariable(
                    input[i]
                ));
            }
            else {
                if (tmp.Optional === true) {
                    args.setter(this.args[i][0], new CheddarVariable(
                        new NIL
                    ));
                }
                else if (tmp.Default) {
                    // If it's an expression
                    if (tmp.Default.constructor.name === "StatementExpression") {
                        let res = new (require('../eval/eval'))(
                            tmp.Default,
                            args
                        ).exec();

                        if (typeof res === 'string') {
                            return res;
                        }

                        tmp.Default = res;
                    }

                    args.setter(this.args[i][0], new CheddarVariable(
                        tmp.Default
                    ));
                }
                else {
                    return `Missing argument for ${this.args[i][0]}`
                }
            }
        }

        return args;
    }

    Operator = new Map([...CheddarClass.Operator,
        ['&', (self, value) => {
            // Copy args to new function
            let new_args = self.args.slice(1);
            return new self.constructor(new_args, (a,b, args) => self.exec([...args, value], null));
        }],
        ['~', (l, self) => {
            if (l !== null) {
                return CheddarError.NO_OP_BEHAVIOR
            }

            return new (self.constructor)(
                [["a", {}]],
                function(s, k){
                    return self.exec(Array(self.args.length).fill(k("a")), null);
                }
            )
        }],
        ['+', (LHS, RHS) => {
            if (RHS instanceof LHS.constructor) {
                return new LHS.constructor([], function(a,b, rargs) {
                    return LHS.exec([RHS.exec(rargs, null)], null);
                });
            } else {
                return CheddarError.NO_OP_BEHAVIOR;
            }
        }]
    ]);

    RHS_Operator = new Map([...CheddarClass.RHS_Operator,
        ['&', (self, value) => {
            // Copy args to new function
            let new_args = self.args.slice(1);
            return new self.constructor(new_args, (a,b, args) => self.exec([value, ...args], null));
        }],

        ['/', (LHS, RHS) => {
            let res;

            try {
                return RHS.value.reduce(function(item1, item2) {
                    res = LHS.exec([ item1, item2 ], null);

                    if (typeof res === 'string')
                        throw res;

                    return res;
                });
            } catch (e) {
                return e;
            }
        }],

        ['=>', (LHS, RHS) => {
            let CheddarArray = require("../primitives/Array");

            if (RHS.constructor.Name !== "Array")
                return CheddarError.NO_OP_BEHAVIOR;

            RHS = RHS.value;
            let res;
            let out = HelperInit(CheddarArray);

            for (var i = 0; i < RHS.length; i++) {
                res = LHS.exec([ RHS[i] ]);

                if (typeof res === 'string') {
                    return res;
                } else {
                    out.value.push(res || new NIL);
                }
            }

            return out;
        }]
    ])

    Scope = new Map([
        ['len', new CheddarVariable(null, {
            Writeable: false,
            getter: (self) => new CheddarFunction([], (_, input) => {
                let CheddarNumber = require('../primitives/Number');
                return HelperInit(CheddarNumber, 10, 0, input("self").args.length);
            })
        })]
    ])
}
