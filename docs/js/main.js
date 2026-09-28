/* refboard - start. Last of the scripts, so everything above is defined. */
"use strict";

applyIcons();
// Read before the tour runs, which marks itself seen.
let firstVisit = false;
try { firstVisit = !localStorage.getItem(TOUR_KEY); } catch { /* private mode */ }
// After boot(): the tour rings controls boot() may still hide. A first
// visit gets the tour, a later one what is new since - never both.
boot().then(() => {
  startTourOnce();
  showNewsOnce(firstVisit);
});
