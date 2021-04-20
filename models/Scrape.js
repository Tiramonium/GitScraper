const IScrape = require('../interfaces/IScrape.js');

module.exports = class Scrape extends IScrape {
    constructor(extension, count, lines, bytes) {
        super(extension, count, lines, bytes);
    }

    get ext() {
        return this.extension;
    }

    set ext(ext) {
        this.extension = ext;
    }

    get ct() {
        return this.count;
    }

    set ct(ct) {
        this.count = ct;
    }

    get ln() {
        return this.lines;
    }

    set ln(ln) {
        this.lines = ln;
    }

    get bt() {
        return this.bytes;
    }

    set bt(bt) {
        this.bytes = bt;
    }
}