const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');

const Common = require('./controllers/CommonController.js');
const Scraper = require('./controllers/ScraperController.js');

const app = express();
const port = process.env.PORT || 8080;

app.disable("x-powered-by");
app.use(bodyParser.json());
app.use(cors());

app.get('/', (request, response) => {
    return response.json({ app: "GitHub Web Scraper", port: port, version: '1.0.0' });
});

app.post('/api/scrape', (request, response) => {
    return Scraper.Scrape(request.body, response);
});

app.listen(port, () => {
    console.log(Common.FormatDateTime(new Date()) + ' - The GitHub Scraper is running on port ' + port);
});

module.exports = app;