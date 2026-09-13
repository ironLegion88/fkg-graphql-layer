import time
import asyncio
from typing import Any
from strawberry.extensions import SchemaExtension
from graphql import GraphQLError, get_operation_ast, FieldNode, FragmentSpreadNode, InlineFragmentNode

class GraphQLSafetyExtension(SchemaExtension):
    """
    Enforces GraphQL operation safety limits:
    - Sets a request deadline in the context.
    - Limits query depth.
    - Limits field complexity/count.
    - Applies a hard timeout to the execution.
    """
    
    max_depth = 7
    max_fields = 100
    timeout_seconds = 15.0

    def on_operation(self):
        ctx = self.execution_context.context
        if isinstance(ctx, dict):
            if "deadline" not in ctx:
                ctx["deadline"] = time.monotonic() + self.timeout_seconds
            if "role" not in ctx:
                ctx["role"] = "operator"
        yield

    def on_validate(self):
        yield  # yield to allow validation to run
        if getattr(self.execution_context, "errors", None):
            return
        
        document = self.execution_context.graphql_document
        if not document:
            return
            
        operation_ast = get_operation_ast(document, self.execution_context.operation_name)
        if not operation_ast:
            return
            
        fragments = {
            d.name.value: d 
            for d in document.definitions 
            if type(d).__name__ == "FragmentDefinitionNode"
        }
        
        field_count = [0]
        max_depth_found = [0]
        
        def calculate_complexity(selection_set, current_depth, visited_fragments=None):
            if current_depth > self.max_depth:
                raise ValueError("MAX_DEPTH")
            
            if current_depth > max_depth_found[0]:
                max_depth_found[0] = current_depth

            if visited_fragments is None:
                visited_fragments = set()
                
            if not selection_set:
                return
                
            for selection in selection_set.selections:
                if isinstance(selection, FieldNode):
                    field_count[0] += 1
                    if field_count[0] > self.max_fields:
                        raise ValueError("MAX_FIELDS")
                    if selection.selection_set:
                        calculate_complexity(selection.selection_set, current_depth + 1, visited_fragments)
                elif isinstance(selection, FragmentSpreadNode):
                    frag_name = selection.name.value
                    if frag_name in visited_fragments:
                        continue
                    visited_fragments.add(frag_name)
                    frag_def = fragments.get(frag_name)
                    if frag_def and frag_def.selection_set:
                        calculate_complexity(frag_def.selection_set, current_depth, visited_fragments)
                elif isinstance(selection, InlineFragmentNode):
                    if selection.selection_set:
                        calculate_complexity(selection.selection_set, current_depth, visited_fragments)

        try:
            if operation_ast.selection_set:
                calculate_complexity(operation_ast.selection_set, 1)
        except ValueError as e:
            if str(e) == "MAX_DEPTH":
                raise GraphQLError(
                    f"Query depth exceeds maximum allowed depth of {self.max_depth}",
                    extensions={"code": "BUDGET_EXHAUSTED"}
                )
            elif str(e) == "MAX_FIELDS":
                raise GraphQLError(
                    f"Query complexity exceeds maximum allowed fields of {self.max_fields}",
                    extensions={"code": "BUDGET_EXHAUSTED"}
                )

    async def on_execute(self):
        try:
            async with asyncio.timeout(self.timeout_seconds):
                yield
        except asyncio.TimeoutError:
            raise GraphQLError("GraphQL execution timed out", extensions={"code": "TIMEOUT"})
