import asyncio
from pyoxigraph import Store, NamedNode, Variable, Literal

from domain.ontology_profile import OntologyPackage
from domain.semantic_models import (
    ResourceMetadata, ClassInfo, PropertyInfo, CompactIRI,
    SemanticKind, Annotation, MultilingualLabel, TypedValue
)
from domain.models import UNKNOWN_KIND
from adapters.oxigraph.repository import OxigraphSettings, _iri_local_name

RDF_TYPE = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
RDFS_LABEL = NamedNode("http://www.w3.org/2000/01/rdf-schema#label")
RDFS_SUBCLASS_OF = NamedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf")
RDFS_DOMAIN = NamedNode("http://www.w3.org/2000/01/rdf-schema#domain")
RDFS_RANGE = NamedNode("http://www.w3.org/2000/01/rdf-schema#range")
RDFS_SUBPROPERTY_OF = NamedNode("http://www.w3.org/2000/01/rdf-schema#subPropertyOf")
OWL_EQUIVALENT_CLASS = NamedNode("http://www.w3.org/2002/07/owl#equivalentClass")
OWL_DISJOINT_WITH = NamedNode("http://www.w3.org/2002/07/owl#disjointWith")
OWL_INVERSE_OF = NamedNode("http://www.w3.org/2002/07/owl#inverseOf")
OWL_EQUIVALENT_PROPERTY = NamedNode("http://www.w3.org/2002/07/owl#equivalentProperty")

class OxigraphSemanticRepository:
    def __init__(
        self,
        profile: OntologyPackage,
        settings: OxigraphSettings | None = None,
        store: Store | None = None,
    ) -> None:
        self._profile = profile
        self._settings = settings or OxigraphSettings.from_environment()
        self._store = (
            store
            if store is not None
            else Store.read_only(str(self._settings.active_store_path()))
        )

    def _resolve_iri(self, term: str) -> str:
        if ":" in term and not term.startswith("http"):
            prefix, local = term.split(":", 1)
            if prefix in self._profile.prefixes.prefixes:
                return self._profile.prefixes.prefixes[prefix] + local
        if not term.startswith("http"):
            return self._profile.prefixes.base_iri + term
        return term

    def _parse_compact_iri(self, iri: str) -> CompactIRI:
        return CompactIRI.parse(iri, self._profile.prefixes.prefixes)

    async def get_resource_metadata(self, iri: str) -> ResourceMetadata | None:
        return await asyncio.to_thread(self._get_resource_metadata, iri)

    async def get_class_info(self, class_iri: str) -> ClassInfo | None:
        return await asyncio.to_thread(self._get_class_info, class_iri)

    async def get_property_info(self, property_iri: str) -> PropertyInfo | None:
        return await asyncio.to_thread(self._get_property_info, property_iri)

    async def list_classes(self, limit: int = 100, offset: int = 0) -> list[ClassInfo]:
        return await asyncio.to_thread(self._list_classes, limit, offset)

    async def list_properties(self, limit: int = 100, offset: int = 0) -> list[PropertyInfo]:
        return await asyncio.to_thread(self._list_properties, limit, offset)

    def _get_resource_metadata(self, iri: str) -> ResourceMetadata | None:
        node = NamedNode(iri)
        if not any(self._store.quads_for_pattern(node, None, None, None)) and \
           not any(self._store.quads_for_pattern(None, None, node, None)):
            return None

        labels = []
        for quad in self._store.quads_for_pattern(node, RDFS_LABEL, None, None):
            if isinstance(quad.object, Literal):
                labels.append(MultilingualLabel(quad.object.value, quad.object.language, quad.object.datatype.value if quad.object.datatype else None, RDFS_LABEL.value))

        preferred_label = labels[0].value if labels else _iri_local_name(iri)
        
        types = []
        for quad in self._store.quads_for_pattern(node, RDF_TYPE, None, None):
            if isinstance(quad.object, NamedNode):
                types.append(quad.object.value)

        return ResourceMetadata(
            iri=iri,
            compact_iri=self._parse_compact_iri(iri),
            semantic_kind="NAMED_INDIVIDUAL",
            asserted_types=tuple(types),
            inferred_types=(),
            labels=tuple(labels),
            preferred_label=preferred_label,
            descriptions=(),
            aliases=(),
            annotations=(),
            source_graphs=(),
            build_id=None
        )

    def _get_class_info(self, class_iri: str) -> ClassInfo | None:
        node = NamedNode(class_iri)
        # Check if it's a class
        is_class = any(self._store.quads_for_pattern(node, RDF_TYPE, NamedNode("http://www.w3.org/2002/07/owl#Class"), None)) or \
                   any(self._store.quads_for_pattern(node, RDF_TYPE, NamedNode("http://www.w3.org/2000/01/rdf-schema#Class"), None)) or \
                   any(self._store.quads_for_pattern(None, RDF_TYPE, node, None))
        if not is_class:
            return None

        parents = [q.object.value for q in self._store.quads_for_pattern(node, RDFS_SUBCLASS_OF, None, None) if isinstance(q.object, NamedNode)]
        children = [q.subject.value for q in self._store.quads_for_pattern(None, RDFS_SUBCLASS_OF, node, None) if isinstance(q.subject, NamedNode)]
        equivalents = [q.object.value for q in self._store.quads_for_pattern(node, OWL_EQUIVALENT_CLASS, None, None) if isinstance(q.object, NamedNode)]
        equivalents.extend([q.subject.value for q in self._store.quads_for_pattern(None, OWL_EQUIVALENT_CLASS, node, None) if isinstance(q.subject, NamedNode)])
        disjoints = [q.object.value for q in self._store.quads_for_pattern(node, OWL_DISJOINT_WITH, None, None) if isinstance(q.object, NamedNode)]
        
        instances = sum(1 for _ in self._store.quads_for_pattern(None, RDF_TYPE, node, None))
        
        label = _iri_local_name(class_iri)
        for q in self._store.quads_for_pattern(node, RDFS_LABEL, None, None):
            if isinstance(q.object, Literal):
                label = q.object.value
                break
                
        return ClassInfo(
            iri=class_iri,
            compact_iri=self._parse_compact_iri(class_iri),
            label=label,
            direct_parents=tuple(parents),
            all_ancestors=tuple(parents), # simplified for now
            direct_children=tuple(children),
            all_descendants=tuple(children), # simplified for now
            equivalent_classes=tuple(equivalents),
            disjoint_classes=tuple(disjoints),
            instance_count=instances,
            annotations=(),
            restrictions=()
        )

    def _get_property_info(self, property_iri: str) -> PropertyInfo | None:
        node = NamedNode(property_iri)
        # Check if property
        types = [q.object.value for q in self._store.quads_for_pattern(node, RDF_TYPE, None, None) if isinstance(q.object, NamedNode)]
        if not any("Property" in t for t in types) and not any(self._store.quads_for_pattern(None, node, None, None)):
            return None

        domains = [q.object.value for q in self._store.quads_for_pattern(node, RDFS_DOMAIN, None, None) if isinstance(q.object, NamedNode)]
        ranges = [q.object.value for q in self._store.quads_for_pattern(node, RDFS_RANGE, None, None) if isinstance(q.object, NamedNode)]
        inverse_of = next((q.object.value for q in self._store.quads_for_pattern(node, OWL_INVERSE_OF, None, None) if isinstance(q.object, NamedNode)), None)
        equivalents = [q.object.value for q in self._store.quads_for_pattern(node, OWL_EQUIVALENT_PROPERTY, None, None) if isinstance(q.object, NamedNode)]
        equivalents.extend([q.subject.value for q in self._store.quads_for_pattern(None, OWL_EQUIVALENT_PROPERTY, node, None) if isinstance(q.subject, NamedNode)])
        parents = [q.object.value for q in self._store.quads_for_pattern(node, RDFS_SUBPROPERTY_OF, None, None) if isinstance(q.object, NamedNode)]
        children = [q.subject.value for q in self._store.quads_for_pattern(None, RDFS_SUBPROPERTY_OF, node, None) if isinstance(q.subject, NamedNode)]
        
        usage_count = sum(1 for _ in self._store.quads_for_pattern(None, node, None, None))
        
        label = _iri_local_name(property_iri)
        for q in self._store.quads_for_pattern(node, RDFS_LABEL, None, None):
            if isinstance(q.object, Literal):
                label = q.object.value
                break
                
        return PropertyInfo(
            iri=property_iri,
            compact_iri=self._parse_compact_iri(property_iri),
            label=label,
            property_kind="OBJECT_PROPERTY" if "ObjectProperty" in "".join(types) else "DATATYPE_PROPERTY",
            domains=tuple(domains),
            ranges=tuple(ranges),
            inverse_of=inverse_of,
            equivalent_properties=tuple(equivalents),
            sub_properties=tuple(children),
            super_properties=tuple(parents),
            characteristics=tuple(t for t in types if "Property" in t),
            usage_count=usage_count,
            annotations=()
        )

    def _list_classes(self, limit: int, offset: int) -> list[ClassInfo]:
        classes = []
        nodes = set(q.subject.value for q in self._store.quads_for_pattern(None, RDF_TYPE, NamedNode("http://www.w3.org/2002/07/owl#Class"), None) if isinstance(q.subject, NamedNode))
        for c in list(nodes)[offset:offset+limit]:
            info = self._get_class_info(c)
            if info:
                classes.append(info)
        return classes

    def _list_properties(self, limit: int, offset: int) -> list[PropertyInfo]:
        props = []
        nodes = set(q.subject.value for q in self._store.quads_for_pattern(None, RDF_TYPE, NamedNode("http://www.w3.org/2002/07/owl#ObjectProperty"), None) if isinstance(q.subject, NamedNode))
        nodes.update(q.subject.value for q in self._store.quads_for_pattern(None, RDF_TYPE, NamedNode("http://www.w3.org/2002/07/owl#DatatypeProperty"), None) if isinstance(q.subject, NamedNode))
        for p in list(nodes)[offset:offset+limit]:
            info = self._get_property_info(p)
            if info:
                props.append(info)
        return props
