const axios = require('axios');

const Common = require('./CommonController.js');
const Scrape = require('../models/Scrape.js');

module.exports = {
    /**
     * Scrapes off a GitHub repository for its used programming languages and their statistic numbers
     * @param {string} repository GitHub repository URL
     * @param {object} response Route Response object used for the function's return
     * @returns An array of ScrapeOutput objects
     */
    async Scrape({ repository }, response) {
        try {
            if (!repository || typeof repository != "string") {
                return response.status(400).send("The Request body must consist of a JSON object containing a GitHub repository homepage domain e.g. { \"repository\": \"https://github.com/owner/repository\" } ");
            }

            if (!/(?:http[s]?:\/\/github.com\/)(.+\/.+)/g.test(repository)) {
                return response.status(400).send("The Request body must consist of a JSON object containing a GitHub repository homepage domain e.g. { \"repository\": \"https://github.com/owner/repository\" } ");
            }

            if (repository.match(/(?:http[s]?:\/\/github.com\/)(.+\/.+)([\s\S]+)/)[3]) {
                return response.status(400).send("The Request body must consist _only_ of a JSON object containing a GitHub repository homepage domain e.g. { \"repository\": \"https://github.com/owner/repository\" } ");
            }

            console.log("The scraping process is beginning\r\n");

            let scrapedResponse, originalResponse, firstLanguage;
            let languages = [], filesUrls = [], filesExtensions = [], totalFiles = [], totalBytes = [], totalLines = [], scrapedReturn = [], lastQueuedRequests = [];
            let matches = repository.match(/(?:http[s]?:\/\/github.com\/)(.+)(\/)(.+)/);
            let totalQueuedRequests = 0, totalRetries = 0;
            let owner = matches[1];
            let projectName = matches[3];

            let firstLanguageLoop = true, firstLanguageFileCountLoop = true, languagesLoop = true;

            while (firstLanguageLoop) {
                await axios({
                    method: "GET",
                    url: repository
                }).then((projectResponse) => {
                    scrapedResponse = Common.ScrapeHtmlJsCss(projectResponse.data);
                    let regex = new RegExp('(?:Languages\\s*)([a-z\\s\\.#]*)(?:\\s*)', 'i');
                    let matches = scrapedResponse.match(regex);

                    if (regex.test(scrapedResponse)) {
                        firstLanguage = matches[1].trim();
                    } else {
                        if (/404/g.test(scrapedResponse)) {
                            throw "Are you sure that this is a GitHub repository that actually exists?";
                        } else {
                            throw "I'm sorry, but I couldn't find a Language name used by this repository";
                        }
                    }

                    firstLanguageLoop = false;
                }).catch((error) => {
                    if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                        totalRetries++;
                        console.log(`GitHub is denying the Requests sent to it. Retrying now. Retry #${totalRetries}`);
                        return;
                    } else {
                        throw error;
                    }
                });
            }

            console.log("The repository's languages are being obtained now\r\n");

            while (languagesLoop) {
                await axios({
                    method: "GET",
                    url: repository + `/search?l=${firstLanguage}`
                }).then((languageResponse) => {
                    scrapedResponse = Common.ScrapeHtmlJsCss(languageResponse.data);
                    let regex = new RegExp('([\\s\\S]*)(Languages\\s*)([\\d\\,\\s]*)([a-z\\. #]*)([\\s|\\n]*[\\w\\W]+Language)', 'i');

                    while (regex.test(scrapedResponse)) {
                        let matches = scrapedResponse.match(regex);

                        if (matches[4]) {
                            languages.push(matches[4]);
                            filesUrls.push([matches[4], []]);
                            filesExtensions.push([matches[4], ""]);
                            totalFiles.push([matches[4], parseInt(matches[3].replace(',', ''))]);
                            totalBytes.push([matches[4], 0]);
                            totalLines.push([matches[4], 0]);
                            scrapedReturn.push(new Scrape());
                            scrapedResponse = matches[1] + matches[2] + matches[5];
                        } else if (matches[3] && !matches[4]) {
                            scrapedResponse = matches[1] + matches[2] + matches[5];
                            continue;
                        } else {
                            break;
                        }
                    }

                    languagesLoop = false;

                    if (languages.length == 0) {
                        throw "I'm sorry, but I couldn't find the languages used by this repository";
                    }
                }).catch((error) => {
                    if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                        totalRetries++;
                        console.log(`GitHub is denying the Requests sent to it. Retrying now. Retry #${totalRetries}`);
                        return;
                    } else {
                        throw error;
                    }
                });
            }

            console.log(`The repository's languages have been obtained: ${JSON.stringify(languages)}\r\n`);

            filesUrls = Object.fromEntries(filesUrls);
            filesExtensions = Object.fromEntries(filesExtensions);
            totalFiles = Object.fromEntries(totalFiles);
            totalBytes = Object.fromEntries(totalBytes);
            totalLines = Object.fromEntries(totalLines);

            let languagesCopy = languages.map((value => value));
            languagesCopy.splice(languagesCopy.indexOf(firstLanguage), 1);

            while (firstLanguageFileCountLoop) {
                await axios({
                    method: "GET",
                    url: repository + `/search?l=${languagesCopy[0]}`
                }).then((languageResponse) => {
                    scrapedResponse = Common.ScrapeHtmlJsCss(languageResponse.data);
                    let regex = new RegExp('([\\s\\S]*)(Languages\\s*)([\\d\\,\\s]*)([a-z\\. #]*)([\\s|\\n]*[\\w\\W]+Language)', 'i');

                    while (regex.test(scrapedResponse)) {
                        let matches = scrapedResponse.match(regex);

                        if (matches[3] && matches[4] && !totalFiles[matches[4].trim()]) {
                            totalFiles[matches[4].trim()] = parseInt(matches[3].replace(',', ''));
                            scrapedResponse = matches[1] + matches[2] + matches[5];
                            break;
                        }

                        if (!matches[3] && !matches[4]) {
                            break;
                        } else {
                            scrapedResponse = matches[1] + matches[2] + matches[5];
                            continue;
                        }
                    }

                    firstLanguageFileCountLoop = false;
                }).catch((error) => {
                    if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                        totalRetries++;
                        console.log(`GitHub is denying the Requests sent to it. Retrying now. Retry #${totalRetries}`);
                        return;
                    } else {
                        throw error;
                    }
                });
            }

            console.log(`The repository's languages file totals have been obtained: ${JSON.stringify(totalFiles)}\r\n`);

            for (let language of languages) {
                console.log(`The repository's ${language} file URLs are being obtained now\r\n`);

                await axios({
                    method: "GET",
                    url: repository + `/search?l=${language}`
                }).then(async (languageResponse) => {
                    originalResponse = languageResponse.data;
                    let regex = new RegExp('(?:<a[^>]*href=\\")(\/' + owner + '\/' + projectName + '\/)([^search?][\\S]*)(\\"[^>]*>)(.*)(<\/a>)');
                    let regexNext = new RegExp('(<a[^>]*href=\\")(\/' + owner + '\/' + projectName + '\/[^\\"]*)(\\"[^>]*>)(Next)(<\/a>)', 'i');
                    let matches = originalResponse.match(regex);
                    let matchesNext = originalResponse.match(regexNext);

                    while (regex.test(originalResponse)) {
                        filesUrls[language].push(matches[2]);
                        originalResponse = originalResponse.replace(matches[0], "");
                        matches = originalResponse.match(regex);
                    }

                    while (regexNext.test(originalResponse)) {
                        await axios({
                            method: "GET",
                            url: "https://github.com" + matchesNext[2]
                        }).then((nextResponse) => {
                            originalResponse = nextResponse.data;
                            matches = originalResponse.match(regex);
                            matchesNext = originalResponse.match(regexNext);

                            while (regex.test(originalResponse)) {
                                filesUrls[language].push(matches[2]);
                                originalResponse = originalResponse.replace(matches[0], "");
                                matches = originalResponse.match(regex);
                            }
                        }).catch((error) => {
                            if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                                totalRetries++;
                                console.log(`GitHub is denying the Requests sent to it. Retrying now. Retry #${totalRetries}`);
                                return;
                            } else {
                                throw error;
                            }
                        });
                    }

                    console.log(`The repository's ${language} file URLs have been obtained\r\n`);
                }).catch((error) => {
                    if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                        totalRetries++;
                        console.log(`GitHub is denying the Requests sent to it. Retrying now. Retry #${totalRetries}`);
                        return;
                    } else {
                        throw error;
                    }
                });
            }

            console.log("The repository's languages file URLs have been obtained\r\n");

            languages.forEach((language, indexLanguage) => {
                let lastIndexLanguage;

                if (!lastIndexLanguage || lastIndexLanguage != indexLanguage) {
                    console.log(`Obtaining the Line and Byte totals from the repository's ${language} files now\r\n`);
                } else {
                    console.log(`Still obtaining the Line and Byte totals from the repository's ${language} files now\r\n`);
                }

                lastIndexLanguage = indexLanguage;

                filesUrls[language].forEach((fileUrl, indexUrl) => {
                    totalQueuedRequests++;

                    axios({
                        method: "GET",
                        url: repository + '/' + fileUrl
                    }).then((fileResponse) => {
                        originalResponse = fileResponse.data;
                        let regex = new RegExp('([\\d]*)(\\slines\\s\\()([\\d]*)(\\ssloc\\)[\\s\\S]*?)([\\d\\.]*\\s)(MB|KB|Bytes)', 'i');
                        let matches = originalResponse.match(regex);

                        if (regex.test(originalResponse)) {
                            if (matches[1]) {
                                totalLines[language] += parseInt(matches[1]);
                            } else {
                                console.log(`The line count wasn't captured in the file URL: ${repository + '/' + fileUrl}\r\n`)
                            }

                            if (matches[6] == "MB") {
                                totalBytes[language] += parseFloat(matches[5]) * 1024 * 1024;
                            } else if (matches[6] == "KB") {
                                totalBytes[language] += parseFloat(matches[5]) * 1024;
                            } else if (matches[6] == "Bytes") {
                                totalBytes[language] += parseInt(matches[5]);
                            } else {
                                console.log(`The size measure unit wasn't captured in the file URL: ${repository + '/' + fileUrl}\r\n`);
                            }
                        } else {
                            console.log(`The information wasn't captured in the file URL: ${repository + '/' + fileUrl}\r\n`);
                        }

                        totalQueuedRequests--;
                    }).catch((error) => {
                        if (error.response && error.response.status == 429 && /Too Many Requests/gi.test(error.response.statusText)) {
                            totalRetries++;
                            console.log(`GitHub is denying the Requests sent to it. Retrying now. Retry #${totalRetries}`);
                            totalQueuedRequests--;
                            console.log("language", language);
                            fileUrl = filesUrls[language][indexUrl - 1];
                            language = languages[indexLanguage - 1];
                            return;
                        } else if (error.response && (error.response.status == 404 || error.response.status == 429)) {
                            console.log(error.response.status + " - " + error.response.statusText + "\r\n");
                            totalQueuedRequests--;
                            console.log("language", language);
                            fileUrl = filesUrls[language][indexUrl - 1];
                            language = languages[indexLanguage - 1];
                            return;
                        } else {
                            console.log(error + "\r\n");
                            totalQueuedRequests--;
                            console.log("language", language);
                            fileUrl = filesUrls[language][indexUrl - 1];
                            language = languages[indexLanguage - 1];
                            return;
                        }
                    });
                });
            });

            let interval = setInterval(function () {
                if (totalQueuedRequests > 0) {
                    console.log("Total Queued Requests right now: " + totalQueuedRequests);

                    if (lastQueuedRequests.length < 30 || lastQueuedRequests.slice(-30).reduce((acc, cur) => acc + cur) != lastQueuedRequests.slice(-30, -29) * 30) {
                        lastQueuedRequests.push(totalQueuedRequests);
                        return;
                    } else {
                        console.log("Breaking the file Requests async processes due to stuck execution\r\n");
                    }
                }

                clearInterval(interval);
                console.log("The repository's languages Line and Byte totals have been obtained\r\n");

                languages.forEach((language, indexLanguage) => {
                    let extension = filesUrls[language][0].split('/');
                    extension = extension[extension.length - 1].split('.');
                    extension = extension[extension.length - 1];

                    scrapedReturn[indexLanguage].ext = extension;
                    scrapedReturn[indexLanguage].ct = totalFiles[language];
                    scrapedReturn[indexLanguage].ln = totalLines[language];
                    scrapedReturn[indexLanguage].bt = parseFloat(totalBytes[language].toFixed(2));
                });

                console.log("The scraping process has been concluded\r\n");

                return response.status(200).send(scrapedReturn);
            }, 2000);
        } catch (error) {
            console.error("There has been an error with the WebScraper\r\n");
            console.error(error.response);
            return response.status(500).send(error);
        }
    }
}