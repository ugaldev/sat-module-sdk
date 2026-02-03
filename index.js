const { SatSession, AuthUtils } = require('./sat-session-sdk');
const { SatFactura, CfdiService, SelloService } = require('./sat-facturas-sdk');

class SatSDK {
    constructor(config = {}) {
        this.session = new SatSession(config);
        this.cfdi = CfdiService;
        this.facturas = new SatFactura({ ...config, cfdiService: this.cfdi });
        this.sello = new SelloService();
        this.utils = AuthUtils;
    }
}

module.exports = SatSDK;
