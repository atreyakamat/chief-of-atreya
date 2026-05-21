const { expect } = require('chai');
const autoHealer = require('../modules/auto_healer');
const ai = require('../modules/ai');
const hitl = require('../modules/hitl');

describe('AutoHealer safety flows', () => {
    let originalAutoexec;
    let originalRunShell;
    let originalProcessCommand;
    let originalCreatePendingAction;

    beforeEach(() => {
        originalAutoexec = process.env.AUTO_HEALER_AUTOEXEC;
        originalRunShell = autoHealer.runShell;
        originalProcessCommand = ai.processCommand;
        originalCreatePendingAction = hitl.createPendingAction;
    });

    afterEach(() => {
        if (originalAutoexec === undefined) delete process.env.AUTO_HEALER_AUTOEXEC;
        else process.env.AUTO_HEALER_AUTOEXEC = originalAutoexec;
        autoHealer.runShell = originalRunShell;
        ai.processCommand = originalProcessCommand;
        hitl.createPendingAction = originalCreatePendingAction;
    });

    it('creates a pending action when autoexec is disabled', async () => {
        delete process.env.AUTO_HEALER_AUTOEXEC;
        let pendingArgs = null;
        let runShellCalled = false;

        hitl.createPendingAction = (actionType, payload) => {
            pendingArgs = { actionType, payload };
            return { id: 777, status: 'pending' };
        };
        autoHealer.runShell = async () => {
            runShellCalled = true;
            return 'should not run';
        };

        try {
            await autoHealer.executeWithHealing('Write-Output "safe"', 0);
            throw new Error('Expected execution to require approval');
        } catch (err) {
            expect(err.message).to.include('requires approval');
        }

        expect(runShellCalled).to.equal(false);
        expect(pendingArgs).to.deep.equal({
            actionType: 'auto_healer_execute',
            payload: { command: 'Write-Output "safe"' }
        });
    });

    it('executes approved commands when autoexec is enabled', async () => {
        process.env.AUTO_HEALER_AUTOEXEC = 'true';
        let pendingCalled = false;
        hitl.createPendingAction = () => {
            pendingCalled = true;
            return { id: 1 };
        };
        autoHealer.runShell = async (command) => `ok:${command}`;

        const result = await autoHealer.executeWithHealing('Write-Output "hello"', 0);
        expect(result).to.equal('ok:Write-Output "hello"');
        expect(pendingCalled).to.equal(false);
    });
});
