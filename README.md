# RunMap

[![Netlify Status](https://api.netlify.com/api/v1/badges/8500222e-d47b-49ed-91c1-20a9a1205cfa/deploy-status)](https://app.netlify.com/sites/runmap/deploys)

See it in action at [runmap.netlify.app](https://runmap.netlify.app/).

## Running map distance app

Designed for anyone looking to plot out a run/bike/walk and find out the distance of their route.
Use it for planning a route, or getting a sense of your route after a workout.

- Click the map to add segments to chart out your run and see the total distance. The shortest route between that and the preceeding point is used.
- Remove the last marker to undo an incorrect point or a more specific route.

## Dev setup

- Get an access token from [mapbox](https://account.mapbox.com/).
- Run `npm run init <your token from above>` to set it up as a secret.
- Use `npm run serve` to start serving locally on port 9000.

## TODO

- Elevation along route
- Simple instructions in-app (better user guidance/education)
- Mile markers along route
- Save/load run

## Thanks

- [github.com/mikeomeara1](https://github.com/mikeomeara1) - mapbox-sdk types
- [realfavicongenerator.net](https://realfavicongenerator.net/) - favicons

## Changelog

- 8/9/22: Took matters into my own hands and deployed to Netlify
- 11/28/20: Refactored a bit to better abstract out mapbox API, localStorage interactions
- 6/14/20: Updates to the testing experience, take advantage of existing libraries to simplify things
- 3/28/20: Audits, enabled Github workflows, also added extra accessiblity/aria context
- 8/13/19: Allowed selecting map visual style
- 8/4/19: Contributed types, now consuming them
- 7/24/19: Closer to proper types for mapbox-sdk, more obfuscation, updated packages
- 5/26/19: Added side menu, choose to follow roads or not
- 3/30/19: Material icons, improved labels
- 3/16/19: Refactored distance formatting
- 3/14/19: Setup Jenkins ci/cd
- 3/11/19: Configure km/mi for distance
- 3/4/19: Initial release
