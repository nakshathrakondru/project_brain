from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    type: str        # File, Module, Function, etc.
    label: str
    data: dict = {}


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str       # belongs_to, imports, modifies, etc.


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
