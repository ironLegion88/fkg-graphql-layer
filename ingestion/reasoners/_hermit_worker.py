import sys
import argparse
import json
import traceback

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ontology", required=True)
    parser.add_argument("--mode", choices=["consistency", "materialize"], required=True)
    parser.add_argument("--output", required=False)
    parser.add_argument("--memory-mb", type=int, required=False, default=2048)
    
    args = parser.parse_args()
    
    try:
        import owlready2
        from owlready2 import get_ontology, sync_reasoner, OwlReadyInconsistentOntologyError, default_world
        
        # Enforce memory limit
        owlready2.reasoning.JAVA_MEMORY = args.memory_mb
    except ImportError:
        print(json.dumps({"error": "owlready2 not installed"}))
        sys.exit(1)

    try:
        # Auto-detect format based on extension
        ext = args.ontology.split(".")[-1].lower()
        fmt = "ntriples" if ext == "nt" else "rdfxml"
        onto = get_ontology(f"file://{args.ontology}").load(format=fmt)
        
        # Run HermiT
        sync_reasoner([onto], infer_property_values=True)
        
        # If we reach here, it's consistent.
        unsatisfiable_classes = []
        # Check for unsatisfiable classes (Nothing)
        from owlready2 import Nothing
        for cls in onto.classes():
            if cls.equivalent_to and Nothing in cls.equivalent_to:
                unsatisfiable_classes.append(cls.iri)
            elif Nothing in cls.is_a:
                unsatisfiable_classes.append(cls.iri)
                
        if args.mode == "materialize" and args.output:
            # We want to save ONLY the inferences.
            # owlready2 puts inferences into a special graph in the default_world.
            # "http://inferrences/" is the default IRI for inferences in owlready2.
            inferences = default_world.get_ontology("http://inferrences/")
            inferences.save(file=args.output, format="ntriples")
            
        print(json.dumps({
            "is_consistent": True,
            "unsatisfiable_classes": unsatisfiable_classes
        }))
        sys.exit(0)
        
    except OwlReadyInconsistentOntologyError:
        print(json.dumps({
            "is_consistent": False,
            "unsatisfiable_classes": [],
            "error": "Ontology is inconsistent according to HermiT."
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "is_consistent": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
