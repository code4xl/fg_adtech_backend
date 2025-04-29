export class Helper {
    // Regular Expressions
    static readonly EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    static readonly MOBILE = /^[0-9]{10}$/;
    static readonly GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    static readonly PAN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    static readonly CIN = /^[L|U]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
}