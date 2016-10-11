/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 GeoMoose
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/** Converts the catalog XML into something more useful.
 *
 */

import uuid from 'uuid';

import { CATALOG } from '../actionTypes';

import * as util from '../util';
import * as mapSources from './mapSource';

function addElement(tree, parentId, child) {
	if(parentId == null) {
		tree.children.push(child);
	}

	for(let element of tree) {
		if(element.type == 'group') {
			if(element.id == parentId) {
				
			}
		}
	}
}


/** Convert a group to a Javascript object.
 *
 *  WARNING! Does not populate children: []!
 *
 *  @param groupXml the XML definition of the group.
 *
 *  @returns Object representing the group.
 */
function parseGroup(groupXml) {
	let new_group = {
		id: groupXml.getAttribute('uuid'),
		children: [],
		label: groupXml.getAttribute('title'),
		expand: util.parseBoolean(groupXml.getAttribute('expand')),
		// multiple=true is checkboxes, false is radio buttons
		multiple: util.parseBoolean(groupXml.getAttribute('multiple'), true)
	};

	let p = groupXml.parentNode;
	if(p && p.tagName == 'group') {
		new_group.parent = p.getAttribute('uuid');
	}

	return new_group;
}

/** Convert a Catalog layer XML definition to a Javascript object.
 *
 *  @param layerXml
 *
 * @returns Object representing the layer
 */
function parseLayer(store, layerXml) {
	let new_layer = {
		id: layerXml.getAttribute('uuid'),
		label: layerXml.getAttribute('title'),
        src: [],
        on: false,
	};

    // collect the src states
    let src_state = true;

    // parse out the souces
    let src_str = layerXml.getAttribute('src');
    if(src_str) {
        for(let src of src_str.split(':')) {
            let split = src.split('/');
            // create a new src entry.
            let s = {
                mapSourceName: split[0],
                layerName: null,
            };
            // set a layer name if there is one.
            if(split.length > 1) {
                s.layerName = split[1];
            }

            new_layer.src.push(s);

            // if any of the underlaying paths in the src
            //  are false, then turn all of them off. 
            src_state = src_state && mapSources.getVisibility(store, s);

            // check to see if a 'default' name is needed
            // for the catalog entry.
            if(!new_layer.label) {
                let ms = mapSources.get(store, s.mapSourceName);
                if(ms.label) {
                    new_layer.label = ms.label;
                }
            }

        }
    }

    // set the new layer state based on the src.
    new_layer.on = src_state;

	let p = layerXml.parentNode;
	if(p && p.tagName == 'group') {
		new_layer.parent = p.getAttribute('uuid');
	}

	return new_layer;
}


function subtreeActions(store, parent, subtreeXml) {
	let actions = [];

	for(let childNode of subtreeXml.children) {
		let child = null, parent_id = null;
		if(parent && parent.id) {
			parent_id = parent.id;
		}
		if(childNode.tagName == 'group') {
			let group = parseGroup(childNode);
			actions.push({type: CATALOG.ADD_GROUP, child: group});
			child = group;

			// build the tree by recursion.
			actions = actions.concat(subtreeActions(store, group, childNode));
		} else if(childNode.tagName == 'layer') {
			let layer = parseLayer(store, childNode);
			actions.push({type: CATALOG.ADD_LAYER, child: layer})
			child = layer;
		}


		if(child && child.id) {
			actions.push({type: CATALOG.ADD_CHILD, parentId: parent_id, childId: child.id});
		}
			
	}

	return actions;
}


/** Read in the XML and returns a list of 
 *  actions to populate the store.
 *
 */
export function parseCatalog(store, catalogXml) {
	// first add a "uuid" attribute to each one
	//  of the elements
    // The UUIDs are used to flatten the tree's data structure.
	for(let e of catalogXml.getElementsByTagName('*')) {
		e.setAttribute('uuid', uuid.v4());
	}

	return subtreeActions(store, null, catalogXml);
}
