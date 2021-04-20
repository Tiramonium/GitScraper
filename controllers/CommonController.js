const { response } = require("express");

module.exports = {
    /**
     * Formats a DateTime object into a string
     * @param {Date} date DateTime JavaScript object to be formatted
     * @returns A DateTime formatted into a string
     */
    FormatDateTime(date) {
        if (date && Object.prototype.toString.call(date) == '[object Date]') {
            var dateString = ('0' + date.getDate()).substr(-2, 2) + '/' + ('0' + (date.getMonth() + 1)).substr(-2, 2) + '/' + date.getFullYear() + ' ' + ('0' + date.getHours()).substr(-2, 2) + ':' + ('0' + date.getMinutes()).substr(-2, 2) + ':' + ('0' + date.getSeconds()).substr(-2, 2);
            return dateString;
        } else {
            return '';
        }
    },

    /**
     * Scrapes code off a HTML body string, returning only its contents for more trustworthy information capturing later on
     * @param {string} responseString Response HTML body to be scraped for content
     * @returns A string containing a scraped HTML body or an empty string if no valid Response string was informed
     */
    ScrapeHtmlJsCss(responseString) {
        if (responseString && typeof responseString == "string") {
            // Removes the HTML5 standard header
            responseString = responseString.replace("<!DOCTYPE html>", "");

            // Removes the HTML opening tag
            responseString = responseString.replace(/<html[^>]*>/g, "");

            // Removes the HTML closing tag
            responseString = responseString.replace(/<\/html>/g, "");

            // Removes the entire HEAD block
            responseString = responseString.replace(/(?:<head>)([\s\S]*?)(?:<\/head>)/g, "");

            // Removes entire SCRIPT blocks
            responseString = responseString.replace(/(?:<script[^>]*>)([\s\S]*?)(?:<\/script>)/g, "");

            // Removes entire STYLE blocks
            responseString = responseString.replace(/(?:<style[^>]*>)([\s\S]*?)(?:<\/style>)/g, "");

            let matches = responseString.match(/(?:<[^>]*>)([\s\S]*?)(?:<\/[^>]*>)/g);

            // Iteratively removes all opened and closed tags, keeping their inner content captured by the first matching group
            while (matches && matches.length >= 1) {
                responseString = responseString.replace(/(?:<[^>]*>)([\s\S]*?)(?:<\/[^>]*>)/g, "$1");
                matches = responseString.match(/(?:<[^>]*>)([\s\S]*?)(?:<\/[^>]*>)/g);
            }

            matches = responseString.match(/(?:<[^>]*>)([\s\S]*?)/g);

            // Iteratively removes all opened only tags, keeping their inner content captured by the first matching group
            while (matches && matches.length >= 1) {
                responseString = responseString.replace(/(?:<[^>]*>)([\s\S]*?)/g, "$1");
                matches = responseString.match(/(?:<[^>]*>)([\s\S]*?)/g);
            }

            return responseString;
        } else {
            return "";
        }
    }
}