import CheddarClass from '../core/env/class';
import CheddarVariable from '../core/env/var';

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
                defaultInitalizer = tostr(tostr(body[i]));
            }

        }




        /** CLASS DATA **/

        // Determine validity
        if (this.scope.has(className)) {
            return `A class with name \`${className}\` is already taken`;
        }

        // Final constructor checks
        if (constructors.length === 0) constructors.push([]);




        /** CLASS OBJECT **/
        let newClass = class extends CheddarClass {
            static Name = className;

            // Create the initalizer
            init(...initArgs) {
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



                return true;
            }
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