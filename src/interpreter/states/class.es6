import CheddarClass from '../core/env/class';
import CheddarVariable from '../core/env/var';
import CheddarScope from '../core/env/scope';
import CheddarExec from '../exec';

import CheddarError from '../core/consts/err';

import CheddarFunction from '../core/env/func';

// Gets the appropriate string token from a token list
function tostr(str, n = 0) {
    return str._Tokens[n];
}

function paramErr(paramLists, attempt, className) {
    // Convert to `type, type...` style-list
    attempt = attempt.map(i => i.Name || i.constructor.Name || "Class").join(", ");
    paramLists = paramLists.map(list =>
        `${className} { ${
            list.map(i => i.type.Name || i.type.constructor.Name || "Class").join(", ")
        } }`
    ).join("\n  ");

    return `${className} has no matching constructor for \`${className} { ${attempt} }\`
Available constructors are:
  ${paramLists}`;
}


// Convert a parameter list to an obj[]
function toParamObj(paramList, scope) {
    for (let i = 0; i < paramList.length; i++) {
        // Get all the items
        let paramAccess = paramList[i]._Tokens[0];
        let paramType = paramList[i]._Tokens[1];
        let paramName = paramList[i]._Tokens[2];

        // If there is no name, it must be placed in type
        if (!paramName) {
            paramName = tostr(paramType);
            paramType = null;
        } else {
            paramName = tostr(paramName);
            paramType = tostr(paramType);

            let t;
            // Locate the class named after paramType
            if (
                scope.has(paramType) &&
                (t = scope.accessor(
                    paramType
                ).Value).prototype instanceof CheddarClass
            ) {
                paramType = t;
            } else {
                return `${paramType} is not a class`;
            }
        }

        paramList[i] = {
            access: paramAccess,
            type: paramType,
            name: paramName
        };
    }

    return paramList;
}

export default class CheddarClassHandler {
    constructor(toks, scope) {
        this.toks = toks._Tokens;
        this.scope = scope;
    }

    exec() {
        // Get class name
        let className = tostr(this.toks[0]);

        // Determine between the two
        let paramList = this.toks[1];
        let body = this.toks[2];




        /** CLASS DEFINITON **/
        let newClass = class extends CheddarClass {
            static Name = className;
        };

        newClass.prototype.Scope = new Map();

        newClass.OpBinary = new Map();
        newClass.OpUnary = new Map();




        /** PRIMARY CONSTRUCTOR HANDLING **/

        // if there is no paramList, assume it's actually the body
        if (!body) {
            body = paramList;
            paramList = null;
        } else {
            // This means there is a parameter list and it should be handled
            paramList = toParamObj(paramList._Tokens, this.scope);

            // Handle errors
            if (typeof paramList === 'string') {
                return paramList;
            }
        }




        /** CONSTRUCTOR HANDLING **/

        // Constructors
        let primaryConstructor = paramList;
        let constructors = []; // Constructor list
        if (primaryConstructor) constructors.push(primaryConstructor);

        // Body's for the class
        let constructorBody = new WeakMap();

        // The initalizer
        let defaultInitalizer;




        /** CLASS BODY HANDLING **/
        body = body._Tokens;
        for (var i = 0; i < body.length; i++) {
            let statementName = body[i].constructor.name;


            // Handle class states
            if (statementName === "ClassStateInit") {
                if (defaultInitalizer)
                    return `Duplicate primary initalizer`;
                defaultInitalizer = tostr(tostr(body[i]));
            } else if (statementName === "ClassStateMethod") {




                /** METHOD HANDLING **/

                let method = body[i];
                let isLambda; // Lambdas run through a seperate token seperation
                let methodName;

                // 1 token means that one token is a StatementFunc
                //  and should be unpacked
                if (method._Tokens.length === 1) {
                    method = tostr(method);
                    isLambda = false;
                } else {
                    isLambda = true;
                }

                methodName = tostr(tostr(method));

                let methodTokens; // Tokens to use for method

                if (isLambda) {
                    methodTokens = tostr(method, 1)._Tokens;
                } else {
                    methodTokens = method._Tokens.slice(1);
                }

                let resFunc = new CheddarFunction(this.scope, methodName, {
                    perms: newClass
                });

                resFunc.init(...methodTokens);

                newClass.prototype.Scope.set(
                    methodName,
                    new CheddarVariable(
                        resFunc,
                        {
                            Writeable: false
                        }
                    )
                );

            } else if (statementName === "ClassStateOp") {




                /** OPERATOR OVERLOADING **/
                let statementTokens = body[i]._Tokens;

                let binaryOrUnary = statementTokens[0];
                let operatorLiteral = statementTokens[1];
                let callbackArgs = statementTokens[2];
                let callbackFunc = statementTokens[3];

                if (newClass.Operator.get(operatorLiteral) === CheddarClass.Operator.get(operatorLiteral)) {
                    newClass.Operator.set(
                        operatorLiteral,
                        function(LHS, RHS) {
                            if (LHS === null) {
                                if (newClass.OpUnary.has(operatorLiteral)) {
                                    // Execute with RHS
                                    let [
                                        args, data
                                    ] = newClass.OpUnary.get(operatorLiteral);

                                    args = args._Tokens.map(i => i._Tokens[0]);

                                    let scope = new CheddarScope(LHS);
                                    scope.setter(
                                        "self",
                                        new CheddarVariable(
                                            RHS,
                                            {
                                                Writeable: false
                                            }
                                        )
                                    );

                                    if (args[0]) scope.setter(args[0], new CheddarVariable(RHS, { Writeable: false }));
                                    return new CheddarExec(tostr(data), scope, {
                                        perms: newClass
                                    }).exec();
                                }
                            } else if (newClass.OpBinary.has(operatorLiteral)) {
                                // Execute with LHS, RHS
                                let [
                                    args, data
                                ] = newClass.OpBinary.get(operatorLiteral);

                                args = args._Tokens.map(i => i._Tokens[0]);

                                let scope = new CheddarScope(LHS);
                                scope.setter(
                                    "self",
                                    new CheddarVariable(
                                        LHS,
                                        {
                                            Writeable: false
                                        }
                                    )
                                );

                                // TODO: enforce constants
                                if (args[0]) scope.setter(args[0], new CheddarVariable(LHS, { Writeable: false }));
                                if (args[1]) scope.setter(args[1], new CheddarVariable(RHS, { Writeable: false }));

                                return new CheddarExec(tostr(data), scope, {
                                    perms: newClass
                                }).exec();
                            } else {
                                return CheddarError.NO_OP_BEHAVIOR;
                            }
                        }
                    )
                }

                // Assign codeblocks
                if (binaryOrUnary === 'binary') {
                    newClass.OpBinary.set(
                        operatorLiteral,
                        [callbackArgs, callbackFunc]
                    )
                } else if (binaryOrUnary === 'unary') {
                    newClass.OpUnary.set(
                        operatorLiteral,
                        [callbackArgs, callbackFunc]
                    )
                }

            }

        }




        /** CLASS DATA **/

        // Determine validity
        if (this.scope.has(className)) {
            return `A class with name \`${className}\` is already taken`;
        }

        // Final constructor checks
        if (constructors.length === 0) constructors.push([]);


        /** CLASS INITALIZER **/
        newClass.prototype.init = function(...initArgs) {
            // TODO: Optimize
            initArgs = initArgs.filter(i => i);

            // Locate matching constructor
            let matchingConstructor;

            constructorLookup:
            for (let i = 0; i < constructors.length; i++) {
                // Avoid iterating and do basic check
                if (initArgs.length !== constructors[i].length) {
                    continue constructorLookup;
                }

                for (let j = 0; j < constructors[i].length; j++) {
                    if (
                        constructors[i][j].type &&
                        !(initArgs[j] instanceof constructors[i][j].type)
                    ) {
                        continue constructorLookup;
                    }
                }
                matchingConstructor = constructors[i];
            }

            // If no matching constructor found, error
            if (!matchingConstructor) {
                return paramErr(constructors, initArgs, className);
            }


            /** ININTALIZE PARAMETERS **/
            let res;
            for (let i = 0;  i < matchingConstructor.length; i++) {
                if (matchingConstructor[i].access) {
                    res = this.manage(
                        matchingConstructor[i].name,
                        new CheddarVariable(
                            initArgs[i], {
                                Writeable: true,
                                StrictType: matchingConstructor[i].type,
                                Access: matchingConstructor[i].access
                            }
                        )
                    );

                    if (res !== true) {
                        return res;
                    }
                }
            }

            /** CALL INITALISER **/
            if (defaultInitalizer) {
                let scope = new CheddarScope(this);

                scope.setter(
                    "self",
                    new CheddarVariable(
                        this,
                        {
                            Writeable: false
                        }
                    )
                );

                let init = new CheddarExec(defaultInitalizer, scope, {
                    perms: newClass
                }).exec();

                if (typeof init === 'string')
                    return init;
            }


            return true;
        };

        // Add the class to the scope
        this.scope.setter(
            className,
            new CheddarVariable(newClass, {
                Writeable: false
            })
        );
    }
}