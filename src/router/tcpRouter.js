// @ts-ignore
require("../def/jsdoc");
const net = require("net");
const sniReader = require("../lib/sniReader");
const ClientInfo = require("../lib/ClientInfo");
const Router = require("../lib/Router");
const { TLS_ROUTER_PORT } = require("../def/const");

class TCPRouter extends Router {
  /**
   * Initialize the router
   * @param {number} localport
   * @param {import("./httpRouter")} httpsRouter
   * @instance
   * @param {import("dns").Resolver} dnsServer
   */
  constructor(localport, httpsRouter, dnsServer) {
    super(localport, "TCP");

    this.httpsRouter = httpsRouter;
    this.dnsServer = dnsServer;

    // TODO: replace with native tls module (sniReader can be removed then)
    var server = net.createServer(serverSocket => {
      sniReader(serverSocket, (err, sniName) => {
        if (err) {
          console.trace(err);
          serverSocket.end();
        } else if (sniName) {
          serverSocket.on("error", function(err) {
            console.error("Socket error: " + err);
            serverSocket.end();
          });
          this.initSession(serverSocket, sniName);
        } else {
          console.warn(serverSocket.remoteAddress, "(none)");
          serverSocket.end();
        }
      });
    });

    this.srvHandler = server.listen(this.localport);
    if (this.srvHandler)
      console.log("TCP Router listening on ", this.srvHandler.address());
  }

  initSession(serverSocket, sniName) {
    // if there's an HTTPS Proxy registered
    // on requested host, then process
    // it first.
    let httpsClients = this.httpsRouter.getClients(sniName);
    if (httpsClients && Object.keys(httpsClients).length) {
      this.createTunnel(
        serverSocket,
        sniName,
        this.httpsRouter.getRouterHost(),
        this.httpsRouter.getRouterPort()
      );

      return false;
    }

    const client = this.getFirstClient(sniName);

    console.error(client);

    if (!client) {
      this.dnsServer.resolve(sniName, (err, addresses) => {
        if (!err) {
          console.log("Resolving by remote DNS");
          this.createTunnel(
            serverSocket,
            sniName,
            addresses[0],
            TLS_ROUTER_PORT
          );
        } else {
          console.log(err);
        }
      });

      return false;
    }

    if (client.isExpired()) {
      console.log("Client expired! Unregistering...");
      this.unregister(client);
      this.createTunnel(serverSocket, sniName, sniName, TLS_ROUTER_PORT); // trying with external connection
      return false;
    }

    this.createTunnel(
      serverSocket,
      sniName,
      client.dstHost,
      client.dstPort,
      client
    );
    return true;
  }

  createTunnel(serverSocket, sniName, dstHost, dstPort, client = null) {
    if (sniName === dstHost && this.localport === dstPort) {
      // avoid infinite loops, try with DNS
      this.dnsServer.resolve(dstHost, (err, addresses) => {
        if (err) {
          console.trace(err);
          return;
        }

        this.createTunnel(serverSocket, sniName, addresses[0], dstPort, client);
      });

      return;
    }

    var clientSocket = net.connect({
      port: dstPort,
      host: dstHost
    });

    clientSocket.on("connect", function() {
      serverSocket.pipe(clientSocket).pipe(serverSocket);
      console.debug(
        serverSocket.remoteAddress,
        sniName,
        " TLS connected",
        dstHost,
        dstPort
      );
    });
    clientSocket.on("error", err => {
      if (client) this.unregister(client);
      console.error(sniName, "Client socket reported", err);
      serverSocket.end();
    });
    serverSocket.on("error", function(err) {
      console.error(
        serverSocket.remoteAddress,
        "Server socket reported",
        err.code
      );
      clientSocket.end();
    });

    return clientSocket;
  }

  /**
   * Get first client for a registered host
   * @param {string} srcHost
   * @returns {ClientInfo} - clients information
   */
  getFirstClient(srcHost) {
    if (!this.clients[srcHost]) return null;

    let keys = Object.keys(this.clients[srcHost]);
    return this.clients[srcHost][keys[0]];
  }
}

module.exports = TCPRouter;