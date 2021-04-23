const consoleLogSpy = jest.spyOn(global.console, "log").mockImplementation(() => {});

const app = require('../server');
const request = require('supertest');

describe('Scrape Endpoints', () => {
    it('should return a 400 Error Code since no Repository URL was informed', async () => {
        const response = await request(app).post('/api/scrape').send(JSON.stringify({
            repository: null
        }));

        expect(response.statusCode).toEqual(400);
    });
});

app.close();
consoleLogSpy.mockRestore();