const axios = require('axios');

const Common = require('./CommonController.js');
const Scrape = require('../models/Scrape.js');

module.exports = {
    /**
     * Scrapes off a GitHub repository for its files and their statistic numbers
     * @param {string} repository GitHub repository URL
     * @param {object} response Route Response object used for the function's return
     * @returns An array of Scrape objects
     */
    async Scrape({ repository }, response) {
        if (!repository || typeof repository != "string") {
            return response.status(400).send("The Request body must consist of a JSON object containing a GitHub repository homepage domain e.g. { \"repository\": \"https://github.com/owner/repository\" } ");
        }

        if (!/(?:http[s]?:\/\/github.com\/)(.+\/.+)/g.test(repository)) {
            return response.status(400).send("The Request body must consist of a JSON object containing a GitHub repository homepage domain e.g. { \"repository\": \"https://github.com/owner/repository\" } ");
        }

        if (repository.match(/(?:http[s]?:\/\/github.com\/)(.+\/.+)([\s\S]+)/)[3]) {
            return response.status(400).send("The Request body must consist _only_ of a JSON object containing a GitHub repository homepage domain e.g. { \"repository\": \"https://github.com/owner/repository\" } ");
        }

        console.log("The scraping process is beginning...\r\n");

        global.scrapedReturn = [], global.lastQueuedRequests = [], global.fileURLs = {}, global.folderURLs = {};
        global.totalQueuedRequests = 1, global.totalTooManyRequests = 0, global.totalTimeoutErrors = 0, global.totalAddressInUseErrors = 0;
        global.totalConnectionResetErrors = 0, global.totalConnectionRefusedErrors = 0, global.totalSslErrors = 0, global.totalSockerErrors = 0;
        global.matches = repository.match(/(http[s]?:\/\/github.com)\/(.+)\/(.+)/);
        global.host = matches[1], global.owner = matches[2], global.repositoryName = matches[3];
        global.nonCapturedFolderURLs = [], global.nonCapturedFileURLs = [];

        await axios({
            method: "GET",
            url: repository
        }).then(function (urlResponse) {
            let originalResponse = urlResponse.data;
            let fileRegex = new RegExp('(?:<a[^>]*href=\\")(\\/' + owner + '\\/' + repositoryName + '\\/)(blob\\/[master|main][\\S]*)(\\"[^>]*>)(.*)(<\\/a>)');
            let folderRegex = new RegExp('(?:<a[^>]*href=\\")(\\/' + owner + '\\/' + repositoryName + '\\/)(tree\\/[master|main][\\S]*)(\\"[^>]*>)(.*)(<\\/a>)');
            let parentFolder = repository.split('/').reduce((acc, cur, idx, arr) => acc + (idx < arr.length - 1 ? '/' + cur : ''));

            while (fileRegex.test(originalResponse)) {
                let fileMatches = originalResponse.match(fileRegex);
                let matchedUrl = `${host}/${owner}/${repositoryName}/${fileMatches[2]}`;

                let extension = fileMatches[2].split('/');
                extension = extension[extension.length - 1].split('.');
                extension = extension[extension.length - 1];

                let index = -1;
                scrapedReturn.some((scrape, scrapeIndex) => {
                    if (scrape.extension == extension) {
                        index = scrapeIndex;
                        return true;
                    }
                });

                if (!scrapedReturn.length || index == -1) {
                    scrapedReturn.push(new Scrape(extension, 1, 0, 0));
                } else {
                    scrapedReturn[index].count += 1;
                }

                fileURLs[matchedUrl] = false;
                originalResponse = originalResponse.replace(fileMatches[0], '');
            }

            totalQueuedRequests--;
            console.log("Obtaining the repository's Folder URLs and File Totals now...\r\n");

            while (folderRegex.test(originalResponse)) {
                let folderMatches = originalResponse.match(folderRegex);
                let matchedUrl = `${host}/${owner}/${repositoryName}/${folderMatches[2]}`;

                if (matchedUrl != parentFolder && (!Object.keys(folderURLs).length || folderURLs[matchedUrl] === undefined)) {
                    totalQueuedRequests++;
                    folderURLs[matchedUrl] = false;
                    module.exports.RecursiveFolderRequest.call(global, matchedUrl);
                }

                originalResponse = originalResponse.replace(folderMatches[0], '');
            }

            let intervalFolders = setInterval(function () {
                if (totalQueuedRequests > 0) {
                    console.log(Common.FormatDateTime(new Date()) + " - Total Queued Folder Requests right now: " + totalQueuedRequests);

                    if (lastQueuedRequests.length <= 150 || lastQueuedRequests.slice(1, 151).reduce((acc, cur) => acc + cur) != lastQueuedRequests.splice(0, 1) * 150) {
                        lastQueuedRequests.push(totalQueuedRequests);
                        return;
                    } else {
                        console.log("\r\nBreaking the Folder async Requests process due to stuck execution\r\n");

                        Object.keys(folderURLs).forEach((folderURL) => {
                            if (!folderURLs[folderURL]) {
                                nonCapturedFolderURLs.push(folderURL);
                            }
                        });
                    }
                }

                clearInterval(intervalFolders);
                console.log("\r\nThe repository's Folder URLs and File Totals have been obtained\r\n");
                console.log("Obtaining the repository's File Line and Byte Totals now...\r\n");
                lastQueuedRequests = [];
                totalQueuedRequests = 0;

                Object.keys(fileURLs).forEach((fileURL) => {
                    totalQueuedRequests++;
                    module.exports.RecursiveFileRequest.call(global, fileURL);
                });

                let intervalFiles = setInterval(function () {
                    if (totalQueuedRequests > 0) {
                        console.log(Common.FormatDateTime(new Date()) + " - Total Queued File Requests right now: " + totalQueuedRequests);

                        if (lastQueuedRequests.length <= 200 || lastQueuedRequests.slice(1, 201).reduce((acc, cur) => acc + cur) != lastQueuedRequests.splice(0, 1) * 200) {
                            lastQueuedRequests.push(totalQueuedRequests);
                            return;
                        } else {
                            console.log("\r\nBreaking the File async Requests process due to stuck execution\r\n");

                            Object.keys(fileURLs).forEach((fileURL) => {
                                if (!fileURLs[fileURL]) {
                                    nonCapturedFileURLs.push(fileURL);
                                }
                            });
                        }
                    }

                    clearInterval(intervalFiles);
                    console.log("\r\nThe repository's File Line and Byte Totals have been obtained\r\n");
                    console.log(`A total of ${nonCapturedFolderURLs.length} Folder URLs failed to be captured, most likely due to execution getting stuck by the following errors`);
                    console.log(`A total of ${nonCapturedFileURLs.length} File URLs failed to be captured, most likely due to execution getting stuck by the following errors\r\n`);
                    console.log(`GitHub rejected a total of ${totalTooManyRequests} Requests with "429 - Too Many Requests" Http Error Responses during this execution`);
                    console.log(`There have been a total of ${totalTimeoutErrors} Time Out errors during this execution`);
                    console.log(`There have been a total of ${totalSslErrors} SSL errors during this execution`);
                    console.log(`There have been a total of ${totalConnectionResetErrors} Connection Reset errors during this execution`);
                    console.log(`There have been a total of ${totalConnectionRefusedErrors} Connection Refused errors during this execution`);
                    console.log(`There have been a total of ${totalAddressInUseErrors} Address Already in Use errors during this execution`);
                    console.log(`There have been a total of ${totalSockerErrors} Socket Errors during this execution\r\n`);

                    return response.status(200).send(scrapedReturn);
                }, 2000);
            }, 2000);
        }).catch(function (error) {
            console.log("The scraping process has been aborted\r\n");

            if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                return response.status(429).send(`GitHub has denied the very first Request sent from your external IP to it with a "429 - Too Many Requests" Http Error Response. Try this again later.`);
            } else if (error.response) {
                console.log(error.response.status + " - " + error.response.statusText);
                console.log(repository + "\r\n");
                return module.exports.Scrape(repository, response);
            } else {
                console.log(error + "\r\n");
                return module.exports.Scrape(repository, response);
            }
        });
    },

    /**
     * Recusively traverses a repository page to capture and count Folder and File URLs
     * @param {string} folderURL Folder URL to have its Folder and File URLs recusively captured and its File totals while at it
     * @returns The repository's Folder and File URLs
     */
    RecursiveFolderRequest(folderURL) {
        return axios({
            method: "GET",
            url: folderURL
        }).then(function (urlResponse) {
            let originalResponse = urlResponse.data;
            let fileRegex = new RegExp('(?:<a[^>]*href=\\")(\\/' + owner + '\\/' + repositoryName + '\\/)(blob\\/[master|main][\\S]*)(\\"[^>]*>)(.*)(<\\/a>)');
            let folderRegex = new RegExp('(?:<a[^>]*href=\\")(\\/' + owner + '\\/' + repositoryName + '\\/)(tree\\/[master|main][\\S]*)(\\"[^>]*>)(.*)(<\\/a>)');
            let parentFolder = folderURL.split('/').reduce((acc, cur, idx, arr) => acc + (idx < arr.length - 1 ? '/' + cur : ''));

            while (fileRegex.test(originalResponse)) {
                let fileMatches = originalResponse.match(fileRegex);
                let matchedUrl = `${host}/${owner}/${repositoryName}/${fileMatches[2]}`;

                let extension = fileMatches[2].split('/');
                extension = extension[extension.length - 1].split('.');
                extension = extension[extension.length - 1];

                let index = -1;
                scrapedReturn.some((scrape, scrapeIndex) => {
                    if (scrape.extension == extension) {
                        index = scrapeIndex;
                        return true;
                    }
                });

                if (!scrapedReturn.length || index == -1) {
                    scrapedReturn.push(new Scrape(extension, 1, 0, 0));
                } else {
                    scrapedReturn[index].count += 1;
                }

                if (!Object.keys(fileURLs).length || fileURLs[matchedUrl] === undefined) {
                    fileURLs[matchedUrl] = false;
                }
                
                originalResponse = originalResponse.replace(fileMatches[0], '');
            }

            while (folderRegex.test(originalResponse)) {
                let folderMatches = originalResponse.match(folderRegex);
                let matchedUrl = `${host}/${owner}/${repositoryName}/${folderMatches[2]}`;

                if (matchedUrl != parentFolder && (!Object.keys(folderURLs).length || folderURLs[matchedUrl] === undefined)) {
                    totalQueuedRequests++;
                    folderURLs[matchedUrl] = false;
                    module.exports.RecursiveFolderRequest.call(global, matchedUrl);
                }

                originalResponse = originalResponse.replace(folderMatches[0], '');
            }

            folderURLs[folderURL] = true;
            totalQueuedRequests--;
            return;
        }).catch(function (error) {
            if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                totalTooManyRequests++;
                error = undefined;
                return module.exports.RecursiveFolderRequest.call(global, folderURL);
            } else if (error.response) {
                console.log(error.response.status + " - " + error.response.statusText);
                console.log(folderURL + "\r\n");
                error = undefined;
                return module.exports.RecursiveFolderRequest.call(global, folderURL);
            } else {
                if (`${error}`.indexOf("ETIMEDOUT") > -1) {
                    totalTimeoutErrors++;
                } else if (`${error}`.indexOf("ECONNRESET") > -1) {
                    totalConnectionResetErrors++;
                } else if (`${error}`.indexOf("ECONNREFUSED") > -1) {
                    totalConnectionRefusedErrors++;
                } else if (`${error}`.indexOf("EADDRINUSE") > -1) {
                    totalAddressInUseErrors++;
                } else if (`${error}`.indexOf("ENOBUFS") > -1 || `${error}`.indexOf("socket hang up") > -1) {
                    totalSockerErrors++;
                } else if (`${error}`.indexOf("ssl3_get_record") > -1 || `${error}`.indexOf("ssl3_read_bytes") > -1) {
                    totalSslErrors++;
                } else {
                    console.log(error + "\r\n");
                }

                error = undefined;
                return module.exports.RecursiveFolderRequest.call(global, folderURL);
            }
        });
    },

    /**
     * Recursively traverses a repository page to capture and count File Line and Byte totals
     * @param {string} fileURL File URL to have its Line and Byte counts captured
     * @returns The repository's File Line and Byte totals
     */
    RecursiveFileRequest(fileURL) {
        return axios({
            method: "GET",
            url: fileURL
        }).then((fileResponse) => {
            originalResponse = fileResponse.data;
            let regex = new RegExp('([\\d]*)([\\slines\\s\\(]*)([\\d]*)([\\ssloc\\]*)[\\s\\S]*?)([\\d\\.]*\\s)(GB|MB|KB|Bytes)', 'i');
            let matches = originalResponse.match(regex);

            let extension = fileURL.split('/');
            extension = extension[extension.length - 1].split('.');
            extension = extension[extension.length - 1];

            let index = -1;
            scrapedReturn.some((scrape, scrapeIndex) => {
                if (scrape.extension == extension) {
                    index = scrapeIndex;
                    return true;
                }
            });

            if (regex.test(originalResponse)) {
                if (!matches) {
                    console.log(`The line count wasn't captured in the File URL: ${fileURL}\r\n`);
                } else if (matches[1]) {
                    scrapedReturn[index].lines += parseInt(matches[1]);
                }

                if (!matches) {
                    console.log(`The byte count wasn't captured in the File URL: ${fileURL}\r\n`);
                } else if (matches[5] && matches[6].match(/GB/i)) {
                    scrapedReturn[index].bytes += parseFloat((parseFloat(matches[5]) * 1024 * 1024 * 1024).toFixed(2));
                } else if (matches[5] && matches[6].match(/MB/i)) {
                    scrapedReturn[index].bytes += parseFloat((parseFloat(matches[5]) * 1024 * 1024).toFixed(2));
                } else if (matches[5] && matches[6].match(/KB/i)) {
                    scrapedReturn[index].bytes += parseFloat((parseFloat(matches[5]) * 1024).toFixed(2));
                } else if (matches[5] && matches[6].match(/Bytes/i)) {
                    scrapedReturn[index].bytes += parseFloat((parseInt(matches[5])).toFixed(2));
                }
            } else {
                console.log(`The information wasn't captured in the File URL: ${fileURL}\r\n`);
            }

            fileURLs[fileURL] = true;
            totalQueuedRequests--;
            return;
        }).catch((error) => {
            if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                totalTooManyRequests++;
                error = undefined;
                return module.exports.RecursiveFileRequest.call(global, fileURL);
            } else if (error.response) {
                console.log(error.response.status + " - " + error.response.statusText);
                console.log(fileURL + "\r\n");
                error = undefined;
                return module.exports.RecursiveFileRequest.call(global, fileURL);
            } else {
                if (`${error}`.indexOf("ETIMEDOUT") > -1) {
                    totalTimeoutErrors++;
                } else if (`${error}`.indexOf("ECONNRESET") > -1) {
                    totalConnectionResetErrors++;
                } else if (`${error}`.indexOf("ECONNREFUSED") > -1) {
                    totalConnectionRefusedErrors++;
                } else if (`${error}`.indexOf("EADDRINUSE") > -1) {
                    totalAddressInUseErrors++;
                } else if (`${error}`.indexOf("ENOBUFS") > -1 || `${error}`.indexOf("socket hang up") > -1) {
                    totalSockerErrors++;
                } else if (`${error}`.indexOf("ssl3_get_record") > -1 || `${error}`.indexOf("ssl3_read_bytes") > -1) {
                    totalSslErrors++;
                } else {
                    console.log(error + "\r\n");
                }

                error = undefined;
                return module.exports.RecursiveFileRequest.call(global, fileURL);
            }
        });
    }
}