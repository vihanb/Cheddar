// Basic idea of the Execution Enviorments:
//
//  ExecutionEnviorment
//    |    ^
//    |- Sandboxed Enviorment
//    |    |- Crossdepedent scoping
//    |    |    ^
//    |    v    | - Inheritence Chain
//    |- Scope  v
//    |   |- Inheritence
//    |- Preset data

import * as CheddarError from '../consts/err';
import {RESERVED_KEYWORDS} from '../../../tokenizer/consts/ops';

import CheddarVariable from './var';

import { DEFAULT_OP, DEFAULT_RHS_OP, DEFAULT_CAST } from './defaults';

function enforceset(token, value, iv) {
    let self;

    if (this.has(token)) {
        self = this.accessor(token);

        if (self.Writeable === false) {
            return `Cannot override constant ${token}`;
        }

        if (self.StrictType && !(value instanceof self.StrictType)) {
            return `Attempted to set \`${token}\` to a \`${
                    value.Name ||
                    value.constructor.Name ||
                    "object"
                }\`, expected \`${
                    self.StrictType.Name ||
                    self.StrictType.constructor.Name ||
                    "object"
                }\``;
        }
    }

    return this.manage(
        token,
        iv ? value : new CheddarVariable(value, {
            Writeable: true,
            StrictType: self ? self.StrictType : null
        })
    );
}

export default class CheddarScope {
    static Name = "Namespace"

    constructor(inherit = null) {
        // Global scope
        // Make sure to move preset items
        // Avoid duplicating scopes
        //  by providing a loopup within
        //  a seperate hash which is linked
        //  by overriding a properties get
        this.inheritanceChain = inherit;

        if (!this.Scope) {
            this.Scope = new Map();
        }
    }

    // STATIC
    static Scope = new Map();
    static has(token) {
        return !RESERVED_KEYWORDS.has(token) & this.Scope.has(token)
    }
    static manage(token, value) {
        if (RESERVED_KEYWORDS.has(token)) {
            return CheddarError.KEY_IS_RESERVED
        } else {
            return this.setter(token, value), token;
        }
    }
    static setter(token, value) {
        this.Scope.set(token, value);
    }
    static accessor(token) {
        let value = this.Scope.get(token);

        if (value && value.Value) {
            value.Value.Reference = token;
            value.Value.scope     = this;
        }
        return value;
    }

    // DYNAMIC
    has(token) {
        return RESERVED_KEYWORDS.has(token) ? false : this.Scope.has(token) || (
            this.inheritanceChain && this.inheritanceChain.has(token)
        );
    }

    manage(token, value) {
        if (this.inheritanceChain && this.inheritanceChain.has(token)) {
            // It's in the inheritance chain
            // just use the parent's function
            return this.inheritanceChain.manage(token, value);

        } else {
            if (RESERVED_KEYWORDS.has(token)) {
                return CheddarError.KEY_IS_RESERVED;
            } else {
                this.setter(token, value);
                return true;
            }
        }

    }

    Cast = DEFAULT_CAST;

    // Enforces typing
    static Operator = DEFAULT_OP;
    Operator = DEFAULT_OP;

    static RHS_Operator = DEFAULT_RHS_OP;
    RHS_Operator = DEFAULT_RHS_OP;

    static enforceset = enforceset;
    enforceset = enforceset;

    // Property accessors
    accessor(token, self) {
        if (!this.has(token))
            return null;

        let value = this.Scope.get(token) || (this.inheritanceChain ?
            this.inheritanceChain.accessor(token) : null
        );

        if (value && value.Access === 'private' && self != this) {
            value = null;
        }

        if (value && value.Value) {
            value.Value.Reference = token;
            value.Value.scope     = this;
        }

        return value;
    }

    setter(path, setter) {
        //console.log(this.Scope);
        this.Scope.set(path, setter);
    }
}