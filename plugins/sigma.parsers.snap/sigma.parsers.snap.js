;(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw 'sigma is not declared';

  // Initialize package:
  sigma.utils.pkg('sigma.parsers');
  sigma.utils.pkg('sigma.utils');

  /**
   * Just an XmlHttpRequest polyfill for different IE versions. Simple reuse of sigma.parsers.json
   *
   * @return {*} The XHR like object.
   */
  sigma.utils.xhr = function() {
    if (window.XMLHttpRequest)
      return new XMLHttpRequest();

    var names,
        i;

    if (window.ActiveXObject) {
      names = [
        'Msxml2.XMLHTTP.6.0',
        'Msxml2.XMLHTTP.3.0',
        'Msxml2.XMLHTTP',
        'Microsoft.XMLHTTP'
      ];

      for (i in names)
        try {
          return new ActiveXObject(names[i]);
        } catch (e) {}
    }

    return null;
  };

  sigma.parsers._snap = {
    //Default node properties such as X/Y/Size
    "default_node" : { 
      "x" : 1,
      "y" : 1,
      "size" : 10
    },
    /**
     * This function fill a node object with must-have properties for sigmaJS (X, Y, Weight)
     * if they are not available
     *
     * @param   {object}  A node object according to SigmaJS requirements
     * @return  {object}  Return the same node with necessary properties
     *
     */
    "fill_node" : function (obj) {
      //Because the default could be enhanced, we do a loop on the default_node properties
      Object.keys(sigma.parsers._snap.default_node).forEach(function(key) {
        if(!(key in obj)) {
          obj[key] = sigma.parsers._snap.default_node[key];
        }
      });

      return obj;
    }
  }

  /**
   * This function loads a JSON file and creates a new sigma instance or
   * updates the graph of a given instance. It is possible to give a callback
   * that will be executed at the end of the process.
   *
   * @param  {string}       url      The URL of the JSON file.
   * @param  {object|sigma} sig      A sigma configuration object or a sigma
   *                                 instance.
   * @param  {?function}    callback Eventually a callback to execute after
   *                                 having parsed the file. It will be called
   *                                 with the related sigma instance as
   *                                 parameter.
   */
  sigma.parsers.snap = function(url, sig, callback) {
    var graph,
        tempgraph,
        jsonld,
        xhr = sigma.utils.xhr();

    if (!xhr)
      throw 'XMLHttpRequest not supported, cannot load the file.';

    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        jsonld = JSON.parse(xhr.responseText);

        if (!('@graph' in jsonld))
          throw "File has not a correct JSON-LD structure (Missing @graph key at the root)";

        tempgraph = {
          "nodes" : {},
          "edges" : {}
        }

        jsonld["@graph"].forEach(function(element) {
          // If the object represented by element has a "snap:hasbond", it's a node
          if ("snap:has-bond" in element) {

            //We check that this node does exist, if not, we instantiate it
            if(!(element["@id"] in tempgraph["nodes"])) {
              tempgraph["nodes"][element["@id"]] = {
                "label" : element["@id"],
                "id" : element["@id"]
              }
            }

            // If no edge has been created with this id, we create it
            if (!(element["snap:has-bond"]["@id"] in tempgraph["edges"])) {
              tempgraph["edges"][element["snap:has-bond"]["@id"]] = {
                "id" : element["snap:has-bond"]["@id"]
              }
            }

            // We set up the source of the edge
            tempgraph["edges"][element["snap:has-bond"]["@id"]]["source"] = element["@id"];


          // Else, it is a relationship
          } else {
            // If no edge has been created with this id, we create it
            if (!(element["@id"] in tempgraph["edges"])) {
              tempgraph["edges"][element["@id"]] = {
                "id" : element["@id"]
              }
            }

            // We set up the target of the edge
            tempgraph["edges"][element["@id"]]["target"] = element["snap:bond-with"]["@id"];

            // We check for snap properties and thing like that

            // Here we check for the @type property
            if ("@type" in element) {
              tempgraph["edges"][element["@id"]]["type"] = element["@type"];
            }

            //We check that this node does exist, if not, we instantiate it
            if(!(element["snap:bond-with"]["@id"] in tempgraph["nodes"])) {
              tempgraph["nodes"][element["snap:bond-with"]["@id"]] = {
                "label" : element["snap:bond-with"]["@id"],
                "id" : element["snap:bond-with"]["@id"]
              }
            }

          }
        });

        graph = {
          "nodes" : Object.keys(tempgraph["nodes"]).map(function(key){return sigma.parsers._snap.fill_node(tempgraph["nodes"][key])}),
          "edges" : Object.keys(tempgraph["edges"]).map(function(key){return tempgraph["edges"][key]})
        }

        // Update the instance's graph:
        if (sig instanceof sigma) {
          sig.graph.clear();
          sig.graph.read(graph);

        // ...or instantiate sigma if needed:
        } else if (typeof sig === 'object') {
          sig.graph = graph;
          sig = new sigma(sig);

        // ...or it's finally the callback:
        } else if (typeof sig === 'function') {
          callback = sig;
          sig = null;
        }

        // Call the callback if specified:
        if (callback)
          callback(sig || graph);
      }
    };
    xhr.send();
  };
}).call(this);
