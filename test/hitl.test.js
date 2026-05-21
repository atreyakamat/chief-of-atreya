const { expect } = require('chai');
const db = require('../db');
const hitl = require('../modules/hitl');

function cleanup(id) {
    db.prepare('DELETE FROM pending_actions WHERE id = ?').run(id);
    db.prepare('DELETE FROM audit_logs WHERE details LIKE ?').run(`%\"id\":${id}%`);
}

describe('HITL flow', () => {
    it('creates, approves, and rejects pending actions with audit logging', () => {
        const action = hitl.createPendingAction('test_action', { foo: 'bar' });
        expect(action).to.have.property('id');

        const fetched = hitl.getPendingAction(action.id);
        expect(fetched).to.have.property('action_type', 'test_action');
        expect(fetched.payload).to.deep.equal({ foo: 'bar' });

        hitl.approveAction(action.id);
        let row = db.prepare('SELECT status FROM pending_actions WHERE id = ?').get(action.id);
        expect(row.status).to.equal('approved');

        hitl.rejectAction(action.id);
        row = db.prepare('SELECT status FROM pending_actions WHERE id = ?').get(action.id);
        expect(row.status).to.equal('rejected');

        const audits = db.prepare('SELECT event_type, details FROM audit_logs WHERE details LIKE ?').all(`%\"id\":${action.id}%`);
        const eventTypes = audits.map(a => a.event_type);
        expect(eventTypes).to.include('pending_created');
        expect(eventTypes).to.include('pending_approved');
        expect(eventTypes).to.include('pending_rejected');

        cleanup(action.id);
    });
});
