import ast
import sys
import os
from typing import Any, Dict, Set

# Caching for recursively parsed files
parse_cache = {}

def get_node_repr(node: ast.AST) -> str:
    """
    Returns the code representation of a node as a string.
    - For literals (strings, numbers), it returns a string with quotes/etc. (e.g., 5 -> '5', "hi" -> "'hi'").
    - For variables and expressions, it returns the code as a string (e.g., res -> 'res', a + b -> 'a + b').
    """
    if isinstance(node, ast.Constant):
        return repr(node.value)
    # For everything else (variables, expressions, calls), ast.unparse is the best tool.
    try:
        return ast.unparse(node)
    except Exception:
        return "'<Complex Value>'"

def _get_literal_value(node: ast.AST) -> Any:
    """Tries to evaluate a node if it's a simple literal"""
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError, SyntaxError, MemoryError, RecursionError):
        return None

def parse_function(node: ast.FunctionDef) -> Dict[str, Any]:
    """Parses a FunctionDef node into a rich dictionary."""
    return_expression_str = None
    return_literal_obj = None
    if node.body:
        for item in reversed(node.body):
            if isinstance(item, ast.Return) and item.value:
                return_expression_str = get_node_repr(item.value)
                return_literal_obj = _get_literal_value(item.value)
                break
    init_assignments = []
    if node.name == '__init__':
        for item in node.body:
            if isinstance(item, ast.Assign):
                for target in item.targets:
                    if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == 'self':
                        init_assignments.append(ast.unparse(item))
    return {
        "name": node.name,
        "args": ast.unparse(node.args),
        "decorators": [ast.unparse(d) for d in node.decorator_list],
        "returns_hint": ast.unparse(node.returns) if node.returns else None,
        "return_expression": return_expression_str,
        "return_literal_obj": return_literal_obj,
        "docstring": ast.get_docstring(node, clean=False),
        "init_assignments": init_assignments
    }

def parse_class(node: ast.ClassDef) -> Dict[str, Any]:
    """Parses a ClassDef node into a rich dictionary."""
    return {
        "name": node.name,
        "bases": [ast.unparse(b) for b in node.bases],
        "decorators": [ast.unparse(d) for d in node.decorator_list],
        "docstring": ast.get_docstring(node, clean=False),
        "methods": [parse_function(item) for item in node.body if isinstance(item, ast.FunctionDef)],
        "variables": {target.id: get_node_repr(item.value) for item in node.body if isinstance(item, ast.Assign) for target in item.targets if isinstance(target, ast.Name)}
    }

def _prune_context(full_context: Dict[str, Any], imported_names: Set[str], mode: str) -> Dict[str, Any]:
    """Filters the context of an imported file based on the selected parsing mode."""
    if mode == 'full':
        return full_context
    
    pruned = {"module_name": full_context.get("module_name"), "imports": [], "variables": {}, "functions": [], "classes": []}
    
    if mode == 'intelligent':
        pruned["variables"] = {k: v for k, v in full_context.get("variables", {}).items() if not k.startswith('_')}
        pruned["functions"] = [f for f in full_context.get("functions", []) if not f['name'].startswith('_')]
        pruned["classes"] = [c for c in full_context.get("classes", []) if not c['name'].startswith('_')]
    elif mode == 'pruned':
        pruned["variables"] = {k: v for k, v in full_context.get("variables", {}).items() if k in imported_names}
        pruned["functions"] = [f for f in full_context.get("functions", []) if f['name'] in imported_names]
        pruned["classes"] = [c for c in full_context.get("classes", []) if c['name'] in imported_names]
        
    return pruned

def _extract_definitions_from_tree(tree: ast.Module, base_path: str, definitions: Dict[str, Any], mode: str):
    """Helper to walk the AST and populate the definitions dictionary."""
    for node in tree.body:
        if isinstance(node, ast.Assign):
            value = get_node_repr(node.value)
            for target in node.targets:
                if isinstance(target, ast.Name): definitions["variables"][target.id] = value
        elif isinstance(node, ast.FunctionDef):
            definitions["functions"].append(parse_function(node))
        elif isinstance(node, ast.ClassDef):
            definitions["classes"].append(parse_class(node))
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            import_data = {"import": ast.unparse(node), "module": None, "resolved_context": None}
            if isinstance(node, ast.ImportFrom) and node.module:
                import_data["module"] = node.module
                relative_module_path = node.module.replace('.', os.sep) + '.py'
                module_path = os.path.join(base_path, relative_module_path)
                
                full_resolved_context = parse_file(module_path, mode)
                
                if full_resolved_context:
                    imported_names = {alias.name for alias in node.names}
                    pruned_context = _prune_context(full_resolved_context, imported_names, mode)
                    import_data["resolved_context"] = pruned_context
            definitions["imports"].append(import_data)

def parse_file(filepath: str, mode: str = 'intelligent', content: str = None) -> Dict[str, Any] | None:
    """Parses Python code from a string, with fault tolerance."""
    abs_filepath = os.path.abspath(filepath)
    if abs_filepath in parse_cache: return parse_cache[abs_filepath]
    
    base_path = os.path.dirname(abs_filepath)
    definitions = {"imports": [], "variables": {}, "functions": [], "classes": [], "module_name": os.path.basename(abs_filepath)}
    
    if content is None:
        if not os.path.exists(abs_filepath): return None
        with open(abs_filepath, "r", encoding="utf-8") as f: content = f.read()

    try:
        tree = ast.parse(content, filename=abs_filepath)
        _extract_definitions_from_tree(tree, base_path, definitions, mode)
    except SyntaxError as e:
        print(f"Handled SyntaxError on line {e.lineno}. Reparsing without it.", file=sys.stderr)
        try:
            lines = content.splitlines()
            if 1 <= e.lineno <= len(lines): del lines[e.lineno - 1]
            resilient_content = "\n".join(lines)
            tree = ast.parse(resilient_content, filename=abs_filepath)
            _extract_definitions_from_tree(tree, base_path, definitions, mode)
        except Exception as final_e:
            definitions["error"] = f"File contains multiple errors. Last error: {final_e}"
    
    parse_cache[abs_filepath] = definitions
    return definitions

def format_context_as_text(context_dict: Dict[str, Any]) -> str:
    """Takes a parsed context dictionary and formats it into readable text."""
    if not context_dict or context_dict.get("error"): return context_dict.get("error", "Error: Could not format context.")
    lines = [context_dict.get("module_name", "Unknown File"), "=" * len(context_dict.get("module_name", "Unknown File"))]
    if context_dict.get("imports"):
        for imp in context_dict["imports"]: lines.append(imp["import"])
        lines.append("")
    if context_dict.get("variables"):
        for name, value in context_dict["variables"].items(): lines.append(f"{name} = {value}")
        lines.append("")

    for func in context_dict.get("functions", []):
        lines.extend([f"@{d}" for d in func['decorators']])
        return_type_str = ""
        if func['returns_hint']:
            return_type_str = f" -> {func['returns_hint']}"
        elif func['return_expression'] is None:
            return_type_str = " -> None"
        elif func['return_literal_obj'] is not None:
            val = func['return_literal_obj']
            if isinstance(val, str): return_type_str = " -> str"
            elif isinstance(val, int): return_type_str = " -> int"
            elif isinstance(val, bool): return_type_str = " -> bool"
            elif isinstance(val, list): return_type_str = " -> list"
            elif isinstance(val, dict): return_type_str = " -> dict"
        lines.append(f"def {func['name']}({func['args']}){return_type_str}:")
        if func['docstring']: lines.append(f"    \"\"\"{func['docstring']}\"\"\"")
        lines.append("    # some code lines")
        if func['return_expression'] is not None:
            lines.append(f"    return {func['return_expression']}")
        lines.append("")

    for cls in context_dict.get("classes", []):
        lines.extend([f"@{d}" for d in cls['decorators']])
        base_classes = f"({', '.join(cls['bases'])})" if cls['bases'] else ""
        lines.append(f"class {cls['name']}{base_classes}:")
        if cls['docstring']: lines.append(f"    \"\"\"{cls['docstring']}\"\"\"")
        lines.append("")
        for name, value in cls['variables'].items(): lines.append(f"    {name} = {value}")
        if cls['variables']: lines.append("")
        for meth in cls["methods"]:
            lines.extend([f"    @{d}" for d in meth['decorators']])
            meth_return_type_str = ""
            if meth['returns_hint']:
                meth_return_type_str = f" -> {meth['returns_hint']}"
            elif meth['name'] == '__init__' or meth['return_expression'] is None:
                meth_return_type_str = " -> None"
            elif meth['return_literal_obj'] is not None:
                val = meth['return_literal_obj']
                if isinstance(val, str): meth_return_type_str = " -> str"
                elif isinstance(val, int): meth_return_type_str = " -> int"
                elif isinstance(val, bool): meth_return_type_str = " -> bool"
                elif isinstance(val, list): meth_return_type_str = " -> list"
                elif isinstance(val, dict): meth_return_type_str = " -> dict"
            lines.append(f"    def {meth['name']}({meth['args']}){meth_return_type_str}:")
            if meth['docstring']: lines.append(f"        \"\"\"{meth['docstring']}\"\"\"")
            if meth.get('init_assignments'):
                for assign_line in meth['init_assignments']:
                    lines.append(f"        {assign_line}")
            lines.append("        # some code lines")
            if meth['return_expression'] is not None:
                if meth['name'] != '__init__' or not meth.get('init_assignments'):
                     lines.append(f"        return {meth['return_expression']}")
            lines.append("")
        lines.append("")
    return "\n".join(lines)

if __name__ == "__main__":
    print("Python parser process started.", file=sys.stderr)
    if len(sys.argv) > 1:
        file_to_parse_path = sys.argv[1]
        parsing_mode = sys.argv[2].lower() if len(sys.argv) > 2 else 'intelligent'
        if parsing_mode not in ['pruned', 'intelligent', 'full']: parsing_mode = 'intelligent'
        
        code_content = sys.stdin.read()

        print(f"Running in '{parsing_mode}' mode on content of '{os.path.basename(file_to_parse_path)}'.", file=sys.stderr)
        parse_cache.clear()
        
        main_context = parse_file(file_to_parse_path, parsing_mode, code_content)
        
        if main_context:
            if "error" in main_context: print(f"Error parsing file: {main_context['error']}")
            else:
                final_output = [format_context_as_text(main_context)]
                imported_files_text, formatted_imports = [], set()
                for imp in main_context.get("imports", []):
                    if imp.get("resolved_context") and imp.get("module") not in formatted_imports:
                        formatted_imports.add(imp["module"])
                        imported_files_text.append(format_context_as_text(imp["resolved_context"]))
                if imported_files_text:
                    final_output.extend(["\nImported files content", "======================"])
                    final_output.extend(imported_files_text)
                print("\n".join(final_output))
        else: print(f"Error: Could not parse file: {file_to_parse_path}")
    else: print("Error: No file path provided.")
