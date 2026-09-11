import pytest
from pyoxigraph import Store, RdfFormat

from adapters.oxigraph.semantic_repository import OxigraphSemanticRepository
from domain.ontology_profile import load_ontology_profile
from tests.test_oxigraph_repository import WINE

@pytest.fixture
def profile():
    return load_ontology_profile()

@pytest.fixture
def repository(profile):
    store = Store()
    store.load(
        input=f"""
            @prefix wine: <{WINE}> .
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

            wine:Wine a owl:Class .
            wine:Winery a owl:Class .
            wine:Region a owl:Class .
            wine:WineGrape a owl:Class .

            wine:RedWine rdfs:subClassOf wine:Wine .
            wine:WhiteWine rdfs:subClassOf wine:Wine .

            wine:DemoWine a wine:Wine ;
                rdfs:label "Vin exemple"@fr, "Demo Wine"@en ;
                wine:hasMaker wine:DemoWinery ;
                wine:locatedIn wine:DemoRegion ;
                wine:madeFromGrape wine:DemoGrape .
            wine:DemoWinery a wine:Winery ; rdfs:label "Demo Winery"@en .
            wine:DemoRegion a wine:Region ; rdfs:label "Demo Region"@en ;
                wine:adjacentRegion wine:OtherRegion .
            wine:OtherRegion a wine:Region .
            wine:DemoGrape a wine:WineGrape .

            wine:hasMaker a owl:ObjectProperty ;
                rdfs:domain wine:Wine ;
                rdfs:range wine:Winery .
                
            wine:hasWinery a owl:ObjectProperty ;
                owl:equivalentProperty wine:hasMaker .
        """,
        format=RdfFormat.TURTLE,
    )
    return OxigraphSemanticRepository(profile=profile, store=store)

@pytest.mark.asyncio
async def test_get_class_info(repository):
    class_info = await repository.get_class_info(f"{WINE}Wine")
    assert class_info is not None
    assert class_info.iri == f"{WINE}Wine"
    assert len(class_info.direct_children) == 2
    assert class_info.instance_count == 1

@pytest.mark.asyncio
async def test_get_property_info(repository):
    prop_info = await repository.get_property_info(f"{WINE}hasMaker")
    assert prop_info is not None
    assert prop_info.iri == f"{WINE}hasMaker"
    assert prop_info.property_kind == "OBJECT_PROPERTY"
    assert len(prop_info.domains) == 1
    assert len(prop_info.ranges) == 1
    assert len(prop_info.equivalent_properties) == 1
    assert prop_info.usage_count == 1
