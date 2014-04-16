(function(module) {
    
    "use strict";
    
    // Scope stacks
    var LAZY_ID   = 0,
        PARALLELS = [],
        REGEX     = /^is|parallel|promise|then/,
        TO_STRING = Object.prototype.toString,
        PROTOTYPE;
        
    // exports
    module.Lazy = Lazy;
    
    // Check variable is Function
    function isF(fn) {
        return typeof fn === 'function';
    }
    
    // Empty function
    function emptyFunction() {}
    
    // Get status string from status code
    function getStatusString(status) {
        return ( status === Lazy.SUCCESS ) ? 'success' : 
               ( status === Lazy.FAIED )   ? 'failed' :
               ( status === Lazy.ABORT )   ? 'abort' :
               void 0;
    }
    
    // Check object implements Lazy interface
    function isImpl(lazy) {
        return lazy && lazy._interface === 'Lazy';
    }
    
    // Get same lazy
    function getLazy(lazy) {
        return ( lazy instanceof PromisedLazy ) ? lazy.lazy : lazy;
    }
    
    // Signal sender class
    function Signal(lazy) {
        this.lazy = lazy;
    }
    
    Signal.prototype = {
        constructor: Signal,
        
        success: signal_success,
        failed : signal_failed,
        abort  : signal_abort,
        send   : signal_send,
        notify : signal_notify
    };
    
    /**
     * Lazy class
     */
    function Lazy() {
        this.id = ++LAZY_ID;
        // Initial parameters
        this._proceeded = false;
        this._appointID = 0;
        this._status    = Lazy.SUSPEND;
        this._message   = void 0;
        this._progress  = null;
        this._pipes     = { 0x01: null, 0x10: null, 0x11: null };
        this._callbacks = { 0x01: [],   0x10: [],   0x11: []   };
        this._chain     = null;
        
        // Attach signal class instance
        this.signal     = new Signal(this);
    }
    
    // Static status properties
    Lazy.SUSPEND = 0x00;
    Lazy.SUCCESS = 0x01;
    Lazy.FAILED  = 0x10;
    Lazy.ABORT   = 0x11;
    
    // Static create instance
    Lazy.make = function() {
        return new Lazy();
    };
    
    // Attach interface
    Lazy.extend = function(fn) {
        fn._interface = 'Lazy';
        
        return fn;
    };
    
    Lazy.prototype = {
        _interface    : 'Lazy',
        constructor   : Lazy,
        
        pipe          : lazy_pipe,
        success       : lazy_success,
        isSuccess     : lazy_isSuccess,
        failed        : lazy_failed,
        isFailed      : lazy_isFailed,
        abort         : lazy_abort,
        isAbort       : lazy_isAbort,
        always        : lazy_always,
        then          : lazy_then,
        chain         : lazy_chain,
        setAppointID  : lazy_setAppointID,
        getMessage    : lazy_getMessage,
        _changeStatus : lazy_changeStatus,
        _execute      : lazy_execute,
        _process      : lazy_process,
        promise       : lazy_promise,
        progress      : lazy_progress
    };
    
    /**
    * Lazy.Parallel: parallel async class
    */
    Lazy.Parallel = function() {
        var idx = -1,
            parallel;
        
        // Apply Lazy constructor
        Lazy.call(this);
        this._appointID = ++LAZY_ID;
        this._lazy      = [];
        this.parallel   = true;
        
        // Add lazy list from arguments
        while( arguments[++idx] ) {
            parallel = arguments[idx];
            if ( isImpl(parallel) ) {
                parallel.setAppointID(this._appointID);
                this._lazy[this._lazy.length] = parallel;
            }
        }
        
        // Add parallel stack
        PARALLELS[this._appointID] = this;
        
        return this;
    }
    
    Lazy.Parallel.prototype = {
        _interface    : 'Lazy',
        constructor   : Lazy.Parallel,
        
        promise       : lazy_promise,
        success       : lazy_success,
        isSuccess     : lazy_isSuccess,
        failed        : lazy_failed,
        isFailed      : lazy_isFailed,
        abort         : lazy_abort,
        chain         : lazy_chain,
        isAbort       : lazy_isAbort,
        pipe          : lazy_pipe,
        getMessage    : lazy_getMessage,
        _execute      : lazy_execute,
        progress      : lazy_progress,
        _changeStatus : lazy_parallel_changeStatus,
        append        : lazy_parallel_append,
        _process      : lazy_parallel_process
       
    };
    
    /**
     * Create "Promised" Lazy instance
     * @param Lazy lazy
     */
    function PromisedLazy(lazy) {
        this.lazy  = lazy;
    }
    
    PromisedLazy.prototype = {
        _interface  : 'Lazy',
        constructor : PromisedLazy,
        signal      : {
            success: emptyFunction,
            failed : emptyFunction,
            abort  : emptyFunction,
            notify : function(msg) {
                signal_notify.call(this, msg);
            }
        }
    };
    
    // Clone Lazy prototypes
    for ( PROTOTYPE in Lazy.prototype ) {
        if ( ! PROTOTYPE.isPrototypeOf(Lazy.prototype)
             && isF(Lazy.prototype[PROTOTYPE]) ) {
            (function(__proto__) {
                PromisedLazy.prototype[__proto__] = function() {
                    var fn  = Lazy.prototype[__proto__],
                        ret = fn.apply(this.lazy, arguments);
                    
                    return ( REGEX.test(__proto__) )
                             ? ret
                             : this;
                };
            })(PROTOTYPE);
        }
    }
    
    // Signal prototype implements ========================
    
    /**
     * Change status to "success" if allowed
     * @access public
     * @param mixed message
     */
    function signal_success(message) {
        return this.send(Lazy.SUCCESS, message);
    }
    
    /**
     * Change status to "failed" if allowed
     * @access public
     * @param mixed message
     */
    function signal_failed(message) {
        return this.send(Lazy.FAILED, message);
    }
    
    /**
     * Change status to "abort" if alloed
     * @access public
     * @param mixed message
     */
    function signal_abort(message) {
        return this.send(Lazy.ABORT, message);
    }
    
    /**
     * Send a signal
     * @access public
     * @param int status
     */
    function signal_send(status, message) {
        var lazy = this.lazy;
        
        lazy._changeStatus(status, message);
        return lazy;
    }
    
    /**
     * Send notify signal
     * @access public
     * @param mixed msg
     * @return Lazy
     */
    function signal_notify(msg) {
        ( this.lazy._status === Lazy.SUSPEND )
          && isF(this.lazy._progress)
          && this.lazy._progress(msg);
        
        return this.lazy;
    }
    
    // Lazy prototype implements ========================
    
    /**
     * Regist status hooks functions
     * @access public
     * @param function success
     * @param function failed
     * @param function abort
     * @return this
     */
    function lazy_pipe(success, failed, abort) {
        this._pipes[Lazy.SUCCESS] = success;
        this._pipes[Lazy.FAILED]  = failed;
        this._pipes[Lazy.ABORT]   = abort;
        
        return this;
    }
    
    /**
     * Attach success callback function
     * @access public
     * @param function callback
     * @return this
     */
    function lazy_success(callback) {
        this._callbacks[Lazy.SUCCESS].push([callback, 0]);
        this.isSuccess() && this._execute();
       
       return this.promise();
    }
    
    /**
     * Returns Lazy status is Success
     * @access public
     * @return boolean
     */
    function lazy_isSuccess() {
        return this._status === Lazy.SUCCESS;
    }
    
    /**
     * Attach failed callback fucntion
     * @access public
     * @param function callback
     * @return this
     */
    function lazy_failed(callback) {
        this._callbacks[Lazy.FAILED].push([callback, 0]);
        this.isFailed() && this._execute();
        
        return this.promise();
    }
    
    /**
     * Returns Lazy status is Failed
     * @access public
     * @return boolean
     */
    function lazy_isFailed() {
        return this._status === Lazy.FAILED;
    }
    
    /**
     * Attach abort callback function
     * @access public
     * @param function callback
     * @return this
     */
    function lazy_abort(callback) {
        this._callbacks[Lazy.ABORT].push([callback, 0]);
        this.isAbort() && this._execute();
        
        return this._promise()
    }
    
    /**
     * Returns Lazy status is Abort
     * @access public
     * @return boolean
     */
    function lazy_isAbort() {
        return this._status === Lazy.ABORT;
    }
    
    /**
     * Attach callback on al status
     * @access public
     * @param function callback
     * @return PromisedLazy
     */
    function lazy_always(callback) {
        this._callbacks[Lazy.SUCCESS].push([callback, 0]);
        this._callbacks[Lazy.ABORT].push([callback, 0]);
        this._callbacks[Lazy.FAILED].push([callback, 0]);
        
        if ( this.isSuccess() || this.isAbort() || this.isFailed() ) {
            this._execute();
        }
        
        return this.promise();
    }
    
    function lazy_then(success, failed, abort) {
        var chain = new Lazy(),
            types = ['success', 'failed', 'abort'],
            idx   = -1,
            arg,
            type;
        
        while ( arguments[++idx] ) {
            arg  = arguments[idx];
            type = types[idx];
            this[type](function() {
                var resp = isF(arg) ? arg() : arg,
                    lazy;
                
                if ( isImpl(resp) ) {
                    lazy = getLazy(resp);
                    lazy[type](function() {
                        chain.signal[type].apply(chain.signal, arguments);
                    });
                } else {
                    chain.signal[type]();
                }
            });
        }
        
        return new PromisedLazy(chain);
    }
    
    /**
     * Returns chained "promised" Lazy instance
     * @access public
     * @param  string type
     * @return Lazy
     */
    function lazy_chain() {
         this._chain = new Lazy();
         
         return this._chain;
    }
    
    /**
     * Set Parallel appointment ID
     * @access public
     * @param  number appointID
     * @return void
     */
    function lazy_setAppointID(appointID) {
        this._appointID = appointID;
    }
    
    /**
     * Get sended message data
     * @access public
     * @return mixed
     */
    function lazy_getMessage() {
        return this._message;
    }
    
    /**
     * Change status
     * @access protected on this scope
     * @param  int status
     * @param  mixed message
     * @return void
     */
    function lazy_changeStatus(status, message) {
        // If state set true either, nothing to do.
        if ( this._proceeded ) {
            return;
        }
        
        // Mark proceeded
        this._proceeded = true;
        // Change status
        this._status    = status;
        this._message   = message;
        
        // Execute
        this._execute();
    }
    
    /**
     * Execute registed callbacks
     * @access private
     * @param  boolean pipesCallback
     * @return void
     */
    function lazy_execute(pipesCallback) {
        var that      = this,
            idx       = -1,
            status    = this._status,
            callbacks = this._callbacks[status] || [],
            message   = ( isF(this._pipes[status]) && ! pipesCallback )
                          ? this._pipes[status](this._message)
                          : this._message;
        
        // Does pipe function returns Lazy instance?
        if ( isImpl(message) && pipesCallback  ) {
            // More Lazy...
            return message[getStatusString(status)](function(msg) {
                that._message = message.getMessage();
                that._execute(true);
            });
        }
        
        while ( callbacks[++idx] ) {
            if ( isF(callbacks[idx][0]) && callbacks[idx][1] === 0 ) {
                callbacks[idx][1] = 1;
                ( this.parallel )
                  ? callbacks[idx][0].apply(this, message)
                  : callbacks[idx][0](message);
            }
        }
        
        this._process(status, message);
    }
    
    /**
     * Lazy process
     * @access private
     * @param int status
     * @param mixed message
     */
    function lazy_process(status, message) {
        // Does this object has appointment?
        if ( this._appointID > 0 && this._appointID in PARALLELS ) {
            PARALLELS[this._appointID].signal.send(status, message);
        }
        
        // Messaging chain lazy
        this._chains && this._chains[status].signal.send(status, message);
    }
    
    /**
     * Create promised object
     * @access public
     * @return PromisedLazy
     */
    function lazy_promise() {
        return new PromisedLazy(this);
    }
    
    /**
     * Set progress callback
     * @access public
     * @param fucntion callback
     * @return this
     */
    function lazy_progress(callback) {
        this._progress = callback;
        return this;
    }
    
    // Lazy prototype implements ========================
    
    /**
     * Add parallel lazy instance list
     * @access public
     * @param Lazy lazy
     * @return this
     * @throws TypeError
     */
    function lazy_parallel_append(lazy) {
        if ( lazy && lazy._interface === 'Lazy' ) {
            lazy.setAppointID(this._appointID);
            this._lazy[this._lazy.length] = lazy;
            return this;
        }
        throw new Error('Argument must be Lazy instance!');
    }
        
    /**
     * Change status
     * @access public
     * @param Number status
     */
    function lazy_parallel_changeStatus(status, message, pipesCallback) {
        var flag     = true,
            idx      = -1,
            messages = [];
        
        // Guard already proceeded
        if ( this._proceeded ) {
            return;
        }
        
        if ( status === Lazy.SUCCESS ) {
            // Do callback if all green
            while ( this._lazy[++idx] ) {
                if ( isImpl(this._lazy[idx]))
                if ( getLazy(this._lazy[idx])._status != Lazy.SUCCESS ) {
                    flag = false;
                    break;
                }
                messages.push(this._lazy[idx].getMessage());
            }
        }
        else {
            flag = false;
            // Do callback if either failed flag is true
            while ( this._lazy[++idx] ) {
                if ( getLazy(this._lazy[idx])._status == Lazy[status] ) {
                    flag = true;
                }
                messages.push(this._lazy[idx].getMessage())
            }
        }
        
        // Execute callbacks if flag is true
        if ( flag === true ) {
             // Double guard
            this._proceeded = true;
            
            this._status  = status;
            this._message = messages;
            this._execute();
        }
    }
    
    /**
     * Lazy parallel process
     * @access private
     * @param int status
     * @param mixed message
     */
    function lazy_parallel_process(status, message) {
        // Remove stack ( self object reference )
        delete PARALLELS[this._appointID];
    }
    
})(typeof Module !== 'undefined' ? Module : this);
