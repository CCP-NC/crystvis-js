# API reference

Generated from the source. For task-oriented guides with live examples, see the [guides](../index.html).

The package exports three classes:

- [CrystVis](CrystVis.html): the viewer. Create one per container.
- [TensorData](TensorData.html): a 3×3 tensor with NMR conventions and derived parameters.
- [RelativeTensorOrientation](RelativeTensorOrientation.html): the relative orientation of two tensors' principal axis systems.

You never construct the other documented classes yourself. You get them from a viewer:

- [Model](Model.html) is `vis.model`, the displayed structure with all its periodic images.
- [ModelView](ModelView.html) is the result of `model.find(query)`, and the type of `vis.displayed` and `vis.selected`.
- [AtomImage](AtomImage.html) and [BondImage](BondImage.html) are the entries of `view.atoms` and `atom.bonds`.
