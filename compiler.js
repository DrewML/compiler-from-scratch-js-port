const { join } = require('path');
const { readFileSync } = require('fs');

const TOKEN_TYPES = {
    def: /\bdef\b/,
    end: /\bend\b/,
    identifier: /\b[a-zA-Z]+\b/,
    integer: /\b[0-9]+\b/,
    oparen: /\(/,
    cparen: /\)/,
    comma: /,/
};

class Tokenizer {
    /** @param {string} code */
    constructor(code) {
        this.code = code;
        /** @type string */
        this.buffer = code;
    }

    tokenizeOneToken() {
        for (let [type, re] of Object.entries(TOKEN_TYPES)) {
            re = new RegExp(`^(${re.source})[\\s\\S]*$`);
            const match = this.buffer.match(re);
            if (match) {
                const [, value] = match;
                this.buffer = this.buffer.slice(value.length);
                return new Token(type, value);
            }
        }
        throw new Error(`Couldn't match token on\n${this.buffer}`);
    }

    tokenize() {
        const tokens = [];

        while (this.buffer.length) {
            tokens.push(this.tokenizeOneToken());
            this.buffer = this.buffer.trim();
        }

        return tokens;
    }
}

class Token {
    /**
     * @param {string} type 
     * @param {string} value 
     */
    constructor(type, value) {
        this.type = type;
        this.value = value;
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
    }

    parse() {
        return this.parseDef();
    }

    parseDef() {
        this.consume('def');
        const name = this.consume('identifier').value;
        const argNames = this.parseArgNames();
        const body = this.parseExpr();
        this.consume('end');
        return DefNode({ name, argNames, body });
    }

    parseExpr() {
        if (this.peek('integer')) {
            return this.parseInteger();
        }

        if (this.peek('identifier') && this.peek('oparen', 1)) {
            return this.parseCall();
        }

        return this.parseVarRef();
    }

    parseVarRef() {
        return VarRefNode(this.consume('identifier').value);
    }

    parseCall() {
        const name = this.consume('identifier').value;
        const argExprs = this.parseArgExprs();
        return CallNode({ name, argExprs });
    }

    parseArgExprs() {
        const argExprs = [];
        this.consume('oparen');
        if (!this.peek('cparen')) {
            argExprs.push(this.parseExpr());
            while (this.peek('comma')) {
                this.consume('comma');
                argExprs.push(this.parseExpr());
            }
        }
        this.consume('cparen');
        return argExprs;
    }

    parseInteger() {
        return IntegerNode(
            Number(this.consume('integer').value)
        );
    }

    parseArgNames() {
        const argNames = [];
        this.consume('oparen');
        if (this.peek('identifier')) {
            argNames.push(this.consume('identifier').value);
            while (this.peek('comma')) {
                this.consume('comma');
                argNames.push(this.consume('identifier').value);
            }
        }
        this.consume('cparen');
        return argNames;
    }

    peek(expectedType, offset = 0) {
        return this.tokens[offset].type === expectedType;
    }

    consume(expectedType) {
        const token = this.tokens.shift();
        if (token.type === expectedType) {
            return token;
        }

        throw new Error(
            `Expected token type ${expectedType}, but got ${token.type}`
        );
    }
}

const DefNode = ({ name, argNames, body }) => ({
    type:'DefNode',
    name,
    argNames,
    body
});

const IntegerNode = value => ({
    type: 'IntegerNode',
    value
});

const CallNode = ({ name, argExprs }) => ({
    type: 'CallNode',
    name,
    argExprs
});

const VarRefNode = value => ({
    type: 'VarRefNode',
    value
});



function generate(node) {
    switch(node.type) {
        case 'DefNode':
            return `function ${node.name}(${node.argNames.join(', ')}) { return ${generate(node.body)} }`;
        case 'CallNode':
            return `${node.name}(${node.argExprs.map(generate).join(', ')})`;
        case 'VarRefNode':
            return node.value;
        case 'IntegerNode':
            return node.value;
        default:
            throw new Error(`Unexpected node type: ${node.constructor.name}`)
    }
}

const tokens = new Tokenizer(
    readFileSync(join(__dirname, 'test.src'), 'utf8')
).tokenize();
const tree = new Parser(tokens).parse();
const generated = generate(tree);
const RUNTIME = 'function add(x, y) { return x + y };';
const TEST = `console.log(f(1, 2));`;
console.log([RUNTIME, generated, TEST].join('\n'));