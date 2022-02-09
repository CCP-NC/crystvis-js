In CrystVis-js, it's possible to use the `.find()` method in `Model` and `ModelView` objects to retrieve atoms based on various search criteria. The `.find()` method takes as argument a *query*; these queries are structured in a way that's inspired by queries used for example in the MongoDB interface. It's worth taking a minute to learn how they work.

### Basic structure of a query

A query passed to the `.find()` method has to be an object. Typically, a query unit is structured as follows:

```js
var query = {
    "query_name": ["argument_1", "argument_2", ...]
}
```

where the appropriate actual name and arguments of course must be replaced. For example, one might use

```js
var H_atoms = model.find({
    "elements": ["H"]
})
```

to identify all hydrogen atoms within the model. The functions accepted for queries by a model are the following:

* `all` (no arguments): return all atoms in the model
* `indices` (`indices`): return all atoms with the given index or Array of indices
* `elements` (`elems`): return all atoms with the given element or one of an Array of elements
* `cell` (`ijk`): return atoms within the cell with indices i, j and k
* `box` (`x0`, `x1`): return atoms inside a box defined by two corners (points or atoms)
* `sphere` (`x0`, `r`): return atoms inside a sphere defined by a center (point or atom) and a radius
* `bonded` (`atoms`, `distance`, `exact`): return atoms within a certain number of bonds ("distance") from one or more atoms. For example, asking for all atoms within one bond from the oxygen in a water molecule will return the whole molecule. If "exact" is set to true instead, only atoms at the exact distance will be returned. In the water molecule example, this would return only the hydrogens
* `molecule` (`atoms`): return all atoms belonging to the same molecule as one of the atoms passed as argument

### Boolean operators

In addition to the simple functions described above, queries accept boolean operators that can be used to build more complex ones. For example one could use this query:

```js
var query = {
    "$and": [{
        "elements": [["H", "C"]]
    }, {
        "sphere": [[0, 0, 0], 4.0]
    }]
}
```

to retrieve all atoms of either hydrogen or carbon located within a radius of 4 Angstroms from the origin of the cell. A boolean operator takes more queries as arguments, which means they can be nested further for more complex searches. The accepted boolean operators are the following:

* `$and` (`query_1`, `query_2`, ...): returns the intersection of all the passed queries
* `$or` (`query_1`, `query_2`, ...): returns the union of all the passed queries
* `$xor` (`query_1`, `query_2`, ...): return the exclusive OR of all queries (in other words, any atom that is returned by only one query but no other)