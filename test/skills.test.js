const { expect } = require('chai');
const skills = require('../modules/skills');

describe('Skills Service', () => {
    it('should have default skills registered', () => {
        const registered = skills.getSkills().map(s => s.name);
        expect(registered).to.include('calculator');
        expect(registered).to.include('system_info');
    });

    it('should correctly execute the calculator skill', async () => {
        const result = await skills.executeSkill('calculator', '5 + 5');
        expect(result.success).to.be.true;
        expect(result.result).to.include('10');
    });

    it('should handle invalid input in calculator', async () => {
        const result = await skills.executeSkill('calculator', 'invalid + expression');
        expect(result.result).to.include('Calculation error');
    });

    it('should flag dangerous skills as needing confirmation', async () => {
        const result = await skills.executeSkill('run_command', 'ls');
        expect(result.needs_confirmation).to.be.true;
    });

    it('should execute dangerous skills if confirmed', async () => {
        const result = await skills.executeSkill('run_command', 'echo test', true);
        expect(result.success).to.be.true;
        expect(result.result.trim()).to.equal('test');
    });
});
