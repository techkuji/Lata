import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export type ParseMode = 'pruned' | 'intelligent' | 'full';

// Interfaces to store parsed data
interface ParsedImport { text: string; moduleSpecifier: string; resolvedContext?: ParsedStructure; namedImports?: Set<string>; }
interface ParsedStructure {
  imports: ParsedImport[];
  variables: string[];
  functions: string[];
  classes: string[];
  moduleName: string;
}

// Caching
const parseCache = new Map<string, ParsedStructure>();

export function parseTsJsFile(filePath: string, fileContent: string, mode: ParseMode): string {
  parseCache.clear();
  const structure = _parseFileInternal(filePath, fileContent, mode, true);
  if (!structure) {
    return `// Could not parse file: ${path.basename(filePath)}`;
  }
  return _formatContextAsText(structure);
}

// Recursive parser with caching
function _parseFileInternal(filePath: string, fileContent: string, mode: ParseMode, isTopLevelFile: boolean, symbolsToFind?: Set<string>): ParsedStructure | undefined {
  const absPath = path.resolve(filePath);
  if (parseCache.has(absPath)) {
      const cached = parseCache.get(absPath)!;
      return isTopLevelFile ? cached : _pruneContext(cached, mode, symbolsToFind);
  }

  const sourceFile = ts.createSourceFile(absPath, fileContent, ts.ScriptTarget.Latest, true);
  const definitions: ParsedStructure = {
    imports: [], variables: [], functions: [], classes: [], moduleName: path.basename(absPath)
  };

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).slice(1, -1);
      const importDef: ParsedImport = { text: node.getText(sourceFile), moduleSpecifier };
      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          importDef.namedImports = new Set(node.importClause.namedBindings.elements.map(e => e.name.getText(sourceFile)));
      }
      if (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../')) {
        const resolvedPath = _resolveModulePath(path.dirname(absPath), moduleSpecifier);
        if (resolvedPath) {
            const symbolsForNextCall = mode === 'pruned' ? importDef.namedImports : undefined;
            const importedContent = fs.readFileSync(resolvedPath, 'utf8');
            importDef.resolvedContext = _parseFileInternal(resolvedPath, importedContent, mode, false, symbolsForNextCall);
        }
      }
      definitions.imports.push(importDef);
    } 
    else if (ts.isVariableStatement(node) && node.parent === sourceFile) {
        definitions.variables.push(node.getText(sourceFile));
    } 
    else if (ts.isFunctionDeclaration(node) && node.name) {
        definitions.functions.push(_formatFunctionOrMethod(node, sourceFile));
    } 
    else if (ts.isClassDeclaration(node) && node.name) {
        definitions.classes.push(_formatClass(node, sourceFile));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  
  parseCache.set(absPath, definitions);
  
  return isTopLevelFile ? definitions : _pruneContext(definitions, mode, symbolsToFind);
}

// Helper function to prune context based on the mode
function _pruneContext(structure: ParsedStructure, mode: ParseMode, symbolsToFind?: Set<string>): ParsedStructure {
    if (mode === 'full') return structure;
    const newStructure: ParsedStructure = { ...structure, variables: [], functions: [], classes: [] };
    
    const filterLogic = (name: string) => {
        if (symbolsToFind) return symbolsToFind.has(name); // Pruned mode
        if (mode === 'intelligent') return !name.startsWith('_'); // Intelligent mode
        return true;
    };

    structure.variables.forEach(v => {
        const name = v.match(/^(export\s+)?(const|let|var)\s+([\w\d_]+)/)?.[3];
        if (name && filterLogic(name)) newStructure.variables.push(v);
    });
    structure.functions.forEach(f => {
        const name = f.match(/function\s+([\w\d_]+)/)?.[1];
        if (name && filterLogic(name)) newStructure.functions.push(f);
    });
    structure.classes.forEach(c => {
        const name = c.match(/class\s+([\w\d_]+)/)?.[1];
        if (name && filterLogic(name)) newStructure.classes.push(c);
    });
    
    return newStructure;
}

function _findLastReturnStatement(bodyNode: ts.Block): ts.ReturnStatement | null {
    let lastReturn: ts.ReturnStatement | null = null;
    const visit = (node: ts.Node) => {
        if (ts.isReturnStatement(node)) lastReturn = node;
        if (!ts.isFunctionLike(node)) ts.forEachChild(node, visit);
    };
    visit(bodyNode);
    return lastReturn;
}
function _getConstructorAssignments(node: ts.ConstructorDeclaration, sourceFile: ts.SourceFile): string[] {
    const assignments: string[] = [];
    if (!node.body) return assignments;
    node.body.statements.forEach(statement => {
        if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
            const expr = statement.expression;
            if (expr.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(expr.left)) {
                if (expr.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
                    assignments.push(statement.getText(sourceFile));
                }
            }
        }
    });
    return assignments;
}
function _getReturnStatementText(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile): string | null {
    if (!node.body) return null;
    const returnStatement = _findLastReturnStatement(node.body);
    if (returnStatement) return returnStatement.getText(sourceFile);
    return null;
}
function _formatFunctionOrMethod(node: ts.FunctionDeclaration | ts.MethodDeclaration, sourceFile: ts.SourceFile, indent = ''): string {
    const fullSignature = node.getText(sourceFile).split('{')[0].trim();
    const docstring = _getJSDoc(node);
    const returnText = _getReturnStatementText(node, sourceFile);
    let result = docstring ? `${indent}/**\n${indent} * ${docstring.replace(/\n/g, `\n${indent} * `)}\n${indent} */\n` : '';
    result += `${indent}${fullSignature} {\n`;
    result += `${indent}    // some code lines\n`;
    if (returnText) {
        result += `${indent}    ${returnText}\n`;
    } else {
        result += `${indent}    ...\n`;
    }
    result += `${indent}}`;
    return result;
}

function _formatClass(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): string {
    const fullSignature = node.getText(sourceFile).split('{')[0].trim();
    const docstring = _getJSDoc(node);
    let classBody = '';
    if (docstring) {
        classBody += `    /**\n     * ${docstring.replace(/\n/g, '\n     * ')}\n     */\n\n`;
    }
    node.members.forEach(member => {
        if (ts.isPropertyDeclaration(member)) { classBody += `    ${member.getText(sourceFile)}\n`; }
        else if (ts.isMethodDeclaration(member)) { classBody += `\n${_formatFunctionOrMethod(member, sourceFile, '    ')}\n`; }
        else if (ts.isConstructorDeclaration(member)) {
            const constructorSignature = member.getText(sourceFile).match(/^(.*?{)/)?.[0] || 'constructor() {';
            const assignments = _getConstructorAssignments(member, sourceFile);
            classBody += `\n    ${constructorSignature}\n`;
            if (assignments.length > 0) {
                assignments.forEach(line => { classBody += `        ${line}\n`; });
            }
            classBody += `        // ... initialization\n    }\n`;
        }
    });
    let result = `${fullSignature} {\n${classBody}\n}`;
    return result;
}
function _getJSDoc(node: ts.Node): string | undefined {
    const jsDoc = (node as any).jsDoc;
    if (jsDoc && jsDoc.length > 0) {
        const comment = jsDoc[0].comment;
        if (typeof comment === 'string') return comment.trim();
    }
    return undefined;
}
function _resolveModulePath(baseDir: string, moduleSpecifier: string): string | undefined {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
        const fullPath = path.resolve(baseDir, moduleSpecifier + ext);
        if (fs.existsSync(fullPath)) return fullPath;
    }
    for (const ext of extensions) {
        const fullPath = path.resolve(baseDir, moduleSpecifier, 'index' + ext);
        if (fs.existsSync(fullPath)) return fullPath;
    }
    return undefined;
}
function _formatContextAsText(structure: ParsedStructure): string {
    const lines = [structure.moduleName, '='.repeat(structure.moduleName.length), ''];
    const importedFileTexts: string[] = [];
    if (structure.imports.length) {
        for (const imp of structure.imports) {
            lines.push(imp.text);
            if (imp.resolvedContext) {
                importedFileTexts.push(_formatContextAsText(imp.resolvedContext));
            }
        }
        lines.push('');
    }
    if (structure.variables.length) lines.push(...structure.variables, '');
    if (structure.functions.length) lines.push(...structure.functions, '');
    if (structure.classes.length) lines.push(...structure.classes, '');
    if (importedFileTexts.length > 0) {
        lines.push('\nImported files content', '======================', ...importedFileTexts);
    }
    return lines.join('\n');
}
