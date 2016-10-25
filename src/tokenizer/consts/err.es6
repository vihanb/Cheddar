/*
 * DEFAULT ERROR CODES
 * Codes:
  0. Success
  1. Unexpected token
  2. Unexpected
**/

export const EXIT_NOTFOUND = Symbol('er_EXIT_NOTFOUND');
export const UNEXPECTED_TOKEN = Symbol('er_UNEXPECTED_TOKEN');
export const UNMATCHED_DELIMITER = Symbol('er_UNMATCHED_DELIMITER');
export const EXPECTED_BLOCK = Symbol('er_EXPECTED_BLOCK');
export const ALLOW_ERROR = Symbol('er_ALLOW_ERROR');
export const KEEP_ITEM = Symbol('er_KEEP_ITEM');