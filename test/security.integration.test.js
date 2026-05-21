process.env.ADMIN_PASSWORD = 'test-admin-password';

const { expect } = require('chai');
const request = require('supertest');
const { app } = require('../index');
const hitl = require('../modules/hitl');
const db = require('../db');

describe('Security API integration', () => {
    it('creates a pending action and allows admin approval and audit retrieval', async () => {
        const action = hitl.createPendingAction('integration_test', { note: 'audit-flow' });

        const approveRes = await request(app)
            .post(`/api/pending-actions/${action.id}/approve`)
            .set('x-zen-admin', 'test-admin-password')
            .expect(200);

        expect(approveRes.body.success).to.equal(true);

        const auditRes = await request(app)
            .get('/api/audit?page=1&pageSize=20&eventType=pending_approved')
            .set('x-zen-admin', 'test-admin-password')
            .expect(200);

        expect(auditRes.body.rows).to.be.an('array');
        expect(auditRes.body.total).to.be.greaterThan(0);

        const approvedRow = db.prepare('SELECT status FROM pending_actions WHERE id = ?').get(action.id);
        expect(approvedRow.status).to.equal('approved');

        db.prepare('DELETE FROM pending_actions WHERE id = ?').run(action.id);
    });

    it('exports audit logs as CSV for admin requests', async () => {
        const res = await request(app)
            .get('/api/audit?export=csv&page=1&pageSize=5')
            .set('x-zen-admin', 'test-admin-password')
            .expect(200);

        expect(res.text).to.include('event_type');
        expect(res.headers['content-type']).to.include('text/csv');
    });
});
