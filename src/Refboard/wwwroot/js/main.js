/* refboard - start. Last of the scripts, so everything above is defined. */
"use strict";

applyIcons();
// The tour after boot(): it rings controls boot() may still hide.
boot().then(startTourOnce);
