Sigma Parses SNAP
===

Ingester of SNAP json rdf data for SigmaJS

## Current data format for SigmaJS 1.0.3

```javascript
{
 "nodes" : [{...}],
 "edges" : [{...}]
}
```

### Nodes

| Key     | Type     | Required | Description
|---------|----------|----------|---------------
| label   | string   |          | Text to display
| x       | float    |     X    | (Could be 0)
| y       | float    |     X    | (Could be 0)
| id      | string   |     X    | Unique ID reused in *Edges*
| color   | css      |          | Color such as `rgb(0,204,204)`
| size    | float    |          | (Could be 1.0)

### Edges

| Key     | Type     | Required | Description    
|---------|----------|----------|-------------------------
| source  | string   |     X    | Source ID of the link for a directed edge
| target  | string   |     X    | Target ID of the link
| id      | string   |     X    | Id of the edge

## How is a snap:bond written in json ?

Two types of nodes up to now :

### Relationship
```javascript
{

}
```