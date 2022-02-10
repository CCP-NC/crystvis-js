User interactions with a model in CrystVis-js can be customised through the definition of callbacks for *events*. This means it's possible to bind arbitrary JavaScript code
to the various ways in which a user can click on an atom in the model. To do this, one needs to use the `.onAtomClick()` method of a `CrystVis` object, as well as its flags.

### Defining an event

A custom event can be set by defining a callback function, then assigning that function to a specific click event. Here is an example:

```js
function myCallback(atom, event) {
    alert(atom.element);
}

visualizer.onAtomClick(myCallback, CrystVis.LEFT_CLICK)
```

This code will result in binding a function that causes a popup to show with the chemical symbol of an atom's element whenever you left click on one.

### Flags

Which event a callback should be bound to is defined by the flags passed as the second argument to `.onAtomClick()`. These are the available flags:

 * `CrystVis.LEFT_CLICK`
 * `CrystVis.RIGHT_CLICK`
 * `CrystVis.MIDDLE_CLICK`
 * `CrystVis.CTRL_BUTTON`
 * `CrystVis.ALT_BUTTON`
 * `CrystVis.SHIFT_BUTTON`
 * `CrystVis.CMD_BUTTON`

Note that `CMD_BUTTON` is only used on Macs and equivalent to `CTRL_BUTTON` on other machines. These are bit flags, so they can be combined with addition or bitwise operators. For 
example, `CrystVis.LEFT_CLICK + CrystVis.SHIFT_BUTTON` represents a click with the shift key down. Each combinations of flags can only hold one callback function; if `null` is passed
instead of a callback, default behaviour is restored.

### Default behaviour

Most events by default are bound to nothing, mean, nothing will happen unless you define a specific behaviour for them. There are only three exceptions to this:

* `CrystVis.LEFT_CLICK` defaults to selecting the clicked atom
* `CrystVis.LEFT_CLICK + CrystVis.SHIFT_BUTTON` defaults to adding the clicked atom to selection
* `CrystVis.LEFT_CLICK + CrystVis.CTRL_BUTTON` defaults to switching the clicked atom in or out of the selection

To best see how the selection changes, set `.highlightSelected = true`.

### Box selection

In addition to the various events described above, there is a special behaviour. Clicking while pressing Shift on a point that does *not* have an atom allows the user to drag
a box around multiple atoms, for example to select them in group. This behaviour can also be customized, by setting a callback with the method `.onAtomBox()`. Here is an example:

```js
function boxCallback(atomview) {
    alert(atomview.map((atom) => atom.element));
}

visualizer.onAtomBox(boxCallback)
```

that will create an alert popup with a list of all the elements in the selected box.