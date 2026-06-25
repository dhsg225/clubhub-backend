'use strict';
const AuthorityNamespace = require('./AuthorityNamespace');

class DomainRegistry {
  constructor() { this._domains = new Map(); }

  create(name, opts = {}) {
    if (this._domains.has(name)) throw new Error(`Domain '${name}' already registered`);
    const ns = new AuthorityNamespace(name, opts);
    this._domains.set(name, ns);
    return ns;
  }

  get(name)    { return this._domains.get(name); }
  getAll()     { return [...this._domains.values()]; }
  delete(name) { this._domains.delete(name); }
  has(name)    { return this._domains.has(name); }

  snapshot() {
    return Object.freeze({
      domain_count: this._domains.size,
      domains: this.getAll().map(d => d.snapshot()),
    });
  }
}

module.exports = { DomainRegistry, AuthorityNamespace };
