(function(global) {

var isTick = false,
    queue  = [],
    Ticker,
    animationFrame,
    lastTime;

// feature detection
animationFrame = requestAnimationFrame || webkitRequestAnimationFrame || mozRequestAnimationFrame || msRequestAnimationFrame || setTimeout;

Ticker = {
    tick:        tick,
    addQueue:    addQueue,
    removeQueue: removeQueue
};

function tick() {
    if ( isTick ) {
        return false;
    }

    isTick   = true;
    lastTime = Date.now;

    animationFrame(_tick);
}

function _tick() {
    var now = Date.now(),
        i   = -1;

    while ( queue[++i] ) {
        queue[i].update(now);
    }

    lastTime = now;
    animationFrame(_tick);
}

function addQueue(ticker) {
    var instance = new TickerInterface(ticker);

    queue.push(instance);

    return instance;
}

function removeQueue(ticker) {
    var i = -1;

    while ( queue[++i] ) {
        if ( queue[i]._tickerCallback === ticker ) {
            queue.splice(i, 1);
            break;
        }
    }
}

function TickerInterface(callback) {
    this.lastTime        = null;
    this.duration        = 100; // ms
    this._tickerCallback = callback;
    this.times           = 0;
    this.paused          = false;
}

TickerInterface.prototype.setDuration = function(duration) {
    this.duration = duration;
};

TickerInterface.prototype.pause = function() {
    this.paused = true;
};

TickerInterface.prototype.resume = function() {
    this.paused = false;
};

TickerInterface.prototype.update = function(time) {
    if ( this.lastTime === null ) {
        this.lastTime = time;
        return;
    }

    if ( time - this.lastTime >= this.duration ) {
        this.lastTime = time;
        ! this.paused && this._tickerCallback(++this.times);
    }
};

if ( typeof process !== 'undefined' ) {
    module.exports = Ticker;
} else {
    global.Ticker = Ticker;
}

})(this);
