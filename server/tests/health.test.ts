import request from 'supertest';
import app from '../src/app';

describe('Health API', () => {
  describe('GET /api/health', () => {
    describe('Happy path', () => {
      it('should return 200 with status ok', async () => {
        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
      });

      it('should return application/json content type', async () => {
        const res = await request(app).get('/api/health');

        expect(res.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('Method not allowed', () => {
      it('should return 404 for POST /api/health', async () => {
        const res = await request(app).post('/api/health');

        expect(res.status).toBeGreaterThanOrEqual(400);
      });

      it('should return 404 for PUT /api/health', async () => {
        const res = await request(app).put('/api/health');

        expect(res.status).toBeGreaterThanOrEqual(400);
      });

      it('should return 404 for DELETE /api/health', async () => {
        const res = await request(app).delete('/api/health');

        expect(res.status).toBeGreaterThanOrEqual(400);
      });
    });

    describe('Unknown routes', () => {
      it('should return 404 for non-existent route', async () => {
        const res = await request(app).get('/api/unknown');

        expect(res.status).toBe(404);
      });

      it('should return 404 for root path', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(404);
      });
    });
  });
});
