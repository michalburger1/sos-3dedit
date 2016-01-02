'use strict';

onmessage = e => process(...e.data);

function process(text, position) {
  var tree = parse(text);
  if (tree !== null) {
    postMessage((new CodeGen(tree)).getCode());
  }
}

function evaluate(node) {
  if (node instanceof Language.OperatorNode) {
    switch (node.name) {
      case '+':
        return evaluate(node.operands[0]) + evaluate(node.operands[1]);
      case '-':
        return evaluate(node.operands[0]) - evaluate(node.operands[1]);
      case '*':
        return evaluate(node.operands[0]) * evaluate(node.operands[1]);
      case '/':
        return evaluate(node.operands[0]) / evaluate(node.operands[1]);
    }
  } else if (node instanceof Language.NumberNode) {
    return node.value;
  }
  throw "Invalid expression";
}

function transform(node) {
  var params = Object.assign({}, node.parameters);
  for (var key in params) {
    params[key] = evaluate(params[key]);
  }
  return {
    name: node.name,
    params: params,
    children: node.operands.map(transform),
  };
}

function parse(text) {
  var tokens = Language.scan(text);
  if (tokens instanceof Language.Error) {
    return null;
  }
  var root = Language.parse(tokens);
  if (root instanceof Language.Error) {
    return null;
  }
  return {
    name: 'union',
    params: {},
    children: root.operands.map(transform),
  };
}

function _dot(a, b) {
  return 'dot(' + a + ',' + b + ')';
}

function _max(a, b) {
  return 'max(' + a + ',' + b + ')';
}

function _f(value) {
  if (value > 1e6) {
    value = 1e6;
  }
  if (value < -1e6) {
    value = -1e6;
  }
  return 'float(' + value + ')';
}

function _min(a, b) {
  return 'min(' + a + ',' + b + ')';
}

function _vec3(x, y, z) {
  return 'vec3(' + x + ',' + y + ',' + z + ')';
}

class CodeGen {
  constructor(tree) {
    this._code = '';
    this._fid = 0;
    this._emitFunc('de', this._genExpr(tree, null, [0, 0, 1]));
    this._emitFunc('he', '1e9');
  }

  getCode() {
    return this._code;
  }

  _emitFunc(name, expr) {
    this._code += 'float ' + name + '(vec3 p){return ' + expr + ';}';
  }

  _emitHelper(expr) {
    var name = 'f' + this._fid++;
    this._emitFunc(name, expr);
    return name;
  }

  _genExpr(node, parent, attachDir) {
    switch (node.name) {
      case 'box':
      case 'cylinder':
      case 'sphere':
        parent = node;
        attachDir = [0, 0, 1];
        break;
    }
    if (node.name === 'intersection') {
      return this._genIntersection(node.children.map(child => this._genExpr(child, parent, attachDir)));
    }
    if (node.name === 'diff') {
      return this._genDifference(node.children.map(child => this._genExpr(child, parent, attachDir)));
    }
    var child = this._genUnion(node.children.map(child => this._genExpr(child, parent, attachDir)));
    switch (node.name) {
      case 'arot':
        return this._genArot(child, node.params);
      case 'box':
        return this._genBox(child, node.params);
      case 'cylinder':
        return this._genCylinder(child, node.params);
      case 'rot':
        return this._genRotation(child, node.params);
      case 'scale':
        return this._genScale(child, node.params);
      case 'sphere':
        return this._genSphere(child, node.params);
      case 'trans':
        return this._genTranslation(child, node.params);
    }
    return child;
  }

  _genArot(child, params) {
    params = Object.assign({x: 0, y: 0, z: 0}, params);
    return this._genTranslation(this._genRotation(child, params), {x:0,y:0,z:-1.5});
  }

  _genBox(child, params) {
    params = Object.assign({x: 1, y: 1, z: 1}, params);
    return _min(
      this._genTranslation(child, {x: 0, y: 0, z: params.z}),
      _max(_max('abs(p.x)-' + _f(params.x / 2), 'abs(p.y)-' + _f(params.y / 2)), _max('-p.z', 'p.z-' + _f(params.z)))
    );
  }

  _genCylinder(child, params) {
    params = Object.assign({h: 1, d: 1}, params);
    return _min(
      this._genTranslation(child, {x: 0, y: 0, z: params.h}),
      _max('length(p.xy)-' + _f(params.d / 2), _max('-p.z', 'p.z-' + _f(params.h)))
    );
  }

  _genRotation(child, params) {
    params = Object.assign({x: 0, y: 0, z: 0}, params);
    var fun = this._emitHelper(child);
    var a = -params.x * Math.PI / 180;
    var b = -params.y * Math.PI / 180;
    var c = -params.z * Math.PI / 180;
    // See: http://inside.mines.edu/fs_home/gmurray/ArbitraryAxisRotation/
    var vx = _vec3(_f(Math.cos(b) * Math.cos(c)), _f(Math.cos(c) * Math.sin(a) * Math.sin(b) - Math.cos(a) * Math.sin(c)), _f(Math.cos(a) * Math.cos(c) * Math.sin(b) + Math.sin(a) * Math.sin(c)));
    var vy = _vec3(_f(Math.cos(b) * Math.sin(c)), _f(Math.cos(a) * Math.cos(c) + Math.sin(a) * Math.sin(b) * Math.sin(c)), _f(-Math.cos(c) * Math.sin(a) + Math.cos(a) * Math.sin(b) * Math.sin(c)));
    var vz = _vec3(_f(-Math.sin(b)), _f(Math.cos(b) * Math.sin(a)), _f(Math.cos(a) * Math.cos(b)));
    return fun + '(' + _vec3(_dot('p', vx), _dot('p', vy), _dot('p', vz)) + ')';
  }

  _genScale(child, params) {
    params = Object.assign({r: 1}, params);
    var fun = this._emitHelper(child);
    return fun + '(p*' + _f(1 / params.r) + ')*' + _f(params.r);
  }

  _genSphere(child, params) {
    params = Object.assign({d: 1}, params);
    return _min(
      this._genTranslation(child, {x: 0, y: 0, z: params.d}),
      'distance(p,' + _vec3('0.0', '0.0', _f(params.d / 2)) + ')-' + _f(params.d / 2)
    );
  }

  _genTranslation(child, params) {
    params = Object.assign({x: 0, y: 0, z: 0}, params);
    var fun = this._emitHelper(child);
    return fun + '(p-' + _vec3(_f(params.x), _f(params.y), _f(params.z)) + ')';
  }

  _genIntersection(exprs) {
    var res = '-1e9';
    exprs.forEach(expr => {
      res = _max(res, expr);
    });
    return res;
  }

  _genDifference(exprs) {
    if (exprs.length < 1) {
      return '1e9';
    }
    var res = exprs[0];
    for (var i = 1; i < exprs.length; i++) {
      res = _max(res, '-(' + exprs[i] + ')');
    }
    return res;
  }

  _genUnion(exprs) {
    var res = '1e9';
    exprs.forEach(expr => {
      res = _min(res, expr);
    });
    return res;
  }
}

// box(x=1, y=1, z=1)
// sphere(d=1)
// cylinder(h=1, d=1)
// union
// intersection
// difference
// inverse
// arot(x=0, y=0, z=0)
// rot(x=0, y=0, z=0)
// trans(x=0, y=0, z=0)
// scale(r=1)




var Language = {};

(function ()
{
  var EOF = '\0';
  var INFINITY = 1 / 0;

  function Interval(min, max)
  {
    this.min = min;
    this.max = max;
    this.contains = function (position)
    {
      return this.min <= position && position <= this.max;
    }
    this.union = function (other)
    {
      return new Interval(Math.min(this.min, other.min), Math.max(this.max, other.max));
    }
  }
  
  function Token(kind, value, interval) 
  {
    this.kind = kind;
    this.value = value;
    this.interval = interval;
  }
  
  function LanguageError(message, interval)
  {
    this.message = message;
    this.interval = interval;
  }
  
  function scan(source)
  {
    source = source + EOF;
    
    function isLowercaseLetter(c) { return 'a' <= c && c <= 'z'; }
    function isUppercaseLetter(c) { return 'A' <= c && c <= 'Z'; }
    function isLetter(c) { return isLowercaseLetter(c) || isUppercaseLetter(c); }
    function isDigit(c) { return '0' <= c && c <= '9'; }
    function isWhitespace(c) { return c == ' ' || c == '\n' || c == '\t'; }
    function isSpecialSymbol(c) { return '+-*/,(){}='.indexOf(c) > -1; }
  
  
    var tokens = [];
    var i = 0;
    var peek = ' ';
    
    function readPeek()
    {
      peek = source[i];
      ++i;
    }
    
    function nextToken()
    {
      function makeCurrentInterval() { return new Interval(tokenStartIndex, i-2); }
      function makeToken(kind, value) { return new Token(kind, value, makeCurrentInterval()); }
      function makeError(message) { return new LanguageError(message, makeCurrentInterval()); }
      
      while (isWhitespace(peek))
      {
        readPeek();
      }
      
      var tokenStartIndex = i-1;

      if (peek == EOF)
      {
        readPeek();
        return makeToken('EOF');
      }
      
      if (isDigit(peek))
      {
        var value = peek;
        readPeek();
        while (isDigit(peek))
        {
          value = value + peek;
          readPeek();
        }
        
        if (peek == '.')
        {
          value = value + '.';
          readPeek();
          if (!isDigit(peek))
            return makeError('Expecting more digits after .');
          
          while (isDigit(peek))
          {
            value = value + peek;
            readPeek();
          }
        }
        
        return makeToken('NUMBER', value);
      }
      
      if (isSpecialSymbol(peek))
      {
        var p = peek;
        readPeek();
        return makeToken(p);
      }
  
      if (isLetter(peek))
      {
        var value = peek;
        readPeek();
        while (isLetter(peek))
        {
          value = value + peek;
          readPeek();
        }
        return makeToken('IDENTIFIER', value);
      }
      
      return makeError('Unknown character "' + peek + '"');
    }
    
    while (true)
    {
      var token = nextToken();
      if (token instanceof LanguageError)
        return token;
      
      tokens.push(token)
      if (token.kind == 'EOF')
        break;
    }
    
    return tokens;
  }
  
  function unitedIntervalsOfNodes(nodes)
  {
    var result = new Interval(INFINITY, -INFINITY);
    for (var i=0; i<nodes.length; ++i)
      result = result.union(nodes[i].interval);
    
    return result;
  }
  
  
  function positionFinder(position)
  {
    if (!this.interval.contains(position))
      return null;
    if (this.operands != undefined)
      for (var i=0; i<this.operands.length; ++i)
      {
        var subNode = this.operands[i].functionNodeForPosition(position);
        if (subNode != null)
          return subNode;
      }
    return this;
  }
  
  function NumberNode(tokens)
  {
    this.name = 'NUMBER';
    this.value = parseFloat(tokens.map(token => token.kind == 'NUMBER' ? token.value : token.kind).join(''));
    this.interval = unitedIntervalsOfNodes(tokens);
    this.prettyPrinted = function (indent)
    {
      return '' + this.value;
    }
  }
  
  function FunctionNode(token, parameters, operands)
  {
    var nodesWithIntervalsToUnite = operands.slice();
    for (var key in parameters)
      nodesWithIntervalsToUnite.push(parameters[key]);
    
    this.name = token.value;
    this.interval = token.interval.union(unitedIntervalsOfNodes(nodesWithIntervalsToUnite));
    this.parameters = parameters;
    this.operands = operands;
    this.prettyPrinted = function (indent)
    {
      if (indent == undefined)
        indent = '';
      
      var result = '<br/>' + indent + this.name + '(';
      var prettyParameters = [];
      for (key in this.parameters)
      {
        prettyParameters.push(key + ': ' + this.parameters[key].prettyPrinted(''));
      }
      
      result = result + prettyParameters.join(', ') + ')<br/>' + indent + '{';
      
      for (var i=0; i<this.operands.length; ++i)
      {
        result = result + this.operands[i].prettyPrinted(indent + '   ');
      }
      
      result = result + indent + '<br/>' + indent + '}';
      return result;
    };
    this.functionNodeForPosition = positionFinder;
  }
  
  function OperatorNode(token, operands)
  {
    this.name = token.kind;
    this.interval = token.interval.union(unitedIntervalsOfNodes(operands));
    
    this.operands = operands;
    this.prettyPrinted = function (indent)
    {
      return this.operands.map(function(x) {return x.prettyPrinted(indent); }).join(this.name);
    };
  }
  
  function RootNode(functionNodes)
  {
    this.name = 'ROOT';
    this.interval = unitedIntervalsOfNodes(functionNodes);
    this.operands = functionNodes;
    this.prettyPrinted = function (indent)
    {
      return this.operands.map(function(x) {return x.prettyPrinted(indent); }).join('<br/>');
    }
    this.functionNodeForPosition = positionFinder;
  }
  
  function parse(tokens)
  {
    var i = 0;
    var token = new Token('EOF');
  
    function makeError(message)
    {
      return new LanguageError(message, token.interval);
    }
    
    function readToken()
    {
      if (i >= tokens.length)
        token = Token('EOF');
      else
        token = tokens[i];
      ++i;
    }
    
    function parseNumber()
    {
      var tokens = [];

      if (token.kind == '-' || token.kind == '+')
      {
        tokens.push(token);
        readToken();
      }

      if (token.kind != 'NUMBER')
        return makeError('Unexpected token: ' + token.kind)
        
      tokens.push(token);
      readToken();

      var number = new NumberNode(tokens);
      return number;
    }
    
    function parseParentheses()
    {
      readToken();
      var innerExpression = parseExpression();
      if (innerExpression instanceof LanguageError)
        return innerExpression;
      
      if (token.kind != ')')
        return makeError('Expecting closing )');
      readToken();
      return innerExpression;
    }
    
    function parseFunction()
    {
      var functionToken = token;
      if (token.kind != 'IDENTIFIER')
        return makeError('Expecting function name, got ' + token.kind + ' instead.');
  
      readToken();
      if (token.kind == '(')
      {
        readToken();
      
        var parameters = {};
        
        while (token.kind != ')')
        {
          if (token.kind != 'IDENTIFIER')
            return makeError('Expecting parameter name, got ' + token.kind + ' instead.');
          
          
          var parameterName = token.value;
          
          readToken();
          
          if (token.kind != '=')
            return makeError('Expecting = after parameter name, got ' + token.kind + ' instead.');
            
          readToken();
          
          var innerExpressionNode = parseExpression();
          if (innerExpressionNode instanceof LanguageError)
            return innerExpressionNode;
          
          
          parameters[parameterName] = innerExpressionNode;
          
          
          
          if (token.kind != ')' && token.kind != ',')
            return makeError('Expecting closing ) or , argument separator');
          
          if (token.kind == ',')
            readToken();
        }
        
        readToken();
      }
      
      var operands = [];
      if (token.kind == '{')
      {
        readToken();
        while (token.kind != '}')
        {
          var operandNode = parseExpression();
          if (operandNode instanceof LanguageError)
            return operandNode;
          
          if (!(operandNode instanceof FunctionNode))
          {
            return new LanguageError('All operands of geometry functions should be geometry functions, this one is ' + operandNode.name, operandNode.interval);
          }
          
          operands.push(operandNode);
          
          if (token.kind == 'EOF')
            return makeError('Expecting closing }');
        }
        readToken();
      }
      
      return new FunctionNode(functionToken, parameters, operands);
    }

    function parseFactor()
    {
      if (token.kind == 'NUMBER' || token.kind == '-' || token.kind == '+')
        return parseNumber();
        
      if (token.kind == '(')
        return parseParentheses();
      
      if (token.kind == 'IDENTIFIER')
        return parseFunction();
      
      return makeError('Unexpected token: ' + token.kind)
    }
    
    function parseTerm()
    {
      var node = parseFactor();
      if (node instanceof LanguageError)
        return node;
        
      while (token.kind == '*' || token.kind == '/')
      {
        var op = token;
        readToken();
        var node2 = parseFactor();
        if (node2 instanceof LanguageError)
          return node2;
          
        node = new OperatorNode(op, [node, node2]);
      }
      return node;
    }
    
    function parseExpression()
    {
      var node = parseTerm();
      if (node instanceof LanguageError)
        return node;
        
      while (token.kind == '+' || token.kind == '-')
      {
        var op = token;
        readToken();
        var node2 = parseTerm();
        if (node2 instanceof LanguageError)
          return node2;
        
        node = new OperatorNode(op, [node, node2]);
      }
      return node;
    }
    
    function parseFunctions()
    {
      var result = [];
      
      do
      {
        var functionNode = parseFunction();
        if (functionNode instanceof LanguageError)
          return functionNode;
          
        result.push(functionNode);
      } while (token.kind != 'EOF');
      
      return new RootNode(result);
    }
  
    readToken();
    return parseFunctions();
  }
  
  
  
  Language.scan = scan;
  Language.parse = parse;
  Language.Error = LanguageError;
  Language.FunctionNode = FunctionNode;
  Language.NumberNode = NumberNode;
  Language.OperatorNode = OperatorNode;
  Language.RootNode = RootNode;
})();