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
     * This function create an edge instance if it does not exist in dict, giving a new dict
     * 
     * @param   {bool|string}     type   Type of relationship in SNAP ontology   
     * @param   {object}          dict   A dictionary (eg : tempgraph["edges"])
     * @param   {string}          id     ID of given object
     * @param   {?string}         label  Label of given nodes
     * @param   {?object}         rdf    RDF representation of the edge
     *
     * @return  {object}          Dictionary with new edge
     */
    "edge" : function(type, dict, id, label, rdf) {
      if (!(id in dict)) {
        dict[id] = {
          "id" : id,
          "label" : label || id,
          "rdf" : rdf
        }
      } else {
        if (dict[id]["label"] === id && typeof label !== "undefined") { 
          dict[id]["label"] = label;
        }
      }
      return dict;
    },
    /**
     * This function create a node instance if it does not exist in dict, giving a new dict
     * 
     * @param   {object}   dict   A dictionary (eg : tempgraph["nodes"])
     * @param   {string}   id     ID of given object
     * @param   {?string}  label  Label of given nodes
     * @param   {?object}  rdf    RDF representation of the node
     *
     * @return  {object}          Dictionary with new node
     */
    "node" : function (dict, id, label, rdf) {
      if(!(id in dict)) {
        dict[id] = {
          "id" : id,
          "label" : label || id,
          "rdf" : rdf
        }
      }
      return dict;
    },
    /**
     * This function fills a node object with must-have properties for sigmaJS (X, Y, Weight)
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
    },
  /**
   * This function creates or update an instance of sigma
   *
   * @param  {object}              graph     A Graph object according to sigma models
   * @param  {object|sigma}        sig       A sigma configuration object or a sigma
   *                                         instance.
   * @param  {?function}           callback  Eventually a callback to execute after
   *                                         having parsed the file. It will be called
   *                                         with the related sigma instance as
   *                                         parameter.
   */
    "instantiateGraph" : function(graph, sig, callback) {
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
    },
    /**
     * This function gets a SNAP JSON-LD object and transforms it to a compatible graph for 
     * SigmaJS 1.0.X
     *
     * @param   {object}  JSON-LD object
     * @return  {object}  Sigma.js proprietary formatted object
     *
     */
    "getGraph" : function(jsonld) {
      var tempgraph;

      if (!('@graph' in jsonld))
        throw "File has not a correct JSON-LD structure (Missing @graph key at the root)";

      tempgraph = {
        "nodes" : {},
        "edges" : {}
      }

      jsonld["@graph"].forEach(function(element) {
        // If the object represented by element has a "snap:hasbond", it's a node
        if ("snap:has-bond" in element || "snap:associated-place" in element) {

          //We check that this node does exist, if not, we instantiate it
          tempgraph["nodes"] = sigma.parsers._snap.node(
            tempgraph["nodes"], 
            element["@id"], 
            element["rdfs:label"]
          );

          // If there is a bond in there
          if("snap:has-bond" in element) {
            // If it is an array of bond
            if(typeof element["snap:has-bond"] === 'array') {
              // We have multiple bond, we loop over it
              element.forEach(function(bond) {

                tempgraph["edges"] = sigma.parsers._snap.edge(
                  false,
                  tempgraph["edges"], 
                  bond["@id"], 
                  bond["rdfs:label"], 
                  bond
                );

              //Update the source
                tempgraph["edges"][bond["@id"]]["source"] = element["@id"];
              });
            } else {
              //Create an edge
              tempgraph["edges"] = sigma.parsers._snap.edge(
                false,
                tempgraph["edges"], 
                element["snap:has-bond"]["@id"], 
                element["snap:has-bond"]["rdfs:label"], 
                element["snap:has-bond"]
              );

              //Update the source
              tempgraph["edges"][element["snap:has-bond"]["@id"]]["source"] = element["@id"];
            }
            // We set up the source of the edge
          }

          // If there is an associated place in there
          // Associated place does not work as snap:has-bond
          // It contains the link in it, so we create a link-id
          if("snap:associated-place" in element) {

            // If it is an array of bond
            if(typeof element["snap:associated-place"] === 'array') {
              // We have multiple bond, we loop over it
              element.forEach(function(bond) {
                var bond_name = bond["@id"] + element["@id"]; 
                tempgraph["edges"] = sigma.parsers._snap.edge(
                  "associated-place",
                  tempgraph["edges"], // Graph dict
                  bond_name, // Name
                  bond["rdfs:label"], // Label (Mostly undefined)
                  bond // RDF Representation
                );
                tempgraph["edges"][bond_name]["source"] = element["@id"];
                tempgraph["edges"][bond_name]["target"] = bond["@id"];
              });
            } else {                
              var bond_name = element["snap:associated-place"]["@id"] + element["@id"];

              tempgraph["edges"] = sigma.parsers._snap.edge(
                "associated-place",
                tempgraph["edges"], 
                bond_name, 
                element["snap:associated-place"]["rdfs:label"],
                element["snap:associated-place"]
              );

              tempgraph["edges"][bond_name]["source"] = element["@id"];
              tempgraph["edges"][bond_name]["target"] = element["snap:associated-place"]["@id"];
            }
            // We set up the source of the edge
          }

        // If it is a relationship
        } else if ("snap:bond-with" in element) {
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

        // For now, we think everything else is nodes !
        } else {
          //We instantiate the node through our helper
          tempgraph["nodes"] = sigma.parsers._snap.node(tempgraph["nodes"], element["@id"], element["rdfs:label"]);
        }
      });

      return {
        "nodes" : Object.keys(tempgraph["nodes"]).map(function(key){return sigma.parsers._snap.fill_node(tempgraph["nodes"][key])}),
        "edges" : Object.keys(tempgraph["edges"]).map(function(key){return tempgraph["edges"][key]})
      }
    }
  }

  /**
   * This function loads a JSON file and creates a new sigma instance or
   * updates the graph of a given instance. It is possible to give a callback
   * that will be executed at the end of the process.
   *
   * @param  {object|string}       jsonld    The URL of the JSON file or a javascript object
   * @param  {object|sigma}        sig       A sigma configuration object or a sigma
   *                                         instance.
   * @param  {?function}           callback  Eventually a callback to execute after
   *                                         having parsed the file. It will be called
   *                                         with the related sigma instance as
   *                                         parameter.
   */
  sigma.parsers.snap = function(jsonld, sig, callback) {
    var graph;

    if(typeof jsonld === "string") {
      var xhr = sigma.utils.xhr();

      if (!xhr)
        throw 'XMLHttpRequest not supported, cannot load the file.';

      xhr.open('GET', jsonld, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          jsonld = JSON.parse(xhr.responseText);

          graph = sigma.parsers._snap.getGraph(jsonld);

          sigma.parsers._snap.instantiateGraph(graph, sig, callback);
        }
      };
      xhr.send();

    // If the object is not a string, it's a JSON-LD preparsed object
    } else {
      // We transform JSON-LD to a network object
      graph = sigma.parsers._snap.getGraph(jsonld);

      sigma.parsers._snap.instantiateGraph(graph, sig, callback);
    }
  };
}).call(this);
