const { expect } = require('chai');
const memory = require('../modules/memory');

describe('Memory Service', () => {
    it('should store and retrieve facts', () => {
        memory.setFact('test_key', 'test_value');
        const value = memory.getFact('test_key');
        expect(value).to.equal('test_value');
    });

    it('should return null for non-existent keys', () => {
        const value = memory.getFact('non_existent');
        expect(value).to.be.null;
    });

    it('should update existing keys', () => {
        memory.setFact('test_key', 'initial');
        memory.setFact('test_key', 'updated');
        expect(memory.getFact('test_key')).to.equal('updated');
    });

    it('should clear facts', () => {
        memory.setFact('clear_me', 'value');
        memory.clearFact('clear_me');
        expect(memory.getFact('clear_me')).to.be.null;
    });
});
