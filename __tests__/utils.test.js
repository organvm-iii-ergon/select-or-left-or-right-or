const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  AFFILIATIONS,
  NOTIFICATION_TYPES,
  extractHashtags,
  extractMentions,
} = require('../lib/utils.js');

describe('AFFILIATIONS', () => {
  it('contains 7 affiliations', () => {
    assert.equal(AFFILIATIONS.length, 7);
  });

  it('includes expected affiliations', () => {
    assert.ok(AFFILIATIONS.includes('Conservative'));
    assert.ok(AFFILIATIONS.includes('Liberal'));
    assert.ok(AFFILIATIONS.includes('Libertarian'));
    assert.ok(AFFILIATIONS.includes('Socialist'));
    assert.ok(AFFILIATIONS.includes('Centrist'));
    assert.ok(AFFILIATIONS.includes('Apolitical'));
  });

  it('has no duplicates', () => {
    const unique = new Set(AFFILIATIONS);
    assert.equal(unique.size, AFFILIATIONS.length);
  });
});

describe('NOTIFICATION_TYPES', () => {
  it('has all expected notification types', () => {
    assert.equal(NOTIFICATION_TYPES.LIKE, 'like');
    assert.equal(NOTIFICATION_TYPES.COMMENT, 'comment');
    assert.equal(NOTIFICATION_TYPES.FOLLOW, 'follow');
    assert.equal(NOTIFICATION_TYPES.MENTION, 'mention');
    assert.equal(NOTIFICATION_TYPES.REPOST, 'repost');
    assert.equal(NOTIFICATION_TYPES.MESSAGE, 'message');
  });

  it('has 6 types', () => {
    assert.equal(Object.keys(NOTIFICATION_TYPES).length, 6);
  });
});

describe('extractHashtags', () => {
  it('extracts single hashtag', () => {
    assert.deepEqual(extractHashtags('Hello #world'), ['world']);
  });

  it('extracts multiple hashtags', () => {
    assert.deepEqual(extractHashtags('#hello #world #test'), ['hello', 'world', 'test']);
  });

  it('lowercases hashtags', () => {
    assert.deepEqual(extractHashtags('#Hello #WORLD'), ['hello', 'world']);
  });

  it('returns empty array for no hashtags', () => {
    assert.deepEqual(extractHashtags('no hashtags here'), []);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(extractHashtags(''), []);
  });

  it('handles hashtags with numbers', () => {
    assert.deepEqual(extractHashtags('#test123'), ['test123']);
  });

  it('handles hashtags with underscores', () => {
    assert.deepEqual(extractHashtags('#hello_world'), ['hello_world']);
  });

  it('extracts hashtags from mixed content', () => {
    assert.deepEqual(extractHashtags('Check out #coding and @user for #tips'), ['coding', 'tips']);
  });

  it('ignores # without word after it', () => {
    assert.deepEqual(extractHashtags('just a # sign'), []);
  });
});

describe('extractMentions', () => {
  it('extracts single mention', () => {
    assert.deepEqual(extractMentions('Hello @user'), ['user']);
  });

  it('extracts multiple mentions', () => {
    assert.deepEqual(extractMentions('@alice and @bob'), ['alice', 'bob']);
  });

  it('preserves case', () => {
    assert.deepEqual(extractMentions('@Alice @BOB'), ['Alice', 'BOB']);
  });

  it('returns empty array for no mentions', () => {
    assert.deepEqual(extractMentions('no mentions here'), []);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(extractMentions(''), []);
  });

  it('handles mentions with numbers', () => {
    assert.deepEqual(extractMentions('@user123'), ['user123']);
  });

  it('handles mentions with underscores', () => {
    assert.deepEqual(extractMentions('@hello_world'), ['hello_world']);
  });

  it('extracts mentions from mixed content', () => {
    assert.deepEqual(extractMentions('Hey @admin check #this'), ['admin']);
  });

  it('ignores @ without word after it', () => {
    assert.deepEqual(extractMentions('email @ sign'), []);
  });
});
