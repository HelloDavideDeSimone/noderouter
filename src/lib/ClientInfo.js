// @ts-nocheck
const assert = require('assert');

/**
 * This class is used to ensure that data retrieved from clients
 * are valid.
 */
class ClientInfo {
  /**
   *
   * @param {import('src/def/jsdoc').ClientInfoObj} info - Client info
   */
  constructor({
    isLocal,
    connType,
    srcHost,
    dstHost,
    dstPort,
    srcPath,
    dstPath,
    timeToLive,
    signature,
    _timeToLiveWait,
  }) {
    // Following assertion are needed to validate network data
    assert(
        !isLocal || typeof isLocal === 'boolean',
        'isLocal must be a boolean',
    );
    assert(typeof connType === 'number', 'connType must be a number');
    assert(srcHost && typeof srcHost === 'string', 'srcHost must be a string');
    assert(dstHost && typeof dstHost === 'string', 'dstHost must be a string');
    assert(dstPort && typeof dstPort === 'number', 'dstPort must be a number');
    assert(
        signature && typeof signature === 'string',
        'Signature must be a string',
    );
    assert(!srcPath || typeof srcPath === 'string', 'srcPath must be a string');
    assert(!dstPath || typeof dstPath === 'string', 'dstPath must be a string');
    assert(typeof timeToLive === 'number', 'timeToLive must be a number');

    this.isLocal = isLocal === true;
    this.connType = connType;
    this.srcHost = srcHost;
    this.dstHost = dstHost;
    this.dstPort = dstPort;
    this.srcPath = srcPath && dstPath ? srcPath : '(.*)';
    this.dstPath = srcPath && dstPath ? dstPath : '$1';
    this.timeToLive = timeToLive;
    this.signature = signature;
    this.timer = Date.now();
    this._timeToLiveWait=_timeToLiveWait;
  }

  refreshTimer() {
    this.timer = Date.now();
  }

  isExpired() {
    return (
      this.timeToLive > 0 &&
      this.timer + this.timeToLive + this._timeToLiveWait < Date.now()
    );
  }

  /**
   *
   * @param {string} url - source url
   * @returns {string} - destination url
   */
  getDestPathByUrl(url) {
    const r = new RegExp(this.srcPath);
    return url.replace(r, this.dstPath);
  }
}

module.exports = ClientInfo;
