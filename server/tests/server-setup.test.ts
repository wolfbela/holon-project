import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../src/middleware/errorHandler';
import app from '../src/app';

describe('Server Setup', () => {
  describe('CORS', () => {
    describe('Allowed origin', () => {
      it('should include Access-Control-Allow-Origin for default origin', async () => {
        const res = await request(app)
          .get('/api/health')
          .set('Origin', 'http://localhost:3000');

        expect(res.headers['access-control-allow-origin']).toBe(
          'http://localhost:3000',
        );
      });

      it('should include Access-Control-Allow-Credentials header', async () => {
        const res = await request(app)
          .get('/api/health')
          .set('Origin', 'http://localhost:3000');

        expect(res.headers['access-control-allow-credentials']).toBe('true');
      });
    });

    describe('Static origin', () => {
      it('should always set Access-Control-Allow-Origin to configured origin', async () => {
        const res = await request(app)
          .get('/api/health')
          .set('Origin', 'http://malicious-site.com');

        // cors with a static string always returns that string;
        // browser-side enforcement blocks mismatched origins
        expect(res.headers['access-control-allow-origin']).toBe(
          'http://localhost:3000',
        );
      });
    });

    describe('Preflight requests', () => {
      it('should respond to OPTIONS preflight with CORS headers', async () => {
        const res = await request(app)
          .options('/api/health')
          .set('Origin', 'http://localhost:3000')
          .set('Access-Control-Request-Method', 'GET');

        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe(
          'http://localhost:3000',
        );
      });

      it('should allow credentials in preflight response', async () => {
        const res = await request(app)
          .options('/api/health')
          .set('Origin', 'http://localhost:3000')
          .set('Access-Control-Request-Method', 'POST');

        expect(res.headers['access-control-allow-credentials']).toBe('true');
      });
    });
  });

  describe('JSON body parser', () => {
    it('should parse JSON request bodies', async () => {
      const res = await request(app)
        .post('/api/health')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // The route doesn't exist for POST, but the parser should not fail
      expect(res.status).toBe(404);
    });

    it('should return 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/health')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('404 catch-all', () => {
    it('should return 404 with JSON for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    it('should return JSON content type for 404', async () => {
      const res = await request(app).get('/unknown-path');

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return 404 for root path', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    it('should return 404 for POST to unknown routes', async () => {
      const res = await request(app).post('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    it('should return 404 for PUT to unknown routes', async () => {
      const res = await request(app).put('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    it('should return 404 for DELETE to unknown routes', async () => {
      const res = await request(app).delete('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });

  describe('Error handling middleware', () => {
    let testApp: express.Express;

    beforeEach(() => {
      testApp = express();
      testApp.use(express.json());
    });

    it('should return 500 with JSON for unhandled errors', async () => {
      testApp.get('/error', () => {
        throw new Error('Test error');
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Test error');
    });

    it('should use custom statusCode from error object', async () => {
      testApp.get('/error', () => {
        const err = new Error('Bad request') as Error & {
          statusCode: number;
        };
        err.statusCode = 400;
        throw err;
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Bad request');
    });

    it('should return consistent JSON error shape', async () => {
      testApp.get('/error', () => {
        throw new Error('Something broke');
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('should not include stack trace when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      testApp.get('/error', () => {
        throw new Error('Prod error');
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.body).not.toHaveProperty('stack');
      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace when NODE_ENV is development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      testApp.get('/error', () => {
        throw new Error('Dev error');
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.body).toHaveProperty('stack');
      expect(typeof res.body.stack).toBe('string');
      process.env.NODE_ENV = originalEnv;
    });

    it('should default to "Internal server error" when error has no message', async () => {
      testApp.get('/error', () => {
        const err = new Error() as Error & { statusCode: number };
        err.message = '';
        err.statusCode = 500;
        throw err;
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });

    it('should handle errors passed via next()', async () => {
      testApp.get(
        '/error',
        (_req: Request, _res: Response, next: NextFunction) => {
          next(new Error('Async error'));
        },
      );
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Async error');
    });

    it('should handle errors with custom statusCode via next()', async () => {
      testApp.get(
        '/error',
        (_req: Request, _res: Response, next: NextFunction) => {
          const err = new Error('Not found') as Error & { statusCode: number };
          err.statusCode = 404;
          next(err);
        },
      );
      testApp.use(errorHandler);

      const res = await request(testApp).get('/error');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not found');
    });
  });
});
