// isVisible() remains true when another window covers the pet.
// Restore z-order without activating the window or changing its position.
function keepAbove(win,quitting=false){
 if(quitting||!win||win.isDestroyed())return false;
 if(win.isMinimized())win.restore();
 if(!win.isAlwaysOnTop())win.setAlwaysOnTop(true);
 if(!win.isVisible())win.showInactive();
 win.moveTop();
 return true;
}
module.exports={keepAbove};
