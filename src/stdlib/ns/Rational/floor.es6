// Rational extension written by LegionMammal978

import of from './helpers/of';

export default function(cheddar, CheddarRational) {
    return new cheddar.func(
        [
            ["val", {
                Optional: true
            }]
        ],
        function(scope, input) {
            let val;
            if (input("self") instanceof CheddarRational)
                val = input("self");
            else if (input("val").constructor.Name === "nil")
                return "Rational.rfloor expects 1 argument";
            else
                val = of(input("val"), cheddar, CheddarRational);
            return cheddar.init(cheddar.number, 10, 0, Math.floor(val.num /
                val.den));
        }
    );
}
